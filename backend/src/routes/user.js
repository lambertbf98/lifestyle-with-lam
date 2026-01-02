const express = require('express');
const pool = require('../db/pool');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get user profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.email, u.name, u.created_at,
              up.height_cm, up.current_weight_kg, up.target_weight_kg,
              up.birth_date, up.gender, up.activity_level, up.fitness_goal,
              up.workout_days_per_week, up.dietary_restrictions,
              up.preferred_proteins, up.preferred_carbs, up.preferred_fats,
              up.meals_per_day, up.onboarding_completed
       FROM users u
       LEFT JOIN user_profiles up ON u.id = up.user_id
       WHERE u.id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

// Update user profile (onboarding)
router.put('/profile', authenticateToken, async (req, res) => {
  const {
    height_cm,
    current_weight_kg,
    target_weight_kg,
    birth_date,
    gender,
    activity_level,
    fitness_goal,
    workout_days_per_week,
    dietary_restrictions,
    preferred_proteins,
    preferred_carbs,
    preferred_fats,
    meals_per_day
  } = req.body;

  try {
    const result = await pool.query(
      `UPDATE user_profiles SET
        height_cm = COALESCE($1, height_cm),
        current_weight_kg = COALESCE($2, current_weight_kg),
        target_weight_kg = COALESCE($3, target_weight_kg),
        birth_date = COALESCE($4, birth_date),
        gender = COALESCE($5, gender),
        activity_level = COALESCE($6, activity_level),
        fitness_goal = COALESCE($7, fitness_goal),
        workout_days_per_week = COALESCE($8, workout_days_per_week),
        dietary_restrictions = COALESCE($9, dietary_restrictions),
        preferred_proteins = COALESCE($10, preferred_proteins),
        preferred_carbs = COALESCE($11, preferred_carbs),
        preferred_fats = COALESCE($12, preferred_fats),
        meals_per_day = COALESCE($13, meals_per_day),
        updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $14
       RETURNING *`,
      [
        height_cm,
        current_weight_kg,
        target_weight_kg,
        birth_date,
        gender,
        activity_level,
        fitness_goal,
        workout_days_per_week,
        dietary_restrictions,
        preferred_proteins,
        preferred_carbs,
        preferred_fats,
        meals_per_day,
        req.user.id
      ]
    );

    // If weight was updated, add to weight history
    if (current_weight_kg) {
      await pool.query(
        'INSERT INTO weight_history (user_id, weight_kg) VALUES ($1, $2)',
        [req.user.id, current_weight_kg]
      );
    }

    res.json({
      message: 'Profile updated successfully',
      profile: result.rows[0]
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Complete onboarding
router.post('/complete-onboarding', authenticateToken, async (req, res) => {
  try {
    await pool.query(
      'UPDATE user_profiles SET onboarding_completed = TRUE, updated_at = CURRENT_TIMESTAMP WHERE user_id = $1',
      [req.user.id]
    );

    res.json({ message: 'Onboarding completed successfully' });
  } catch (error) {
    console.error('Complete onboarding error:', error);
    res.status(500).json({ error: 'Failed to complete onboarding' });
  }
});

// Get weight history
router.get('/weight-history', authenticateToken, async (req, res) => {
  const { limit = 30 } = req.query;

  try {
    const result = await pool.query(
      `SELECT id, weight_kg, recorded_at, notes
       FROM weight_history
       WHERE user_id = $1
       ORDER BY recorded_at DESC
       LIMIT $2`,
      [req.user.id, limit]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get weight history error:', error);
    res.status(500).json({ error: 'Failed to get weight history' });
  }
});

// Add weight entry
router.post('/weight', authenticateToken, async (req, res) => {
  const { weight_kg, notes } = req.body;

  if (!weight_kg) {
    return res.status(400).json({ error: 'Weight is required' });
  }

  try {
    // Add to history
    const result = await pool.query(
      'INSERT INTO weight_history (user_id, weight_kg, notes) VALUES ($1, $2, $3) RETURNING *',
      [req.user.id, weight_kg, notes]
    );

    // Update current weight in profile
    await pool.query(
      'UPDATE user_profiles SET current_weight_kg = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2',
      [weight_kg, req.user.id]
    );

    res.status(201).json({
      message: 'Weight logged successfully',
      entry: result.rows[0]
    });
  } catch (error) {
    console.error('Add weight error:', error);
    res.status(500).json({ error: 'Failed to log weight' });
  }
});

// Get dashboard stats
router.get('/dashboard', authenticateToken, async (req, res) => {
  try {
    // Get profile data
    const profileResult = await pool.query(
      `SELECT current_weight_kg, target_weight_kg, fitness_goal
       FROM user_profiles WHERE user_id = $1`,
      [req.user.id]
    );

    // Get this week's workouts
    const workoutsResult = await pool.query(
      `SELECT COUNT(*) as workouts_this_week
       FROM workout_logs
       WHERE user_id = $1
       AND completed_at >= DATE_TRUNC('week', CURRENT_DATE)`,
      [req.user.id]
    );

    // Get weight change (last 7 days)
    const weightChangeResult = await pool.query(
      `WITH recent AS (
         SELECT weight_kg FROM weight_history
         WHERE user_id = $1 ORDER BY recorded_at DESC LIMIT 1
       ),
       week_ago AS (
         SELECT weight_kg FROM weight_history
         WHERE user_id = $1 AND recorded_at <= CURRENT_DATE - INTERVAL '7 days'
         ORDER BY recorded_at DESC LIMIT 1
       )
       SELECT
         (SELECT weight_kg FROM recent) as current_weight,
         (SELECT weight_kg FROM week_ago) as week_ago_weight`,
      [req.user.id]
    );

    // Get streak
    const streakResult = await pool.query(
      `WITH dates AS (
         SELECT DISTINCT DATE(completed_at) as workout_date
         FROM workout_logs
         WHERE user_id = $1 AND completed_at IS NOT NULL
         ORDER BY workout_date DESC
       )
       SELECT COUNT(*) as streak
       FROM dates
       WHERE workout_date >= CURRENT_DATE - (SELECT COUNT(*) FROM dates WHERE workout_date <= CURRENT_DATE)::INTEGER`,
      [req.user.id]
    );

    const profile = profileResult.rows[0] || {};
    const weightData = weightChangeResult.rows[0] || {};

    res.json({
      currentWeight: profile.current_weight_kg,
      targetWeight: profile.target_weight_kg,
      fitnessGoal: profile.fitness_goal,
      workoutsThisWeek: parseInt(workoutsResult.rows[0]?.workouts_this_week || 0),
      weightChange: weightData.current_weight && weightData.week_ago_weight
        ? (parseFloat(weightData.current_weight) - parseFloat(weightData.week_ago_weight)).toFixed(1)
        : null,
      streak: parseInt(streakResult.rows[0]?.streak || 0)
    });
  } catch (error) {
    console.error('Get dashboard error:', error);
    res.status(500).json({ error: 'Failed to get dashboard data' });
  }
});

module.exports = router;
