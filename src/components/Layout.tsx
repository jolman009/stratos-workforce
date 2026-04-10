import { ReactNode } from 'react';
import { Home, Calendar, User, Bell, History, CalendarOff } from 'lucide-react';
import { Screen } from '../types';
import { motion } from 'motion/react';

interface LayoutProps {
  children: ReactNode;
  banner?: ReactNode;
  currentScreen: Screen;
  onNavigate: (screen: Screen) => void;
  user?: {
    name: string;
    photoUrl: string;
  };
  title?: string;
  showTopBar?: boolean;
  showBottomBar?: boolean;
}

export default function Layout({ 
  children, 
  banner,
  currentScreen, 
  onNavigate, 
  user, 
  title = "Workforce Pro",
  showTopBar = true,
  showBottomBar = true
}: LayoutProps) {
  
  const navItems = [
    { id: 'dashboard', label: 'Home', icon: Home, activeIcon: Home },
    { id: 'schedule', label: 'Schedule', icon: Calendar, activeIcon: Calendar },
    { id: 'time-off', label: 'Time Off', icon: CalendarOff, activeIcon: CalendarOff },
    { id: 'alerts', label: 'Alerts', icon: Bell, activeIcon: Bell },
    { id: 'profile', label: 'Profile', icon: User, activeIcon: User },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {showTopBar && (
        <header className="fixed top-0 w-full z-50 bg-white/70 backdrop-blur-xl border-b border-white/20 px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            {user && (
              <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-primary/10">
                <img src={user.photoUrl} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </div>
            )}
            <div>
              <h1 className="font-headline font-bold text-lg text-primary tracking-tight leading-tight">{title}</h1>
              <p className="text-[10px] uppercase tracking-widest font-semibold text-on-surface-variant">
                {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 hover:bg-surface-container-low rounded-full transition-colors text-primary" onClick={() => onNavigate('history')}>
              <History size={20} />
            </button>
            <button className="p-2 hover:bg-surface-container-low rounded-full transition-colors text-primary" onClick={() => onNavigate('alerts')}>
              <Bell size={20} />
            </button>
          </div>
        </header>
      )}

      <main className={`flex-1 ${showTopBar ? 'pt-24' : ''} ${showBottomBar ? 'pb-32' : 'pb-8'} px-6 max-w-2xl mx-auto w-full`}>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          key={currentScreen}
        >
          {banner}
          {children}
        </motion.div>
      </main>

      {showBottomBar && (
        <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-4 pt-3 pb-8 bg-white/80 backdrop-blur-2xl border-t border-white/10 rounded-t-3xl shadow-[0px_-10px_40px_rgba(7,30,39,0.04)]">
          {navItems.map((item) => {
            const isActive = currentScreen === item.id || (item.id === 'dashboard' && currentScreen === 'request-submitted');
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id as Screen)}
                className={`flex flex-col items-center justify-center px-5 py-2 rounded-2xl transition-all duration-200 ${
                  isActive 
                    ? 'bg-surface-container-highest text-primary scale-100' 
                    : 'text-on-surface-variant scale-90 hover:text-primary'
                }`}
              >
                <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
                <span className="font-body text-[10px] font-bold tracking-wide uppercase mt-1">{item.label}</span>
              </button>
            );
          })}
        </nav>
      )}
    </div>
  );
}
