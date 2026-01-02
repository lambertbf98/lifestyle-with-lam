const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const pool = require('../db/pool');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

// Helper function to calculate age from birth_date
const calculateAge = (birthDate) => {
  if (!birthDate) return 30; // Default if not provided
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
};

// Calculate BMR using Mifflin-St Jeor equation (more accurate than Harris-Benedict)
const calculateBMR = (weight, height, age, gender) => {
  if (gender === 'male' || gender === 'hombre') {
    return (10 * weight) + (6.25 * height) - (5 * age) + 5;
  } else {
    return (10 * weight) + (6.25 * height) - (5 * age) - 161;
  }
};

// Calculate TDEE (Total Daily Energy Expenditure)
const calculateTDEE = (bmr, activityLevel) => {
  const multipliers = {
    'sedentary': 1.2,        // Little or no exercise
    'sedentario': 1.2,
    'light': 1.375,          // Light exercise 1-3 days/week
    'ligero': 1.375,
    'moderate': 1.55,        // Moderate exercise 3-5 days/week
    'moderado': 1.55,
    'active': 1.725,         // Hard exercise 6-7 days/week
    'activo': 1.725,
    'very_active': 1.9,      // Very hard exercise, physical job
    'muy_activo': 1.9
  };
  return bmr * (multipliers[activityLevel] || 1.55);
};

// Calculate macros based on goal
const calculateMacros = (tdee, goal, weight) => {
  let calories = tdee;
  let proteinPerKg = 1.6; // Default protein

  switch (goal) {
    case 'lose_weight':
    case 'perder_peso':
      calories = tdee - 500; // 500 cal deficit for ~0.5kg/week loss
      proteinPerKg = 2.0; // Higher protein to preserve muscle
      break;
    case 'gain_muscle':
    case 'ganar_musculo':
      calories = tdee + 300; // Slight surplus for muscle gain
      proteinPerKg = 2.2; // Higher protein for muscle synthesis
      break;
    case 'maintain':
    case 'mantener':
    default:
      proteinPerKg = 1.8;
      break;
  }

  const protein = Math.round(weight * proteinPerKg);
  const fat = Math.round((calories * 0.25) / 9); // 25% of calories from fat
  const carbs = Math.round((calories - (protein * 4) - (fat * 9)) / 4); // Rest from carbs

  return {
    calories: Math.round(calories),
    protein,
    carbs,
    fat
  };
};

// System prompt for the AI coach
const getCoachSystemPrompt = (profile, nutritionInfo) => `Eres un entrenador personal profesional y nutricionista certificado llamado "Coach Lam". Tu objetivo es ayudar a tu cliente a alcanzar sus metas de fitness y nutrición.

INFORMACIÓN DEL CLIENTE:
- Nombre: ${profile.name || 'Usuario'}
- Peso actual: ${profile.current_weight_kg || 'No especificado'} kg
- Peso objetivo: ${profile.target_weight_kg || 'No especificado'} kg
- Altura: ${profile.height_cm || 'No especificada'} cm
- Edad: ${calculateAge(profile.birth_date)} años
- Género: ${profile.gender || 'No especificado'}
- Objetivo: ${profile.fitness_goal || 'No especificado'}
- Nivel de actividad: ${profile.activity_level || 'No especificado'}
- Días de entrenamiento por semana: ${profile.workout_days_per_week || 3}
- Restricciones dietéticas: ${profile.dietary_restrictions?.join(', ') || 'Ninguna'}
- Comidas por día preferidas: ${profile.meals_per_day || 4}

DATOS NUTRICIONALES CALCULADOS:
- TMB (Tasa Metabólica Basal): ${nutritionInfo.bmr} kcal
- TDEE (Gasto Energético Total): ${nutritionInfo.tdee} kcal
- Calorías objetivo diarias: ${nutritionInfo.calories} kcal
- Proteínas objetivo: ${nutritionInfo.protein}g
- Carbohidratos objetivo: ${nutritionInfo.carbs}g
- Grasas objetivo: ${nutritionInfo.fat}g

INSTRUCCIONES:
1. Sé motivador pero realista
2. Da consejos basados en evidencia científica
3. Personaliza tus respuestas según el perfil del cliente
4. Responde en español
5. Sé conciso pero informativo
6. USA LOS DATOS NUTRICIONALES CALCULADOS - son precisos basados en la ecuación Mifflin-St Jeor
7. Si te piden un plan de entrenamiento, sugiere usar el botón "Generar Plan" en la app
8. Si te piden un plan de dieta, sugiere usar el botón "Generar Dieta" en la app
9. Celebra los logros y motiva cuando hay dificultades`;

