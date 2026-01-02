import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { workouts as workoutsApi, coach as coachApi } from '../api';
import { Dumbbell, Plus, ChevronRight, Sparkles, Clock, Target, Loader2 } from 'lucide-react';

export default function Workouts() {
  const [activePlan, setActivePlan] = useState(null);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [activeRes, plansRes] = await Promise.all([
        workoutsApi.getActivePlan(),
        workoutsApi.getPlans()
      ]);
      setActivePlan(activeRes.data);
      setPlans(plansRes.data);
    } catch (error) {
      console.error('Error loading workouts:', error);
    } finally {
      setLoading(false);
    }
  };

  const generatePlan = async () => {
    setGenerating(true);
    try {
      const response = await coachApi.generateWorkout({});
      const aiPlan = response.data.plan;

      // Create the plan in database
      await workoutsApi.createPlan({
        name: aiPlan.name,
        description: aiPlan.description,
        days: aiPlan.days.map(day => ({
          day_of_week: day.day_of_week,
          name: day.name,
          focus_area: day.focus_area,
          exercises: day.exercises.map(ex => ({
            exercise_id: null, // Will need to match with database
            sets: ex.sets,
            reps: ex.reps,
            rest_seconds: ex.rest_seconds,
            notes: ex.notes,
            name: ex.name
          }))
        }))
      });

      await loadData();
    } catch (error) {
      console.error('Error generating plan:', error);
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <div className="skeleton h-12 w-48 rounded-lg"></div>
        <div className="skeleton h-40 rounded-2xl"></div>
        <div className="skeleton h-40 rounded-2xl"></div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Entrenamientos</h1>
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

      {/* Active Plan */}
      {activePlan ? (
        <div className="card-glow">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-accent-primary font-medium">Plan Activo</p>
              <h2 className="text-xl font-bold">{activePlan.name}</h2>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-400">Semana {activePlan.week_number}</p>
              <p className="text-sm text-gray-500">{activePlan.days?.length || 0} días</p>
            </div>
          </div>

          {activePlan.description && (
            <p className="text-sm text-gray-400 mb-4">{activePlan.description}</p>
          )}

          {/* Workout Days */}
          <div className="space-y-3">
            {activePlan.days?.map((day, index) => (
              <Link
                key={day.id}
                to={`/workout-session/${day.id}`}
                className="exercise-card"
              >
                <div className="w-10 h-10 bg-accent-primary/20 rounded-xl flex items-center justify-center text-accent-primary font-bold">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <h3 className="font-medium">{day.name}</h3>
                  <p className="text-sm text-gray-400">
                    {day.exercises?.length || 0} ejercicios • {day.focus_area || 'General'}
                  </p>
                </div>
                <ChevronRight size={20} className="text-gray-500" />
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <div className="card text-center py-8">
          <div className="w-16 h-16 bg-dark-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Dumbbell size={32} className="text-gray-500" />
          </div>
          <h3 className="font-semibold mb-2">Sin plan activo</h3>
          <p className="text-sm text-gray-400 mb-4">
            Genera un plan personalizado con IA o crea uno manualmente
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
            Generar Plan con IA
          </button>
        </div>
      )}

      {/* Previous Plans */}
      {plans.length > 1 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Planes Anteriores</h2>
          <div className="space-y-3">
            {plans.filter(p => !p.is_active).map(plan => (
              <div key={plan.id} className="card flex items-center justify-between">
                <div>
                  <h3 className="font-medium">{plan.name}</h3>
                  <p className="text-sm text-gray-400">
                    {plan.days_count} días • Semana {plan.week_number}
                  </p>
                </div>
                <button className="text-accent-primary text-sm">
                  Activar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-2">
            <Clock size={18} className="text-accent-primary" />
            <span className="text-sm text-gray-400">Esta Semana</span>
          </div>
          <p className="text-xl font-bold">0 horas</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-2">
            <Target size={18} className="text-neon-purple" />
            <span className="text-sm text-gray-400">Completados</span>
          </div>
          <p className="text-xl font-bold">0 entrenos</p>
        </div>
      </div>
    </div>
  );
}
