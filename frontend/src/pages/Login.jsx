import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Eye, EyeOff, Dumbbell } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const user = await login(email, password);
      if (user.onboardingCompleted) {
        navigate('/');
      } else {
        navigate('/onboarding');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-dark flex flex-col">
      {/* Header */}
      <div className="flex-1 flex flex-col justify-center px-6 pt-12 pb-8">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-accent-primary to-neon-purple rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-neon-cyan">
            <Dumbbell size={40} className="text-dark-900" />
          </div>
          <h1 className="text-3xl font-bold mb-2">
            <span className="gradient-text">Lifestyle</span> With Lam
          </h1>
          <p className="text-gray-400">Tu entrenador personal con IA</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-accent-danger/20 border border-accent-danger/30 rounded-xl p-3 text-center">
              <p className="text-accent-danger text-sm">{error}</p>
            </div>
          )}

          <div>
            <label className="label">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              placeholder=""
              required
            />
          </div>

          <div>
            <label className="label">Contraseña</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input pr-12"
                placeholder=""
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
          </button>
        </form>

        <p className="text-center mt-6 text-gray-400">
          ¿No tienes cuenta?{' '}
          <Link to="/register" className="text-accent-primary hover:underline font-medium">
            Regístrate
          </Link>
        </p>
      </div>

      {/* Bottom decoration */}
      <div className="h-32 bg-gradient-to-t from-accent-primary/5 to-transparent"></div>
    </div>
  );
}