// Chat with AI coach
router.post('/chat', authenticateToken, async (req, res) => {
  const { message, context = 'general' } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  try {
    // Get user profile
    const profileResult = await pool.query(
      `SELECT up.*, u.name FROM user_profiles up
       JOIN users u ON up.user_id = u.id
       WHERE up.user_id = $1`,
      [req.user.id]
    );

    const profile = profileResult.rows[0] || {};

    // Calculate nutrition info
    const age = calculateAge(profile.birth_date);
    const bmr = calculateBMR(
      profile.current_weight_kg || 70,
      profile.height_cm || 170,
      age,
      profile.gender
    );
    const tdee = calculateTDEE(bmr, profile.activity_level);
    const macros = calculateMacros(tdee, profile.fitness_goal, profile.current_weight_kg || 70);

    const nutritionInfo = {
      bmr: Math.round(bmr),
      tdee: Math.round(tdee),
      ...macros
    };

    // Get or create conversation
    let conversationResult = await pool.query(
      `SELECT id, messages FROM coach_conversations
       WHERE user_id = $1 AND context = $2
       ORDER BY updated_at DESC LIMIT 1`,
      [req.user.id, context]
    );

    let conversationId;
    let previousMessages = [];

    if (conversationResult.rows.length > 0) {
      conversationId = conversationResult.rows[0].id;
      previousMessages = conversationResult.rows[0].messages || [];
    } else {
      const newConversation = await pool.query(
        `INSERT INTO coach_conversations (user_id, context, messages)
         VALUES ($1, $2, '[]') RETURNING id`,
        [req.user.id, context]
      );
      conversationId = newConversation.rows[0].id;
    }

    // Keep only last 10 messages for context
    const recentMessages = previousMessages.slice(-10);

    // Build messages for Claude
    const messages = [
      ...recentMessages.map(m => ({
        role: m.role,
        content: m.content
      })),
      { role: 'user', content: message }
    ];

    // Call Claude Haiku
    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1024,
      system: getCoachSystemPrompt(profile, nutritionInfo),
      messages
    });

    const assistantMessage = response.content[0].text;

    // Save conversation
    const updatedMessages = [
      ...previousMessages,
      { role: 'user', content: message, timestamp: new Date().toISOString() },
      { role: 'assistant', content: assistantMessage, timestamp: new Date().toISOString() }
    ].slice(-20); // Keep last 20 messages

    await pool.query(
      `UPDATE coach_conversations
       SET messages = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [JSON.stringify(updatedMessages), conversationId]
    );

    res.json({
      message: assistantMessage,
      conversationId,
      nutritionInfo
    });
  } catch (error) {
    console.error('AI Coach error:', error);
    res.status(500).json({ error: 'Failed to get response from coach' });
  }
});

// Generate AND SAVE workout plan with AI
router.post('/generate-workout', authenticateToken, async (req, res) => {
  const { focus, days_per_week, equipment_available } = req.body;

  const client = await pool.connect();

  try {
    // Get user profile
    const profileResult = await pool.query(
      `SELECT * FROM user_profiles WHERE user_id = $1`,
      [req.user.id]
    );
    const profile = profileResult.rows[0] || {};

    // Get ALL available exercises from database
    const exercisesResult = await pool.query(
      `SELECT id, name, name_es, muscle_group, equipment, difficulty, gif_url, instructions
       FROM exercises ORDER BY muscle_group, name`
    );
    const availableExercises = exercisesResult.rows;

    // Create a map for quick lookup
    const exerciseMap = {};
    availableExercises.forEach(ex => {
      exerciseMap[ex.name.toLowerCase()] = ex;
      if (ex.name_es) {
        exerciseMap[ex.name_es.toLowerCase()] = ex;
      }
    });

    // Create exercise list grouped by muscle
    const exercisesByMuscle = {};
    availableExercises.forEach(ex => {
      if (!exercisesByMuscle[ex.muscle_group]) {
        exercisesByMuscle[ex.muscle_group] = [];
      }
      exercisesByMuscle[ex.muscle_group].push(ex.name);
    });

    const exerciseListText = Object.entries(exercisesByMuscle)
      .map(([muscle, exercises]) => `${muscle}: ${exercises.join(', ')}`)
      .join('\n');

    const daysCount = days_per_week || profile.workout_days_per_week || 3;
    const userGoal = focus || profile.fitness_goal || 'general';

    const prompt = `Genera un plan de entrenamiento semanal profesional con las siguientes características:
- Días por semana: ${daysCount}
- Objetivo: ${userGoal}
- Equipamiento disponible: ${equipment_available || 'gimnasio completo'}
- Nivel: ${profile.activity_level || 'intermedio'}

IMPORTANTE: SOLO puedes usar ejercicios de esta lista (usa los nombres EXACTOS):
${exerciseListText}

Responde SOLO con un JSON válido con esta estructura exacta:
{
  "name": "Nombre del plan (ej: Plan de Hipertrofia 3 Días)",
  "description": "Descripción breve del objetivo del plan",
  "days": [
    {
      "day_of_week": 1,
      "name": "Día 1 - Pecho y Tríceps",
      "focus_area": "Pecho",
      "exercises": [
        {
          "name": "Press de Banca",
          "sets": 4,
          "reps": "8-10",
          "rest_seconds": 90,
          "notes": "Controla la bajada 2-3 segundos"
        }
      ]
    }
  ]
}

REGLAS:
1. Incluye 4-6 ejercicios por día
2. Alterna grupos musculares en días consecutivos
3. Incluye ejercicios compuestos primero, aislamiento después
4. Ajusta series y repeticiones al objetivo (fuerza: 4-6 reps, hipertrofia: 8-12 reps, resistencia: 15-20 reps)
5. Los días deben numerarse del 1 al ${daysCount}`;

    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 3000,
      system: 'Eres un entrenador personal certificado NSCA. Responde ÚNICAMENTE con JSON válido, sin texto adicional. Usa SOLO los ejercicios de la lista proporcionada.',
      messages: [{ role: 'user', content: prompt }]
    });

    const jsonResponse = response.content[0].text;

    // Parse the JSON
    let workoutPlan;
    try {
      workoutPlan = JSON.parse(jsonResponse);
    } catch (parseError) {
      const jsonMatch = jsonResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        workoutPlan = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Invalid JSON response from AI');
      }
    }

    // NOW SAVE THE PLAN TO DATABASE
    await client.query('BEGIN');

    // Deactivate other workout plans
    await client.query(
      'UPDATE workout_plans SET is_active = FALSE WHERE user_id = $1',
      [req.user.id]
    );

    // Create the workout plan
    const planResult = await client.query(
      `INSERT INTO workout_plans (user_id, name, description, ai_generated, is_active)
       VALUES ($1, $2, $3, TRUE, TRUE) RETURNING *`,
      [req.user.id, workoutPlan.name, workoutPlan.description]
    );
    const savedPlan = planResult.rows[0];

    // Create days and exercises
    for (const day of workoutPlan.days) {
      const dayResult = await client.query(
        `INSERT INTO workout_days (plan_id, day_of_week, name, focus_area)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [savedPlan.id, day.day_of_week, day.name, day.focus_area]
      );
      const dayId = dayResult.rows[0].id;

      // Add exercises
      for (let i = 0; i < day.exercises.length; i++) {
        const exercise = day.exercises[i];

        // Find the exercise ID from our database
        const exerciseData = exerciseMap[exercise.name.toLowerCase()];

        if (exerciseData) {
          await client.query(
            `INSERT INTO workout_exercises
             (workout_day_id, exercise_id, sets, reps, rest_seconds, notes, order_index)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              dayId,
              exerciseData.id,
              exercise.sets || 3,
              exercise.reps || '10-12',
              exercise.rest_seconds || 60,
              exercise.notes || '',
              i
            ]
          );
        }
      }
    }

    await client.query('COMMIT');

    // Return the full saved plan with exercises
    const fullPlanResult = await pool.query(
      `SELECT wp.*,
              json_agg(
                json_build_object(
                  'id', wd.id,
                  'day_of_week', wd.day_of_week,
                  'name', wd.name,
                  'focus_area', wd.focus_area
                ) ORDER BY wd.day_of_week
              ) as days
       FROM workout_plans wp
       LEFT JOIN workout_days wd ON wp.id = wd.plan_id
       WHERE wp.id = $1
       GROUP BY wp.id`,
      [savedPlan.id]
    );

    res.json({
      success: true,
      message: 'Plan de entrenamiento generado y guardado correctamente',
      plan: fullPlanResult.rows[0]
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Generate workout error:', error);
    res.status(500).json({ error: 'Failed to generate workout plan', details: error.message });
  } finally {
    client.release();
  }
});

// Generate AND SAVE diet plan with AI
router.post('/generate-diet', authenticateToken, async (req, res) => {
  const { meals_per_day, dietary_preferences } = req.body;

  const client = await pool.connect();

  try {
    // Get user profile
    const profileResult = await pool.query(
      `SELECT * FROM user_profiles WHERE user_id = $1`,
      [req.user.id]
    );
    const profile = profileResult.rows[0] || {};

    // Calculate precise nutrition requirements
    const age = calculateAge(profile.birth_date);
    const weight = profile.current_weight_kg || 70;
    const height = profile.height_cm || 170;

    const bmr = calculateBMR(weight, height, age, profile.gender);
    const tdee = calculateTDEE(bmr, profile.activity_level);
    const macros = calculateMacros(tdee, profile.fitness_goal, weight);

    const mealsCount = meals_per_day || profile.meals_per_day || 4;

    const prompt = `Genera un plan de dieta diario COMPLETO y PROFESIONAL con las siguientes características:

REQUERIMIENTOS NUTRICIONALES (calculados científicamente):
- Calorías diarias: ${macros.calories} kcal
- Proteínas: ${macros.protein}g (${Math.round(macros.protein * 4)} kcal)
- Carbohidratos: ${macros.carbs}g (${Math.round(macros.carbs * 4)} kcal)
- Grasas: ${macros.fat}g (${Math.round(macros.fat * 9)} kcal)

PREFERENCIAS:
- Comidas por día: ${mealsCount}
- Restricciones: ${profile.dietary_restrictions?.join(', ') || 'ninguna'}
- Proteínas preferidas: ${profile.preferred_proteins?.join(', ') || 'pollo, pescado, huevos, carne'}
- Carbohidratos preferidos: ${profile.preferred_carbs?.join(', ') || 'arroz, avena, pan integral, pasta'}
- Preferencias adicionales: ${dietary_preferences || 'ninguna'}

Responde SOLO con un JSON válido con esta estructura EXACTA:
{
  "name": "Plan Nutricional ${macros.calories} kcal",
  "daily_calories": ${macros.calories},
  "protein_grams": ${macros.protein},
  "carbs_grams": ${macros.carbs},
  "fat_grams": ${macros.fat},
  "meals": [
    {
      "meal_type": "breakfast",
      "name": "Desayuno Energético",
      "description": "Descripción del plato completo",
      "calories": 500,
      "protein_grams": 35,
      "carbs_grams": 50,
      "fat_grams": 15,
      "ingredients": [
        {"name": "Avena", "amount": "80g", "calories": 304, "protein": 10.7},
        {"name": "Claras de huevo", "amount": "200ml (6 claras)", "calories": 104, "protein": 22},
        {"name": "Plátano", "amount": "1 mediano (120g)", "calories": 107, "protein": 1.3},
        {"name": "Miel", "amount": "1 cucharada (15g)", "calories": 46, "protein": 0}
      ],
      "recipe": "1. Cocina la avena con agua o leche desnatada\\n2. Prepara las claras revueltas\\n3. Añade el plátano en rodajas\\n4. Endulza con miel",
      "alternatives": [
        {
          "name": "Tostadas con Huevo",
          "description": "2 tostadas integrales con huevos revueltos y aguacate",
          "calories": 480,
          "protein_grams": 28,
          "carbs_grams": 45,
          "fat_grams": 22
        }
      ]
    }
  ]
}

REGLAS IMPORTANTES:
1. Los meal_type DEBEN ser: breakfast, lunch, snack, dinner (en ese orden)
2. CADA comida debe tener 1-2 alternativas
3. Los ingredientes DEBEN incluir cantidades EXACTAS en gramos
4. Las calorías de cada comida deben sumar aproximadamente ${macros.calories} kcal en total
5. Las proteínas deben distribuirse equitativamente
6. Incluye preparaciones realistas y fáciles`;

    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 4000,
      system: 'Eres un nutricionista deportivo certificado. Responde ÚNICAMENTE con JSON válido, sin texto adicional. Los planes deben ser realistas, balanceados y con cantidades precisas.',
      messages: [{ role: 'user', content: prompt }]
    });

    const jsonResponse = response.content[0].text;

    // Parse the JSON
    let dietPlan;
    try {
      dietPlan = JSON.parse(jsonResponse);
    } catch (parseError) {
      const jsonMatch = jsonResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        dietPlan = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Invalid JSON response from AI');
      }
    }

    // SAVE TO DATABASE
    await client.query('BEGIN');

    // Deactivate other diet plans
    await client.query(
      'UPDATE diet_plans SET is_active = FALSE WHERE user_id = $1',
      [req.user.id]
    );

    // Create the diet plan
    const planResult = await client.query(
      `INSERT INTO diet_plans
       (user_id, name, daily_calories, protein_grams, carbs_grams, fat_grams, ai_generated, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, TRUE, TRUE) RETURNING *`,
      [
        req.user.id,
        dietPlan.name,
        dietPlan.daily_calories,
        dietPlan.protein_grams,
        dietPlan.carbs_grams,
        dietPlan.fat_grams
      ]
    );
    const savedPlan = planResult.rows[0];

    // Save meals for all 7 days (same meals, different days)
    for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
      for (const meal of dietPlan.meals) {
        await client.query(
          `INSERT INTO meals
           (diet_plan_id, day_of_week, meal_type, name, description,
            calories, protein_grams, carbs_grams, fat_grams, ingredients, recipe, image_url)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [
            savedPlan.id,
            dayOfWeek,
            meal.meal_type,
            meal.name,
            meal.description,
            meal.calories,
            meal.protein_grams,
            meal.carbs_grams,
            meal.fat_grams,
            JSON.stringify({
              main: meal.ingredients,
              alternatives: meal.alternatives || []
            }),
            meal.recipe,
            getMealImageUrl(meal.meal_type, meal.name)
          ]
        );
      }
    }

    await client.query('COMMIT');

    // Return the full saved plan
    const fullPlanResult = await pool.query(
      `SELECT dp.*,
              json_agg(
                json_build_object(
                  'id', m.id,
                  'meal_type', m.meal_type,
                  'name', m.name,
                  'description', m.description,
                  'calories', m.calories,
                  'protein_grams', m.protein_grams,
                  'carbs_grams', m.carbs_grams,
                  'fat_grams', m.fat_grams,
                  'ingredients', m.ingredients,
                  'recipe', m.recipe,
                  'image_url', m.image_url,
                  'day_of_week', m.day_of_week
                ) ORDER BY m.day_of_week,
                  CASE m.meal_type
                    WHEN 'breakfast' THEN 1
                    WHEN 'lunch' THEN 2
                    WHEN 'snack' THEN 3
                    WHEN 'dinner' THEN 4
                  END
              ) as meals
       FROM diet_plans dp
       LEFT JOIN meals m ON dp.id = m.diet_plan_id
       WHERE dp.id = $1
       GROUP BY dp.id`,
      [savedPlan.id]
    );

    res.json({
      success: true,
      message: 'Plan de dieta generado y guardado correctamente',
      plan: fullPlanResult.rows[0],
      nutritionCalculation: {
        bmr: Math.round(bmr),
        tdee: Math.round(tdee),
        age,
        ...macros
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Generate diet error:', error);
    res.status(500).json({ error: 'Failed to generate diet plan', details: error.message });
  } finally {
    client.release();
  }
});

// Helper function to get meal image URL based on meal type
const getMealImageUrl = (mealType, mealName) => {
  // Default food images by type
  const defaultImages = {
    breakfast: 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=400',
    lunch: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400',
    snack: 'https://images.unsplash.com/photo-1505576399279-565b52d4ac71?w=400',
    dinner: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=400'
  };

  // Check for specific foods in name
  const nameLower = mealName.toLowerCase();

  if (nameLower.includes('avena') || nameLower.includes('oatmeal')) {
    return 'https://images.unsplash.com/photo-1517673400267-0251440c45dc?w=400';
  }
  if (nameLower.includes('huevo') || nameLower.includes('egg')) {
    return 'https://images.unsplash.com/photo-1482049016gy-2f7yj7?w=400';
  }
  if (nameLower.includes('pollo') || nameLower.includes('chicken')) {
    return 'https://images.unsplash.com/photo-1532550907401-a500c9a57435?w=400';
  }
  if (nameLower.includes('ensalada') || nameLower.includes('salad')) {
    return 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400';
  }
  if (nameLower.includes('pescado') || nameLower.includes('salmon') || nameLower.includes('fish')) {
    return 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=400';
  }
  if (nameLower.includes('arroz') || nameLower.includes('rice')) {
    return 'https://images.unsplash.com/photo-1516684732162-798a0062be99?w=400';
  }
  if (nameLower.includes('proteina') || nameLower.includes('batido') || nameLower.includes('shake')) {
    return 'https://images.unsplash.com/photo-1622597467836-f3285f2131b8?w=400';
  }
  if (nameLower.includes('yogur') || nameLower.includes('yogurt')) {
    return 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400';
  }
  if (nameLower.includes('tostada') || nameLower.includes('toast')) {
    return 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=400';
  }

  return defaultImages[mealType] || defaultImages.lunch;
};

// Get user's calculated nutrition info
router.get('/nutrition-info', authenticateToken, async (req, res) => {
  try {
    const profileResult = await pool.query(
      `SELECT * FROM user_profiles WHERE user_id = $1`,
      [req.user.id]
    );
    const profile = profileResult.rows[0];

    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    const age = calculateAge(profile.birth_date);
    const bmr = calculateBMR(
      profile.current_weight_kg || 70,
      profile.height_cm || 170,
      age,
      profile.gender
    );
    const tdee = calculateTDEE(bmr, profile.activity_level);
    const macros = calculateMacros(tdee, profile.fitness_goal, profile.current_weight_kg || 70);

    res.json({
      age,
      bmr: Math.round(bmr),
      tdee: Math.round(tdee),
      ...macros,
      explanation: {
        bmr: 'Tasa Metabólica Basal - Calorías que quemas en reposo',
        tdee: 'Gasto Energético Total - Calorías totales diarias según tu actividad',
        calories: `Calorías objetivo ajustadas a tu meta (${profile.fitness_goal})`
      }
    });
  } catch (error) {
    console.error('Get nutrition info error:', error);
    res.status(500).json({ error: 'Failed to get nutrition info' });
  }
});

// Get conversation history
router.get('/conversations', authenticateToken, async (req, res) => {
  const { context } = req.query;

  try {
    let query = 'SELECT * FROM coach_conversations WHERE user_id = $1';
    const params = [req.user.id];

    if (context) {
      query += ' AND context = $2';
      params.push(context);
    }

    query += ' ORDER BY updated_at DESC LIMIT 10';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ error: 'Failed to get conversations' });
  }
});

// Clear conversation
router.delete('/conversations/:id', authenticateToken, async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM coach_conversations WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    res.json({ message: 'Conversation deleted' });
  } catch (error) {
    console.error('Delete conversation error:', error);
    res.status(500).json({ error: 'Failed to delete conversation' });
  }
});

module.exports = router;
