const pool = require('./pool');
const { seedExercises } = require('./seed');

const initDatabase = async () => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // User profile (fitness data)
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_profiles (
        id SERIAL PRIMARY KEY,
        user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        height_cm DECIMAL(5,2),
        current_weight_kg DECIMAL(5,2),
        target_weight_kg DECIMAL(5,2),
        birth_date DATE,
        gender VARCHAR(20),
        activity_level VARCHAR(50),
        fitness_goal VARCHAR(50),
        workout_days_per_week INTEGER DEFAULT 3,
        dietary_restrictions TEXT[],
        preferred_proteins TEXT[],
        preferred_carbs TEXT[],
        preferred_fats TEXT[],
        meals_per_day INTEGER DEFAULT 5,
        chest_cm DECIMAL(5,2),
        waist_cm DECIMAL(5,2),
        hips_cm DECIMAL(5,2),
        bicep_cm DECIMAL(5,2),
        thigh_cm DECIMAL(5,2),
        calf_cm DECIMAL(5,2),
        onboarding_completed BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Add body measurement columns if they don't exist (for existing databases)
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS chest_cm DECIMAL(5,2);
        ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS waist_cm DECIMAL(5,2);
        ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS hips_cm DECIMAL(5,2);
        ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS bicep_cm DECIMAL(5,2);
        ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS thigh_cm DECIMAL(5,2);
        ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS calf_cm DECIMAL(5,2);
        ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS disliked_foods TEXT[];
        ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS initial_weight_kg DECIMAL(5,2);
      EXCEPTION WHEN OTHERS THEN NULL;
      END $$;
    `);

    // Weight history for tracking progress
    await client.query(`
      CREATE TABLE IF NOT EXISTS weight_history (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        weight_kg DECIMAL(5,2) NOT NULL,
        recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        notes TEXT
      )
    `);

    // Body measurements history
    await client.query(`
      CREATE TABLE IF NOT EXISTS body_measurements (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        chest_cm DECIMAL(5,2),
        waist_cm DECIMAL(5,2),
        hips_cm DECIMAL(5,2),
        bicep_cm DECIMAL(5,2),
        thigh_cm DECIMAL(5,2),
        calf_cm DECIMAL(5,2),
        recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        notes TEXT
      )
    `);

    // Exercises library
    await client.query(`
      CREATE TABLE IF NOT EXISTS exercises (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        name_es VARCHAR(255),
        muscle_group VARCHAR(100) NOT NULL,
        secondary_muscles TEXT[],
        equipment VARCHAR(100),
        difficulty VARCHAR(50),
        instructions TEXT,
        gif_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Workout plans
    await client.query(`
      CREATE TABLE IF NOT EXISTS workout_plans (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        week_number INTEGER DEFAULT 1,
        is_active BOOLEAN DEFAULT TRUE,
        ai_generated BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Workout days (within a plan)
    await client.query(`
      CREATE TABLE IF NOT EXISTS workout_days (
        id SERIAL PRIMARY KEY,
        plan_id INTEGER REFERENCES workout_plans(id) ON DELETE CASCADE,
        day_of_week INTEGER NOT NULL,
        name VARCHAR(100),
        focus_area VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Workout exercises (exercises within a day)
    await client.query(`
      CREATE TABLE IF NOT EXISTS workout_exercises (
        id SERIAL PRIMARY KEY,
        workout_day_id INTEGER REFERENCES workout_days(id) ON DELETE CASCADE,
        exercise_id INTEGER REFERENCES exercises(id),
        sets INTEGER DEFAULT 3,
        reps VARCHAR(50) DEFAULT '10-12',
        rest_seconds INTEGER DEFAULT 60,
        notes TEXT,
        order_index INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Completed workouts log
    await client.query(`
      CREATE TABLE IF NOT EXISTS workout_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        workout_day_id INTEGER REFERENCES workout_days(id),
        started_at TIMESTAMP,
        completed_at TIMESTAMP,
        duration_minutes INTEGER,
        notes TEXT,
        rating INTEGER CHECK (rating >= 1 AND rating <= 5),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Exercise logs (individual exercise performance)
    await client.query(`
      CREATE TABLE IF NOT EXISTS exercise_logs (
        id SERIAL PRIMARY KEY,
        workout_log_id INTEGER REFERENCES workout_logs(id) ON DELETE CASCADE,
        exercise_id INTEGER REFERENCES exercises(id),
        sets_completed INTEGER,
        reps_per_set TEXT,
        weight_kg DECIMAL(5,2),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Diet plans
    await client.query(`
      CREATE TABLE IF NOT EXISTS diet_plans (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        daily_calories INTEGER,
        protein_grams INTEGER,
        carbs_grams INTEGER,
        fat_grams INTEGER,
        week_number INTEGER DEFAULT 1,
        is_active BOOLEAN DEFAULT TRUE,
        ai_generated BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Meals within a diet plan
    await client.query(`
      CREATE TABLE IF NOT EXISTS meals (
        id SERIAL PRIMARY KEY,
        diet_plan_id INTEGER REFERENCES diet_plans(id) ON DELETE CASCADE,
        day_of_week INTEGER,
        meal_type VARCHAR(50) NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        calories INTEGER,
        protein_grams DECIMAL(5,2),
        carbs_grams DECIMAL(5,2),
        fat_grams DECIMAL(5,2),
        ingredients JSONB,
        recipe TEXT,
        image_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Meal logs (what user actually ate)
    await client.query(`
      CREATE TABLE IF NOT EXISTS meal_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        meal_id INTEGER REFERENCES meals(id),
        meal_type VARCHAR(50),
        custom_meal_name VARCHAR(255),
        calories INTEGER,
        protein_grams DECIMAL(5,2),
        carbs_grams DECIMAL(5,2),
        fat_grams DECIMAL(5,2),
        logged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        notes TEXT
      )
    `);

    // AI coaching conversations
    await client.query(`
      CREATE TABLE IF NOT EXISTS coach_conversations (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        context VARCHAR(50),
        messages JSONB DEFAULT '[]',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // User achievements/milestones
    await client.query(`
      CREATE TABLE IF NOT EXISTS achievements (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(100) NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        achieved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query('COMMIT');
    console.log('Database tables initialized successfully');

    // Ensure body_measurements table exists (for existing databases)
    await client.query(`
      CREATE TABLE IF NOT EXISTS body_measurements (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        chest_cm DECIMAL(5,2),
        waist_cm DECIMAL(5,2),
        hips_cm DECIMAL(5,2),
        bicep_cm DECIMAL(5,2),
        thigh_cm DECIMAL(5,2),
        calf_cm DECIMAL(5,2),
        recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        notes TEXT
      )
    `);

    // Seed exercises if table is empty
    await seedExercises();
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

module.exports = { initDatabase };
