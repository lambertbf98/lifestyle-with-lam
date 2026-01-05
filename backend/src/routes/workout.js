const express = require('express');
const pool = require('../db/pool');
const { authenticateToken } = require('../middleware/auth');
const { forceUpdateAllGifs, seedExercises } = require('../db/seed');

const router = express.Router();

// Helper: Remove accents from string for accent-insensitive search
const removeAccents = (str) => {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
};

// Mapping of generic search terms to muscle groups
const muscleGroupAliases = {
  'pierna': ['Cuádriceps', 'Isquiotibiales', 'Glúteos', 'Pantorrillas', 'Aductores'],
  'piernas': ['Cuádriceps', 'Isquiotibiales', 'Glúteos', 'Pantorrillas', 'Aductores'],
  'brazo': ['Bíceps', 'Tríceps', 'Antebrazos'],
  'brazos': ['Bíceps', 'Tríceps', 'Antebrazos'],
  'abdomen': ['Abdominales', 'Oblicuos', 'Core'],
  'abs': ['Abdominales', 'Oblicuos', 'Core'],
  'core': ['Abdominales', 'Oblicuos', 'Core'],
  'tren superior': ['Pecho', 'Espalda', 'Hombros', 'Bíceps', 'Tríceps'],
  'tren inferior': ['Cuádriceps', 'Isquiotibiales', 'Glúteos', 'Pantorrillas'],
  'pecho': ['Pecho'],
  'espalda': ['Espalda'],
  'hombro': ['Hombros'],
  'hombros': ['Hombros'],
  'biceps': ['Bíceps'],
  'bicep': ['Bíceps'],
  'triceps': ['Tríceps'],
  'tricep': ['Tríceps'],
  'cuadriceps': ['Cuádriceps'],
  'cuadricep': ['Cuádriceps'],
  'cuads': ['Cuádriceps'],
  'isquios': ['Isquiotibiales'],
  'isquiotibiales': ['Isquiotibiales'],
  'femoral': ['Isquiotibiales'],
  'gluteo': ['Glúteos'],
  'gluteos': ['Glúteos'],
  'pantorrilla': ['Pantorrillas'],
  'pantorrillas': ['Pantorrillas'],
  'gemelo': ['Pantorrillas'],
  'gemelos': ['Pantorrillas'],
  'abdominal': ['Abdominales'],
  'abdominales': ['Abdominales'],
  'trapecio': ['Trapecios'],
  'trapecios': ['Trapecios']
};

// Get all exercises
router.get('/exercises', authenticateToken, async (req, res) => {
  const { muscle_group, search, equipment } = req.query;

  try {
    let query = 'SELECT * FROM exercises WHERE 1=1';
    const params = [];
    let paramCount = 0;

    if (muscle_group) {
      paramCount++;
      query += ` AND muscle_group = $${paramCount}`;
      params.push(muscle_group);
    }

    if (equipment) {
      paramCount++;
      query += ` AND equipment = $${paramCount}`;
      params.push(equipment);
    }

    if (search) {
      const searchLower = removeAccents(search.trim());

      // Check if search matches a muscle group alias
      const matchedGroups = muscleGroupAliases[searchLower];

      if (matchedGroups && matchedGroups.length > 0) {
        // Search by muscle groups
        const placeholders = matchedGroups.map((_, i) => `$${paramCount + i + 1}`).join(', ');
        query += ` AND muscle_group IN (${placeholders})`;
        params.push(...matchedGroups);
        paramCount += matchedGroups.length;
      } else {
        // Search by name (with accent-insensitive matching)
        paramCount++;
        query += ` AND (
          name ILIKE $${paramCount} OR
          name_es ILIKE $${paramCount} OR
          muscle_group ILIKE $${paramCount} OR
          LOWER(TRANSLATE(name, 'áéíóúÁÉÍÓÚñÑ', 'aeiouAEIOUnN')) LIKE LOWER($${paramCount}) OR
          LOWER(TRANSLATE(name_es, 'áéíóúÁÉÍÓÚñÑ', 'aeiouAEIOUnN')) LIKE LOWER($${paramCount}) OR
          LOWER(TRANSLATE(muscle_group, 'áéíóúÁÉÍÓÚñÑ', 'aeiouAEIOUnN')) LIKE LOWER($${paramCount})
        )`;
        params.push(`%${search}%`);
      }
    }

    query += ' ORDER BY muscle_group, name_es';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get exercises error:', error);
    res.status(500).json({ error: 'Failed to get exercises' });
  }
});

