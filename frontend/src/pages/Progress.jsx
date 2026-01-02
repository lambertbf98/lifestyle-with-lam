import { useState, useEffect } from 'react';
import { progress as progressApi, user as userApi } from '../api';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, Area, AreaChart } from 'recharts';
import { TrendingDown, TrendingUp, Scale, Trophy, Target, Calendar, Plus, Ruler, Trash2, RotateCcw } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

export default function Progress() {
  const [progressData, setProgressData] = useState(null);
  const [weeklySummary, setWeeklySummary] = useState(null);
  const [achievements, setAchievements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(30);
  const [showWeightModal, setShowWeightModal] = useState(false);
  const [showMeasurementsModal, setShowMeasurementsModal] = useState(false);
  const [newWeight, setNewWeight] = useState('');
  const [measurements, setMeasurements] = useState({
    chest_cm: '',
    waist_cm: '',
    hips_cm: '',
    bicep_cm: '',
    thigh_cm: ''
  });
  const [measurementsHistory, setMeasurementsHistory] = useState([]);

  useEffect(() => {
    loadData();
  }, [period]);

  const loadData = async () => {
    try {
      const [progressRes, summaryRes, achievementsRes, measurementsRes] = await Promise.all([
        progressApi.get(period),
        progressApi.getWeeklySummary(),
        progressApi.getAchievements(),
        userApi.getMeasurementsHistory(period)
      ]);
      setProgressData(progressRes.data);
      setWeeklySummary(summaryRes.data);
      setAchievements(achievementsRes.data);
      setMeasurementsHistory(measurementsRes.data || []);
    } catch (error) {
      console.error('Error loading progress:', error);
    } finally {
      setLoading(false);
    }
  };

  const addWeight = async () => {
    if (!newWeight) return;

    try {
      await userApi.addWeight({ weight_kg: parseFloat(newWeight) });
      setNewWeight('');
      setShowWeightModal(false);
      await loadData();
    } catch (error) {
      console.error('Error adding weight:', error);
    }
  };

  const addMeasurements = async () => {
    const hasValue = Object.values(measurements).some(v => v !== '');
    if (!hasValue) return;

    try {
      const data = {};
      Object.entries(measurements).forEach(([key, value]) => {
        if (value !== '') {
          data[key] = parseFloat(value);
        }
      });
      await userApi.addMeasurements(data);
      setMeasurements({
        chest_cm: '',
        waist_cm: '',
        hips_cm: '',
        bicep_cm: '',
        thigh_cm: ''
      });
      setShowMeasurementsModal(false);
      await loadData();
    } catch (error) {
      console.error('Error adding measurements:', error);
    }
  };

  const deleteMeasurement = async (id) => {
    if (!window.confirm('¿Eliminar esta medida?')) return;
    try {
      await userApi.deleteMeasurement(id);
      await loadData();
    } catch (error) {
      console.error('Error deleting measurement:', error);
    }
  };

  const clearWeightHistory = async () => {
    if (!window.confirm('¿Eliminar todo el historial de peso? Esta acción no se puede deshacer.')) return;
    try {
      await userApi.clearWeightHistory();
      await loadData();
    } catch (error) {
      console.error('Error clearing weight history:', error);
    }
  };

  const formatWeightData = () => {
    if (!progressData?.weight?.history) return [];
    return progressData.weight.history.map(entry => ({
      date: format(parseISO(entry.recorded_at), 'dd/MM', { locale: es }),
      weight: parseFloat(entry.weight_kg),
      fullDate: format(parseISO(entry.recorded_at), 'dd MMM yyyy', { locale: es })
    }));
  };

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <div className="skeleton h-12 w-32 rounded-lg"></div>
        <div className="skeleton h-48 rounded-2xl"></div>
        <div className="grid grid-cols-2 gap-4">
          <div className="skeleton h-28 rounded-2xl"></div>
          <div className="skeleton h-28 rounded-2xl"></div>
        </div>
      </div>
    );
  }

  const weightData = formatWeightData();
  const weightChange = progressData?.weight?.current && progressData?.weight?.initial
    ? (parseFloat(progressData.weight.current) - parseFloat(progressData.weight.initial)).toFixed(1)
    : null;

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Progreso</h1>
        <div className="flex gap-2">
          {[7, 30, 90].map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1 rounded-lg text-sm transition-all ${
                period === p
                  ? 'bg-accent-primary text-dark-900'
                  : 'bg-dark-700 text-gray-400'
              }`}
            >
              {p}d
            </button>
          ))}
        </div>
      </div>

      {/* Weight Chart */}
      <div className="card-glow">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold">Peso</h2>
            <p className="text-sm text-gray-400">Últimos {period} días</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={clearWeightHistory}
              className="w-10 h-10 bg-red-500/20 rounded-xl flex items-center justify-center hover:bg-red-500/30 transition-colors"
              title="Reiniciar historial"
            >
              <RotateCcw size={18} className="text-red-400" />
            </button>
            <button
              onClick={() => setShowWeightModal(true)}
              className="w-10 h-10 bg-accent-primary/20 rounded-xl flex items-center justify-center hover:bg-accent-primary/30 transition-colors"
            >
              <Plus size={20} className="text-accent-primary" />
            </button>
          </div>
        </div>

        {weightData.length > 0 ? (
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weightData}>
                <defs>
                  <linearGradient id="weightGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  stroke="#475569"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#475569"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  domain={['dataMin - 2', 'dataMax + 2']}
                  tickFormatter={(val) => `${val}kg`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '12px',
                    color: '#fff'
                  }}
                  formatter={(value) => [`${value} kg`, 'Peso']}
                  labelFormatter={(label, payload) => payload[0]?.payload?.fullDate || label}
                />
                <Area
                  type="monotone"
                  dataKey="weight"
                  stroke="#22d3ee"
                  strokeWidth={2}
                  fill="url(#weightGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-48 flex items-center justify-center">
            <div className="text-center">
              <Scale size={32} className="text-gray-600 mx-auto mb-2" />
              <p className="text-gray-500">Sin datos de peso</p>
              <button
                onClick={() => setShowWeightModal(true)}
                className="text-accent-primary text-sm mt-2"
              >
                Registrar peso
              </button>
            </div>
          </div>
        )}

        {/* Weight Stats */}
        <div className="grid grid-cols-4 gap-2 mt-4 pt-4 border-t border-dark-600">
          <div className="text-center">
            <p className="text-xl font-bold">{progressData?.weight?.initial || '--'}</p>
            <p className="text-xs text-gray-400">Inicial</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold">{progressData?.weight?.current || '--'}</p>
            <p className="text-xs text-gray-400">Actual</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold">{progressData?.weight?.target || '--'}</p>
            <p className="text-xs text-gray-400">Objetivo</p>
          </div>
          <div className="text-center">
            <p className={`text-xl font-bold ${
              weightChange && parseFloat(weightChange) < 0 ? 'text-accent-success' : 'text-accent-warning'
            }`}>
              {weightChange ? `${parseFloat(weightChange) > 0 ? '+' : ''}${weightChange}` : '--'}
            </p>
            <p className="text-xs text-gray-400">Diferencia</p>
          </div>
        </div>
      </div>

      {/* Body Measurements */}
      <div className="card-glow">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold">Medidas Corporales</h2>
            <p className="text-sm text-gray-400">Seguimiento en cm</p>
          </div>
          <button
            onClick={() => setShowMeasurementsModal(true)}
            className="w-10 h-10 bg-neon-purple/20 rounded-xl flex items-center justify-center hover:bg-neon-purple/30 transition-colors"
          >
            <Plus size={20} className="text-neon-purple" />
          </button>
        </div>

        {measurementsHistory.length > 0 ? (
          <div className="space-y-3">
            {/* Latest measurements */}
            <div className="grid grid-cols-5 gap-2 text-center">
              {[
                { key: 'chest_cm', label: 'Pecho' },
                { key: 'waist_cm', label: 'Cintura' },
                { key: 'hips_cm', label: 'Cadera' },
                { key: 'bicep_cm', label: 'Brazo' },
                { key: 'thigh_cm', label: 'Muslo' }
              ].map(({ key, label }) => {
                const latest = measurementsHistory[0]?.[key];
                const previous = measurementsHistory[1]?.[key];
                const diff = latest && previous ? (latest - previous).toFixed(1) : null;
                return (
                  <div key={key} className="bg-dark-700/50 rounded-xl p-2">
                    <p className="text-lg font-bold">{latest || '--'}</p>
                    <p className="text-xs text-gray-400">{label}</p>
                    {diff && (
                      <p className={`text-xs ${parseFloat(diff) < 0 ? 'text-accent-success' : 'text-accent-warning'}`}>
                        {parseFloat(diff) > 0 ? '+' : ''}{diff}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
            {measurementsHistory[0]?.recorded_at && (
              <div className="flex items-center justify-center gap-2">
                <p className="text-xs text-gray-500">
                  Último registro: {format(parseISO(measurementsHistory[0].recorded_at), 'dd MMM yyyy', { locale: es })}
                </p>
                <button
                  onClick={() => deleteMeasurement(measurementsHistory[0].id)}
                  className="text-red-400 hover:text-red-300 p-1"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-6">
            <Ruler size={32} className="text-gray-600 mx-auto mb-2" />
            <p className="text-gray-500">Sin medidas registradas</p>
            <button
              onClick={() => setShowMeasurementsModal(true)}
              className="text-neon-purple text-sm mt-2"
            >
              Registrar medidas
            </button>
          </div>
        )}
      </div>

      {/* Weekly Summary */}
      {weeklySummary && (
        <div className="grid grid-cols-2 gap-4">
          <div className="stat-card">
            <div className="flex items-center gap-2 mb-2">
              <Calendar size={18} className="text-neon-purple" />
              <span className="text-sm text-gray-400">Entrenos</span>
            </div>
            <p className="text-2xl font-bold">{weeklySummary.workouts?.count || 0}</p>
            <p className="text-xs text-gray-500">
              {weeklySummary.workouts?.totalMinutes || 0} min esta semana
            </p>
          </div>

          <div className="stat-card">
            <div className="flex items-center gap-2 mb-2">
              <Target size={18} className="text-accent-primary" />
              <span className="text-sm text-gray-400">Calorías</span>
            </div>
            <p className="text-2xl font-bold">{weeklySummary.nutrition?.avgCalories || 0}</p>
            <p className="text-xs text-gray-500">promedio diario</p>
          </div>
        </div>
      )}

      {/* Achievements */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Logros</h2>
        {achievements.length > 0 ? (
          <div className="space-y-3">
            {achievements.map(achievement => (
              <div key={achievement.id} className="card flex items-center gap-4">
                <div className="w-12 h-12 bg-accent-warning/20 rounded-xl flex items-center justify-center">
                  <Trophy size={24} className="text-accent-warning" />
                </div>
                <div>
                  <h3 className="font-semibold">{achievement.title}</h3>
                  <p className="text-sm text-gray-400">{achievement.description}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card text-center py-6">
            <Trophy size={32} className="text-gray-600 mx-auto mb-2" />
            <p className="text-gray-500">Completa retos para desbloquear logros</p>
          </div>
        )}
      </div>

      {/* Weight Modal */}
      {showWeightModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-dark-800 rounded-2xl w-full max-w-sm p-6 animate-slide-up">
            <h3 className="text-xl font-bold mb-4">Registrar Peso</h3>
            <div className="mb-4">
              <label className="label">Peso (kg)</label>
              <input
                type="number"
                step="0.1"
                value={newWeight}
                onChange={(e) => setNewWeight(e.target.value)}
                className="input text-2xl text-center"
                autoFocus
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowWeightModal(false)}
                className="btn-secondary flex-1"
              >
                Cancelar
              </button>
              <button
                onClick={addWeight}
                disabled={!newWeight}
                className="btn-primary flex-1 disabled:opacity-50"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Measurements Modal */}
      {showMeasurementsModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-dark-800 rounded-2xl w-full max-w-sm p-6 animate-slide-up max-h-[80vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">Registrar Medidas</h3>
            <div className="space-y-3">
              <div>
                <label className="label">Pecho (cm)</label>
                <input
                  type="number"
                  step="0.1"
                  value={measurements.chest_cm}
                  onChange={(e) => setMeasurements(prev => ({ ...prev, chest_cm: e.target.value }))}
                  className="input"
                />
              </div>
              <div>
                <label className="label">Cintura (cm)</label>
                <input
                  type="number"
                  step="0.1"
                  value={measurements.waist_cm}
                  onChange={(e) => setMeasurements(prev => ({ ...prev, waist_cm: e.target.value }))}
                  className="input"
                />
              </div>
              <div>
                <label className="label">Cadera (cm)</label>
                <input
                  type="number"
                  step="0.1"
                  value={measurements.hips_cm}
                  onChange={(e) => setMeasurements(prev => ({ ...prev, hips_cm: e.target.value }))}
                  className="input"
                />
              </div>
              <div>
                <label className="label">Brazo (cm)</label>
                <input
                  type="number"
                  step="0.1"
                  value={measurements.bicep_cm}
                  onChange={(e) => setMeasurements(prev => ({ ...prev, bicep_cm: e.target.value }))}
                  className="input"
                />
              </div>
              <div>
                <label className="label">Muslo (cm)</label>
                <input
                  type="number"
                  step="0.1"
                  value={measurements.thigh_cm}
                  onChange={(e) => setMeasurements(prev => ({ ...prev, thigh_cm: e.target.value }))}
                  className="input"
                />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-3">Solo rellena las medidas que quieras registrar</p>
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setShowMeasurementsModal(false)}
                className="btn-secondary flex-1"
              >
                Cancelar
              </button>
              <button
                onClick={addMeasurements}
                disabled={!Object.values(measurements).some(v => v !== '')}
                className="btn-primary flex-1 disabled:opacity-50"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
