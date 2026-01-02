import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { user as userApi } from '../api';
import { ArrowLeft, ArrowRight, Check, Target, Scale, Ruler, Calendar, Activity, Utensils } from 'lucide-react';

const steps = [
  { id: 'basics', title: 'Datos Básicos', icon: Ruler },
  { id: 'goals', title: 'Objetivos', icon: Target },
  { id: 'activity', title: 'Actividad', icon: Activity },
  { id: 'diet', title: 'Alimentación', icon: Utensils }
];

const activityLevels = [
  { value: 'sedentary', label: 'Sedentario', desc: 'Poco o nada de ejercicio' },
  { value: 'light', label: 'Ligero', desc: '1-2 días de ejercicio/semana' },
  { value: 'moderate', label: 'Moderado', desc: '3-5 días de ejercicio/semana' },
  { value: 'active', label: 'Activo', desc: '6-7 días de ejercicio/semana' },
  { value: 'very_active', label: 'Muy Activo', desc: 'Atleta o trabajo físico' }
];

const fitnessGoals = [
  { value: 'lose_weight', label: 'Perder Peso', desc: 'Quemar grasa y definir' },
  { value: 'gain_muscle', label: 'Ganar Músculo', desc: 'Aumentar masa muscular' },
  { value: 'maintain', label: 'Mantener', desc: 'Mantener peso y tonificar' },
  { value: 'improve_health', label: 'Mejorar Salud', desc: 'Bienestar general' }
];

const proteins = ['Pollo', 'Carne', 'Pescado', 'Huevo', 'Pavo', 'Cerdo', 'Tofu', 'Proteína en polvo'];
const carbs = ['Arroz', 'Patata', 'Pasta', 'Avena', 'Pan integral', 'Quinoa', 'Batata'];