// Get muscle groups
router.get('/muscle-groups', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT DISTINCT muscle_group FROM exercises ORDER BY muscle_group'
    );
    res.json(result.rows.map(r => r.muscle_group));
  } catch (error) {
    console.error('Get muscle groups error:', error);
    res.status(500).json({ error: 'Failed to get muscle groups' });
  }
});

// Get user's workout plans
router.get('/plans', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT wp.*,
              (SELECT COUNT(*) FROM workout_days wd WHERE wd.plan_id = wp.id) as days_count
       FROM workout_plans wp
       WHERE wp.user_id = $1
       ORDER BY wp.is_active DESC, wp.created_at DESC`,
      [req.user.id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get plans error:', error);
    res.status(500).json({ error: 'Failed to get workout plans' });
  }
});

// Get active workout plan with full details
router.get('/plans/active', authenticateToken, async (req, res) => {
  try {
    const planResult = await pool.query(
      'SELECT * FROM workout_plans WHERE user_id = $1 AND is_active = TRUE LIMIT 1',
      [req.user.id]
    );

    if (planResult.rows.length === 0) {
      return res.json(null);
    }

    const plan = planResult.rows[0];

    // Get days with exercises
    const daysResult = await pool.query(
      `SELECT wd.*,
              json_agg(
                json_build_object(
                  'id', we.id,
                  'exercise_id', we.exercise_id,
                  'sets', we.sets,
                  'reps', we.reps,
                  'rest_seconds', we.rest_seconds,
                  'notes', we.notes,
                  'order_index', we.order_index,
                  'exercise', json_build_object(
                    'id', e.id,
                    'name', e.name,
                    'name_es', e.name_es,
                    'muscle_group', e.muscle_group,
                    'equipment', e.equipment,
                    'gif_url', e.gif_url,
                    'instructions', e.instructions
                  )
                ) ORDER BY we.order_index
              ) FILTER (WHERE we.id IS NOT NULL) as exercises
       FROM workout_days wd
       LEFT JOIN workout_exercises we ON wd.id = we.workout_day_id
       LEFT JOIN exercises e ON we.exercise_id = e.id
       WHERE wd.plan_id = $1
       GROUP BY wd.id
       ORDER BY wd.day_of_week`,
      [plan.id]
    );

    plan.days = daysResult.rows;

    res.json(plan);
  } catch (error) {
    console.error('Get active plan error:', error);
    res.status(500).json({ error: 'Failed to get active workout plan' });
  }
});

// Create new workout plan
router.post('/plans', authenticateToken, async (req, res) => {
  const { name, description, days } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Plan name is required' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Deactivate other plans
    await client.query(
      'UPDATE workout_plans SET is_active = FALSE WHERE user_id = $1',
      [req.user.id]
    );

    // Create plan
    const planResult = await client.query(
      'INSERT INTO workout_plans (user_id, name, description) VALUES ($1, $2, $3) RETURNING *',
      [req.user.id, name, description]
    );

    const plan = planResult.rows[0];

    // Add days if provided
    if (days && days.length > 0) {
      for (const day of days) {
        const dayResult = await client.query(
          'INSERT INTO workout_days (plan_id, day_of_week, name, focus_area) VALUES ($1, $2, $3, $4) RETURNING id',
          [plan.id, day.day_of_week, day.name, day.focus_area]
        );

        // Add exercises to day
        if (day.exercises && day.exercises.length > 0) {
          for (let i = 0; i < day.exercises.length; i++) {
            const exercise = day.exercises[i];
            await client.query(
              `INSERT INTO workout_exercises
               (workout_day_id, exercise_id, sets, reps, rest_seconds, notes, order_index)
               VALUES ($1, $2, $3, $4, $5, $6, $7)`,
              [
                dayResult.rows[0].id,
                exercise.exercise_id,
                exercise.sets || 3,
                exercise.reps || '10-12',
                exercise.rest_seconds || 60,
                exercise.notes,
                i
              ]
            );
          }
        }
      }
    }

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Workout plan created successfully',
      plan
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create plan error:', error);
    res.status(500).json({ error: 'Failed to create workout plan' });
  } finally {
    client.release();
  }
});

// Start a workout
router.post('/start', authenticateToken, async (req, res) => {
  const { workout_day_id } = req.body;

  if (!workout_day_id) {
    return res.status(400).json({ error: 'Workout day ID is required' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO workout_logs (user_id, workout_day_id, started_at) VALUES ($1, $2, CURRENT_TIMESTAMP) RETURNING *',
      [req.user.id, workout_day_id]
    );

    res.status(201).json({
      message: 'Workout started',
      log: result.rows[0]
    });
  } catch (error) {
    console.error('Start workout error:', error);
    res.status(500).json({ error: 'Failed to start workout' });
  }
});

// Complete a workout
router.post('/complete', authenticateToken, async (req, res) => {
  const { workout_log_id, duration_minutes, notes, rating, exercises } = req.body;

  if (!workout_log_id) {
    return res.status(400).json({ error: 'Workout log ID is required' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Update workout log
    await client.query(
      `UPDATE workout_logs SET
        completed_at = CURRENT_TIMESTAMP,
        duration_minutes = $1,
        notes = $2,
        rating = $3
       WHERE id = $4 AND user_id = $5`,
      [duration_minutes, notes, rating, workout_log_id, req.user.id]
    );

    // Log individual exercises
    if (exercises && exercises.length > 0) {
      for (const exercise of exercises) {
        await client.query(
          `INSERT INTO exercise_logs
           (workout_log_id, exercise_id, sets_completed, reps_per_set, weight_kg, notes)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            workout_log_id,
            exercise.exercise_id,
            exercise.sets_completed,
            exercise.reps_per_set,
            exercise.weight_kg,
            exercise.notes
          ]
        );
      }
    }

    await client.query('COMMIT');

    res.json({ message: 'Workout completed successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Complete workout error:', error);
    res.status(500).json({ error: 'Failed to complete workout' });
  } finally {
    client.release();
  }
});

