const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const pool = require('../db/pool');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

// System prompt for the AI coach
const getCoachSystemPrompt = (profile) => `Eres un entrenador personal profesional y nutricionista certificado llamado "Coach Lam". Tu objetivo es ayudar a tu cliente a alcanzar sus metas de fitness y nutrición.

INFORMACIÓN DEL CLIENTE:
- Peso actual: ${profile.current_weight_kg || 'No especificado'} kg
- Peso objetivo: ${profile.target_weight_kg || 'No especificado'} kg
- Altura: ${profile.height_cm || 'No especificada'} cm
- Objetivo: ${profile.fitness_goal || 'No especificado'}
- Nivel de actividad: ${profile.activity_level || 'No especificado'}
- Días de entrenamiento por semana: ${profile.workout_days_per_week || 3}
- Restricciones dietéticas: ${profile.dietary_restrictions?.join(', ') || 'Ninguna'}

INSTRUCCIONES:
1. Sé motivador pero realista
2. Da consejos basados en evidencia científica
3. Personaliza tus respuestas según el perfil del cliente
4. Responde en español
5. Sé conciso pero informativo
6. Si te piden un plan de entrenamiento, incluye ejercicios específicos con series y repeticiones
7. Si te piden un plan de dieta, incluye macros y ejemplos de comidas
8. Celebra los logros y motiva cuando hay dificultades`;

// Chat with AI coach
router.post('/chat', authenticateToken, async (req, res) => {
  const { message, context = 'general' } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  try {
    // Get user profile
    const profileResult = await pool.query(
      `SELECT * FROM user_profiles WHERE user_id = $1`,
      [req.user.id]
    );

    const profile = profileResult.rows[0] || {};

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
      system: getCoachSystemPrompt(profile),
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
      conversationId
    });
  } catch (error) {
    console.error('AI Coach error:', error);
    res.status(500).json({ error: 'Failed to get response from coach' });
  }
});

// Generate workout plan with AI
router.post('/generate-workout', authenticateToken, async (req, res) => {
  const { focus, days_per_week, equipment_available } = req.body;

  try {
    const profileResult = await pool.query(
      `SELECT * FROM user_profiles WHERE user_id = $1`,
      [req.user.id]
    );

    const profile = profileResult.rows[0] || {};

    const prompt = `Genera un plan de entrenamiento semanal con las siguientes características:
- Días por semana: ${days_per_week || profile.workout_days_per_week || 3}
- Enfoque: ${focus || profile.fitness_goal || 'general'}
- Equipamiento disponible: ${equipment_available || 'gimnasio completo'}

Responde SOLO con un JSON válido con esta estructura exacta:
{
  "name": "Nombre del plan",
  "description": "Descripción breve",
  "days": [
    {
      "day_of_week": 1,
      "name": "Día 1 - Pecho y Tríceps",
      "focus_area": "chest_triceps",
      "exercises": [
        {
          "name": "Press de Banca",
          "name_en": "Bench Press",
          "muscle_group": "Pecho",
          "sets": 4,
          "reps": "8-10",
          "rest_seconds": 90,
          "notes": "Controla la bajada"
        }
      ]
    }
  ]
}`;

    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 2048,
      system: 'Eres un entrenador personal experto. Responde ÚNICAMENTE con JSON válido, sin texto adicional.',
      messages: [{ role: 'user', content: prompt }]
    });

    const jsonResponse = response.content[0].text;

    // Try to parse the JSON
    let workoutPlan;
    try {
      workoutPlan = JSON.parse(jsonResponse);
    } catch (parseError) {
      // Try to extract JSON from response
      const jsonMatch = jsonResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        workoutPlan = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Invalid JSON response from AI');
      }
    }

    res.json({
      plan: workoutPlan,
      raw: jsonResponse
    });
  } catch (error) {
    console.error('Generate workout error:', error);
    res.status(500).json({ error: 'Failed to generate workout plan' });
  }
});

// Generate diet plan with AI
router.post('/generate-diet', authenticateToken, async (req, res) => {
  const { calories_target, meals_per_day, dietary_preferences } = req.body;

  try {
    const profileResult = await pool.query(
      `SELECT * FROM user_profiles WHERE user_id = $1`,
      [req.user.id]
    );

    const profile = profileResult.rows[0] || {};

    // Calculate approximate calories if not provided
    let targetCalories = calories_target;
    if (!targetCalories && profile.current_weight_kg && profile.height_cm) {
      // Basic BMR calculation
      const bmr = profile.gender === 'male'
        ? 88.362 + (13.397 * profile.current_weight_kg) + (4.799 * profile.height_cm) - (5.677 * 30)
        : 447.593 + (9.247 * profile.current_weight_kg) + (3.098 * profile.height_cm) - (4.330 * 30);

      const activityMultiplier = {
        sedentary: 1.2,
        light: 1.375,
        moderate: 1.55,
        active: 1.725,
        very_active: 1.9
      }[profile.activity_level] || 1.55;

      targetCalories = Math.round(bmr * activityMultiplier);

      // Adjust for goal
      if (profile.fitness_goal === 'lose_weight') {
        targetCalories -= 500;
      } else if (profile.fitness_goal === 'gain_muscle') {
        targetCalories += 300;
      }
    }

    const prompt = `Genera un plan de dieta diario con las siguientes características:
- Calorías objetivo: ${targetCalories || 2000} kcal
- Comidas por día: ${meals_per_day || profile.meals_per_day || 4}
- Preferencias: ${dietary_preferences || 'ninguna específica'}
- Restricciones: ${profile.dietary_restrictions?.join(', ') || 'ninguna'}
- Proteínas preferidas: ${profile.preferred_proteins?.join(', ') || 'variadas'}

Responde SOLO con un JSON válido con esta estructura exacta:
{
  "name": "Plan de Alimentación",
  "daily_calories": 2000,
  "protein_grams": 150,
  "carbs_grams": 200,
  "fat_grams": 65,
  "meals": [
    {
      "meal_type": "breakfast",
      "name": "Desayuno Proteico",
      "description": "Descripción del plato",
      "calories": 500,
      "protein_grams": 35,
      "carbs_grams": 50,
      "fat_grams": 15,
      "ingredients": [
        {"name": "Huevos", "amount": "3 unidades"},
        {"name": "Avena", "amount": "50g"}
      ],
      "recipe": "Instrucciones de preparación"
    }
  ]
}

Los meal_type deben ser: breakfast, lunch, snack, dinner`;

    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 2048,
      system: 'Eres un nutricionista experto. Responde ÚNICAMENTE con JSON válido, sin texto adicional.',
      messages: [{ role: 'user', content: prompt }]
    });

    const jsonResponse = response.content[0].text;

    // Try to parse the JSON
    let dietPlan;
    try {
      dietPlan = JSON.parse(jsonResponse);
    } catch (parseError) {
      // Try to extract JSON from response
      const jsonMatch = jsonResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        dietPlan = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Invalid JSON response from AI');
      }
    }

    res.json({
      plan: dietPlan,
      targetCalories
    });
  } catch (error) {
    console.error('Generate diet error:', error);
    res.status(500).json({ error: 'Failed to generate diet plan' });
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
