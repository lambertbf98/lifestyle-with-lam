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
  if (!birthDate) return 30;
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
};

// Calculate BMR using Mifflin-St Jeor equation
const calculateBMR = (weight, height, age, gender) => {
  if (gender === 'male' || gender === 'hombre' || gender === 'masculino') {
    return (10 * weight) + (6.25 * height) - (5 * age) + 5;
  } else {
    return (10 * weight) + (6.25 * height) - (5 * age) - 161;
  }
};

// Calculate TDEE
const calculateTDEE = (bmr, activityLevel) => {
  const multipliers = {
    'sedentary': 1.2,
    'sedentario': 1.2,
    'light': 1.375,
    'ligero': 1.375,
    'moderate': 1.55,
    'moderado': 1.55,
    'active': 1.725,
    'activo': 1.725,
    'very_active': 1.9,
    'muy_activo': 1.9
  };
  return bmr * (multipliers[activityLevel] || 1.55);
};

// Calculate macros based on goal
const calculateMacros = (tdee, goal, weight) => {
  let calories = tdee;
  let proteinPerKg = 1.6;

  switch (goal) {
    case 'lose_weight':
    case 'perder_peso':
      calories = tdee - 500;
      proteinPerKg = 2.0;
      break;
    case 'gain_muscle':
    case 'ganar_musculo':
      calories = tdee + 300;
      proteinPerKg = 2.2;
      break;
    case 'maintain':
    case 'mantener':
    default:
      proteinPerKg = 1.8;
      break;
  }

  const protein = Math.round(weight * proteinPerKg);
  const fat = Math.round((calories * 0.25) / 9);
  const carbs = Math.round((calories - (protein * 4) - (fat * 9)) / 4);

  return {
    calories: Math.round(calories),
    protein,
    carbs,
    fat
  };
};

// Get user's current plans for coach context
const getUserPlansContext = async (userId) => {
  try {
    const workoutPlan = await pool.query(
      `SELECT wp.name, wp.description,
              (SELECT COUNT(*) FROM workout_days WHERE plan_id = wp.id) as days_count
       FROM workout_plans wp WHERE user_id = $1 AND is_active = TRUE LIMIT 1`,
      [userId]
    );

    const dietPlan = await pool.query(
      `SELECT name, daily_calories, protein_grams, carbs_grams, fat_grams
       FROM diet_plans WHERE user_id = $1 AND is_active = TRUE LIMIT 1`,
      [userId]
    );

    const recentWorkouts = await pool.query(
      `SELECT COUNT(*) as count FROM workout_logs
       WHERE user_id = $1 AND completed_at > NOW() - INTERVAL '7 days'`,
      [userId]
    );

    return {
      hasWorkoutPlan: workoutPlan.rows.length > 0,
      workoutPlan: workoutPlan.rows[0] || null,
      hasDietPlan: dietPlan.rows.length > 0,
      dietPlan: dietPlan.rows[0] || null,
      workoutsThisWeek: parseInt(recentWorkouts.rows[0]?.count || 0)
    };
  } catch (error) {
    return { hasWorkoutPlan: false, hasDietPlan: false, workoutsThisWeek: 0 };
  }
};