// Get workout history
router.get('/history', authenticateToken, async (req, res) => {
  const { limit = 20, offset = 0 } = req.query;

  try {
    const result = await pool.query(
      `SELECT wl.*, wd.name as workout_name, wd.focus_area,
              wp.name as plan_name
       FROM workout_logs wl
       LEFT JOIN workout_days wd ON wl.workout_day_id = wd.id
       LEFT JOIN workout_plans wp ON wd.plan_id = wp.id
       WHERE wl.user_id = $1 AND wl.completed_at IS NOT NULL
       ORDER BY wl.completed_at DESC
       LIMIT $2 OFFSET $3`,
      [req.user.id, limit, offset]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get workout history error:', error);
    res.status(500).json({ error: 'Failed to get workout history' });
  }
});

// Replace exercise in workout (manual selection)
router.put('/exercise/:workoutExerciseId', authenticateToken, async (req, res) => {
  const { workoutExerciseId } = req.params;
  const { exercise_id } = req.body;

  if (!exercise_id) {
    return res.status(400).json({ error: 'Exercise ID is required' });
  }

  try {
    // Verify the workout exercise belongs to the user
    const verifyResult = await pool.query(
      `SELECT we.id FROM workout_exercises we
       JOIN workout_days wd ON we.workout_day_id = wd.id
       JOIN workout_plans wp ON wd.plan_id = wp.id
       WHERE we.id = $1 AND wp.user_id = $2`,
      [workoutExerciseId, req.user.id]
    );

    if (verifyResult.rows.length === 0) {
      return res.status(404).json({ error: 'Workout exercise not found' });
    }

    // Update the exercise
    await pool.query(
      'UPDATE workout_exercises SET exercise_id = $1 WHERE id = $2',
      [exercise_id, workoutExerciseId]
    );

    // Get the new exercise data
    const exerciseResult = await pool.query(
      'SELECT * FROM exercises WHERE id = $1',
      [exercise_id]
    );

    res.json({
      success: true,
      exercise: exerciseResult.rows[0]
    });
  } catch (error) {
    console.error('Replace exercise error:', error);
    res.status(500).json({ error: 'Failed to replace exercise' });
  }
});

// Force update all exercise GIFs
router.post('/update-gifs', authenticateToken, async (req, res) => {
  try {
    const result = await forceUpdateAllGifs();
    res.json(result);
  } catch (error) {
    console.error('Update GIFs error:', error);
    res.status(500).json({ error: 'Failed to update GIFs' });
  }
});

// Seed exercises - add new exercises and update GIFs
router.post('/seed-exercises', async (req, res) => {
  try {
    console.log('Manual seed triggered via API');
    await seedExercises();

    // Get final count
    const result = await pool.query('SELECT COUNT(*) as total FROM exercises');
    const byGroup = await pool.query(
      'SELECT muscle_group, COUNT(*) as count FROM exercises GROUP BY muscle_group ORDER BY muscle_group'
    );

    res.json({
      success: true,
      total: parseInt(result.rows[0].total),
      byMuscleGroup: byGroup.rows
    });
  } catch (error) {
    console.error('Seed exercises error:', error);
    res.status(500).json({ error: 'Failed to seed exercises', details: error.message });
  }
});

// Debug endpoint - check exercises and their GIFs
router.get('/debug-exercises', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, name_es, muscle_group, gif_url
       FROM exercises
       ORDER BY name_es`
    );

    // Check for specific exercises
    const prensa = result.rows.find(e => e.name_es?.toLowerCase().includes('prensa de pierna'));
    const elevaciones = result.rows.find(e => e.name_es?.toLowerCase().includes('elevaciones laterales'));
    const sentadilla = result.rows.find(e => e.name_es?.toLowerCase().includes('sentadilla con barra'));

    res.json({
      total: result.rows.length,
      specificExercises: {
        prensaDePiernas: prensa || 'NOT FOUND',
        elevacionesLaterales: elevaciones || 'NOT FOUND',
        sentadillaConBarra: sentadilla || 'NOT FOUND'
      },
      allExercises: result.rows
    });
  } catch (error) {
    console.error('Debug exercises error:', error);
    res.status(500).json({ error: 'Failed to get debug info' });
  }
});

// Clear workout history (for testing)
router.delete('/clear-history', authenticateToken, async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Delete exercise logs first (due to foreign key)
    await client.query(
      `DELETE FROM exercise_logs WHERE workout_log_id IN
       (SELECT id FROM workout_logs WHERE user_id = $1)`,
      [req.user.id]
    );

    // Delete workout logs
    await client.query(
      'DELETE FROM workout_logs WHERE user_id = $1',
      [req.user.id]
    );

    await client.query('COMMIT');

    res.json({ message: 'Workout history cleared successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Clear workout history error:', error);
    res.status(500).json({ error: 'Failed to clear workout history' });
  } finally {
    client.release();
  }
});

module.exports = router;