export default function Onboarding() {
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    gender: '',
    birth_date: '',
    height_cm: '',
    current_weight_kg: '',
    target_weight_kg: '',
    fitness_goal: '',
    activity_level: '',
    workout_days_per_week: 3,
    meals_per_day: 4,
    preferred_proteins: [],
    preferred_carbs: []
  });

  const { updateUser } = useAuth();
  const navigate = useNavigate();

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const toggleArrayItem = (field, item) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].includes(item)
        ? prev[field].filter(i => i !== item)
        : [...prev[field], item]
    }));
  };

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await userApi.updateProfile(formData);
      await userApi.completeOnboarding();
      updateUser({ onboardingCompleted: true });
      navigate('/');
    } catch (error) {
      console.error('Onboarding error:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderStepContent = () => {
    switch (steps[currentStep].id) {
      case 'basics':
        return (
          <div className="space-y-6 animate-fade-in">
            <div>
              <label className="label">Género</label>
              <div className="grid grid-cols-2 gap-3">
                {[{ value: 'male', label: 'Masculino' }, { value: 'female', label: 'Femenino' }].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => updateField('gender', opt.value)}
                    className={`p-4 rounded-xl border transition-all ${
                      formData.gender === opt.value
                        ? 'bg-accent-primary/20 border-accent-primary text-accent-primary'
                        : 'bg-dark-700 border-dark-600 text-gray-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="label">Fecha de Nacimiento</label>
              <input
                type="date"
                value={formData.birth_date}
                onChange={(e) => updateField('birth_date', e.target.value)}
                className="input"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Altura (cm)</label>
                <input
                  type="number"
                  value={formData.height_cm}
                  onChange={(e) => updateField('height_cm', e.target.value)}
                  className="input"
                  placeholder="175"
                />
              </div>
              <div>
                <label className="label">Peso Actual (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.current_weight_kg}
                  onChange={(e) => updateField('current_weight_kg', e.target.value)}
                  className="input"
                  placeholder="75"
                />
              </div>
            </div>
          </div>
        );

      case 'goals':
        return (
          <div className="space-y-6 animate-fade-in">
            <div>
              <label className="label">¿Cuál es tu objetivo?</label>
              <div className="space-y-3">
                {fitnessGoals.map(goal => (
                  <button
                    key={goal.value}
                    type="button"
                    onClick={() => updateField('fitness_goal', goal.value)}
                    className={`w-full p-4 rounded-xl border text-left transition-all ${
                      formData.fitness_goal === goal.value
                        ? 'bg-accent-primary/20 border-accent-primary'
                        : 'bg-dark-700 border-dark-600'
                    }`}
                  >
                    <div className={`font-semibold ${formData.fitness_goal === goal.value ? 'text-accent-primary' : 'text-white'}`}>
                      {goal.label}
                    </div>
                    <div className="text-sm text-gray-400">{goal.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="label">Peso Objetivo (kg)</label>
              <input
                type="number"
                step="0.1"
                value={formData.target_weight_kg}
                onChange={(e) => updateField('target_weight_kg', e.target.value)}
                className="input"
                placeholder="70"
              />
            </div>
          </div>
        );

      case 'activity':
        return (
          <div className="space-y-6 animate-fade-in">
            <div>
              <label className="label">Nivel de Actividad Actual</label>
              <div className="space-y-3">
                {activityLevels.map(level => (
                  <button
                    key={level.value}
                    type="button"
                    onClick={() => updateField('activity_level', level.value)}
                    className={`w-full p-4 rounded-xl border text-left transition-all ${
                      formData.activity_level === level.value
                        ? 'bg-accent-primary/20 border-accent-primary'
                        : 'bg-dark-700 border-dark-600'
                    }`}
                  >
                    <div className={`font-semibold ${formData.activity_level === level.value ? 'text-accent-primary' : 'text-white'}`}>
                      {level.label}
                    </div>
                    <div className="text-sm text-gray-400">{level.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="label">Días de entrenamiento por semana</label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="1"
                  max="7"
                  value={formData.workout_days_per_week}
                  onChange={(e) => updateField('workout_days_per_week', parseInt(e.target.value))}
                  className="flex-1 accent-accent-primary"
                />
                <span className="text-2xl font-bold text-accent-primary w-8">
                  {formData.workout_days_per_week}
                </span>
              </div>
            </div>
          </div>
        );

      case 'diet':
        return (
          <div className="space-y-6 animate-fade-in">
            <div>
              <label className="label">Proteínas Preferidas</label>
              <div className="flex flex-wrap gap-2">
                {proteins.map(item => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => toggleArrayItem('preferred_proteins', item)}
                    className={`px-4 py-2 rounded-full border text-sm transition-all ${
                      formData.preferred_proteins.includes(item)
                        ? 'bg-accent-primary/20 border-accent-primary text-accent-primary'
                        : 'bg-dark-700 border-dark-600 text-gray-300'
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="label">Carbohidratos Preferidos</label>
              <div className="flex flex-wrap gap-2">
                {carbs.map(item => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => toggleArrayItem('preferred_carbs', item)}
                    className={`px-4 py-2 rounded-full border text-sm transition-all ${
                      formData.preferred_carbs.includes(item)
                        ? 'bg-accent-primary/20 border-accent-primary text-accent-primary'
                        : 'bg-dark-700 border-dark-600 text-gray-300'
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="label">Comidas por día</label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="2"
                  max="6"
                  value={formData.meals_per_day}
                  onChange={(e) => updateField('meals_per_day', parseInt(e.target.value))}
                  className="flex-1 accent-accent-primary"
                />
                <span className="text-2xl font-bold text-accent-primary w-8">
                  {formData.meals_per_day}
                </span>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-dark flex flex-col">
      {/* Progress bar */}
      <div className="p-4">
        <div className="flex items-center gap-2 mb-6">
          {steps.map((step, index) => (
            <div
              key={step.id}
              className={`flex-1 h-1.5 rounded-full transition-all ${
                index <= currentStep ? 'bg-accent-primary' : 'bg-dark-700'
              }`}
            />
          ))}
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-3">
          {(() => {
            const Icon = steps[currentStep].icon;
            return (
              <>
                <div className="w-10 h-10 bg-accent-primary/20 rounded-xl flex items-center justify-center">
                  <Icon size={20} className="text-accent-primary" />
                </div>
                <div>
                  <p className="text-sm text-gray-400">Paso {currentStep + 1} de {steps.length}</p>
                  <h2 className="text-xl font-bold">{steps[currentStep].title}</h2>
                </div>
              </>
            );
          })()}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 py-6 overflow-y-auto">
        {renderStepContent()}
      </div>

      {/* Navigation */}
      <div className="p-4 border-t border-dark-700 bg-dark-800/50 backdrop-blur-lg">
        <div className="flex gap-3">
          {currentStep > 0 && (
            <button
              onClick={prevStep}
              className="btn-secondary flex items-center gap-2"
            >
              <ArrowLeft size={20} />
              Atrás
            </button>
          )}

          {currentStep < steps.length - 1 ? (
            <button
              onClick={nextStep}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              Siguiente
              <ArrowRight size={20} />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? 'Guardando...' : 'Completar'}
              <Check size={20} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