// System prompt for the AI coach - ONLY for questions and motivation
const getCoachSystemPrompt = (profile, nutritionInfo, plansContext) => `Eres "Coach Lam", un entrenador personal y nutricionista deportivo certificado con 10 años de experiencia. Tu rol es ÚNICAMENTE responder preguntas, motivar y dar consejos personalizados.

⚠️ IMPORTANTE: NO generes planes de entrenamiento ni dietas completas. Si el usuario pide un plan, dile que use los botones "Generar con IA" en las secciones de Entreno o Dieta de la app.

INFORMACIÓN DEL CLIENTE:
- Nombre: ${profile.name || 'Usuario'}
- Género: ${profile.gender || 'No especificado'}
- Peso actual: ${profile.current_weight_kg || 'No especificado'} kg
- Peso objetivo: ${profile.target_weight_kg || 'No especificado'} kg
- Altura: ${profile.height_cm || 'No especificada'} cm
- Edad: ${calculateAge(profile.birth_date)} años
- Objetivo: ${profile.fitness_goal || 'No especificado'}
- Nivel de actividad: ${profile.activity_level || 'No especificado'}
- Días de entrenamiento: ${profile.workout_days_per_week || 3}/semana

DATOS NUTRICIONALES CALCULADOS:
- TMB: ${nutritionInfo.bmr} kcal/día
- TDEE: ${nutritionInfo.tdee} kcal/día
- Objetivo calórico: ${nutritionInfo.calories} kcal/día
- Macros: ${nutritionInfo.protein}g proteína | ${nutritionInfo.carbs}g carbos | ${nutritionInfo.fat}g grasas

PLANES ACTUALES DEL USUARIO:
- Plan de entrenamiento: ${plansContext.hasWorkoutPlan ? `"${plansContext.workoutPlan.name}" (${plansContext.workoutPlan.days_count} días)` : 'Sin plan activo - sugiérele generar uno'}
- Plan de dieta: ${plansContext.hasDietPlan ? `"${plansContext.dietPlan.name}" (${plansContext.dietPlan.daily_calories} kcal)` : 'Sin plan activo - sugiérele generar uno'}
- Entrenos esta semana: ${plansContext.workoutsThisWeek}

TU ROL:
1. Responder dudas sobre ejercicios (técnica, variaciones, sustituciones)
2. Explicar conceptos de nutrición
3. Motivar y celebrar logros
4. Dar tips para mejorar rendimiento
5. Resolver dudas sobre los planes que ya tiene
6. Sugerir ajustes menores (más peso, más series, etc.)

NO DEBES:
- Generar planes completos de entrenamiento
- Generar dietas completas
- Solo di: "Para generar un plan personalizado, usa el botón 'Generar con IA' en la sección correspondiente"

Responde siempre en español, de forma motivadora pero profesional. Sé conciso.`;

