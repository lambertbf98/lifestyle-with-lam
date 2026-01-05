import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { Home, Dumbbell, UtensilsCrossed, TrendingUp, User } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

const navItems = [
  { path: '/', icon: Home, label: 'Inicio' },
  { path: '/workouts', icon: Dumbbell, label: 'Entreno' },
  { path: '/diet', icon: UtensilsCrossed, label: 'Dieta' },
  { path: '/progress', icon: TrendingUp, label: 'Progreso' },
  { path: '/profile', icon: User, label: 'Perfil' }
];

export default function Layout() {
  const location = useLocation();
  const { isDark } = useTheme();

  return (
    <div className="min-h-screen">
      {/* Main content */}
      <main className="safe-bottom">
        <Outlet />
      </main>

      {/* Bottom navigation - NEW dark/orange theme */}
      <nav
        className="fixed bottom-0 left-0 right-0 border-t z-50"
        style={{
          background: isDark
            ? 'linear-gradient(180deg, rgba(12, 12, 16, 0.98) 0%, rgba(9, 9, 11, 0.99) 100%)'
            : 'rgba(255, 255, 255, 0.95)',
          borderColor: isDark ? 'rgba(249, 115, 22, 0.15)' : 'rgba(200, 200, 200, 0.3)'
        }}
      >
        <div
          className="flex justify-around items-center py-2"
          style={{ paddingBottom: 'calc(8px + env(safe-area-inset-bottom))' }}
        >
          {navItems.map(({ path, icon: Icon, label }) => {
            const isActive = location.pathname === path;
            return (
              <NavLink
                key={path}
                to={path}
                className="flex flex-col items-center justify-center gap-1 flex-1 py-2 transition-all duration-200"
              >
                <div
                  className={`p-2 rounded-xl transition-all duration-300 ${
                    isActive
                      ? isDark
                        ? 'bg-gradient-to-br from-orange-500/20 to-pink-500/20 shadow-lg shadow-orange-500/10'
                        : 'bg-orange-100'
                      : ''
                  }`}
                >
                  <Icon
                    size={22}
                    className={`transition-all duration-200 ${
                      isActive
                        ? isDark
                          ? 'text-orange-500'
                          : 'text-orange-600'
                        : isDark
                          ? 'text-gray-500'
                          : 'text-gray-400'
                    }`}
                    style={isActive && isDark ? { filter: 'drop-shadow(0 0 8px rgba(249, 115, 22, 0.5))' } : {}}
                  />
                </div>
                <span
                  className={`text-xs font-medium transition-all duration-200 ${
                    isActive
                      ? isDark
                        ? 'text-orange-500'
                        : 'text-orange-600'
                      : isDark
                        ? 'text-gray-500'
                        : 'text-gray-400'
                  }`}
                  style={isActive && isDark ? { textShadow: '0 0 10px rgba(249, 115, 22, 0.5)' } : {}}
                >
                  {label}
                </span>
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
