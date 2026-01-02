import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { Home, Dumbbell, UtensilsCrossed, TrendingUp, MessageCircle } from 'lucide-react';

const navItems = [
  { path: '/', icon: Home, label: 'Inicio' },
  { path: '/workouts', icon: Dumbbell, label: 'Entreno' },
  { path: '/diet', icon: UtensilsCrossed, label: 'Dieta' },
  { path: '/progress', icon: TrendingUp, label: 'Progreso' },
  { path: '/coach', icon: MessageCircle, label: 'Coach' }
];

export default function Layout() {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-gradient-dark">
      {/* Main content */}
      <main className="safe-bottom">
        <Outlet />
      </main>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-dark-800/95 backdrop-blur-lg border-t border-dark-700 z-50">
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
