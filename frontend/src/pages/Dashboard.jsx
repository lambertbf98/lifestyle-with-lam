import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { user as userApi, progress as progressApi, workouts as workoutsApi } from '../api';
import { Dumbbell, Flame, TrendingDown, TrendingUp, Trophy, ChevronRight, Sparkles } from 'lucide-react';

export default function Dashboard() {
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState(null);
  const [activePlan, setActivePlan] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const [dashboardRes, planRes] = await Promise.all([
        userApi.getDashboard(),
        workoutsApi.getActivePlan()
      ]);
      setDashboard(dashboardRes.data);
      setActivePlan(planRes.data);
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
          <p className="text-gray-400">{getGreeting()}</p>
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

        {/* Streak */}
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-accent-warning/20 rounded-lg flex items-center justify-center">
              <Flame size={18} className="text-accent-warning" />
            </div>
            <span className="text-sm text-gray-400">Racha</span>
          </div>
          <p className="text-2xl font-bold">{dashboard?.streak || 0}</p>
          <p className="text-sm text-gray-500">días seguidos</p>
        </div>

        {/* Goal Progress */}
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-accent-success/20 rounded-lg flex items-center justify-center">
              <Trophy size={18} className="text-accent-success" />
            </div>
            <span className="text-sm text-gray-400">Objetivo</span>
          </div>
          <p className="text-2xl font-bold">{dashboard?.targetWeight || '--'} kg</p>
          <p className="text-sm text-gray-500">meta de peso</p>
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
          <div className="space-y-3">
            {activePlan.days.slice(0, 2).map((day) => (
              <Link
                key={day.id}
                to={`/workout-session/${day.id}`}
                className="block bg-dark-700/50 rounded-xl p-4 border border-dark-600 hover:border-accent-primary/30 transition-all"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">{day.name}</h3>
                    <p className="text-sm text-gray-400">
                      {day.exercises?.length || 0} ejercicios
                    </p>
                  </div>
                  <div className="w-10 h-10 bg-accent-primary/20 rounded-xl flex items-center justify-center">
                    <Dumbbell size={20} className="text-accent-primary" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <Link
            to="/coach"
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
        className="card bg-gradient-to-br from-neon-purple/10 to-dark-800 border-neon-purple/20 hover:border-neon-purple/40 transition-all"
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-neon-purple/20 rounded-xl flex items-center justify-center">
            <TrendingUp size={24} className="text-neon-purple" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-lg">Ver Progreso</p>
            <p className="text-sm text-gray-400">Gráficas, estadísticas y logros</p>
          </div>
          <ChevronRight size={20} className="text-gray-400" />
        </div>
      </Link>
    </div>
  );
}