// Chat with AI coach
router.post('/chat', authenticateToken, async (req, res) => {
  const { message, context = 'general' } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  try {
    const profileResult = await pool.query(
      `SELECT up.*, u.name FROM user_profiles up
       JOIN users u ON up.user_id = u.id
       WHERE up.user_id = $1`,
      [req.user.id]
    );

    const profile = profileResult.rows[0] || {};
    const plansContext = await getUserPlansContext(req.user.id);

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

    const recentMessages = previousMessages.slice(-10);

    const messages = [
      ...recentMessages.map(m => ({
        role: m.role,
        content: m.content
      })),
      { role: 'user', content: message }
    ];

    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1024,
      system: getCoachSystemPrompt(profile, nutritionInfo, plansContext),
      messages
    });

    const assistantMessage = response.content[0].text;

    const updatedMessages = [
      ...previousMessages,
      { role: 'user', content: message, timestamp: new Date().toISOString() },
      { role: 'assistant', content: assistantMessage, timestamp: new Date().toISOString() }
    ].slice(-20);

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
    const profileResult = await pool.query(
      `SELECT * FROM user_profiles WHERE user_id = $1`,
      [req.user.id]
    );
    const profile = profileResult.rows[0] || {};

    // Get previous exercise performance for progressive overload
    const previousPerformanceResult = await pool.query(
      `SELECT
         e.name as exercise_name,
         e.name_es as exercise_name_es,
         MAX(el.weight_kg) as max_weight,
         AVG(el.weight_kg) as avg_weight,
         COUNT(el.id) as times_performed,
         MAX(wl.completed_at) as last_performed
       FROM exercise_logs el
       JOIN exercises e ON el.exercise_id = e.id
       JOIN workout_logs wl ON el.workout_log_id = wl.id
       WHERE wl.user_id = $1 AND el.weight_kg > 0
       GROUP BY e.id, e.name, e.name_es
       ORDER BY MAX(wl.completed_at) DESC
       LIMIT 50`,
      [req.user.id]
    );
    const previousPerformance = previousPerformanceResult.rows;

    const exercisesResult = await pool.query(
      `SELECT id, name, name_es, muscle_group, equipment, difficulty, gif_url, instructions
       FROM exercises ORDER BY muscle_group, name`
    );
    const availableExercises = exercisesResult.rows;

    const exerciseMap = {};
    availableExercises.forEach(ex => {
      exerciseMap[ex.name.toLowerCase()] = ex;
      if (ex.name_es) {
        exerciseMap[ex.name_es.toLowerCase()] = ex;
      }
    });

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
    const userGender = profile.gender || 'male';
    const isFemale = userGender === 'female' || userGender === 'mujer' || userGender === 'femenino';

    // Build previous performance context for progressive overload
    let progressionContext = '';
    if (previousPerformance.length > 0) {
      progressionContext = `
HISTORIAL DE RENDIMIENTO DEL USUARIO (para progresión):
${previousPerformance.slice(0, 20).map(p =>
  `- ${p.exercise_name_es || p.exercise_name}: Peso máximo ${p.max_weight}kg, Promedio ${Math.round(p.avg_weight)}kg (realizado ${p.times_performed} veces)`
).join('\n')}

⚡ PROGRESIÓN OBLIGATORIA:
- Para ejercicios donde el usuario ya tiene historial, sugiere peso +2.5kg a +5kg más que su máximo anterior
- Si el usuario ha hecho el ejercicio más de 3 veces, puede aumentar más
- Incluye en las notas el peso sugerido basado en su progreso`;
    } else {
      progressionContext = `
NOTA: Este es un usuario nuevo sin historial de pesos. Sugiere pesos conservadores para empezar.`;
    }

    // Different training approach based on gender
    let trainingFocus = '';
    if (isFemale) {
      trainingFocus = `
ENFOQUE ESPECIAL PARA MUJER:
- Prioridad absoluta en GLÚTEOS e ISQUIOTIBIALES
- Si son 3 días: 2 días de pierna/glúteo + 1 día de torso
- Si son 4 días: 2 días pierna/glúteo + 1 torso + 1 full body
- Incluir SIEMPRE: Hip Thrust, Sentadilla, Peso Muerto Rumano, Zancadas
- Cada día de pierna debe tener mínimo 3 ejercicios de glúteo`;
    } else {
      trainingFocus = `
ENFOQUE PARA HOMBRE:
- Distribución equilibrada: empuje/tirón/pierna o por grupos musculares
- Incluir ejercicios compuestos pesados: Press Banca, Peso Muerto, Sentadilla
- Priorizar fuerza y volumen muscular`;
    }

    const prompt = `Genera un plan de entrenamiento PROFESIONAL de ~45 minutos por sesión:

DATOS DEL USUARIO:
- Género: ${userGender} ${isFemale ? '(MUJER - énfasis en glúteos)' : '(HOMBRE)'}
- Días por semana: ${daysCount}
- Objetivo: ${userGoal}
- Equipamiento: ${equipment_available || 'gimnasio completo'}
${progressionContext}

${trainingFocus}

EJERCICIOS DISPONIBLES (usa nombres EXACTOS):
${exerciseListText}

REGLAS OBLIGATORIAS:
1. MÍNIMO 6-7 ejercicios por día (para ~45 min de entreno)
2. Ejercicios compuestos primero, aislamiento después
3. Series: 3-4 por ejercicio
4. Repeticiones según objetivo:
   - Fuerza: 4-6 reps, descanso 120-180s
   - Hipertrofia: 8-12 reps, descanso 60-90s
   - Resistencia: 15-20 reps, descanso 30-45s
5. ${isFemale ? 'MÍNIMO 2 días enfocados en pierna/glúteo' : 'Distribución equilibrada'}

Responde SOLO con JSON válido:
{
  "name": "Plan ${isFemale ? 'Glúteos y Piernas' : 'Hipertrofia'} ${daysCount} Días",
  "description": "Plan de ${daysCount} días enfocado en ${isFemale ? 'desarrollo de glúteos y piernas' : userGoal}",
  "days": [
    {
      "day_of_week": 1,
      "name": "Día 1 - ${isFemale ? 'Glúteos y Piernas' : 'Pecho y Tríceps'}",
      "focus_area": "${isFemale ? 'Glúteos' : 'Pecho'}",
      "exercises": [
        {"name": "Nombre exacto del ejercicio", "sets": 4, "reps": "10-12", "rest_seconds": 90, "notes": "Técnica o tips"}
      ]
    }
  ]
}`;

    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 4000,
      system: 'Eres un entrenador personal certificado NSCA con especialización en entrenamiento femenino y masculino. Responde ÚNICAMENTE con JSON válido. Genera entrenamientos COMPLETOS de 45 minutos con 6-7 ejercicios por día.',
      messages: [{ role: 'user', content: prompt }]
    });

    const jsonResponse = response.content[0].text;

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

    await client.query('BEGIN');

    await client.query(
      'UPDATE workout_plans SET is_active = FALSE WHERE user_id = $1',
      [req.user.id]
    );

    const planResult = await client.query(
      `INSERT INTO workout_plans (user_id, name, description, ai_generated, is_active)
       VALUES ($1, $2, $3, TRUE, TRUE) RETURNING *`,
      [req.user.id, workoutPlan.name, workoutPlan.description]
    );
    const savedPlan = planResult.rows[0];

    for (const day of workoutPlan.days) {
      const dayResult = await client.query(
        `INSERT INTO workout_days (plan_id, day_of_week, name, focus_area)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [savedPlan.id, day.day_of_week, day.name, day.focus_area]
      );
      const dayId = dayResult.rows[0].id;

      for (let i = 0; i < day.exercises.length; i++) {
        const exercise = day.exercises[i];
        const exerciseData = exerciseMap[exercise.name.toLowerCase()];

        if (exerciseData) {
          await client.query(
            `INSERT INTO workout_exercises
             (workout_day_id, exercise_id, sets, reps, rest_seconds, notes, order_index)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              dayId,
              exerciseData.id,
              exercise.sets || 4,
              exercise.reps || '10-12',
              exercise.rest_seconds || 90,
              exercise.notes || '',
              i
            ]
          );
        }
      }
    }

    await client.query('COMMIT');

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

