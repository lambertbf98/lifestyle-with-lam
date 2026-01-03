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

      {/* Bottom navigation */}
      <nav
        className="fixed bottom-0 left-0 right-0 backdrop-blur-xl border-t z-50"
        style={{
          background: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.8)',
          borderColor: isDark ? 'rgba(51, 65, 85, 1)' : 'rgba(255, 255, 255, 0.5)'
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
                className={`nav-item flex-1 py-2 ${isActive ? 'active' : ''}`}
              >
                <div
                  className={`p-2 rounded-xl transition-all duration-200 ${
                    isActive ? 'bg-accent-primary/20' : ''
                  }`}
                >
                  <Icon
                    size={22}
                    className={isActive ? 'text-accent-primary' : ''}
                  />
                </div>
                <span className={`text-xs font-medium ${isActive ? 'text-accent-primary' : ''}`}>
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
