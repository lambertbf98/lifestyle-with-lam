import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { user as userApi, workouts as workoutsApi } from '../api';
import { ArrowLeft, LogOut, User, Target, Activity, Scale, Ruler, Calendar, Settings, ChevronRight, Save, Trash2, Edit3, X, Check } from 'lucide-react';

const activityLabels = {
  sedentary: 'Sedentario',
  light: 'Ligero',
  moderate: 'Moderado',
  active: 'Activo',
  very_active: 'Muy Activo'
};

const activityOptions = [
  { value: 'sedentary', label: 'Sedentario', desc: 'Poco o nada de ejercicio' },
  { value: 'light', label: 'Ligero', desc: '1-2 días de ejercicio/semana' },
  { value: 'moderate', label: 'Moderado', desc: '3-5 días de ejercicio/semana' },
  { value: 'active', label: 'Activo', desc: '6-7 días de ejercicio/semana' },
  { value: 'very_active', label: 'Muy Activo', desc: 'Atleta o trabajo físico' }
];

const goalLabels = {
  lose_weight: 'Perder Peso',
  lose_weight_aggressive: 'Pérdida Agresiva (-500kcal)',
  gain_muscle: 'Ganar Músculo',
  maintain: 'Mantener',
  improve_health: 'Mejorar Salud'
};

const goalOptions = [
  { value: 'lose_weight', label: 'Perder Peso', desc: 'Déficit moderado (-300kcal)' },
  { value: 'lose_weight_aggressive', label: 'Pérdida Agresiva', desc: 'Déficit fuerte (-500kcal) - Sprint' },
  { value: 'gain_muscle', label: 'Ganar Músculo', desc: 'Superávit calórico (+300kcal)' },
  { value: 'maintain', label: 'Mantener', desc: 'Mantenimiento de peso' }
];

const commonDislikedFoods = [
  'Queso cottage', 'Brócoli', 'Espinacas', 'Coliflor', 'Hígado', 'Atún en lata',
  'Tofu', 'Avena', 'Claras de huevo', 'Requesón', 'Acelgas', 'Coles de Bruselas'
];