// Generate AND SAVE diet plan with AI - 5 meals + pre/post workout
router.post('/generate-diet', authenticateToken, async (req, res) => {
  const { dietary_preferences, is_training_day } = req.body;

  const client = await pool.connect();

  try {
    const profileResult = await pool.query(
      `SELECT * FROM user_profiles WHERE user_id = $1`,
      [req.user.id]
    );
    const profile = profileResult.rows[0] || {};

    const age = calculateAge(profile.birth_date);
    const weight = profile.current_weight_kg || 70;
    const height = profile.height_cm || 170;

    const bmr = calculateBMR(weight, height, age, profile.gender);
    const tdee = calculateTDEE(bmr, profile.activity_level);
    const macros = calculateMacros(tdee, profile.fitness_goal, weight);

    const prompt = `Genera un plan de dieta PROFESIONAL para deportistas siguiendo el protocolo de 5 comidas cada 3 horas:

DATOS NUTRICIONALES CALCULADOS (Mifflin-St Jeor):
- TMB: ${Math.round(bmr)} kcal
- TDEE: ${Math.round(tdee)} kcal
- Calorías objetivo: ${macros.calories} kcal/día
- Proteínas: ${macros.protein}g (${Math.round(macros.protein/weight*10)/10}g/kg)
- Carbohidratos: ${macros.carbs}g
- Grasas: ${macros.fat}g

DATOS DEL USUARIO:
- Peso: ${weight}kg
- Objetivo: ${profile.fitness_goal || 'mantener'}
- Restricciones: ${profile.dietary_restrictions?.join(', ') || 'ninguna'}
- Proteínas preferidas: ${profile.preferred_proteins?.join(', ') || 'pollo, pescado, huevos, carne'}

PROTOCOLO NUTRICIONAL OBLIGATORIO:
1. 5 COMIDAS al día (cada ~3 horas):
   - 07:00 - Desayuno (breakfast)
   - 10:00 - Media mañana (mid_morning)
   - 13:00 - Almuerzo (lunch)
   - 16:00 - Merienda (snack) - PRE-ENTRENO si entrena
   - 20:00 - Cena (dinner) - POST-ENTRENO si entrena tarde

2. DISTRIBUCIÓN de calorías:
   - Desayuno: 25% (~${Math.round(macros.calories*0.25)} kcal)
   - Media mañana: 10% (~${Math.round(macros.calories*0.10)} kcal)
   - Almuerzo: 30% (~${Math.round(macros.calories*0.30)} kcal)
   - Merienda: 15% (~${Math.round(macros.calories*0.15)} kcal)
   - Cena: 20% (~${Math.round(macros.calories*0.20)} kcal)

3. PROTEÍNA distribuida: ${Math.round(macros.protein/5)}g por comida aprox

4. PRE-ENTRENO (merienda): Carbohidratos complejos + proteína ligera
5. POST-ENTRENO (cena): Proteína alta + carbohidratos para recuperación

Responde SOLO con JSON válido:
{
  "name": "Plan Nutricional ${macros.calories} kcal",
  "daily_calories": ${macros.calories},
  "protein_grams": ${macros.protein},
  "carbs_grams": ${macros.carbs},
  "fat_grams": ${macros.fat},
  "meals": [
    {
      "meal_type": "breakfast",
      "time": "07:00",
      "name": "Desayuno Energético",
      "description": "Descripción completa del plato",
      "calories": ${Math.round(macros.calories*0.25)},
      "protein_grams": ${Math.round(macros.protein*0.25)},
      "carbs_grams": ${Math.round(macros.carbs*0.25)},
      "fat_grams": ${Math.round(macros.fat*0.25)},
      "ingredients": [
        {"name": "Avena", "amount": "80g", "calories": 304, "protein": 10.7}
      ],
      "recipe": "Pasos de preparación",
      "alternatives": [
        {
          "name": "Alternativa",
          "description": "Descripción",
          "calories": 400,
          "protein_grams": 30
        }
      ]
    },
    {
      "meal_type": "mid_morning",
      "time": "10:00",
      "name": "Snack Media Mañana",
      ...
    },
    {
      "meal_type": "lunch",
      "time": "13:00",
      ...
    },
    {
      "meal_type": "snack",
      "time": "16:00",
      "name": "Pre-Entreno / Merienda",
      ...
    },
    {
      "meal_type": "dinner",
      "time": "20:00",
      "name": "Cena Post-Entreno",
      ...
    }
  ]
}

IMPORTANTE: Las 5 comidas deben sumar EXACTAMENTE ${macros.calories} kcal y ${macros.protein}g de proteína.`;

    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 4000,
      system: 'Eres un nutricionista deportivo certificado ISSN especializado en nutrición para rendimiento. Creas planes con 5 comidas cada 3 horas, timing de nutrientes pre/post entreno, y cantidades EXACTAS en gramos. Responde ÚNICAMENTE con JSON válido.',
      messages: [{ role: 'user', content: prompt }]
    });

    const jsonResponse = response.content[0].text;

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

    await client.query('BEGIN');

    await client.query(
      'UPDATE diet_plans SET is_active = FALSE WHERE user_id = $1',
      [req.user.id]
    );

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

    // Save meals for all 7 days
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
              alternatives: meal.alternatives || [],
              time: meal.time
            }),
            meal.recipe,
            getMealImageUrl(meal.meal_type, meal.name)
          ]
        );
      }
    }

    await client.query('COMMIT');

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
                    WHEN 'mid_morning' THEN 2
                    WHEN 'lunch' THEN 3
                    WHEN 'snack' THEN 4
                    WHEN 'dinner' THEN 5
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

