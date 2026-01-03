import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { workouts as workoutsApi } from '../api';
import { ArrowLeft, Play, Check, X, Timer, ChevronDown, ChevronUp, Dumbbell, Clock, Target, Info, Plus, Minus } from 'lucide-react';

export default function WorkoutSession() {
  const { dayId } = useParams();
  const navigate = useNavigate();

  const [workout, setWorkout] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isActive, setIsActive] = useState(false);
  const [workoutLogId, setWorkoutLogId] = useState(null);
  const [currentExercise, setCurrentExercise] = useState(0);
  const [timer, setTimer] = useState(0);
  const [restTimer, setRestTimer] = useState(0);
  const [isResting, setIsResting] = useState(false);
  const [exerciseLogs, setExerciseLogs] = useState([]);
  const [expandedExercise, setExpandedExercise] = useState(null);
  const [customRestTimes, setCustomRestTimes] = useState({});

  useEffect(() => {
    loadWorkout();
  }, [dayId]);

  // Initialize custom rest times when workout loads
  useEffect(() => {
    if (workout?.exercises) {
      const initialRestTimes = {};
      workout.exercises.forEach((ex, idx) => {
        initialRestTimes[idx] = ex.rest_seconds || 60;
      });
      setCustomRestTimes(initialRestTimes);
    }
  }, [workout]);

  const updateRestTime = (index, delta) => {
    setCustomRestTimes(prev => ({
      ...prev,
      [index]: Math.max(15, Math.min(300, (prev[index] || 60) + delta))
    }));
  };

  useEffect(() => {
    let interval;
    if (isActive && !isResting) {
      interval = setInterval(() => {
        setTimer(t => t + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isActive, isResting]);

  useEffect(() => {
    let interval;
    if (isResting && restTimer > 0) {
      interval = setInterval(() => {
        setRestTimer(t => {
          if (t <= 1) {
            setIsResting(false);
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isResting, restTimer]);

  const loadWorkout = async () => {
    try {
      const response = await workoutsApi.getActivePlan();
      const plan = response.data;
      if (plan) {
        const day = plan.days.find(d => d.id === parseInt(dayId));
        if (day) {
          setWorkout(day);
          // Initialize exercise logs with sets tracking
          setExerciseLogs(day.exercises?.map(ex => ({
            exercise_id: ex.exercise_id,
            exercise_name: ex.exercise?.name || '',
            target_sets: ex.sets,
            target_reps: ex.reps,
            sets: [], // Array of { reps: number, weight_kg: number }
            notes: ''
          })) || []);
        }
      }
    } catch (error) {
      console.error('Error loading workout:', error);
    } finally {
      setLoading(false);
    }
  };

  const startWorkout = async () => {
    try {
      const response = await workoutsApi.startWorkout(parseInt(dayId));
      setWorkoutLogId(response.data.log.id);
      setIsActive(true);
      setExpandedExercise(0);
    } catch (error) {
      console.error('Error starting workout:', error);
    }
  };

  const updateSetData = (exerciseIndex, field, value) => {
    const newLogs = [...exerciseLogs];
    if (!newLogs[exerciseIndex].currentSet) {
      newLogs[exerciseIndex].currentSet = { reps: 10, weight_kg: 0 };
    }
    newLogs[exerciseIndex].currentSet[field] = value;
    setExerciseLogs(newLogs);
  };

  const completeSet = (exerciseIndex) => {
    const newLogs = [...exerciseLogs];
    const currentSet = newLogs[exerciseIndex].currentSet || { reps: 10, weight_kg: 0 };

    // Add the completed set
    newLogs[exerciseIndex].sets.push({
      reps: currentSet.reps,
      weight_kg: currentSet.weight_kg
    });

    // Prepare for next set (keep same weight)
    newLogs[exerciseIndex].currentSet = {
      reps: currentSet.reps,
      weight_kg: currentSet.weight_kg
    };

    setExerciseLogs(newLogs);

    const exercise = workout.exercises[exerciseIndex];

    // Check if exercise is complete
    if (newLogs[exerciseIndex].sets.length >= exercise.sets) {
      if (exerciseIndex < workout.exercises.length - 1) {
        setExpandedExercise(exerciseIndex + 1);
        setCurrentExercise(exerciseIndex + 1);
      }
    }

    // Start rest timer with custom rest time
    setRestTimer(customRestTimes[exerciseIndex] || exercise.rest_seconds || 60);
    setIsResting(true);
  };

  const skipRest = () => {
    setRestTimer(0);
    setIsResting(false);
  };

  const completeWorkout = async () => {
    try {
      // Format exercise logs for API
      const formattedLogs = exerciseLogs.map(log => ({
        exercise_id: log.exercise_id,
        sets_completed: log.sets.length,
        reps_per_set: log.sets.map(s => s.reps).join(','),
        weight_kg: log.sets.length > 0 ? Math.max(...log.sets.map(s => s.weight_kg)) : null,
        sets_detail: JSON.stringify(log.sets),
        notes: log.notes
      }));

      await workoutsApi.completeWorkout({
        workout_log_id: workoutLogId,
        duration_minutes: Math.round(timer / 60),
        exercises: formattedLogs
      });
      navigate('/workouts');
    } catch (error) {
      console.error('Error completing workout:', error);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getTotalProgress = () => {
    const totalSets = workout.exercises?.reduce((acc, ex) => acc + ex.sets, 0) || 0;
    const completedSets = exerciseLogs.reduce((acc, log) => acc + log.sets.length, 0);
    return totalSets > 0 ? (completedSets / totalSets) * 100 : 0;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="skeleton w-16 h-16 rounded-full"></div>
      </div>
    );
  }

  if (!workout) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <p className="text-gray-500 dark:text-gray-400 mb-4">Entrenamiento no encontrado</p>
        <button onClick={() => navigate('/workouts')} className="btn-primary">
          Volver a Entrenamientos
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/95 dark:bg-dark-800/95 backdrop-blur-lg border-b border-gray-200 dark:border-dark-700 p-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate('/workouts')}
            className="w-10 h-10 bg-gray-200 dark:bg-dark-700 rounded-xl flex items-center justify-center"
          >
            <ArrowLeft size={20} />
          </button>

          <div className="text-center">
            <p className="text-sm text-accent-primary font-medium">{workout.focus_area}</p>
            <h1 className="font-bold">{workout.name}</h1>
          </div>

          <div className="text-right">
            <p className="text-xs text-gray-400">{workout.exercises?.length || 0} ejercicios</p>
          </div>
        </div>

        {isActive && (
          <div className="mt-4 space-y-3">
            <div>
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                <span>Progreso</span>
                <span>{Math.round(getTotalProgress())}%</span>
              </div>
              <div className="h-2 bg-gray-200 dark:bg-dark-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-accent-primary to-neon-purple rounded-full transition-all duration-300"
                  style={{ width: `${getTotalProgress()}%` }}
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Timer size={18} className="text-accent-primary" />
                <span className="text-xl font-mono font-bold text-accent-primary">
                  {formatTime(timer)}
                </span>
              </div>

              {isResting && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setRestTimer(t => Math.max(0, t - 15))}
                    className="w-8 h-8 bg-gray-200 dark:bg-dark-600 rounded-lg flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white"
                  >
                    <Minus size={16} />
                  </button>
                  <div className="bg-accent-warning/20 px-4 py-2 rounded-full flex items-center gap-2">
                    <Clock size={16} className="text-accent-warning" />
                    <span className="text-accent-warning font-bold text-lg">{restTimer}s</span>
                  </div>
                  <button
                    onClick={() => setRestTimer(t => t + 15)}
                    className="w-8 h-8 bg-gray-200 dark:bg-dark-600 rounded-lg flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white"
                  >
                    <Plus size={16} />
                  </button>
                  <button onClick={skipRest} className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white ml-1">
                    Saltar
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Exercises List */}
      <div className="p-4 space-y-4 pb-32">
        {workout.exercises?.map((exercise, index) => {
          const log = exerciseLogs[index];
          const completedSets = log?.sets?.length || 0;
          const isComplete = completedSets >= exercise.sets;
          const isExpanded = expandedExercise === index;
          const isCurrent = currentExercise === index && isActive;
          const currentSetData = log?.currentSet || { reps: 10, weight_kg: 0 };

          return (
            <div
              key={exercise.id}
              className={`rounded-2xl overflow-hidden border transition-all ${
                isComplete
                  ? 'border-accent-success/50 bg-accent-success/5'
                  : isCurrent
                  ? 'border-accent-primary/50 bg-accent-primary/5'
                  : 'border-gray-200 dark:border-dark-600 bg-white dark:bg-dark-800'
              }`}
            >
              {/* Exercise Header */}
              <button
                onClick={() => setExpandedExercise(isExpanded ? null : index)}
                className="w-full p-4 flex items-center gap-4"
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  isComplete ? 'bg-accent-success' : isCurrent ? 'bg-accent-primary' : 'bg-gray-200 dark:bg-dark-700'
                }`}>
                  {isComplete ? (
                    <Check size={20} className="text-white dark:text-dark-900" />
                  ) : (
                    <span className={`font-bold ${isCurrent ? 'text-white dark:text-dark-900' : 'text-gray-500 dark:text-gray-400'}`}>
                      {index + 1}
                    </span>
                  )}
                </div>

                <div className="flex-1 text-left">
                  <h3 className="font-semibold text-lg">
                    {exercise.exercise?.name_es || exercise.exercise?.name || `Ejercicio ${index + 1}`}
                  </h3>
                  <div className="flex items-center gap-3 text-sm text-gray-400">
                    <span>{exercise.sets} series × {exercise.reps}</span>
                    <span>•</span>
                    {!isActive ? (
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={(e) => { e.stopPropagation(); updateRestTime(index, -15); }}
                          className="w-6 h-6 bg-gray-300 dark:bg-dark-600 rounded flex items-center justify-center text-xs hover:bg-gray-400 dark:hover:bg-dark-500"
                        >
                          -
                        </button>
                        <span className="text-accent-primary font-medium min-w-[40px] text-center">
                          {customRestTimes[index] || exercise.rest_seconds || 60}s
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); updateRestTime(index, 15); }}
                          className="w-6 h-6 bg-gray-300 dark:bg-dark-600 rounded flex items-center justify-center text-xs hover:bg-gray-400 dark:hover:bg-dark-500"
                        >
                          +
                        </button>
                      </div>
                    ) : (
                      <span>{customRestTimes[index] || exercise.rest_seconds || 60}s descanso</span>
                    )}
                  </div>
                  {/* Sets progress */}
                  <div className="flex gap-1 mt-2">
                    {Array.from({ length: exercise.sets }).map((_, i) => (
                      <div
                        key={i}
                        className={`h-1.5 flex-1 rounded-full transition-all ${
                          i < completedSets ? 'bg-accent-primary' : 'bg-gray-300 dark:bg-dark-600'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                {isExpanded ? (
                  <ChevronUp size={20} className="text-gray-500 dark:text-gray-400" />
                ) : (
                  <ChevronDown size={20} className="text-gray-500 dark:text-gray-400" />
                )}
              </button>

              {/* Expanded Content */}
              {isExpanded && (
                <div className="border-t border-gray-200 dark:border-dark-600 animate-fade-in">
                  {/* GIF Display - Exercise GIF from database */}
                  {exercise.exercise?.gif_url && (
                    <div className="relative bg-gray-100 dark:bg-dark-900">
                      <img
                        src={exercise.exercise.gif_url}
                        alt={exercise.exercise?.name_es || exercise.exercise?.name || 'Ejercicio'}
                        className="w-full h-48 object-contain"
                        loading="lazy"
                      />
                    </div>
                  )}

                  <div className="p-4 space-y-4">
                    {/* Muscle Info */}
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <Target size={16} className="text-accent-primary" />
                        <span className="text-gray-300">{exercise.exercise?.muscle_group || 'General'}</span>
                      </div>
                      {exercise.exercise?.equipment && (
                        <div className="flex items-center gap-2">
                          <Dumbbell size={16} className="text-neon-purple" />
                          <span className="text-gray-300">{exercise.exercise.equipment}</span>
                        </div>
                      )}
                    </div>

                    {/* Instructions */}
                    {exercise.exercise?.instructions && (
                      <div className="bg-gray-100 dark:bg-dark-700/50 rounded-xl p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <Info size={16} className="text-accent-primary" />
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Instrucciones</span>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                          {exercise.exercise.instructions}
                        </p>
                      </div>
                    )}

                    {/* Completed Sets Log */}
                    {log?.sets?.length > 0 && (
                      <div className="bg-gray-100 dark:bg-dark-700/30 rounded-xl p-3">
                        <p className="text-xs text-gray-400 mb-2">Series completadas:</p>
                        <div className="flex flex-wrap gap-2">
                          {log.sets.map((set, i) => (
                            <div key={i} className="bg-accent-primary/20 px-3 py-1 rounded-full text-sm">
                              <span className="text-accent-primary font-medium">
                                {set.weight_kg}kg × {set.reps}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Weight and Reps Input */}
                    {isActive && !isComplete && (
                      <div className="bg-gray-100 dark:bg-dark-700 rounded-xl p-4 space-y-4">
                        <p className="text-sm font-medium text-center text-gray-700 dark:text-gray-300">
                          Serie {completedSets + 1} de {exercise.sets}
                        </p>

                        {/* Weight Input */}
                        <div>
                          <label className="text-xs text-gray-500 dark:text-gray-400 block mb-2 text-center">Peso (kg)</label>
                          <div className="flex items-center justify-center gap-3">
                            <button
                              onClick={() => updateSetData(index, 'weight_kg', Math.max(0, currentSetData.weight_kg - 2.5))}
                              className="w-12 h-12 bg-gray-200 dark:bg-dark-600 rounded-xl flex items-center justify-center hover:bg-gray-300 dark:hover:bg-dark-500 transition-colors"
                            >
                              <Minus size={20} />
                            </button>
                            <input
                              type="number"
                              value={currentSetData.weight_kg}
                              onChange={(e) => updateSetData(index, 'weight_kg', parseFloat(e.target.value) || 0)}
                              className="w-24 h-12 bg-gray-200 dark:bg-dark-600 rounded-xl text-center text-2xl font-bold focus:outline-none focus:ring-2 focus:ring-accent-primary"
                            />
                            <button
                              onClick={() => updateSetData(index, 'weight_kg', currentSetData.weight_kg + 2.5)}
                              className="w-12 h-12 bg-gray-200 dark:bg-dark-600 rounded-xl flex items-center justify-center hover:bg-gray-300 dark:hover:bg-dark-500 transition-colors"
                            >
                              <Plus size={20} />
                            </button>
                          </div>
                        </div>

                        {/* Reps Input */}
                        <div>
                          <label className="text-xs text-gray-500 dark:text-gray-400 block mb-2 text-center">Repeticiones</label>
                          <div className="flex items-center justify-center gap-3">
                            <button
                              onClick={() => updateSetData(index, 'reps', Math.max(1, currentSetData.reps - 1))}
                              className="w-12 h-12 bg-gray-200 dark:bg-dark-600 rounded-xl flex items-center justify-center hover:bg-gray-300 dark:hover:bg-dark-500 transition-colors"
                            >
                              <Minus size={20} />
                            </button>
                            <input
                              type="number"
                              value={currentSetData.reps}
                              onChange={(e) => updateSetData(index, 'reps', parseInt(e.target.value) || 1)}
                              className="w-24 h-12 bg-gray-200 dark:bg-dark-600 rounded-xl text-center text-2xl font-bold focus:outline-none focus:ring-2 focus:ring-accent-primary"
                            />
                            <button
                              onClick={() => updateSetData(index, 'reps', currentSetData.reps + 1)}
                              className="w-12 h-12 bg-gray-200 dark:bg-dark-600 rounded-xl flex items-center justify-center hover:bg-gray-300 dark:hover:bg-dark-500 transition-colors"
                            >
                              <Plus size={20} />
                            </button>
                          </div>
                        </div>

                        {/* Complete Set Button */}
                        <button
                          onClick={() => completeSet(index)}
                          disabled={isResting}
                          className={`w-full py-4 rounded-xl font-semibold text-lg transition-all ${
                            isResting
                              ? 'bg-gray-300 dark:bg-dark-600 text-gray-500 cursor-not-allowed'
                              : 'bg-gradient-to-r from-accent-primary to-neon-purple text-white hover:scale-[1.02] active:scale-[0.98]'
                          }`}
                        >
                          {isResting
                            ? `Descansando... (${restTimer}s)`
                            : `Completar Serie ${completedSets + 1}`
                          }
                        </button>
                      </div>
                    )}

                    {isComplete && (
                      <div className="bg-accent-success/10 rounded-xl p-4 text-center border border-accent-success/20">
                        <Check size={24} className="text-accent-success mx-auto mb-2" />
                        <p className="text-accent-success font-medium">Ejercicio completado</p>
                        {log?.sets?.length > 0 && (
                          <p className="text-xs text-gray-400 mt-1">
                            Mejor serie: {Math.max(...log.sets.map(s => s.weight_kg))}kg
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom Action */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/95 dark:bg-dark-800/95 backdrop-blur-lg border-t border-gray-200 dark:border-dark-700">
        {!isActive ? (
          <button
            onClick={startWorkout}
            className="btn-primary w-full py-4 flex items-center justify-center gap-2 text-lg"
          >
            <Play size={24} />
            Comenzar Entrenamiento
          </button>
        ) : (
          <div className="flex gap-3">
            <button
              onClick={() => navigate('/workouts')}
              className="btn-secondary flex-1 py-4 flex items-center justify-center gap-2"
            >
              <X size={20} />
              Cancelar
            </button>
            <button
              onClick={completeWorkout}
              className="btn-primary flex-1 py-4 flex items-center justify-center gap-2"
            >
              <Check size={20} />
              Finalizar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
