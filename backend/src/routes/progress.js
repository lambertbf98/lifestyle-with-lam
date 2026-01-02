const express = require('express');
const pool = require('../db/pool');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get comprehensive progress data
router.get('/', authenticateToken, async (req, res) => {
  const { period = '30' } = req.query;
  const daysBack = parseInt(period);

  try {
    // Weight progress
    const weightResult = await pool.query(
      `SELECT weight_kg, recorded_at
       FROM weight_history
       WHERE user_id = $1
       AND recorded_at >= CURRENT_DATE - INTERVAL '${daysBack} days'
       ORDER BY recorded_at`,
      [req.user.id]
    );

    // Workout frequency
    const workoutResult = await pool.query(
      `SELECT DATE(completed_at) as date, COUNT(*) as count
       FROM workout_logs
       WHERE user_id = $1
       AND completed_at IS NOT NULL
       AND completed_at >= CURRENT_DATE - INTERVAL '${daysBack} days'
       GROUP BY DATE(completed_at)
       ORDER BY date`,
      [req.user.id]
    );

    // Calories per day
    const caloriesResult = await pool.query(
      `SELECT DATE(logged_at) as date, SUM(calories) as total
       FROM meal_logs
       WHERE user_id = $1
       AND logged_at >= CURRENT_DATE - INTERVAL '${daysBack} days'
       GROUP BY DATE(logged_at)
       ORDER BY date`,
      [req.user.id]
    );

    // Get targets and initial weight from profile
    const profileResult = await pool.query(
      `SELECT up.current_weight_kg, up.target_weight_kg, up.initial_weight_kg, dp.daily_calories
       FROM user_profiles up
       LEFT JOIN diet_plans dp ON dp.user_id = up.user_id AND dp.is_active = TRUE
       WHERE up.user_id = $1`,
      [req.user.id]
    );

    const profile = profileResult.rows[0] || {};
    // Fallback: usar current_weight_kg si initial_weight_kg no existe
    const initialWeight = profile.initial_weight_kg || profile.current_weight_kg;

    res.json({
      weight: {
        history: weightResult.rows,
        current: profile.current_weight_kg,
        target: profile.target_weight_kg,
        initial: initialWeight
      },
      workouts: workoutResult.rows,
      calories: {
        history: caloriesResult.rows,
        target: profile.daily_calories
      }
    });
  } catch (error) {
    console.error('Get progress error:', error);
    res.status(500).json({ error: 'Failed to get progress data' });
  }
});

// Get achievements
router.get('/achievements', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM achievements WHERE user_id = $1 ORDER BY achieved_at DESC',
      [req.user.id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get achievements error:', error);
    res.status(500).json({ error: 'Failed to get achievements' });
  }
});

