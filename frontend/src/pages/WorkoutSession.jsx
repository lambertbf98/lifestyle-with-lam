import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { workouts as workoutsApi } from '../api';
import { ArrowLeft, Play, Pause, Check, X, Timer, ChevronDown, ChevronUp, Dumbbell, Clock, Target, Info } from 'lucide-react';

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
  const [showExerciseDetail, setShowExerciseDetail] = useState(null);

  useEffect(() => {
    loadWorkout();
  }, [dayId]);

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
          setExerciseLogs(day.exercises?.map(ex => ({
            exercise_id: ex.exercise_id,
            sets_completed: 0,
            reps_per_set: '',
            weight_kg: null
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
      setExpandedExercise(0); // Expand first exercise
    } catch (error) {
      console.error('Error starting workout:', error);
    }
  };

  const completeSet = (exerciseIndex) => {
    const newLogs = [...exerciseLogs];
    newLogs[exerciseIndex].sets_completed += 1;
    setExerciseLogs(newLogs);

    const exercise = workout.exercises[exerciseIndex];

    // Check if exercise is complete
    if (newLogs[exerciseIndex].sets_completed >= exercise.sets) {
      // Move to next exercise
      if (exerciseIndex < workout.exercises.length - 1) {
        setExpandedExercise(exerciseIndex + 1);
        setCurrentExercise(exerciseIndex + 1);
      }
    }

    // Start rest timer
    setRestTimer(exercise.rest_seconds || 60);
    setIsResting(true);
  };

  const skipRest = () => {
    setRestTimer(0);
    setIsResting(false);
  };

  const completeWorkout = async () => {
    try {
      await workoutsApi.completeWorkout({
        workout_log_id: workoutLogId,
        duration_minutes: Math.round(timer / 60),
        exercises: exerciseLogs
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
    const completedSets = exerciseLogs.reduce((acc, log) => acc + (log.sets_completed || 0), 0);
    return totalSets > 0 ? (completedSets / totalSets) * 100 : 0;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-dark flex items-center justify-center">
        <div className="skeleton w-16 h-16 rounded-full"></div>
      </div>
    );
  }

  if (!workout) {
    return (
      <div className="min-h-screen bg-gradient-dark flex flex-col items-center justify-center p-4">
        <p className="text-gray-400 mb-4">Entrenamiento no encontrado</p>
        <button onClick={() => navigate('/workouts')} className="btn-primary">
          Volver a Entrenamientos
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-dark">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-dark-800/95 backdrop-blur-lg border-b border-dark-700 p-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate('/workouts')}
            className="w-10 h-10 bg-dark-700 rounded-xl flex items-center justify-center"
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

        {/* Progress Bar and Timer */}
        {isActive && (
          <div className="mt-4 space-y-3">
            {/* Progress */}
            <div>
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>Progreso</span>
                <span>{Math.round(getTotalProgress())}%</span>
              </div>
              <div className="h-2 bg-dark-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-accent-primary to-neon-purple rounded-full transition-all duration-300"
                  style={{ width: `${getTotalProgress()}%` }}
                />
              </div>
            </div>

            {/* Timer */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Timer size={18} className="text-accent-primary" />
                <span className="text-xl font-mono font-bold text-accent-primary">
                  {formatTime(timer)}
                </span>
              </div>

              {isResting && (
                <div className="flex items-center gap-2">
                  <div className="bg-accent-warning/20 px-4 py-2 rounded-full flex items-center gap-2">
                    <Clock size={16} className="text-accent-warning" />
                    <span className="text-accent-warning font-bold text-lg">{restTimer}s</span>
                  </div>
                  <button
                    onClick={skipRest}
                    className="text-xs text-gray-400 hover:text-white"
                  >
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
          const isComplete = log?.sets_completed >= exercise.sets;
          const isExpanded = expandedExercise === index;
          const isCurrent = currentExercise === index && isActive;

          return (
            <div
              key={exercise.id}
              className={`rounded-2xl overflow-hidden border transition-all ${
                isComplete
                  ? 'border-accent-success/50 bg-accent-success/5'
                  : isCurrent
                  ? 'border-accent-primary/50 bg-accent-primary/5'
                  : 'border-dark-600 bg-dark-800'
              }`}
            >
              {/* Exercise Header */}
              <button
                onClick={() => setExpandedExercise(isExpanded ? null : index)}
                className="w-full p-4 flex items-center gap-4"
              >
                {/* Exercise Number */}
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  isComplete
                    ? 'bg-accent-success'
                    : isCurrent
                    ? 'bg-accent-primary'
                    : 'bg-dark-700'
                }`}>
                  {isComplete ? (
                    <Check size={20} className="text-dark-900" />
                  ) : (
                    <span className={`font-bold ${isCurrent ? 'text-dark-900' : 'text-gray-400'}`}>
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
                    {exercise.rest_seconds && (
                      <>
                        <span>•</span>
                        <span>{exercise.rest_seconds}s descanso</span>
                      </>
                    )}
                  </div>
                  {/* Progress indicator */}
                  <div className="flex gap-1 mt-2">
                    {Array.from({ length: exercise.sets }).map((_, i) => (
                      <div
                        key={i}
                        className={`h-1.5 flex-1 rounded-full transition-all ${
                          i < (log?.sets_completed || 0)
                            ? 'bg-accent-primary'
                            : 'bg-dark-600'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                {isExpanded ? (
                  <ChevronUp size={20} className="text-gray-400" />
                ) : (
                  <ChevronDown size={20} className="text-gray-400" />
                )}
              </button>

              {/* Expanded Content */}
              {isExpanded && (
                <div className="border-t border-dark-600 animate-fade-in">
                  {/* GIF Display */}
                  {exercise.exercise?.gif_url && (
                    <div className="relative bg-dark-900">
                      <img
                        src={exercise.exercise.gif_url}
                        alt={exercise.exercise.name}
                        className="w-full h-48 object-contain"
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
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
                      <div className="bg-dark-700/50 rounded-xl p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <Info size={16} className="text-accent-primary" />
                          <span className="text-sm font-medium text-gray-300">Instrucciones</span>
                        </div>
                        <p className="text-sm text-gray-400 leading-relaxed">
                          {exercise.exercise.instructions}
                        </p>
                      </div>
                    )}

                    {/* Notes */}
                    {exercise.notes && (
                      <div className="bg-accent-warning/10 rounded-xl p-3 border border-accent-warning/20">
                        <p className="text-sm text-accent-warning">
                          {exercise.notes}
                        </p>
                      </div>
                    )}

                    {/* Complete Set Button */}
                    {isActive && !isComplete && (
                      <button
                        onClick={() => completeSet(index)}
                        disabled={isResting}
                        className={`w-full py-4 rounded-xl font-semibold text-lg transition-all ${
                          isResting
                            ? 'bg-dark-600 text-gray-500 cursor-not-allowed'
                            : 'bg-gradient-to-r from-accent-primary to-neon-purple text-dark-900 hover:scale-[1.02] active:scale-[0.98]'
                        }`}
                      >
                        {isResting
                          ? `Descansando... (${restTimer}s)`
                          : `Completar Serie ${(log?.sets_completed || 0) + 1} de ${exercise.sets}`
                        }
                      </button>
                    )}

                    {isComplete && (
                      <div className="bg-accent-success/10 rounded-xl p-4 text-center border border-accent-success/20">
                        <Check size={24} className="text-accent-success mx-auto mb-2" />
                        <p className="text-accent-success font-medium">Ejercicio completado</p>
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
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-dark-800/95 backdrop-blur-lg border-t border-dark-700">
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
              Finalizar Entreno
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