// Helper function for meal images
const getMealImageUrl = (mealType, mealName) => {
  const defaultImages = {
    breakfast: 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=400',
    mid_morning: 'https://images.unsplash.com/photo-1505576399279-565b52d4ac71?w=400',
    lunch: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400',
    snack: 'https://images.unsplash.com/photo-1505576399279-565b52d4ac71?w=400',
    dinner: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=400'
  };

  const nameLower = (mealName || '').toLowerCase();

  if (nameLower.includes('avena') || nameLower.includes('oatmeal')) {
    return 'https://images.unsplash.com/photo-1517673400267-0251440c45dc?w=400';
  }
  if (nameLower.includes('huevo') || nameLower.includes('egg')) {
    return 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=400';
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
  if (nameLower.includes('batido') || nameLower.includes('shake') || nameLower.includes('proteina')) {
    return 'https://images.unsplash.com/photo-1622597467836-f3285f2131b8?w=400';
  }
  if (nameLower.includes('yogur') || nameLower.includes('yogurt')) {
    return 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400';
  }
  if (nameLower.includes('tostada') || nameLower.includes('toast') || nameLower.includes('pan')) {
    return 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=400';
  }
  if (nameLower.includes('fruta') || nameLower.includes('fruit') || nameLower.includes('manzana') || nameLower.includes('platano')) {
    return 'https://images.unsplash.com/photo-1619566636858-adf3ef46400b?w=400';
  }
  if (nameLower.includes('pasta')) {
    return 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=400';
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
        bmr: 'Tasa Metabólica Basal - Calorías en reposo total',
        tdee: 'Gasto Energético Total - Incluye tu actividad diaria',
        calories: `Calorías ajustadas para ${profile.fitness_goal || 'tu objetivo'}`
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