// Check and award achievements
router.post('/check-achievements', authenticateToken, async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const newAchievements = [];

    // Check for first workout achievement
    const firstWorkout = await client.query(
      `SELECT id FROM achievements WHERE user_id = $1 AND type = 'first_workout'`,
      [req.user.id]
    );

    if (firstWorkout.rows.length === 0) {
      const workoutCount = await client.query(
        'SELECT COUNT(*) FROM workout_logs WHERE user_id = $1 AND completed_at IS NOT NULL',
        [req.user.id]
      );

      if (parseInt(workoutCount.rows[0].count) >= 1) {
        await client.query(
          `INSERT INTO achievements (user_id, type, title, description)
           VALUES ($1, 'first_workout', 'First Workout Complete!', 'You completed your first workout. Keep it up!')`,
          [req.user.id]
        );
        newAchievements.push({ type: 'first_workout', title: 'First Workout Complete!' });
      }
    }

    // Check for 7-day streak
    const streakAchievement = await client.query(
      `SELECT id FROM achievements WHERE user_id = $1 AND type = 'week_streak'`,
      [req.user.id]
    );

    if (streakAchievement.rows.length === 0) {
      const weekWorkouts = await client.query(
        `SELECT COUNT(DISTINCT DATE(completed_at)) as days
         FROM workout_logs
         WHERE user_id = $1
         AND completed_at >= CURRENT_DATE - INTERVAL '7 days'`,
        [req.user.id]
      );

      if (parseInt(weekWorkouts.rows[0].days) >= 7) {
        await client.query(
          `INSERT INTO achievements (user_id, type, title, description)
           VALUES ($1, 'week_streak', '7-Day Warrior', 'You worked out every day for a week!')`,
          [req.user.id]
        );
        newAchievements.push({ type: 'week_streak', title: '7-Day Warrior' });
      }
    }

    // Check for 10 workouts
    const tenWorkouts = await client.query(
      `SELECT id FROM achievements WHERE user_id = $1 AND type = 'ten_workouts'`,
      [req.user.id]
    );

    if (tenWorkouts.rows.length === 0) {
      const totalWorkouts = await client.query(
        'SELECT COUNT(*) FROM workout_logs WHERE user_id = $1 AND completed_at IS NOT NULL',
        [req.user.id]
      );

      if (parseInt(totalWorkouts.rows[0].count) >= 10) {
        await client.query(
          `INSERT INTO achievements (user_id, type, title, description)
           VALUES ($1, 'ten_workouts', 'Getting Consistent', 'You completed 10 workouts!')`,
          [req.user.id]
        );
        newAchievements.push({ type: 'ten_workouts', title: 'Getting Consistent' });
      }
    }

    // Check for weight goal reached
    const weightGoal = await client.query(
      `SELECT id FROM achievements WHERE user_id = $1 AND type = 'weight_goal'`,
      [req.user.id]
    );

    if (weightGoal.rows.length === 0) {
      const profile = await client.query(
        'SELECT current_weight_kg, target_weight_kg, fitness_goal FROM user_profiles WHERE user_id = $1',
        [req.user.id]
      );

      if (profile.rows.length > 0) {
        const { current_weight_kg, target_weight_kg, fitness_goal } = profile.rows[0];

        if (current_weight_kg && target_weight_kg) {
          const goalReached =
            (fitness_goal === 'lose_weight' && parseFloat(current_weight_kg) <= parseFloat(target_weight_kg)) ||
            (fitness_goal === 'gain_muscle' && parseFloat(current_weight_kg) >= parseFloat(target_weight_kg));

          if (goalReached) {
            await client.query(
              `INSERT INTO achievements (user_id, type, title, description)
               VALUES ($1, 'weight_goal', 'Goal Reached!', 'You reached your target weight!')`,
              [req.user.id]
            );
            newAchievements.push({ type: 'weight_goal', title: 'Goal Reached!' });
          }
        }
      }
    }

    await client.query('COMMIT');

    res.json({ newAchievements });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Check achievements error:', error);
    res.status(500).json({ error: 'Failed to check achievements' });
  } finally {
    client.release();
  }
});

// Get weekly summary
router.get('/weekly-summary', authenticateToken, async (req, res) => {
  try {
    // This week's stats
    const workouts = await pool.query(
      `SELECT COUNT(*) as count, COALESCE(SUM(duration_minutes), 0) as total_minutes
       FROM workout_logs
       WHERE user_id = $1
       AND completed_at >= DATE_TRUNC('week', CURRENT_DATE)`,
      [req.user.id]
    );

    const meals = await pool.query(
      `SELECT
         COALESCE(AVG(calories), 0) as avg_calories,
         COALESCE(AVG(protein_grams), 0) as avg_protein
       FROM (
         SELECT DATE(logged_at), SUM(calories) as calories, SUM(protein_grams) as protein_grams
         FROM meal_logs
         WHERE user_id = $1
         AND logged_at >= DATE_TRUNC('week', CURRENT_DATE)
         GROUP BY DATE(logged_at)
       ) daily`,
      [req.user.id]
    );

    const weight = await pool.query(
      `SELECT
         (SELECT weight_kg FROM weight_history WHERE user_id = $1 ORDER BY recorded_at DESC LIMIT 1) as current,
         (SELECT weight_kg FROM weight_history WHERE user_id = $1 AND recorded_at < DATE_TRUNC('week', CURRENT_DATE) ORDER BY recorded_at DESC LIMIT 1) as start_of_week`,
      [req.user.id]
    );

    res.json({
      workouts: {
        count: parseInt(workouts.rows[0].count),
        totalMinutes: parseInt(workouts.rows[0].total_minutes)
      },
      nutrition: {
        avgCalories: Math.round(parseFloat(meals.rows[0].avg_calories) || 0),
        avgProtein: Math.round(parseFloat(meals.rows[0].avg_protein) || 0)
      },
      weight: {
        current: weight.rows[0].current,
        change: weight.rows[0].current && weight.rows[0].start_of_week
          ? (parseFloat(weight.rows[0].current) - parseFloat(weight.rows[0].start_of_week)).toFixed(1)
          : null
      }
    });
  } catch (error) {
    console.error('Get weekly summary error:', error);
    res.status(500).json({ error: 'Failed to get weekly summary' });
  }
});

module.exports = router;
