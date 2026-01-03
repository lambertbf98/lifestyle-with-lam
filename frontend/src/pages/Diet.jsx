import { useState, useEffect } from 'react';
import { diet as dietApi, coach as coachApi } from '../api';
import { useTheme } from '../contexts/ThemeContext';
import { UtensilsCrossed, Plus, Sparkles, Flame, Drumstick, Wheat, Droplets, Check, Loader2, ChevronDown, ChevronUp, Scale, RefreshCw, X, RotateCcw } from 'lucide-react';

const mealTypeLabels = {
  breakfast: 'Desayuno',
  mid_morning: 'Media Mañana',
  lunch: 'Almuerzo',
  snack: 'Merienda / Pre-Entreno',
  dinner: 'Cena / Post-Entreno'
};

const mealTypeIcons = {
  breakfast: '🌅',
  mid_morning: '🥤',
  lunch: '☀️',
  snack: '💪',
  dinner: '🌙'
};

export default function Diet() {
  const { isDark } = useTheme();
  const [todayData, setTodayData] = useState({ meals: [], logged: [] });
  const [activePlan, setActivePlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [regeneratingMeal, setRegeneratingMeal] = useState(null);
  const [regeneratingIngredient, setRegeneratingIngredient] = useState(null);
  const [expandedMeal, setExpandedMeal] = useState(null);
  const [selectedMealDetail, setSelectedMealDetail] = useState(null);
  const [nutritionInfo, setNutritionInfo] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [todayRes, planRes] = await Promise.all([
        dietApi.getToday(),
        dietApi.getActivePlan()
      ]);
      setTodayData(todayRes.data);
      setActivePlan(planRes.data);

      // Try to get nutrition info
      try {
        const nutritionRes = await coachApi.getNutritionInfo();
        setNutritionInfo(nutritionRes.data);
      } catch (e) {
        console.log('Nutrition info not available');
      }
    } catch (error) {
      console.error('Error loading diet data:', error);
    } finally {
      setLoading(false);
    }
  };

  const generatePlan = async () => {
    setGenerating(true);
    try {
      // El endpoint generate-diet ahora guarda el plan directamente en BD
      const response = await coachApi.generateDiet({});

      if (response.data.success) {
        // Guardar la info nutricional calculada
        if (response.data.nutritionCalculation) {
          setNutritionInfo(response.data.nutritionCalculation);
        }
        // Recargar datos
        await loadData();
      }
    } catch (error) {
      console.error('Error generating diet plan:', error);
      alert('Error al generar el plan. Por favor intenta de nuevo.');
    } finally {
      setGenerating(false);
    }
  };

  const logMeal = async (meal) => {
    try {
      await dietApi.logMeal({
        meal_id: meal.id,
        meal_type: meal.meal_type,
        calories: meal.calories,
        protein_grams: meal.protein_grams,
        carbs_grams: meal.carbs_grams,
        fat_grams: meal.fat_grams
      });
      await loadData();
    } catch (error) {
      console.error('Error logging meal:', error);
    }
  };

  const unlogMeal = async (mealId) => {
    try {
      // Find the log entry for this meal
      const logEntry = todayData.logged.find(log => log.meal_id === mealId);
      if (logEntry) {
        await dietApi.deleteMealLog(logEntry.id);
        await loadData();
      }
    } catch (error) {
      console.error('Error unlogging meal:', error);
    }
  };

  const clearTodayLogs = async () => {
    if (todayData.logged.length === 0) return;
    try {
      await dietApi.clearToday();
      await loadData();
    } catch (error) {
      console.error('Error clearing today:', error);
    }
  };

  const regenerateMeal = async (meal) => {
    setRegeneratingMeal(meal.id);
    try {
      const response = await coachApi.regenerateMeal({
        meal_id: meal.id,
        calories: meal.calories,
        protein_grams: meal.protein_grams,
        meal_type: meal.meal_type
      });

      if (response.data.success) {
        // Update the local state with the new meal
        setTodayData(prev => ({
          ...prev,
          meals: prev.meals.map(m =>
            m.id === meal.id
              ? { ...m, ...response.data.meal, id: m.id }
              : m
          )
        }));
      }
    } catch (error) {
      console.error('Error regenerating meal:', error);
      alert('Error al regenerar la comida. Intenta de nuevo.');
    } finally {
      setRegeneratingMeal(null);
    }
  };

  const regenerateIngredient = async (mealId, ingredient) => {
    const key = `${mealId}-${ingredient.name}`;
    setRegeneratingIngredient(key);
    try {
      const response = await coachApi.regenerateIngredient({
        meal_id: mealId,
        ingredient_name: ingredient.name,
        ingredient_calories: ingredient.calories,
        ingredient_protein: ingredient.protein
      });

      if (response.data.success) {
        // Update the local state with the new ingredient
        setTodayData(prev => ({
          ...prev,
          meals: prev.meals.map(m => {
            if (m.id === mealId) {
              const currentIngredients = m.ingredients?.main || [];
              const updatedIngredients = currentIngredients.map(ing =>
                ing.name === ingredient.name ? response.data.new_ingredient : ing
              );
              return {
                ...m,
                ingredients: { ...m.ingredients, main: updatedIngredients }
              };
            }
            return m;
          })
        }));
      }
    } catch (error) {
      console.error('Error regenerating ingredient:', error);
      alert('Error al cambiar el ingrediente. Intenta de nuevo.');
    } finally {
      setRegeneratingIngredient(null);
    }
  };

  const calculateTodayTotals = () => {
    return todayData.logged.reduce((acc, log) => ({
      calories: acc.calories + (log.calories || 0),
      protein: acc.protein + (parseFloat(log.protein_grams) || 0),
      carbs: acc.carbs + (parseFloat(log.carbs_grams) || 0),
      fat: acc.fat + (parseFloat(log.fat_grams) || 0)
    }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
  };

  const isMealLogged = (mealId) => {
    return todayData.logged.some(log => log.meal_id === mealId);
  };

  const toggleMealExpand = (mealId) => {
    setExpandedMeal(expandedMeal === mealId ? null : mealId);
  };

  // Parse ingredients from the JSON structure
  const parseIngredients = (ingredientsData) => {
    if (!ingredientsData) return { main: [], alternatives: [] };

    // If it's already an object with main/alternatives
    if (ingredientsData.main) {
      return ingredientsData;
    }

    // If it's an array (old format)
    if (Array.isArray(ingredientsData)) {
      return { main: ingredientsData, alternatives: [] };
    }

    // If it's a string, try to parse
    if (typeof ingredientsData === 'string') {
      try {
        const parsed = JSON.parse(ingredientsData);
        if (parsed.main) return parsed;
        if (Array.isArray(parsed)) return { main: parsed, alternatives: [] };
      } catch (e) {
        return { main: [], alternatives: [] };
      }
    }

    return { main: [], alternatives: [] };
  };

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <div className="skeleton h-12 w-32 rounded-lg"></div>
        <div className="skeleton h-24 rounded-2xl"></div>
        <div className="skeleton h-40 rounded-2xl"></div>
      </div>
    );
  }

  const totals = calculateTodayTotals();
  const targets = activePlan || { daily_calories: 2000, protein_grams: 150, carbs_grams: 200, fat_grams: 65 };

  return (
    <div className="p-4 space-y-6 safe-bottom">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Nutrición</h1>
        <button
          onClick={generatePlan}
          disabled={generating}
          className="btn-primary flex items-center gap-2 text-sm disabled:opacity-50"
        >
          {generating ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Sparkles size={18} />
          )}
          {generating ? 'Generando...' : 'Generar con IA'}
        </button>
      </div>

      {/* Nutrition Info Banner */}
      {nutritionInfo && (
        <div className="bg-gradient-to-r from-accent-primary/10 to-neon-purple/10 rounded-xl p-3 border border-accent-primary/20">
          <div className="flex items-center gap-2 mb-2">
            <Scale size={16} className="text-accent-primary" />
            <span className="text-xs text-gray-400">Tu metabolismo</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div>
              <p className="text-gray-400">TMB</p>
              <p className="font-bold text-accent-primary">{nutritionInfo.bmr} kcal</p>
            </div>
            <div>
              <p className="text-gray-400">TDEE</p>
              <p className="font-bold text-neon-purple">{nutritionInfo.tdee} kcal</p>
            </div>
            <div>
              <p className="text-gray-400">Objetivo</p>
              <p className="font-bold text-accent-success">{nutritionInfo.calories} kcal</p>
            </div>
          </div>
        </div>
      )}

      {/* Today's Macros */}
      <div className="card-glow">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Progreso de Hoy</h2>
          {todayData.logged.length > 0 && (
            <button
              onClick={clearTodayLogs}
              className={`w-8 h-8 rounded-lg flex items-center justify-center hover:bg-red-500/20 transition-colors ${
                isDark ? 'bg-dark-600' : 'bg-gray-200'
              }`}
              title="Reiniciar día"
            >
              <RotateCcw size={16} className={`hover:text-red-400 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
            </button>
          )}
        </div>

        {/* Calories Progress */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Flame size={20} className="text-accent-warning" />
              <span className="font-medium">Calorías</span>
            </div>
            <span className="text-sm">
              <span className={`font-bold ${isDark ? 'text-white' : 'text-gray-800'}`}>{totals.calories}</span>
              <span className={isDark ? 'text-gray-400' : 'text-gray-500'}> / {targets.daily_calories} kcal</span>
            </span>
          </div>
          <div className={`h-3 rounded-full overflow-hidden ${isDark ? 'bg-dark-700' : 'bg-gray-200'}`}>
            <div
              className="h-full bg-gradient-to-r from-accent-warning to-accent-danger rounded-full transition-all duration-500"
              style={{ width: `${Math.min((totals.calories / targets.daily_calories) * 100, 100)}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {targets.daily_calories - totals.calories > 0
              ? `Faltan ${targets.daily_calories - totals.calories} kcal`
              : 'Meta alcanzada'}
          </p>
        </div>

        {/* Macros Grid */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="w-14 h-14 bg-accent-danger/20 rounded-xl flex items-center justify-center mx-auto mb-2">
              <Drumstick size={28} className="text-accent-danger" />
            </div>
            <p className="text-xl font-bold">{Math.round(totals.protein)}g</p>
            <p className="text-xs text-gray-400">Proteína</p>
            <div className={`w-full h-1 rounded-full mt-2 ${isDark ? 'bg-dark-700' : 'bg-gray-200'}`}>
              <div
                className="h-full bg-accent-danger rounded-full"
                style={{ width: `${Math.min((totals.protein / targets.protein_grams) * 100, 100)}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">/ {targets.protein_grams}g</p>
          </div>

          <div className="text-center">
            <div className="w-14 h-14 bg-accent-warning/20 rounded-xl flex items-center justify-center mx-auto mb-2">
              <Wheat size={28} className="text-accent-warning" />
            </div>
            <p className="text-xl font-bold">{Math.round(totals.carbs)}g</p>
            <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Carbos</p>
            <div className={`w-full h-1 rounded-full mt-2 ${isDark ? 'bg-dark-700' : 'bg-gray-200'}`}>
              <div
                className="h-full bg-accent-warning rounded-full"
                style={{ width: `${Math.min((totals.carbs / targets.carbs_grams) * 100, 100)}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">/ {targets.carbs_grams}g</p>
          </div>

          <div className="text-center">
            <div className="w-14 h-14 bg-accent-primary/20 rounded-xl flex items-center justify-center mx-auto mb-2">
              <Droplets size={28} className="text-accent-primary" />
            </div>
            <p className="text-xl font-bold">{Math.round(totals.fat)}g</p>
            <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Grasas</p>
            <div className={`w-full h-1 rounded-full mt-2 ${isDark ? 'bg-dark-700' : 'bg-gray-200'}`}>
              <div
                className="h-full bg-accent-primary rounded-full"
                style={{ width: `${Math.min((totals.fat / targets.fat_grams) * 100, 100)}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">/ {targets.fat_grams}g</p>
          </div>
        </div>
      </div>

      {/* Today's Meals */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Comidas de Hoy</h2>

        {todayData.meals.length > 0 ? (
          <div className="space-y-4">
            {todayData.meals.map(meal => {
              const logged = isMealLogged(meal.id);
              const isExpanded = expandedMeal === meal.id;
              const ingredients = parseIngredients(meal.ingredients);

              return (
                <div
                  key={meal.id}
                  className={`rounded-2xl overflow-hidden border transition-all ${
                    logged
                      ? 'border-accent-success/30 bg-accent-success/5'
                      : isDark
                        ? 'border-dark-600 bg-dark-800'
                        : 'border-gray-200 bg-white/70 backdrop-blur-sm'
                  }`}
                >
                  {/* Meal Image */}
                  {meal.image_url && (
                    <div className="relative h-32 overflow-hidden">
                      <img
                        src={meal.image_url}
                        alt={meal.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                      {isDark && <div className="absolute inset-0 bg-gradient-to-t from-dark-900 to-transparent" />}
                      <div className="absolute bottom-2 left-3">
                        <span className={`text-xs backdrop-blur px-2 py-1 rounded-full ${
                          isDark ? 'bg-dark-900/80 text-white' : 'bg-white/90 text-gray-800'
                        }`}>
                          {mealTypeIcons[meal.meal_type]} {mealTypeLabels[meal.meal_type]}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="p-4">
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        {!meal.image_url && (
                          <p className="text-xs text-accent-primary font-medium mb-1">
                            {mealTypeIcons[meal.meal_type]} {mealTypeLabels[meal.meal_type]}
                          </p>
                        )}
                        <h3 className="font-semibold text-lg">{meal.name}</h3>
                        <div className="flex items-center gap-3 mt-1 text-sm">
                          <span className="text-accent-warning font-medium">{meal.calories} kcal</span>
                          <span className="text-gray-400">
                            P: {meal.protein_grams}g • C: {meal.carbs_grams}g • G: {meal.fat_grams}g
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        {/* Regenerate button */}
                        <button
                          onClick={() => regenerateMeal(meal)}
                          disabled={regeneratingMeal === meal.id}
                          className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors disabled:opacity-50 ${
                            isDark ? 'bg-dark-600 hover:bg-dark-500' : 'bg-gray-200 hover:bg-gray-300'
                          }`}
                          title="Cambiar por otra opción"
                        >
                          {regeneratingMeal === meal.id ? (
                            <Loader2 size={18} className="animate-spin text-accent-primary" />
                          ) : (
                            <RefreshCw size={18} className={isDark ? 'text-gray-400' : 'text-gray-500'} />
                          )}
                        </button>

                        {logged ? (
                          <div className="flex items-center gap-1">
                            <div className="w-8 h-8 bg-accent-success rounded-full flex items-center justify-center">
                              <Check size={16} className="text-dark-900" />
                            </div>
                            <button
                              onClick={() => unlogMeal(meal.id)}
                              className="w-8 h-8 bg-red-500/20 rounded-full flex items-center justify-center hover:bg-red-500 transition-colors"
                              title="Quitar comida registrada"
                            >
                              <X size={16} className="text-red-400 hover:text-white" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => logMeal(meal)}
                            className="w-10 h-10 bg-accent-primary rounded-full flex items-center justify-center hover:scale-105 transition-transform"
                          >
                            <Plus size={20} className="text-dark-900" />
                          </button>
                        )}
                      </div>
                    </div>

                    {meal.description && (
                      <p className="text-sm text-gray-400 mt-2">{meal.description}</p>
                    )}

                    {/* Expandable Content */}
                    <button
                      onClick={() => toggleMealExpand(meal.id)}
                      className="flex items-center gap-1 text-accent-primary text-sm mt-3 font-medium"
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp size={16} />
                          Ocultar detalles
                        </>
                      ) : (
                        <>
                          <ChevronDown size={16} />
                          Ver ingredientes y receta
                        </>
                      )}
                    </button>

                    {isExpanded && (
                      <div className="mt-4 space-y-4 animate-fade-in">
                        {/* Ingredients */}
                        {ingredients.main && ingredients.main.length > 0 && (
                          <div>
                            <h4 className={`text-sm font-semibold mb-2 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Ingredientes:</h4>
                            <div className={`rounded-xl p-3 space-y-2 ${isDark ? 'bg-dark-700/50' : 'bg-gray-100/80'}`}>
                              {ingredients.main.map((ing, i) => {
                                const isRegenerating = regeneratingIngredient === `${meal.id}-${ing.name}`;
                                return (
                                  <div key={i} className="flex items-center justify-between text-sm">
                                    <span className={`flex-1 ${isDark ? 'text-white' : 'text-gray-800'}`}>{ing.name}</span>
                                    <span className="text-accent-primary font-medium mr-2">{ing.amount}</span>
                                    <button
                                      onClick={() => regenerateIngredient(meal.id, ing)}
                                      disabled={isRegenerating}
                                      className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors disabled:opacity-50 ${
                                        isDark ? 'bg-dark-600 hover:bg-dark-500' : 'bg-gray-200 hover:bg-gray-300'
                                      }`}
                                      title="Cambiar ingrediente"
                                    >
                                      {isRegenerating ? (
                                        <Loader2 size={14} className="animate-spin text-accent-primary" />
                                      ) : (
                                        <RefreshCw size={14} className={isDark ? 'text-gray-400' : 'text-gray-500'} />
                                      )}
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Recipe */}
                        {meal.recipe && (
                          <div>
                            <h4 className={`text-sm font-semibold mb-2 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Preparación:</h4>
                            <div className={`rounded-xl p-3 ${isDark ? 'bg-dark-700/50' : 'bg-gray-100/80'}`}>
                              <p className={`text-sm whitespace-pre-line ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{meal.recipe}</p>
                            </div>
                          </div>
                        )}

                        {/* Alternatives */}
                        {ingredients.alternatives && ingredients.alternatives.length > 0 && (
                          <div>
                            <h4 className="text-sm font-semibold text-gray-300 mb-2">
                              Alternativas disponibles:
                            </h4>
                            <div className="space-y-2">
                              {ingredients.alternatives.map((alt, i) => (
                                <div key={i} className="bg-neon-purple/10 border border-neon-purple/20 rounded-xl p-3">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <p className="font-medium text-neon-purple">{alt.name}</p>
                                      <p className="text-xs text-gray-400">{alt.description}</p>
                                    </div>
                                    <div className="text-right text-xs">
                                      <p className="text-accent-warning">{alt.calories} kcal</p>
                                      <p className="text-gray-500">P: {alt.protein_grams}g</p>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="card text-center py-10">
            <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4 ${
              isDark ? 'bg-gradient-to-br from-dark-700 to-dark-800' : 'bg-gradient-to-br from-gray-100 to-gray-200'
            }`}>
              <UtensilsCrossed size={40} className="text-gray-500" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Sin plan de comidas</h3>
            <p className={`text-sm mb-6 max-w-xs mx-auto ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              Genera un plan nutricional personalizado basado en tus datos y objetivos
            </p>
            <button
              onClick={generatePlan}
              disabled={generating}
              className="btn-primary inline-flex items-center gap-2 disabled:opacity-50"
            >
              {generating ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Calculando tu plan...
                </>
              ) : (
                <>
                  <Sparkles size={18} />
                  Generar Plan Nutricional
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Plan Info */}
      {activePlan && (
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-accent-primary font-medium">Plan Activo</p>
              <h3 className="font-semibold">{activePlan.name}</h3>
            </div>
            {activePlan.ai_generated && (
              <span className="text-xs bg-neon-purple/20 text-neon-purple px-2 py-1 rounded-full">
                Generado por IA
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
