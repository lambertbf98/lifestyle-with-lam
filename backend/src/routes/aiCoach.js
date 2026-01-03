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

// Expand food categories to individual items
const expandFoodCategories = (dislikedFoods) => {
  const categoryMap = {
    'verduras': ['espinacas', 'brócoli', 'brócoli', 'calabacín', 'judías verdes', 'acelgas', 'col', 'repollo', 'coliflor', 'berenjenas', 'pimientos', 'tomate', 'lechuga', 'espárragos', 'alcachofas', 'champiñones', 'setas'],
    'pescado': ['salmón', 'atún', 'merluza', 'bacalao', 'lubina', 'dorada', 'sardinas', 'anchoas', 'trucha', 'caballa', 'boquerones'],
    'mariscos': ['gambas', 'langostinos', 'mejillones', 'almejas', 'calamares', 'pulpo', 'sepia'],
    'lácteos': ['leche', 'queso', 'yogur', 'yogur griego', 'queso cottage', 'requesón', 'nata', 'mantequilla'],
    'frutos secos': ['nueces', 'almendras', 'cacahuetes', 'avellanas', 'pistachos', 'anacardos'],
    'legumbres': ['lentejas', 'garbanzos', 'alubias', 'judías', 'habas', 'guisantes'],
    'cerdo': ['lomo de cerdo', 'chuletas de cerdo', 'bacon', 'jamón', 'chorizo', 'salchichón'],
    'ternera': ['ternera', 'carne picada de ternera', 'filete de ternera', 'entrecot'],
    'pollo': ['pechuga de pollo', 'muslos de pollo', 'pollo entero'],
    'huevos': ['huevos', 'huevos revueltos', 'tortilla', 'huevo cocido', 'claras de huevo'],
    'avena': ['avena', 'copos de avena', 'porridge', 'overnight oats']
  };

  const expanded = new Set();

  for (const food of (dislikedFoods || [])) {
    const lower = food.toLowerCase().trim();
    expanded.add(lower);

    // Check if it's a category
    for (const [category, items] of Object.entries(categoryMap)) {
      if (lower.includes(category) || category.includes(lower)) {
        items.forEach(item => expanded.add(item));
      }
    }
  }

  return Array.from(expanded);
};

