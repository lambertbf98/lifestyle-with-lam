import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { workouts as workoutsApi } from '../api';
import { ArrowLeft, Play, Pause, Check, X, Timer, ChevronDown, ChevronUp } from 'lucide-react';

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
    } catch (error) {
      console.error('Error starting workout:', error);
    }
  };

  const completeSet = (exerciseIndex) => {
    const newLogs = [...exerciseLogs];
    newLogs[exerciseIndex].sets_completed += 1;
    setExerciseLogs(newLogs);

    // Start rest timer
    const exercise = workout.exercises[exerciseIndex];
    setRestTimer(exercise.rest_seconds || 60);
    setIsResting(true);
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
            <p className="text-sm text-gray-400">{workout.focus_area}</p>
            <h1 className="font-bold">{workout.name}</h1>
          </div>

          <div className="w-10 h-10 bg-accent-primary/20 rounded-xl flex items-center justify-center">
            <Timer size={20} className="text-accent-primary" />
          </div>
        </div>

        {/* Timer Bar */}
        {isActive && (
          <div className="mt-4 flex items-center justify-between">
            <div className="text-2xl font-mono font-bold text-accent-primary">
              {formatTime(timer)}
            </div>
            {isResting && (
              <div className="flex items-center gap-2 bg-accent-warning/20 px-3 py-1 rounded-full">
                <span className="text-accent-warning text-sm">Descanso</span>
                <span className="text-accent-warning font-bold">{restTimer}s</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Exercises List */}
      <div className="p-4 space-y-4 pb-32">
        {workout.exercises?.map((exercise, index) => {
          const log = exerciseLogs[index];
          const isComplete = log?.sets_completed >= exercise.sets;
          const isExpanded = expandedExercise === index;

          return (
            <div
              key={exercise.id}
              className={`card transition-all ${isComplete ? 'border-accent-success/50 bg-accent-success/5' : ''}`}
            >
              <button
                onClick={() => setExpandedExercise(isExpanded ? null : index)}
                className="w-full flex items-center gap-4"
              >
                {/* Exercise Image/Placeholder */}
                <div className="w-16 h-16 bg-dark-700 rounded-xl flex items-center justify-center overflow-hidden">
                  {exercise.exercise?.gif_url ? (
                    <img
                      src={exercise.exercise.gif_url}
                      alt={exercise.exercise.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-2xl font-bold text-gray-600">{index + 1}</span>
                  )}
                </div>

                <div className="flex-1 text-left">
                  <h3 className="font-semibold">
                    {exercise.exercise?.name_es || exercise.exercise?.name || `Ejercicio ${index + 1}`}
                  </h3>
                  <p className="text-sm text-gray-400">
                    {exercise.sets} series × {exercise.reps} reps
                  </p>
                  <p className="text-xs text-gray-500">
                    {log?.sets_completed || 0}/{exercise.sets} completadas
                  </p>
                </div>

                {isComplete ? (
                  <div className="w-8 h-8 bg-accent-success rounded-full flex items-center justify-center">
                    <Check size={18} className="text-dark-900" />
                  </div>
                ) : (
                  isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />
                )}
              </button>

              {/* Expanded Details */}
              {isExpanded && !isComplete && (
                <div className="mt-4 pt-4 border-t border-dark-600 space-y-4 animate-fade-in">
                  {exercise.exercise?.instructions && (
                    <p className="text-sm text-gray-400">{exercise.exercise.instructions}</p>
                  )}

                  {/* Sets Progress */}
                  <div className="flex gap-2">
                    {Array.from({ length: exercise.sets }).map((_, i) => (
                      <div
                        key={i}
                        className={`flex-1 h-2 rounded-full ${
                          i < (log?.sets_completed || 0)
                            ? 'bg-accent-primary'
                            : 'bg-dark-600'
                        }`}
                      />
                    ))}
                  </div>

                  {isActive && (
                    <button
                      onClick={() => completeSet(index)}
                      disabled={isComplete}
                      className="btn-primary w-full"
                    >
                      Completar Serie {(log?.sets_completed || 0) + 1}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom Action */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-dark-800/95 backdrop-blur-lg border-t border-dark-700">
        {!isActive ? (
          <button onClick={startWorkout} className="btn-primary w-full flex items-center justify-center gap-2">
            <Play size={20} />
            Comenzar Entrenamiento
          </button>
        ) : (
          <div className="flex gap-3">
            <button
              onClick={() => navigate('/workouts')}
              className="btn-secondary flex-1 flex items-center justify-center gap-2"
            >
              <X size={20} />
              Cancelar
            </button>
            <button
              onClick={completeWorkout}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
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
