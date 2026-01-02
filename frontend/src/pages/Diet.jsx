import { useState, useEffect } from 'react';
import { diet as dietApi, coach as coachApi } from '../api';
import { UtensilsCrossed, Plus, Sparkles, Flame, Drumstick, Wheat, Droplets, Check, Loader2 } from 'lucide-react';

const mealTypeLabels = {
  breakfast: 'Desayuno',
  lunch: 'Almuerzo',
  snack: 'Snack',
  dinner: 'Cena'
};

const mealTypeIcons = {
  breakfast: '🌅',
  lunch: '☀️',
  snack: '🍎',
  dinner: '🌙'
};

export default function Diet() {
  const [todayData, setTodayData] = useState({ meals: [], logged: [] });
  const [activePlan, setActivePlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showLogModal, setShowLogModal] = useState(false);
  const [selectedMeal, setSelectedMeal] = useState(null);

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
    } catch (error) {
      console.error('Error loading diet data:', error);
    } finally {
      setLoading(false);
    }
  };

  const generatePlan = async () => {
    setGenerating(true);
    try {
      const response = await coachApi.generateDiet({});
      const aiPlan = response.data.plan;

      await dietApi.createPlan({
        name: aiPlan.name,
        daily_calories: aiPlan.daily_calories,
        protein_grams: aiPlan.protein_grams,
        carbs_grams: aiPlan.carbs_grams,
        fat_grams: aiPlan.fat_grams,
        meals: aiPlan.meals.map((meal, index) => ({
          day_of_week: new Date().getDay(),
          meal_type: meal.meal_type,
          name: meal.name,
          description: meal.description,
          calories: meal.calories,
          protein_grams: meal.protein_grams,
          carbs_grams: meal.carbs_grams,
          fat_grams: meal.fat_grams,
          ingredients: meal.ingredients,
          recipe: meal.recipe
        }))
      });

      await loadData();
    } catch (error) {
      console.error('Error generating diet plan:', error);
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
    <div className="p-4 space-y-6">
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
          Generar con IA
        </button>
      </div>

      {/* Today's Macros */}
      <div className="card-glow">
        <h2 className="text-lg font-semibold mb-4">Hoy</h2>

        {/* Calories Progress */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Flame size={20} className="text-accent-warning" />
              <span className="font-medium">Calorías</span>
            </div>
            <span className="text-sm text-gray-400">
              {totals.calories} / {targets.daily_calories} kcal
            </span>
          </div>
          <div className="h-3 bg-dark-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-accent-warning to-accent-danger rounded-full transition-all duration-500"
              style={{ width: `${Math.min((totals.calories / targets.daily_calories) * 100, 100)}%` }}
            />
          </div>
        </div>

        {/* Macros Grid */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="w-12 h-12 bg-accent-danger/20 rounded-xl flex items-center justify-center mx-auto mb-2">
              <Drumstick size={24} className="text-accent-danger" />
            </div>
            <p className="text-lg font-bold">{Math.round(totals.protein)}g</p>
            <p className="text-xs text-gray-400">Proteína</p>
            <p className="text-xs text-gray-500">/ {targets.protein_grams}g</p>
          </div>

          <div className="text-center">
            <div className="w-12 h-12 bg-accent-warning/20 rounded-xl flex items-center justify-center mx-auto mb-2">
              <Wheat size={24} className="text-accent-warning" />
            </div>
            <p className="text-lg font-bold">{Math.round(totals.carbs)}g</p>
            <p className="text-xs text-gray-400">Carbos</p>
            <p className="text-xs text-gray-500">/ {targets.carbs_grams}g</p>
          </div>

          <div className="text-center">
            <div className="w-12 h-12 bg-accent-primary/20 rounded-xl flex items-center justify-center mx-auto mb-2">
              <Droplets size={24} className="text-accent-primary" />
            </div>
            <p className="text-lg font-bold">{Math.round(totals.fat)}g</p>
            <p className="text-xs text-gray-400">Grasas</p>
            <p className="text-xs text-gray-500">/ {targets.fat_grams}g</p>
          </div>
        </div>
      </div>

      {/* Today's Meals */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Comidas de Hoy</h2>

        {todayData.meals.length > 0 ? (
          <div className="space-y-3">
            {todayData.meals.map(meal => {
              const logged = isMealLogged(meal.id);
              return (
                <div
                  key={meal.id}
                  className={`meal-card ${logged ? 'border-accent-success/30 bg-accent-success/5' : ''}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="text-2xl">{mealTypeIcons[meal.meal_type]}</div>
                      <div>
                        <p className="text-xs text-accent-primary font-medium">
                          {mealTypeLabels[meal.meal_type]}
                        </p>
                        <h3 className="font-semibold">{meal.name}</h3>
                        <p className="text-sm text-gray-400 mt-1">
                          {meal.calories} kcal • {meal.protein_grams}g prot
                        </p>
                      </div>
                    </div>

                    {logged ? (
                      <div className="w-8 h-8 bg-accent-success rounded-full flex items-center justify-center">
                        <Check size={18} className="text-dark-900" />
                      </div>
                    ) : (
                      <button
                        onClick={() => logMeal(meal)}
                        className="w-8 h-8 bg-accent-primary/20 rounded-full flex items-center justify-center hover:bg-accent-primary/30 transition-colors"
                      >
                        <Plus size={18} className="text-accent-primary" />
                      </button>
                    )}
                  </div>

                  {meal.description && (
                    <p className="text-sm text-gray-500 mt-2">{meal.description}</p>
                  )}

                  {meal.ingredients && meal.ingredients.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-dark-600">
                      <p className="text-xs text-gray-500 mb-2">Ingredientes:</p>
                      <div className="flex flex-wrap gap-2">
                        {meal.ingredients.slice(0, 4).map((ing, i) => (
                          <span key={i} className="text-xs bg-dark-600 px-2 py-1 rounded-full">
                            {ing.name}
                          </span>
                        ))}
                        {meal.ingredients.length > 4 && (
                          <span className="text-xs text-gray-500">
                            +{meal.ingredients.length - 4} más
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="card text-center py-8">
            <div className="w-16 h-16 bg-dark-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <UtensilsCrossed size={32} className="text-gray-500" />
            </div>
            <h3 className="font-semibold mb-2">Sin plan de comidas</h3>
            <p className="text-sm text-gray-400 mb-4">
              Genera un plan nutricional personalizado con IA
            </p>
            <button
              onClick={generatePlan}
              disabled={generating}
              className="btn-primary inline-flex items-center gap-2 disabled:opacity-50"
            >
              {generating ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Sparkles size={18} />
              )}
              Generar Plan
            </button>
          </div>
        )}
      </div>

      {/* Quick Log Button */}
      <button
        onClick={() => setShowLogModal(true)}
        className="fixed bottom-24 right-4 w-14 h-14 bg-accent-primary rounded-full flex items-center justify-center shadow-neon-cyan z-40"
      >
        <Plus size={24} className="text-dark-900" />
      </button>
    </div>
  );
}
