import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { workouts as workoutsApi, coach as coachApi } from '../api';
import { useTheme } from '../contexts/ThemeContext';
import { Dumbbell, ChevronRight, Sparkles, Clock, Target, Loader2, Calendar, Trophy, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';

export default function Workouts() {
  const { isDark } = useTheme();
  const [activePlan, setActivePlan] = useState(null);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [history, setHistory] = useState([]);
  const [expandedDay, setExpandedDay] = useState(null);
  const [regeneratingExercise, setRegeneratingExercise] = useState(null);

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
      const response = await coachApi.generateWorkout({});
      if (response.data.success) {
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
      await loadData();
    } catch (error) {
      console.error('Error activating plan:', error);
    }
  };

  const regenerateExercise = async (exercise, dayIndex) => {
    setRegeneratingExercise(exercise.id);
    try {
      const response = await coachApi.regenerateExercise({
        workout_exercise_id: exercise.id,
        current_exercise_name: exercise.exercise?.name_es || exercise.exercise?.name,
        muscle_group: exercise.exercise?.muscle_group,
        sets: exercise.sets,
        reps: exercise.reps
      });

      if (response.data.success) {
        setActivePlan(prev => ({
          ...prev,
          days: prev.days.map((day, idx) =>
            idx === dayIndex
              ? {
                  ...day,
                  exercises: day.exercises.map(ex =>
                    ex.id === exercise.id
                      ? { ...ex, exercise: response.data.exercise.exercise }
                      : ex
                  )
                }
              : day
          )
        }));
      }
    } catch (error) {
      console.error('Error regenerating exercise:', error);
      alert('Error al cambiar el ejercicio. Intenta de nuevo.');
    } finally {
      setRegeneratingExercise(null);
    }
  };

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

  // Dynamic styles for light/dark mode
  const dayCardStyle = {
    background: isDark ? 'rgba(30, 41, 59, 1)' : 'rgba(255, 255, 255, 0.6)',
    backdropFilter: isDark ? 'none' : 'blur(10px)',
    border: isDark ? '1px solid rgba(51, 65, 85, 1)' : '1px solid rgba(255, 255, 255, 0.5)'
  };

  const exerciseStyle = {
    background: isDark ? 'rgba(51, 65, 85, 0.5)' : 'rgba(255, 255, 255, 0.5)',
    backdropFilter: isDark ? 'none' : 'blur(8px)'
  };

  const buttonStyle = {
    background: isDark ? 'rgba(51, 65, 85, 1)' : 'rgba(255, 255, 255, 0.6)'
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
              <p className="text-sm text-gray-500 dark:text-gray-400">Semana {activePlan.week_number}</p>
              <p className="text-sm text-gray-500">{activePlan.days?.length || 0} días</p>
            </div>
          </div>

          {activePlan.description && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{activePlan.description}</p>
          )}

          {/* Workout Days */}
          <div className="space-y-3">
            {activePlan.days?.map((day, dayIndex) => {
              const exerciseCount = day.exercises?.length || 0;
              const isExpanded = expandedDay === day.id;

              return (
                <div key={day.id} className="rounded-xl overflow-hidden" style={dayCardStyle}>
                  {/* Day Header */}
                  <button
                    onClick={() => setExpandedDay(isExpanded ? null : day.id)}
                    className="w-full p-4 flex items-center gap-4"
                  >
                    <div className="w-12 h-12 bg-gradient-to-br from-accent-primary/30 to-neon-purple/20 rounded-xl flex items-center justify-center">
                      <span className="text-accent-primary font-bold text-lg">{dayIndex + 1}</span>
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <h3 className="font-semibold truncate">{day.name}</h3>
                      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
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
                    {isExpanded ? (
                      <ChevronUp size={20} className="text-gray-400" />
                    ) : (
                      <ChevronDown size={20} className="text-gray-400" />
                    )}
                  </button>

                  {/* Exercises List (Expandable) */}
                  {isExpanded && (
                    <div className="border-t border-gray-200 dark:border-dark-600 p-3 space-y-2 animate-fade-in">
                      {day.exercises?.map((exercise) => (
                        <div
                          key={exercise.id}
                          className="flex items-center gap-3 p-3 rounded-xl"
                          style={exerciseStyle}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">
                              {exercise.exercise?.name_es || exercise.exercise?.name || 'Ejercicio'}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {exercise.sets} series × {exercise.reps} • {exercise.rest_seconds}s descanso
                            </p>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              regenerateExercise(exercise, dayIndex);
                            }}
                            disabled={regeneratingExercise === exercise.id}
                            className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors disabled:opacity-50"
                            style={buttonStyle}
                            title="Cambiar ejercicio"
                          >
                            {regeneratingExercise === exercise.id ? (
                              <Loader2 size={16} className="animate-spin text-accent-primary" />
                            ) : (
                              <RefreshCw size={16} className="text-gray-400" />
                            )}
                          </button>
                        </div>
                      ))}

                      {/* Start Workout Button */}
                      <Link
                        to={`/workout-session/${day.id}`}
                        className="block w-full py-3 mt-2 bg-gradient-to-r from-accent-primary to-neon-purple rounded-xl text-center font-semibold text-dark-900"
                      >
                        Comenzar Entreno
                      </Link>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="card text-center py-10">
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: isDark ? 'linear-gradient(to bottom right, #334155, #1e293b)' : 'rgba(255, 255, 255, 0.6)' }}
          >
            <Dumbbell size={40} className="text-gray-500" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Sin plan activo</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-xs mx-auto">
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
            <span className="text-sm text-gray-500 dark:text-gray-400">Esta Semana</span>
          </div>
          <p className="text-2xl font-bold">
            {weekStats.totalHours.toFixed(1)} <span className="text-base font-normal text-gray-500 dark:text-gray-400">hrs</span>
          </p>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-2">
            <Trophy size={18} className="text-neon-purple" />
            <span className="text-sm text-gray-500 dark:text-gray-400">Completados</span>
          </div>
          <p className="text-2xl font-bold">
            {weekStats.completedWorkouts} <span className="text-base font-normal text-gray-500 dark:text-gray-400">entrenos</span>
          </p>
        </div>
      </div>

    </div>
  );
}