export default function Profile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(null); // 'settings', 'measurements', 'preferences'
  const [workoutHistory, setWorkoutHistory] = useState([]);
  const [formData, setFormData] = useState({});

  useEffect(() => {
    loadProfile();
    loadWorkoutHistory();
  }, []);

  const loadProfile = async () => {
    try {
      const response = await userApi.getProfile();
      setProfile(response.data);
      setFormData(response.data);
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadWorkoutHistory = async () => {
    try {
      const response = await workoutsApi.getHistory(50);
      setWorkoutHistory(response.data);
    } catch (error) {
      console.error('Error loading workout history:', error);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await userApi.updateProfile(formData);
      setProfile(formData);
      setEditMode(null);
    } catch (error) {
      console.error('Error saving profile:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const clearWorkoutHistory = async () => {
    if (!confirm('¿Seguro que quieres borrar todo el historial de entrenos? Esta acción no se puede deshacer.')) {
      return;
    }
    try {
      // Call API to clear history (we'll add this endpoint)
      await fetch('/api/workouts/clear-history', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      setWorkoutHistory([]);
      alert('Historial borrado correctamente');
    } catch (error) {
      console.error('Error clearing history:', error);
    }
  };

  const toggleDislikedFood = (food) => {
    const current = formData.disliked_foods || [];
    if (current.includes(food)) {
      setFormData({ ...formData, disliked_foods: current.filter(f => f !== food) });
    } else {
      setFormData({ ...formData, disliked_foods: [...current, food] });
    }
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
    <div className="p-4 space-y-6 pb-24">
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
              {goalLabels[profile.fitness_goal] || profile.fitness_goal}
            </span>
          </div>
        )}
      </div>

      {/* Configuración General */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-lg">Configuración</h3>
          {editMode === 'settings' ? (
            <div className="flex gap-2">
              <button onClick={() => setEditMode(null)} className="p-2 bg-dark-600 rounded-lg">
                <X size={18} />
              </button>
              <button onClick={handleSave} disabled={saving} className="p-2 bg-accent-primary rounded-lg text-dark-900">
                <Check size={18} />
              </button>
            </div>
          ) : (
            <button onClick={() => setEditMode('settings')} className="p-2 bg-dark-600 rounded-lg">
              <Edit3 size={18} />
            </button>
          )}
        </div>

        {editMode === 'settings' ? (
          <div className="space-y-4">
            {/* Objetivo */}
            <div>
              <label className="label">Objetivo</label>
              <div className="space-y-2">
                {goalOptions.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setFormData({ ...formData, fitness_goal: opt.value })}
                    className={`w-full p-3 rounded-xl border text-left transition-all ${
                      formData.fitness_goal === opt.value
                        ? 'bg-accent-primary/20 border-accent-primary'
                        : 'bg-dark-700 border-dark-600'
                    }`}
                  >
                    <div className={`font-medium ${formData.fitness_goal === opt.value ? 'text-accent-primary' : ''}`}>
                      {opt.label}
                    </div>
                    <div className="text-xs text-gray-400">{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Nivel de actividad */}
            <div>
              <label className="label">Nivel de Actividad</label>
              <div className="space-y-2">
                {activityOptions.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setFormData({ ...formData, activity_level: opt.value })}
                    className={`w-full p-3 rounded-xl border text-left transition-all ${
                      formData.activity_level === opt.value
                        ? 'bg-accent-primary/20 border-accent-primary'
                        : 'bg-dark-700 border-dark-600'
                    }`}
                  >
                    <div className={`font-medium ${formData.activity_level === opt.value ? 'text-accent-primary' : ''}`}>
                      {opt.label}
                    </div>
                    <div className="text-xs text-gray-400">{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Días de entreno */}
            <div>
              <label className="label">Días de Entrenamiento por Semana</label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="1"
                  max="7"
                  value={formData.workout_days_per_week || 3}
                  onChange={(e) => setFormData({ ...formData, workout_days_per_week: parseInt(e.target.value) })}
                  className="flex-1 accent-accent-primary"
                />
                <span className="text-2xl font-bold text-accent-primary w-8">
                  {formData.workout_days_per_week || 3}
                </span>
              </div>
            </div>

            {/* Comidas por día */}
            <div>
              <label className="label">Comidas por Día</label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="3"
                  max="6"
                  value={formData.meals_per_day || 5}
                  onChange={(e) => setFormData({ ...formData, meals_per_day: parseInt(e.target.value) })}
                  className="flex-1 accent-accent-primary"
                />
                <span className="text-2xl font-bold text-accent-primary w-8">
                  {formData.meals_per_day || 5}
                </span>
              </div>
            </div>

            {/* Peso actual y objetivo */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Peso Actual (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.current_weight_kg || ''}
                  onChange={(e) => setFormData({ ...formData, current_weight_kg: e.target.value })}
                  className="input"
                />
              </div>
              <div>
                <label className="label">Peso Objetivo (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.target_weight_kg || ''}
                  onChange={(e) => setFormData({ ...formData, target_weight_kg: e.target.value })}
                  className="input"
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-dark-700">
              <span className="text-gray-300">Objetivo</span>
              <span className="text-gray-400">{goalLabels[profile?.fitness_goal] || 'No definido'}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-dark-700">
              <span className="text-gray-300">Nivel de Actividad</span>
              <span className="text-gray-400">{activityLabels[profile?.activity_level] || 'No definido'}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-dark-700">
              <span className="text-gray-300">Días de Entreno</span>
              <span className="text-gray-400">{profile?.workout_days_per_week || 3} días/semana</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-dark-700">
              <span className="text-gray-300">Comidas por día</span>
              <span className="text-gray-400">{profile?.meals_per_day || 5}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-gray-300">Peso</span>
              <span className="text-gray-400">{profile?.current_weight_kg || '--'} → {profile?.target_weight_kg || '--'} kg</span>
            </div>
          </div>
        )}
      </div>

      {/* Medidas Corporales */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-lg">Medidas Corporales</h3>
          {editMode === 'measurements' ? (
            <div className="flex gap-2">
              <button onClick={() => setEditMode(null)} className="p-2 bg-dark-600 rounded-lg">
                <X size={18} />
              </button>
              <button onClick={handleSave} disabled={saving} className="p-2 bg-accent-primary rounded-lg text-dark-900">
                <Check size={18} />
              </button>
            </div>
          ) : (
            <button onClick={() => setEditMode('measurements')} className="p-2 bg-dark-600 rounded-lg">
              <Edit3 size={18} />
            </button>
          )}
        </div>

        {editMode === 'measurements' ? (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Pecho (cm)</label>
              <input
                type="number"
                step="0.1"
                value={formData.chest_cm || ''}
                onChange={(e) => setFormData({ ...formData, chest_cm: e.target.value })}
                className="input"
                placeholder="95"
              />
            </div>
            <div>
              <label className="label">Cintura (cm)</label>
              <input
                type="number"
                step="0.1"
                value={formData.waist_cm || ''}
                onChange={(e) => setFormData({ ...formData, waist_cm: e.target.value })}
                className="input"
                placeholder="80"
              />
            </div>
            <div>
              <label className="label">Cadera (cm)</label>
              <input
                type="number"
                step="0.1"
                value={formData.hips_cm || ''}
                onChange={(e) => setFormData({ ...formData, hips_cm: e.target.value })}
                className="input"
                placeholder="100"
              />
            </div>
            <div>
              <label className="label">Bícep (cm)</label>
              <input
                type="number"
                step="0.1"
                value={formData.bicep_cm || ''}
                onChange={(e) => setFormData({ ...formData, bicep_cm: e.target.value })}
                className="input"
                placeholder="32"
              />
            </div>
            <div>
              <label className="label">Muslo (cm)</label>
              <input
                type="number"
                step="0.1"
                value={formData.thigh_cm || ''}
                onChange={(e) => setFormData({ ...formData, thigh_cm: e.target.value })}
                className="input"
                placeholder="55"
              />
            </div>
            <div>
              <label className="label">Gemelo (cm)</label>
              <input
                type="number"
                step="0.1"
                value={formData.calf_cm || ''}
                onChange={(e) => setFormData({ ...formData, calf_cm: e.target.value })}
                className="input"
                placeholder="38"
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-dark-700/50 rounded-xl p-3 text-center">
              <p className="text-xs text-gray-400">Pecho</p>
              <p className="font-bold">{profile?.chest_cm || '--'} cm</p>
            </div>
            <div className="bg-dark-700/50 rounded-xl p-3 text-center">
              <p className="text-xs text-gray-400">Cintura</p>
              <p className="font-bold">{profile?.waist_cm || '--'} cm</p>
            </div>
            <div className="bg-dark-700/50 rounded-xl p-3 text-center">
              <p className="text-xs text-gray-400">Cadera</p>
              <p className="font-bold">{profile?.hips_cm || '--'} cm</p>
            </div>
            <div className="bg-dark-700/50 rounded-xl p-3 text-center">
              <p className="text-xs text-gray-400">Bícep</p>
              <p className="font-bold">{profile?.bicep_cm || '--'} cm</p>
            </div>
            <div className="bg-dark-700/50 rounded-xl p-3 text-center">
              <p className="text-xs text-gray-400">Muslo</p>
              <p className="font-bold">{profile?.thigh_cm || '--'} cm</p>
            </div>
            <div className="bg-dark-700/50 rounded-xl p-3 text-center">
              <p className="text-xs text-gray-400">Gemelo</p>
              <p className="font-bold">{profile?.calf_cm || '--'} cm</p>
            </div>
          </div>
        )}
      </div>

      {/* Alimentos NO deseados */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-lg">Alimentos NO Deseados</h3>
          {editMode === 'disliked' ? (
            <div className="flex gap-2">
              <button onClick={() => setEditMode(null)} className="p-2 bg-dark-600 rounded-lg">
                <X size={18} />
              </button>
              <button onClick={handleSave} disabled={saving} className="p-2 bg-accent-primary rounded-lg text-dark-900">
                <Check size={18} />
              </button>
            </div>
          ) : (
            <button onClick={() => setEditMode('disliked')} className="p-2 bg-dark-600 rounded-lg">
              <Edit3 size={18} />
            </button>
          )}
        </div>

        {editMode === 'disliked' ? (
          <div>
            <p className="text-sm text-gray-400 mb-3">Selecciona los alimentos que NO quieres que aparezcan en tu dieta:</p>
            <div className="flex flex-wrap gap-2">
              {commonDislikedFoods.map(food => (
                <button
                  key={food}
                  onClick={() => toggleDislikedFood(food)}
                  className={`px-4 py-2 rounded-full border text-sm transition-all ${
                    (formData.disliked_foods || []).includes(food)
                      ? 'bg-accent-danger/20 border-accent-danger text-accent-danger'
                      : 'bg-dark-700 border-dark-600 text-gray-300'
                  }`}
                >
                  {food}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div>
            {(profile?.disliked_foods?.length > 0) ? (
              <div className="flex flex-wrap gap-2">
                {profile.disliked_foods.map((food, i) => (
                  <span key={i} className="text-xs bg-accent-danger/20 text-accent-danger px-3 py-1 rounded-full">
                    {food}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No hay alimentos excluidos</p>
            )}
          </div>
        )}
      </div>

      {/* Preferencias Alimenticias */}
      {(profile?.preferred_proteins?.length > 0 || profile?.preferred_carbs?.length > 0) && (
        <div className="card">
          <h3 className="font-semibold mb-3">Preferencias Alimenticias</h3>

          {profile?.preferred_proteins?.length > 0 && (
            <div className="mb-3">
              <p className="text-sm text-gray-400 mb-2">Proteínas preferidas</p>
              <div className="flex flex-wrap gap-2">
                {profile.preferred_proteins.map((item, i) => (
                  <span key={i} className="text-xs bg-accent-success/20 text-accent-success px-3 py-1 rounded-full">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          )}

          {profile?.preferred_carbs?.length > 0 && (
            <div>
              <p className="text-sm text-gray-400 mb-2">Carbohidratos preferidos</p>
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

      {/* Historial de entrenos - Borrar */}
      {workoutHistory.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Historial de Entrenos</h3>
              <p className="text-sm text-gray-400">{workoutHistory.length} entrenos registrados</p>
            </div>
            <button
              onClick={clearWorkoutHistory}
              className="flex items-center gap-2 px-4 py-2 bg-accent-danger/10 border border-accent-danger/30 rounded-xl text-accent-danger text-sm hover:bg-accent-danger/20 transition-colors"
            >
              <Trash2 size={16} />
              Borrar
            </button>
          </div>
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
