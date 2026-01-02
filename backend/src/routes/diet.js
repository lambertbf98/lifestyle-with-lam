const express = require('express');
const pool = require('../db/pool');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get user's diet plans
router.get('/plans', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT dp.*,
              (SELECT COUNT(*) FROM meals m WHERE m.diet_plan_id = dp.id) as meals_count
       FROM diet_plans dp
       WHERE dp.user_id = $1
       ORDER BY dp.is_active DESC, dp.created_at DESC`,
      [req.user.id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get diet plans error:', error);
    res.status(500).json({ error: 'Failed to get diet plans' });
  }
});

// Get active diet plan with meals
router.get('/plans/active', authenticateToken, async (req, res) => {
  try {
    const planResult = await pool.query(
      'SELECT * FROM diet_plans WHERE user_id = $1 AND is_active = TRUE LIMIT 1',
      [req.user.id]
    );

    if (planResult.rows.length === 0) {
      return res.json(null);
    }

    const plan = planResult.rows[0];

    // Get meals grouped by day
    const mealsResult = await pool.query(
      `SELECT * FROM meals WHERE diet_plan_id = $1 ORDER BY day_of_week,
       CASE meal_type
         WHEN 'breakfast' THEN 1
         WHEN 'lunch' THEN 2
         WHEN 'snack' THEN 3
         WHEN 'dinner' THEN 4
       END`,
      [plan.id]
    );

    plan.meals = mealsResult.rows;

    res.json(plan);
  } catch (error) {
    console.error('Get active diet plan error:', error);
    res.status(500).json({ error: 'Failed to get active diet plan' });
  }
});

// Get today's meals
router.get('/today', authenticateToken, async (req, res) => {
  const dayOfWeek = new Date().getDay();

  try {
    const planResult = await pool.query(
      'SELECT id FROM diet_plans WHERE user_id = $1 AND is_active = TRUE LIMIT 1',
      [req.user.id]
    );

    if (planResult.rows.length === 0) {
      return res.json({ meals: [], logged: [] });
    }

    // Get planned meals for today
    const mealsResult = await pool.query(
      `SELECT * FROM meals WHERE diet_plan_id = $1 AND day_of_week = $2
       ORDER BY CASE meal_type
         WHEN 'breakfast' THEN 1
         WHEN 'lunch' THEN 2
         WHEN 'snack' THEN 3
         WHEN 'dinner' THEN 4
       END`,
      [planResult.rows[0].id, dayOfWeek]
    );

    // Get logged meals for today
    const loggedResult = await pool.query(
      `SELECT * FROM meal_logs WHERE user_id = $1
       AND DATE(logged_at) = CURRENT_DATE
       ORDER BY logged_at`,
      [req.user.id]
    );

    res.json({
      meals: mealsResult.rows,
      logged: loggedResult.rows
    });
  } catch (error) {
    console.error('Get today meals error:', error);
    res.status(500).json({ error: 'Failed to get today\'s meals' });
  }
});

// Create diet plan
router.post('/plans', authenticateToken, async (req, res) => {
  const { name, daily_calories, protein_grams, carbs_grams, fat_grams, meals } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Plan name is required' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Deactivate other plans
    await client.query(
      'UPDATE diet_plans SET is_active = FALSE WHERE user_id = $1',
      [req.user.id]
    );

    // Create plan
    const planResult = await client.query(
      `INSERT INTO diet_plans
       (user_id, name, daily_calories, protein_grams, carbs_grams, fat_grams)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [req.user.id, name, daily_calories, protein_grams, carbs_grams, fat_grams]
    );

    const plan = planResult.rows[0];

    // Add meals if provided
    if (meals && meals.length > 0) {
      for (const meal of meals) {
        await client.query(
          `INSERT INTO meals
           (diet_plan_id, day_of_week, meal_type, name, description,
            calories, protein_grams, carbs_grams, fat_grams, ingredients, recipe)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            plan.id,
            meal.day_of_week,
            meal.meal_type,
            meal.name,
            meal.description,
            meal.calories,
            meal.protein_grams,
            meal.carbs_grams,
            meal.fat_grams,
            JSON.stringify(meal.ingredients || []),
            meal.recipe
          ]
        );
      }
    }

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Diet plan created successfully',
      plan
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create diet plan error:', error);
    res.status(500).json({ error: 'Failed to create diet plan' });
  } finally {
    client.release();
  }
});

// Log a meal
router.post('/log', authenticateToken, async (req, res) => {
  const { meal_id, meal_type, custom_meal_name, calories, protein_grams, carbs_grams, fat_grams, notes } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO meal_logs
       (user_id, meal_id, meal_type, custom_meal_name, calories, protein_grams, carbs_grams, fat_grams, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [req.user.id, meal_id, meal_type, custom_meal_name, calories, protein_grams, carbs_grams, fat_grams, notes]
    );

    res.status(201).json({
      message: 'Meal logged successfully',
      log: result.rows[0]
    });
  } catch (error) {
    console.error('Log meal error:', error);
    res.status(500).json({ error: 'Failed to log meal' });
  }
});

// Get nutrition summary for a date range
router.get('/summary', authenticateToken, async (req, res) => {
  const { start_date, end_date } = req.query;

  const startDate = start_date || new Date().toISOString().split('T')[0];
  const endDate = end_date || startDate;

  try {
    const result = await pool.query(
      `SELECT
         DATE(logged_at) as date,
         SUM(calories) as total_calories,
         SUM(protein_grams) as total_protein,
         SUM(carbs_grams) as total_carbs,
         SUM(fat_grams) as total_fat,
         COUNT(*) as meals_count
       FROM meal_logs
       WHERE user_id = $1
         AND DATE(logged_at) BETWEEN $2 AND $3
       GROUP BY DATE(logged_at)
       ORDER BY date`,
      [req.user.id, startDate, endDate]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get nutrition summary error:', error);
    res.status(500).json({ error: 'Failed to get nutrition summary' });
  }
});

// Delete meal log
router.delete('/log/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    await pool.query(
      'DELETE FROM meal_logs WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );

    res.json({ message: 'Meal log deleted successfully' });
  } catch (error) {
    console.error('Delete meal log error:', error);
    res.status(500).json({ error: 'Failed to delete meal log' });
  }
});

// Clear all today's meal logs
router.delete('/clear-today', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `DELETE FROM meal_logs
       WHERE user_id = $1
       AND DATE(logged_at) = CURRENT_DATE
       RETURNING id`,
      [req.user.id]
    );

    res.json({
      message: 'Today\'s meals cleared',
      deleted_count: result.rowCount
    });
  } catch (error) {
    console.error('Clear today meals error:', error);
    res.status(500).json({ error: 'Failed to clear today\'s meals' });
  }
});

module.exports = router;
