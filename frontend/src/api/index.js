import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth
export const auth = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  verify: () => api.get('/auth/verify')
};

// User
export const user = {
  getProfile: () => api.get('/user/profile'),
  updateProfile: (data) => api.put('/user/profile', data),
  completeOnboarding: () => api.post('/user/complete-onboarding'),
  getWeightHistory: (limit = 30) => api.get(`/user/weight-history?limit=${limit}`),
  addWeight: (data) => api.post('/user/weight', data),
  getMeasurementsHistory: (limit = 30) => api.get(`/user/measurements-history?limit=${limit}`),
  addMeasurements: (data) => api.post('/user/measurements', data),
  deleteMeasurement: (id) => api.delete(`/user/measurements/${id}`),
  getDashboard: () => api.get('/user/dashboard')
};

// Workouts
export const workouts = {
  getExercises: (params) => api.get('/workouts/exercises', { params }),
  getMuscleGroups: () => api.get('/workouts/muscle-groups'),
  getPlans: () => api.get('/workouts/plans'),
  getActivePlan: () => api.get('/workouts/plans/active'),
  createPlan: (data) => api.post('/workouts/plans', data),
  startWorkout: (workoutDayId) => api.post('/workouts/start', { workout_day_id: workoutDayId }),
  completeWorkout: (data) => api.post('/workouts/complete', data),
  getHistory: (limit = 20, offset = 0) => api.get(`/workouts/history?limit=${limit}&offset=${offset}`),
  clearHistory: () => api.delete('/workouts/clear-history'),
  updateGifs: () => api.post('/workouts/update-gifs')
};

// Diet
export const diet = {
  getPlans: () => api.get('/diet/plans'),
  getActivePlan: () => api.get('/diet/plans/active'),
  getToday: () => api.get('/diet/today'),
  createPlan: (data) => api.post('/diet/plans', data),
  logMeal: (data) => api.post('/diet/log', data),
  getSummary: (startDate, endDate) => api.get('/diet/summary', { params: { start_date: startDate, end_date: endDate } }),
  deleteMealLog: (id) => api.delete(`/diet/log/${id}`),
  clearToday: () => api.delete('/diet/clear-today')
};

// Progress
export const progress = {
  get: (period = 30) => api.get(`/progress?period=${period}`),
  getAchievements: () => api.get('/progress/achievements'),
  checkAchievements: () => api.post('/progress/check-achievements'),
  getWeeklySummary: () => api.get('/progress/weekly-summary')
};

// AI Coach
export const coach = {
  chat: (message, context = 'general') => api.post('/coach/chat', { message, context }),
  generateWorkout: (data) => api.post('/coach/generate-workout', data),
  generateDiet: (data) => api.post('/coach/generate-diet', data),
  regenerateMeal: (data) => api.post('/coach/regenerate-meal', data),
  regenerateExercise: (data) => api.post('/coach/regenerate-exercise', data),
  regenerateIngredient: (data) => api.post('/coach/regenerate-ingredient', data),
  getConversations: (context) => api.get('/coach/conversations', { params: { context } }),
  deleteConversation: (id) => api.delete(`/coach/conversations/${id}`),
  getNutritionInfo: () => api.get('/coach/nutrition-info')
};

export default api;
