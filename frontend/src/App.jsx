import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import Onboarding from './pages/Onboarding';
import Dashboard from './pages/Dashboard';
import Workouts from './pages/Workouts';
import WorkoutSession from './pages/WorkoutSession';
import Diet from './pages/Diet';
import Progress from './pages/Progress';
import Coach from './pages/Coach';
import Profile from './pages/Profile';

// Components
import Layout from './components/Layout';
import Loading from './components/Loading';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <Loading />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

const OnboardingRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <Loading />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.onboardingCompleted) {
    return <Navigate to="/" replace />;
  }

  return children;
};

const AppRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <Loading />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!user.onboardingCompleted) {
    return <Navigate to="/onboarding" replace />;
  }

  return children;
};

function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Onboarding */}
      <Route
        path="/onboarding"
        element={
          <OnboardingRoute>
            <Onboarding />
          </OnboardingRoute>
        }
      />

      {/* Protected routes with layout */}
      <Route
        element={
          <AppRoute>
            <Layout />
          </AppRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="/workouts" element={<Workouts />} />
        <Route path="/diet" element={<Diet />} />
        <Route path="/progress" element={<Progress />} />
        <Route path="/coach" element={<Coach />} />
        <Route path="/profile" element={<Profile />} />
      </Route>

      {/* Workout session (full screen) */}
      <Route
        path="/workout-session/:dayId"
        element={
          <AppRoute>
            <WorkoutSession />
          </AppRoute>
        }
      />

      {/* Catch all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
