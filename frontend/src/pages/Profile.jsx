import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { user as userApi } from '../api';
import { ArrowLeft, LogOut, User, Target, Activity, Scale, Ruler, Calendar, Settings, ChevronRight } from 'lucide-react';

const activityLabels = {
  sedentary: 'Sedentario',
  light: 'Ligero',
  moderate: 'Moderado',
  active: 'Activo',
  very_active: 'Muy Activo'
};

const goalLabels = {
  lose_weight: 'Perder Peso',
  gain_muscle: 'Ganar Músculo',
  maintain: 'Mantener',
  improve_health: 'Mejorar Salud'
};

export default function Profile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const response = await userApi.getProfile();
      setProfile(response.data);
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const calculateAge = (birthDate) => {
    if (!birthDate) return null;
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <div className="skeleton h-32 rounded-2xl"></div>
        <div className="skeleton h-48 rounded-2xl"></div>
      </div>
    );
  }

  const age = calculateAge(profile?.birth_date);

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 bg-dark-700 rounded-xl flex items-center justify-center"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-2xl font-bold">Perfil</h1>
      </div>

      {/* Profile Card */}
      <div className="card-glow text-center">
        <div className="w-24 h-24 bg-gradient-to-br from-accent-primary to-neon-purple rounded-full flex items-center justify-center mx-auto mb-4 text-dark-900 text-4xl font-bold">
          {user?.name?.charAt(0).toUpperCase()}
        </div>
        <h2 className="text-xl font-bold">{user?.name}</h2>
        <p className="text-gray-400">{user?.email}</p>

        {profile?.fitness_goal && (
          <div className="mt-4 inline-flex items-center gap-2 bg-accent-primary/20 px-4 py-2 rounded-full">
            <Target size={16} className="text-accent-primary" />
            <span className="text-accent-primary text-sm font-medium">
              {goalLabels[profile.fitness_goal]}
            </span>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-2">
            <Scale size={18} className="text-accent-primary" />
            <span className="text-sm text-gray-400">Peso Actual</span>
          </div>
          <p className="text-xl font-bold">{profile?.current_weight_kg || '--'} kg</p>
        </div>

        <div className="stat-card">
          <div className="flex items-center gap-2 mb-2">
            <Target size={18} className="text-accent-success" />
            <span className="text-sm text-gray-400">Peso Objetivo</span>
          </div>
          <p className="text-xl font-bold">{profile?.target_weight_kg || '--'} kg</p>
        </div>

        <div className="stat-card">
          <div className="flex items-center gap-2 mb-2">
            <Ruler size={18} className="text-neon-purple" />
            <span className="text-sm text-gray-400">Altura</span>
          </div>
          <p className="text-xl font-bold">{profile?.height_cm || '--'} cm</p>
        </div>

        <div className="stat-card">
          <div className="flex items-center gap-2 mb-2">
            <Calendar size={18} className="text-accent-warning" />
            <span className="text-sm text-gray-400">Edad</span>
          </div>
          <p className="text-xl font-bold">{age || '--'} años</p>
        </div>
      </div>

      {/* Details */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between py-2 border-b border-dark-700">
          <div className="flex items-center gap-3">
            <Activity size={20} className="text-gray-400" />
            <span className="text-gray-300">Nivel de Actividad</span>
          </div>
          <span className="text-gray-400">
            {activityLabels[profile?.activity_level] || 'No definido'}
          </span>
        </div>

        <div className="flex items-center justify-between py-2 border-b border-dark-700">
          <div className="flex items-center gap-3">
            <Calendar size={20} className="text-gray-400" />
            <span className="text-gray-300">Días de Entreno</span>
          </div>
          <span className="text-gray-400">
            {profile?.workout_days_per_week || 3} días/semana
          </span>
        </div>

        <div className="flex items-center justify-between py-2 border-b border-dark-700">
          <div className="flex items-center gap-3">
            <User size={20} className="text-gray-400" />
            <span className="text-gray-300">Género</span>
          </div>
          <span className="text-gray-400">
            {profile?.gender === 'male' ? 'Masculino' : profile?.gender === 'female' ? 'Femenino' : 'No definido'}
          </span>
        </div>

        <div className="flex items-center justify-between py-2">
          <div className="flex items-center gap-3">
            <Settings size={20} className="text-gray-400" />
            <span className="text-gray-300">Comidas por día</span>
          </div>
          <span className="text-gray-400">{profile?.meals_per_day || 4}</span>
        </div>
      </div>

      {/* Dietary Preferences */}
      {(profile?.preferred_proteins?.length > 0 || profile?.preferred_carbs?.length > 0) && (
        <div className="card">
          <h3 className="font-semibold mb-3">Preferencias Alimenticias</h3>

          {profile?.preferred_proteins?.length > 0 && (
            <div className="mb-3">
              <p className="text-sm text-gray-400 mb-2">Proteínas</p>
              <div className="flex flex-wrap gap-2">
                {profile.preferred_proteins.map((item, i) => (
                  <span key={i} className="text-xs bg-accent-danger/20 text-accent-danger px-3 py-1 rounded-full">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          )}

          {profile?.preferred_carbs?.length > 0 && (
            <div>
              <p className="text-sm text-gray-400 mb-2">Carbohidratos</p>
              <div className="flex flex-wrap gap-2">
                {profile.preferred_carbs.map((item, i) => (
                  <span key={i} className="text-xs bg-accent-warning/20 text-accent-warning px-3 py-1 rounded-full">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="w-full flex items-center justify-center gap-3 py-4 bg-accent-danger/10 border border-accent-danger/30 rounded-xl text-accent-danger font-medium hover:bg-accent-danger/20 transition-colors"
      >
        <LogOut size={20} />
        Cerrar Sesión
      </button>
    </div>
  );
}