// Calculate macros based on goal
const calculateMacros = (tdee, goal, weight) => {
  let calories = tdee;
  let proteinPerKg = 1.6;

  switch (goal) {
    case 'lose_weight':
    case 'perder_peso':
      calories = tdee - 300; // Moderate deficit
      proteinPerKg = 2.0;
      break;
    case 'lose_weight_aggressive':
      calories = tdee - 500; // Aggressive deficit for sprint
      proteinPerKg = 2.2; // Higher protein to preserve muscle
      break;
    case 'lose_weight_extreme':
      calories = tdee - 750; // Extreme deficit - not recommended long term
      proteinPerKg = 2.4; // Very high protein to minimize muscle loss
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

    // Debug logging
    console.log('=== DIET GENERATION DEBUG ===');
    console.log('User ID:', req.user.id);
    console.log('Fitness Goal from DB:', profile.fitness_goal);
    console.log('Weight:', weight, 'kg');
    console.log('Height:', height, 'cm');
    console.log('Age:', age);
    console.log('Activity Level:', profile.activity_level);
    console.log('BMR:', Math.round(bmr));
    console.log('TDEE:', Math.round(tdee));
    console.log('Final Calories:', macros.calories);
    console.log('=============================');

    const mealsPerDay = profile.meals_per_day || 5;
    // Expand categories like "verduras" to include all vegetables
    const expandedDisliked = expandFoodCategories(profile.disliked_foods);
    const dislikedFoods = expandedDisliked.join(', ') || '';

    // Calculate EXACT calories per meal (AI is bad at math)
    const totalCal = macros.calories;
    const totalPro = macros.protein;
    const totalCarbs = macros.carbs;
    const totalFat = macros.fat;

    let mealBreakdown = [];

    if (mealsPerDay === 3) {
      mealBreakdown = [
        { type: 'breakfast', name: 'Desayuno', pct: 0.30 },
        { type: 'lunch', name: 'Almuerzo', pct: 0.40 },
        { type: 'dinner', name: 'Cena', pct: 0.30 }
      ];
    } else if (mealsPerDay === 4) {
      mealBreakdown = [
        { type: 'breakfast', name: 'Desayuno', pct: 0.25 },
        { type: 'lunch', name: 'Almuerzo', pct: 0.35 },
        { type: 'snack', name: 'Merienda', pct: 0.15 },
        { type: 'dinner', name: 'Cena', pct: 0.25 }
      ];
    } else if (mealsPerDay === 5) {
      mealBreakdown = [
        { type: 'breakfast', name: 'Desayuno', pct: 0.25 },
        { type: 'mid_morning', name: 'Media Mañana', pct: 0.10 },
        { type: 'lunch', name: 'Almuerzo', pct: 0.30 },
        { type: 'snack', name: 'Merienda', pct: 0.15 },
        { type: 'dinner', name: 'Cena', pct: 0.20 }
      ];
    } else {
      mealBreakdown = [
        { type: 'breakfast', name: 'Desayuno', pct: 0.20 },
        { type: 'mid_morning', name: 'Media Mañana', pct: 0.10 },
        { type: 'lunch', name: 'Almuerzo', pct: 0.30 },
        { type: 'snack', name: 'Merienda', pct: 0.15 },
        { type: 'dinner', name: 'Cena', pct: 0.20 },
        { type: 'late_snack', name: 'Snack Nocturno', pct: 0.05 }
      ];
    }

    // Pre-calculate exact values for each meal
    const mealsWithMacros = mealBreakdown.map(meal => ({
      ...meal,
      calories: Math.round(totalCal * meal.pct),
      protein: Math.round(totalPro * meal.pct),
      carbs: Math.round(totalCarbs * meal.pct),
      fat: Math.round(totalFat * meal.pct)
    }));

    // Build the exact meal requirements string
    const mealRequirements = mealsWithMacros.map(m =>
      `- ${m.name} (${m.type}): ${m.calories} kcal, ${m.protein}g prot, ${m.carbs}g carbs, ${m.fat}g grasa`
    ).join('\n');

    // Build forbidden foods warning - make it VERY clear
    const forbiddenWarning = dislikedFoods
      ? `

🚨🚨🚨 ALIMENTOS TERMINANTEMENTE PROHIBIDOS 🚨🚨🚨
El usuario ODIA estos alimentos. NUNCA los incluyas bajo NINGUNA circunstancia:
❌ ${dislikedFoods.split(', ').join('\n❌ ')}

Si incluyes CUALQUIERA de estos alimentos, el plan será RECHAZADO.
Verifica CADA ingrediente antes de incluirlo.
`
      : '';

    // Build JSON template with EXACT values per meal
    const mealsJsonTemplate = mealsWithMacros.map(m => `    {
      "meal_type": "${m.type}",
      "name": "${m.name} - [nombre del plato]",
      "description": "Descripción breve",
      "calories": ${m.calories},
      "protein_grams": ${m.protein},
      "carbs_grams": ${m.carbs},
      "fat_grams": ${m.fat},
      "ingredients": [{"name": "Producto", "amount": "100g", "calories": XX, "protein": XX}],
      "recipe": "Preparación"
    }`).join(',\n');

    const prompt = `Genera un plan de dieta con EXACTAMENTE estas calorías:
${forbiddenWarning}
📊 OBJETIVO CALÓRICO TOTAL: ${macros.calories} kcal/día
(TDEE: ${Math.round(tdee)} - Déficit aplicado = ${macros.calories} kcal)

🎯 CALORÍAS EXACTAS POR COMIDA (NO CAMBIAR):
${mealRequirements}

TOTAL: ${macros.calories} kcal | ${macros.protein}g prot | ${macros.carbs}g carbs | ${macros.fat}g grasa

⚠️ MERCADONA ESPAÑA - Productos:
Pollo, Huevos, Ternera, Cerdo, Pavo, Arroz, Pasta, Pan integral, Patatas, Boniato, Yogur griego, Queso fresco 0%

Preferencias: ${profile.preferred_proteins?.join(', ') || 'pollo, huevos'} | ${profile.preferred_carbs?.join(', ') || 'arroz, patata'}

Responde SOLO con JSON. USA LAS CALORÍAS EXACTAS indicadas arriba:
{
  "name": "Plan Nutricional ${macros.calories} kcal",
  "daily_calories": ${macros.calories},
  "protein_grams": ${macros.protein},
  "carbs_grams": ${macros.carbs},
  "fat_grams": ${macros.fat},
  "meals": [
${mealsJsonTemplate}
  ]
}

🚨 VERIFICACIÓN: La suma de calorías de todas las comidas DEBE ser ${macros.calories} kcal (±20).
${dislikedFoods ? `🚫 NO incluir: ${dislikedFoods}` : ''}`;

    const systemPrompt = dislikedFoods
      ? `Eres un nutricionista deportivo certificado. REGLA CRÍTICA: El usuario ha especificado alimentos que ODIA y NO PUEDE COMER: ${dislikedFoods}. NUNCA incluyas estos alimentos ni sus derivados. Verifica CADA ingrediente. Si dudas, usa una alternativa. Responde ÚNICAMENTE con JSON válido.`
      : 'Eres un nutricionista deportivo certificado ISSN. Creas planes con comidas balanceadas y cantidades exactas en gramos. Responde ÚNICAMENTE con JSON válido.';

    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 4000,
      system: systemPrompt,
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

    // FORCE correct calories - AI is bad at math, so we override with our calculations
    console.log('=== CALORIE VALIDATION ===');
    const aiTotalCal = dietPlan.meals.reduce((sum, m) => sum + (m.calories || 0), 0);
    console.log('AI generated total calories:', aiTotalCal);
    console.log('Target calories:', macros.calories);

    // Override each meal with our pre-calculated values
    if (dietPlan.meals && dietPlan.meals.length === mealsWithMacros.length) {
      dietPlan.meals = dietPlan.meals.map((meal, index) => {
        const target = mealsWithMacros[index];
        return {
          ...meal,
          meal_type: target.type,
          calories: target.calories,
          protein_grams: target.protein,
          carbs_grams: target.carbs,
          fat_grams: target.fat
        };
      });
      console.log('Calories FORCED to correct values');
    }

    // Also force the plan totals
    dietPlan.daily_calories = macros.calories;
    dietPlan.protein_grams = macros.protein;
    dietPlan.carbs_grams = macros.carbs;
    dietPlan.fat_grams = macros.fat;
    console.log('Plan totals FORCED to:', macros.calories, 'kcal');
    console.log('=========================');

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

// Regenerate a single exercise in workout plan
router.post('/regenerate-exercise', authenticateToken, async (req, res) => {
  const { workout_exercise_id, current_exercise_name, muscle_group, sets, reps } = req.body;

  try {
    // Get available exercises for the same muscle group
    const exercisesResult = await pool.query(
      `SELECT id, name, name_es, muscle_group, equipment, gif_url, instructions
       FROM exercises
       WHERE muscle_group = $1 AND name_es != $2
       ORDER BY RANDOM()
       LIMIT 5`,
      [muscle_group, current_exercise_name]
    );

    if (exercisesResult.rows.length === 0) {
      return res.status(404).json({ error: 'No hay ejercicios alternativos disponibles' });
    }

    // Pick the first random exercise
    const newExercise = exercisesResult.rows[0];

    // Update the workout_exercises table
    await pool.query(
      `UPDATE workout_exercises SET exercise_id = $1 WHERE id = $2`,
      [newExercise.id, workout_exercise_id]
    );

    res.json({
      success: true,
      exercise: {
        id: workout_exercise_id,
        exercise_id: newExercise.id,
        exercise: newExercise,
        sets,
        reps
      }
    });
  } catch (error) {
    console.error('Regenerate exercise error:', error);
    res.status(500).json({ error: 'Failed to regenerate exercise', details: error.message });
  }
});

// Regenerate a single meal with same macros
router.post('/regenerate-meal', authenticateToken, async (req, res) => {
  const { meal_id, calories, protein_grams, meal_type, current_meal_name } = req.body;

  try {
    const profileResult = await pool.query(
      `SELECT * FROM user_profiles WHERE user_id = $1`,
      [req.user.id]
    );
    const profile = profileResult.rows[0] || {};
    // Expand categories like "verduras" to include all vegetables
    const expandedDisliked = expandFoodCategories(profile.disliked_foods);
    const dislikedFoods = expandedDisliked.join(', ') || '';

    // Get current meal to avoid similar suggestions
    const mealResult = await pool.query('SELECT name FROM meals WHERE id = $1', [meal_id]);
    const currentName = current_meal_name || mealResult.rows[0]?.name || '';

    // Build strong forbidden warning
    const forbiddenList = dislikedFoods
      ? `🚨🚨🚨 ALIMENTOS TERMINANTEMENTE PROHIBIDOS 🚨🚨🚨
❌ ${dislikedFoods.split(', ').join('\n❌ ')}
Si incluyes CUALQUIERA de estos, la comida será RECHAZADA.`
      : '';

    const prompt = `Genera UNA comida COMPLETAMENTE DIFERENTE con estos macros:
- Calorías: ${calories} kcal (±50)
- Proteína: ${protein_grams}g (±5g)
- Tipo: ${meal_type}
${forbiddenList}

🚨 VARIEDAD OBLIGATORIA:
- Comida actual: "${currentName}" - NO sugieras nada similar
- Usa ingredientes DIFERENTES
- Sé CREATIVO: wraps, bowls, tortitas proteicas, revueltos, etc.

⚠️ MERCADONA ESPAÑA:
Pechuga de pollo, Huevos, Ternera picada, Lomo de cerdo, Pavo,
Arroz, Pasta, Pan integral, Patatas, Boniato,
Yogur griego, Queso fresco batido 0%

Responde SOLO con JSON:
{
  "name": "Nombre del plato (creativo y diferente)",
  "description": "Descripción breve",
  "calories": ${calories},
  "protein_grams": ${protein_grams},
  "carbs_grams": XX,
  "fat_grams": XX,
  "ingredients": [{"name": "Ingrediente", "amount": "cantidad", "calories": XX, "protein": XX}],
  "recipe": "Preparación paso a paso"
}`;

    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1000,
      system: 'Eres un nutricionista deportivo. Genera comidas con productos de MERCADONA España. Responde SOLO con JSON válido.',
      messages: [{ role: 'user', content: prompt }]
    });

    const jsonResponse = response.content[0].text;
    let newMeal;
    try {
      newMeal = JSON.parse(jsonResponse);
    } catch (parseError) {
      const jsonMatch = jsonResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        newMeal = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Invalid JSON response');
      }
    }

    // Update the meal in database if meal_id provided
    if (meal_id) {
      await pool.query(
        `UPDATE meals SET
          name = $1,
          description = $2,
          calories = $3,
          protein_grams = $4,
          carbs_grams = $5,
          fat_grams = $6,
          ingredients = $7,
          recipe = $8,
          image_url = $9
         WHERE id = $10`,
        [
          newMeal.name,
          newMeal.description,
          newMeal.calories,
          newMeal.protein_grams,
          newMeal.carbs_grams,
          newMeal.fat_grams,
          JSON.stringify({ main: newMeal.ingredients }),
          newMeal.recipe,
          getMealImageUrl(meal_type, newMeal.name),
          meal_id
        ]
      );
    }

    res.json({
      success: true,
      meal: {
        ...newMeal,
        meal_type,
        image_url: getMealImageUrl(meal_type, newMeal.name)
      }
    });
  } catch (error) {
    console.error('Regenerate meal error:', error);
    res.status(500).json({ error: 'Failed to regenerate meal', details: error.message });
  }
});

