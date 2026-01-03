import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { user as userApi, progress as progressApi, workouts as workoutsApi } from '../api';
import { Dumbbell, TrendingDown, TrendingUp, Trophy, ChevronRight, Sparkles, CheckCircle } from 'lucide-react';

export default function Dashboard() {
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState(null);
  const [activePlan, setActivePlan] = useState(null);
  const [todayCompleted, setTodayCompleted] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const [dashboardRes, planRes, historyRes] = await Promise.all([
        userApi.getDashboard(),
        workoutsApi.getActivePlan(),
        workoutsApi.getHistory(10, 0)
      ]);
      setDashboard(dashboardRes.data);
      setActivePlan(planRes.data);

      // Check if today's workout was completed
      const today = new Date().toDateString();
      const completedToday = historyRes.data?.some(log => {
        const logDate = new Date(log.completed_at).toDateString();
        return logDate === today;
      });
      setTodayCompleted(completedToday);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Buenos días';
    if (hour < 18) return 'Buenas tardes';
    return 'Buenas noches';
  };

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <div className="skeleton h-24 rounded-2xl"></div>
        <div className="skeleton h-32 rounded-2xl"></div>
        <div className="grid grid-cols-2 gap-4">
          <div className="skeleton h-28 rounded-2xl"></div>
          <div className="skeleton h-28 rounded-2xl"></div>
        </div>
      </div>
    );
  }

  const weightChange = dashboard?.weightChange ? parseFloat(dashboard.weightChange) : 0;

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-500 dark:text-gray-400">{getGreeting()}</p>
          <h1 className="text-2xl font-bold">{user?.name?.split(' ')[0]}</h1>
        </div>
        <Link
          to="/profile"
          className="w-12 h-12 bg-gradient-to-br from-accent-primary to-neon-purple rounded-full flex items-center justify-center text-dark-900 font-bold text-lg"
        >
          {user?.name?.charAt(0).toUpperCase()}
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4">
        {/* Current Weight */}
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-accent-primary/20 rounded-lg flex items-center justify-center">
              {weightChange < 0 ? (
                <TrendingDown size={18} className="text-accent-success" />
              ) : (
                <TrendingUp size={18} className="text-accent-warning" />
              )}
            </div>
            <span className="text-sm text-gray-400">Peso</span>
          </div>
          <p className="text-2xl font-bold">{dashboard?.currentWeight || '--'} kg</p>
          {weightChange !== 0 && (
            <p className={`text-sm ${weightChange < 0 ? 'text-accent-success' : 'text-accent-warning'}`}>
              {weightChange > 0 ? '+' : ''}{weightChange} kg esta semana
            </p>
          )}
        </div>

        {/* Workouts This Week */}
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-neon-purple/20 rounded-lg flex items-center justify-center">
              <Dumbbell size={18} className="text-neon-purple" />
            </div>
            <span className="text-sm text-gray-400">Entrenos</span>
          </div>
          <p className="text-2xl font-bold">{dashboard?.workoutsThisWeek || 0}</p>
          <p className="text-sm text-gray-500">esta semana</p>
        </div>
      </div>

      {/* Objetivo - Full Width */}
      <div className="bg-gradient-to-r from-accent-success/10 to-gray-100 dark:to-dark-800 rounded-2xl p-4 border border-accent-success/30">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-accent-success/20 rounded-2xl flex items-center justify-center">
            <Trophy size={28} className="text-accent-success" />
          </div>
          <div className="flex-1">
            <p className="text-sm text-gray-500 dark:text-gray-400">Objetivo de peso</p>
            <p className="font-bold text-2xl">{dashboard?.targetWeight || '--'} kg</p>
          </div>
          {dashboard?.currentWeight && dashboard?.targetWeight && (
            <div className="text-right">
              <p className="text-sm text-gray-400">Faltan</p>
              <p className="font-bold text-xl text-accent-success">
                {Math.abs(parseFloat(dashboard.currentWeight) - parseFloat(dashboard.targetWeight)).toFixed(1)} kg
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Today's Workout */}
      <div className="card-glow">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Entreno de Hoy</h2>
          <Link to="/workouts" className="text-accent-primary text-sm flex items-center gap-1">
            Ver todos <ChevronRight size={16} />
          </Link>
        </div>

        {activePlan && activePlan.days?.length > 0 ? (
          (() => {
            // Map weekdays to workout days: Monday=1, Wednesday=3, Friday=5
            const today = new Date().getDay(); // 0=Sunday, 1=Monday, etc.
            const workoutDayMap = { 1: 0, 3: 1, 5: 2 }; // Mon->Day1, Wed->Day2, Fri->Day3
            const todayWorkoutIndex = workoutDayMap[today];

            if (todayWorkoutIndex !== undefined && activePlan.days[todayWorkoutIndex]) {
              const todayWorkout = activePlan.days[todayWorkoutIndex];

              // Show completed state if workout was done today
              if (todayCompleted) {
                return (
                  <div className="bg-accent-success/10 rounded-xl p-6 border border-accent-success/30 text-center">
                    <div className="w-16 h-16 bg-accent-success/20 rounded-full flex items-center justify-center mx-auto mb-3">
                      <CheckCircle size={32} className="text-accent-success" />
                    </div>
                    <h3 className="font-semibold text-lg mb-1 text-accent-success">¡Entreno Completado!</h3>
                    <p className="text-sm text-gray-400">
                      Has completado tu entreno de hoy. ¡Buen trabajo!
                    </p>
                  </div>
                );
              }

              return (
                <Link
                  to={`/workout-session/${todayWorkout.id}`}
                  className="block bg-gray-100 dark:bg-dark-700/50 rounded-xl p-4 border border-gray-200 dark:border-dark-600 hover:border-accent-primary/30 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium">{todayWorkout.name}</h3>
                      <p className="text-sm text-gray-400">
                        {todayWorkout.exercises?.length || 0} ejercicios • {todayWorkout.focus_area || 'General'}
                      </p>
                    </div>
                    <div className="w-10 h-10 bg-accent-primary/20 rounded-xl flex items-center justify-center">
                      <Dumbbell size={20} className="text-accent-primary" />
                    </div>
                  </div>
                </Link>
              );
            } else {
              // Rest day (Tuesday, Thursday, Saturday, Sunday)
              const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
              return (
                <div className="bg-gray-100 dark:bg-dark-700/50 rounded-xl p-6 border border-gray-200 dark:border-dark-600 text-center">
                  <div className="w-16 h-16 bg-neon-purple/20 rounded-full flex items-center justify-center mx-auto mb-3">
                    <span className="text-3xl">😴</span>
                  </div>
                  <h3 className="font-semibold text-lg mb-1">Día de Descanso</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Hoy es {dayNames[today]}. Próximo entreno: {today < 5 ? 'Viernes' : 'Lunes'}
                  </p>
                </div>
              );
            }
          })()
        ) : (
          <Link
            to="/workouts"
            className="block bg-gradient-to-r from-accent-primary/10 to-neon-purple/10 rounded-xl p-4 border border-accent-primary/20 hover:border-accent-primary/40 transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-accent-primary/20 rounded-xl flex items-center justify-center">
                <Sparkles size={24} className="text-accent-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-medium">Genera tu plan con IA</h3>
                <p className="text-sm text-gray-400">
                  Deja que tu coach personal cree tu rutina
                </p>
              </div>
              <ChevronRight size={20} className="text-gray-400" />
            </div>
          </Link>
        )}
      </div>

      {/* Quick Action */}
      <Link
        to="/progress"
        className="block bg-gradient-to-br from-neon-purple/10 to-gray-100 dark:to-dark-800 rounded-2xl p-4 border border-neon-purple/30 hover:border-neon-purple/50 transition-all shadow-lg"
      >
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-neon-purple/20 rounded-2xl flex items-center justify-center">
            <TrendingUp size={28} className="text-neon-purple" />
          </div>
          <div className="flex-1">
            <p className="font-bold text-xl">Ver Progreso</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Gráficas, estadísticas y logros</p>
          </div>
          <div className="w-10 h-10 bg-neon-purple/20 rounded-full flex items-center justify-center">
            <ChevronRight size={22} className="text-neon-purple" />
          </div>
        </div>
      </Link>

    </div>
  );
}
