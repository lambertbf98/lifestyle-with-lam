import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { workouts as workoutsApi, coach as coachApi } from '../api';
import { Dumbbell, ChevronRight, Sparkles, Clock, Target, Loader2, Calendar, Trophy } from 'lucide-react';

export default function Workouts() {
  const [activePlan, setActivePlan] = useState(null);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [activeRes, plansRes, historyRes] = await Promise.all([
        workoutsApi.getActivePlan(),
        workoutsApi.getPlans(),
        workoutsApi.getHistory()
      ]);
      setActivePlan(activeRes.data);
      setPlans(plansRes.data);
      setHistory(historyRes.data || []);
    } catch (error) {
      console.error('Error loading workouts:', error);
    } finally {
      setLoading(false);
    }
  };

  const generatePlan = async () => {
    setGenerating(true);
    try {
      // El endpoint generate-workout ahora guarda el plan directamente
      const response = await coachApi.generateWorkout({});

      if (response.data.success) {
        // Recargar datos para mostrar el nuevo plan
        await loadData();
      }
    } catch (error) {
      console.error('Error generating plan:', error);
      alert('Error al generar el plan. Por favor intenta de nuevo.');
    } finally {
      setGenerating(false);
    }
  };

  const activatePlan = async (planId) => {
    try {
      // TODO: Implementar endpoint para activar plan
      await loadData();
    } catch (error) {
      console.error('Error activating plan:', error);
    }
  };

  // Calculate weekly stats
  const weekStats = {
    totalHours: history
      .filter(h => {
        const date = new Date(h.completed_at);
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        return date >= weekAgo;
      })
      .reduce((acc, h) => acc + (h.duration_minutes || 0), 0) / 60,
    completedWorkouts: history.filter(h => {
      const date = new Date(h.completed_at);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return date >= weekAgo;
    }).length
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
    <div className="p-4 space-y-6 safe-bottom">
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
          {generating ? 'Generando...' : 'Generar con IA'}
        </button>
      </div>

      {/* Active Plan */}
      {activePlan ? (
        <div className="card-glow">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs bg-accent-primary/20 text-accent-primary px-2 py-1 rounded-full font-medium">
                  Plan Activo
                </span>
                {activePlan.ai_generated && (
                  <span className="text-xs bg-neon-purple/20 text-neon-purple px-2 py-1 rounded-full">
                    IA
                  </span>
                )}
              </div>
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
            {activePlan.days?.map((day, index) => {
              const exerciseCount = day.exercises?.length || 0;
              const hasExercises = exerciseCount > 0;

              return (
                <Link
                  key={day.id}
                  to={`/workout-session/${day.id}`}
                  className="exercise-card group"
                >
                  <div className="w-12 h-12 bg-gradient-to-br from-accent-primary/30 to-neon-purple/20 rounded-xl flex items-center justify-center">
                    <span className="text-accent-primary font-bold text-lg">{index + 1}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate">{day.name}</h3>
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <span className="flex items-center gap-1">
                        <Dumbbell size={14} />
                        {exerciseCount} ejercicios
                      </span>
                      {day.focus_area && (
                        <>
                          <span>•</span>
                          <span>{day.focus_area}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <ChevronRight size={20} className="text-gray-500 group-hover:text-accent-primary transition-colors" />
                </Link>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="card text-center py-10">
          <div className="w-20 h-20 bg-gradient-to-br from-dark-700 to-dark-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Dumbbell size={40} className="text-gray-500" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Sin plan activo</h3>
          <p className="text-sm text-gray-400 mb-6 max-w-xs mx-auto">
            Genera un plan de entrenamiento personalizado basado en tus objetivos y nivel de experiencia
          </p>
          <button
            onClick={generatePlan}
            disabled={generating}
            className="btn-primary inline-flex items-center gap-2 disabled:opacity-50"
          >
            {generating ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Generando plan...
              </>
            ) : (
              <>
                <Sparkles size={18} />
                Generar Plan con IA
              </>
            )}
          </button>
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-2">
            <Clock size={18} className="text-accent-primary" />
            <span className="text-sm text-gray-400">Esta Semana</span>
          </div>
          <p className="text-2xl font-bold">
            {weekStats.totalHours.toFixed(1)} <span className="text-base font-normal text-gray-400">hrs</span>
          </p>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-2">
            <Trophy size={18} className="text-neon-purple" />
            <span className="text-sm text-gray-400">Completados</span>
          </div>
          <p className="text-2xl font-bold">
            {weekStats.completedWorkouts} <span className="text-base font-normal text-gray-400">entrenos</span>
          </p>
        </div>
      </div>

      {/* Previous Plans */}
      {plans.filter(p => !p.is_active).length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Calendar size={20} className="text-gray-400" />
            Planes Anteriores
          </h2>
          <div className="space-y-3">
            {plans.filter(p => !p.is_active).map(plan => (
              <div key={plan.id} className="card flex items-center justify-between">
                <div>
                  <h3 className="font-medium">{plan.name}</h3>
                  <p className="text-sm text-gray-400">
                    {plan.days_count} días • Semana {plan.week_number}
                  </p>
                </div>
                <button
                  onClick={() => activatePlan(plan.id)}
                  className="text-accent-primary text-sm font-medium hover:underline"
                >
                  Activar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