// Regenerate a single ingredient in a meal
router.post('/regenerate-ingredient', authenticateToken, async (req, res) => {
  const { meal_id, ingredient_name, ingredient_calories, ingredient_protein } = req.body;

  try {
    const profileResult = await pool.query(
      `SELECT * FROM user_profiles WHERE user_id = $1`,
      [req.user.id]
    );
    const profile = profileResult.rows[0] || {};
    const expandedDisliked = expandFoodCategories(profile.disliked_foods);
    const dislikedFoods = expandedDisliked.join(', ') || '';

    // Get current meal to access ingredients
    const mealResult = await pool.query(
      `SELECT * FROM meals WHERE id = $1`,
      [meal_id]
    );

    if (mealResult.rows.length === 0) {
      return res.status(404).json({ error: 'Comida no encontrada' });
    }

    const meal = mealResult.rows[0];

    // Parse ingredients if it's a string
    let ingredientsObj = meal.ingredients;
    if (typeof ingredientsObj === 'string') {
      try {
        ingredientsObj = JSON.parse(ingredientsObj);
      } catch (e) {
        ingredientsObj = { main: [] };
      }
    }
    ingredientsObj = ingredientsObj || { main: [] };
    const currentIngredients = ingredientsObj.main || [];

    if (currentIngredients.length === 0) {
      return res.status(400).json({ error: 'No hay ingredientes en esta comida' });
    }

    // Build strong forbidden warning
    const forbiddenIngredients = dislikedFoods
      ? `🚨 PROHIBIDO - El usuario ODIA estos alimentos:
❌ ${dislikedFoods.split(', ').join('\n❌ ')}`
      : '';

    const prompt = `Reemplaza UN ingrediente:

INGREDIENTE A REEMPLAZAR: ${ingredient_name}
- Calorías: ~${ingredient_calories || 100} | Proteína: ~${ingredient_protein || 10}g

OTROS INGREDIENTES (no cambiar):
${currentIngredients.filter(i => i.name !== ingredient_name).map(i => `- ${i.name}: ${i.amount}`).join('\n')}
${forbiddenIngredients}

⚠️ MERCADONA ESPAÑA - NO usar: ${ingredient_name}

Preferencias: ${profile.preferred_proteins?.join(', ') || 'pollo, huevos'}, ${profile.preferred_carbs?.join(', ') || 'arroz, patata'}

Responde SOLO con JSON:
{
  "name": "Nombre del nuevo ingrediente",
  "amount": "cantidad (ej: 100g, 2 unidades)",
  "calories": ${ingredient_calories || 100},
  "protein": ${ingredient_protein || 10}
}`;

    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 500,
      system: 'Eres un nutricionista deportivo. Sugiere ingredientes alternativos de MERCADONA España con macros similares. Responde SOLO con JSON válido.',
      messages: [{ role: 'user', content: prompt }]
    });

    const jsonResponse = response.content[0].text;
    let newIngredient;
    try {
      newIngredient = JSON.parse(jsonResponse);
    } catch (parseError) {
      const jsonMatch = jsonResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        newIngredient = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Invalid JSON response');
      }
    }

    // Update the meal ingredients in database (preserve other properties)
    const updatedIngredients = currentIngredients.map(ing =>
      ing.name === ingredient_name ? { ...ing, ...newIngredient } : ing
    );

    // Preserve any other properties in ingredientsObj (like extras)
    const updatedIngredientsObj = {
      ...ingredientsObj,
      main: updatedIngredients
    };

    await pool.query(
      `UPDATE meals SET ingredients = $1 WHERE id = $2`,
      [JSON.stringify(updatedIngredientsObj), meal_id]
    );

    res.json({
      success: true,
      old_ingredient: ingredient_name,
      new_ingredient: newIngredient,
      updated_ingredients: updatedIngredients
    });
  } catch (error) {
    console.error('Regenerate ingredient error:', error);
    res.status(500).json({ error: 'Failed to regenerate ingredient', details: error.message });
  }
});

module.exports = router;
