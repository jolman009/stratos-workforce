import { ReactNode } from 'react';
import { Badge, Bell, ChevronRight, LogOut, Mail, Moon, Phone, Settings } from 'lucide-react';
import Layout from '../components/Layout';
import { AppSettings, Screen, User } from '../types';

interface ProfileScreenProps {
  apiStatus: 'connecting' | 'online' | 'offline';
  banner?: ReactNode;
  editForm: { name: string; phone: string };
  isEditingProfile: boolean;
  onEditFormChange: (next: { name: string; phone: string }) => void;
  onNavigate: (screen: Screen) => void;
  onSaveProfile: () => void | Promise<void>;
  onToggleDarkMode: () => void | Promise<void>;
  onToggleNotifications: () => void | Promise<void>;
  onLogout: () => void | Promise<void>;
  setIsEditingProfile: (value: boolean) => void;
  settings: AppSettings;
  user: User;
}

export function ProfileScreen({
  apiStatus,
  banner,
  editForm,
  isEditingProfile,
  onEditFormChange,
  onLogout,
  onNavigate,
  onSaveProfile,
  onToggleDarkMode,
  onToggleNotifications,
  setIsEditingProfile,
  settings,
  user,
}: ProfileScreenProps) {
  return (
    <Layout currentScreen="profile" onNavigate={onNavigate} user={user} title="Profile" banner={banner}>
      <section className="relative bg-surface-container-lowest rounded-xl p-8 flex flex-col items-center text-center overflow-hidden border border-outline-variant/10">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16"></div>
        <div className="relative w-28 h-28 rounded-xl overflow-hidden mb-4 shadow-lg ring-4 ring-surface-container">
          <img src={user.photoUrl} alt={user.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
        </div>
        {isEditingProfile ? (
          <div className="w-full max-w-xs space-y-2">
            <input
              className="w-full text-center text-2xl font-extrabold text-primary bg-surface-container-highest rounded-lg px-2 py-1 border-none focus:ring-2 focus:ring-primary/20"
              value={editForm.name}
              onChange={(event) => onEditFormChange({ ...editForm, name: event.target.value })}
            />
          </div>
        ) : (
          <h2 className="text-3xl font-extrabold text-primary tracking-tight mb-1">{user.name}</h2>
        )}
        <div className="flex items-center gap-2 px-3 py-1 bg-surface-container-highest rounded-full mt-2">
          <Badge size={14} className="text-primary" />
          <p className="text-sm font-semibold tracking-wide text-on-surface-variant uppercase">{user.id}</p>
        </div>
      </section>
      <section className="space-y-4 mt-8">
        <div className="flex items-center justify-between px-2">
          <h3 className="text-lg font-bold text-primary tracking-tight">Personal Information</h3>
          {!isEditingProfile ? (
            <button
              type="button"
              onClick={() => {
                onEditFormChange({ name: user.name, phone: user.phone });
                setIsEditingProfile(true);
              }}
              className="text-sm font-semibold text-primary hover:underline transition-all"
            >
              Edit
            </button>
          ) : (
            <div className="flex gap-4">
              <button type="button" onClick={() => setIsEditingProfile(false)} className="text-sm font-semibold text-on-surface-variant hover:underline transition-all">
                Cancel
              </button>
              <button type="button" onClick={onSaveProfile} className="text-sm font-bold text-secondary hover:underline transition-all">
                Save Changes
              </button>
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-surface-container-low p-6 rounded-xl space-y-2 border border-outline-variant/10 opacity-80">
            <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Email Address</p>
            <div className="flex items-center gap-3">
              <Mail className="text-primary" size={20} />
              <p className="font-medium text-on-surface">{user.email}</p>
            </div>
            <p className="text-[10px] text-outline italic">Contact IT to update email.</p>
          </div>
          <div className="bg-surface-container-low p-6 rounded-xl space-y-2 border border-outline-variant/10">
            <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Phone Number</p>
            <div className="flex items-center gap-3">
              <Phone className="text-primary" size={20} />
              {isEditingProfile ? (
                <input
                  className="flex-1 bg-surface-container-highest rounded-lg px-3 py-1 border-none focus:ring-2 focus:ring-primary/20 font-medium text-on-surface"
                  value={editForm.phone}
                  onChange={(event) => onEditFormChange({ ...editForm, phone: event.target.value })}
                />
              ) : (
                <p className="font-medium text-on-surface">{user.phone}</p>
              )}
            </div>
          </div>
        </div>
      </section>
      <section className="space-y-4 mt-8">
        <h3 className="text-lg font-bold text-primary tracking-tight px-2">App Settings</h3>
        <div className="bg-surface-container-highest/30 backdrop-blur-md rounded-xl divide-y divide-outline-variant/10 border border-white/20">
          <button type="button" onClick={onToggleNotifications} className="w-full flex items-center justify-between p-5 hover:bg-surface-container-low transition-colors group text-left">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center shadow-sm">
                <Bell className="text-primary" size={20} />
              </div>
              <div>
                <p className="font-bold text-on-surface">Notifications</p>
                <p className="text-xs text-on-surface-variant">Shift alerts and updates</p>
              </div>
            </div>
            <div className={`w-11 h-6 rounded-full relative transition-colors ${settings.notificationsEnabled ? 'bg-secondary' : 'bg-surface-dim'}`}>
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.notificationsEnabled ? 'right-1' : 'left-1'}`}></div>
            </div>
          </button>
          <button type="button" onClick={onToggleDarkMode} className="w-full flex items-center justify-between p-5 hover:bg-surface-container-low transition-colors group text-left">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center shadow-sm">
                <Moon className="text-primary" size={20} />
              </div>
              <div>
                <p className="font-bold text-on-surface">Dark Mode</p>
                <p className="text-xs text-on-surface-variant">Persistent theme preference</p>
              </div>
            </div>
            <div className={`w-11 h-6 rounded-full relative transition-colors ${settings.darkMode ? 'bg-secondary' : 'bg-surface-dim'}`}>
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.darkMode ? 'right-1' : 'left-1'}`}></div>
            </div>
          </button>
          <button type="button" onClick={() => onNavigate('history')} className="w-full flex items-center justify-between p-5 hover:bg-surface-container-low transition-colors group text-left">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center shadow-sm">
                <Settings className="text-primary" size={20} />
              </div>
              <div>
                <p className="font-bold text-on-surface">Activity History</p>
                <p className="text-xs text-on-surface-variant">Review your recent shifts and records</p>
              </div>
            </div>
            <ChevronRight className="text-on-surface-variant" size={20} />
          </button>
        </div>
      </section>
      <section className="pt-8 mb-12">
        <p className="text-center text-on-surface-variant text-xs mb-4 font-medium tracking-widest uppercase">
          {apiStatus === 'online' ? 'Syncing with local API' : 'Using browser fallback storage'}
        </p>
        <button type="button" onClick={onLogout} className="w-full py-5 bg-tertiary text-white rounded-xl font-bold text-lg flex items-center justify-center gap-3 shadow-lg shadow-tertiary/20 hover:bg-tertiary-container transition-all duration-300 active:scale-95">
          <LogOut size={20} />
          Logout
        </button>
      </section>
    </Layout>
  );
}
