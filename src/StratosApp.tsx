import { FormEvent, useEffect, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import {
  Badge,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Eye,
  Home,
  Info,
  LogOut,
  Plus,
  Search,
  Send,
  Settings,
  Shield,
  Timer,
  Users,
} from 'lucide-react';
import Layout from './components/Layout';
import { ClockCard, ComplianceCard, ProgressCard } from './components/Dashboard';
import { ShiftCard } from './components/ShiftCard';
import { BalanceCard, RequestItem } from './components/TimeOff';
import { AppSettings, ClockState, LeaveType, LoginFormState, Notification, PersistedState, Screen, Shift, TimeOffFormState, TimeOffRequest, User } from './types';
import { BALANCE_LIMITS, BREAK_LIMIT_SECONDS, createDefaultAppState, DEFAULT_LOGIN_FORM, DEFAULT_TIME_OFF_FORM, INITIAL_CLOCK_STATE, INITIAL_SETTINGS, STORAGE_KEY } from './appState';
import { fetchPersistedStateFromApi, patchNotificationUnread, patchSessionAuth, patchSettings, patchUserProfile, postClockEvent, postShiftSwapDraft, postTimeOffRequest } from './api/client';
import { useOptimisticMutation } from './hooks/useOptimisticMutation';
import { AlertsScreen } from './screens/AlertsScreen';
import { ProfileScreen } from './screens/ProfileScreen';

function getPersistedState(): PersistedState | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PersistedState) : null;
  } catch {
    return null;
  }
}

function getInitialState(): PersistedState {
  const persisted = getPersistedState();
  if (persisted) {
    return {
      ...persisted,
      lastSubmittedRequestId: persisted.lastSubmittedRequestId ?? null,
      settings: persisted.settings ?? INITIAL_SETTINGS,
      clockState: persisted.clockState ?? INITIAL_CLOCK_STATE,
    };
  }

  return createDefaultAppState();
}

function isScreen(value: string): value is Screen {
  return ['login', 'dashboard', 'history', 'schedule', 'time-off', 'new-request', 'alerts', 'profile', 'request-submitted'].includes(value);
}

function getScreenFromHash(): Screen {
  if (typeof window === 'undefined') {
    return 'login';
  }

  const screen = window.location.hash.replace('#', '');
  return isScreen(screen) ? screen : 'login';
}

function formatHoursAndMinutes(totalSeconds: number): string {
  const totalMinutes = Math.max(Math.floor(totalSeconds / 60), 0);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

function getElapsedSeconds(iso: string | null): number {
  if (!iso) {
    return 0;
  }

  return Math.max(Math.floor((Date.now() - new Date(iso).getTime()) / 1000), 0);
}

function formatShiftDate(date: Date) {
  return {
    date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    day: date.toLocaleDateString('en-US', { weekday: 'short' }),
  };
}

function formatClockTime(date: Date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatBreakDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.round((totalSeconds % 3600) / 60);
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

function formatShiftTotal(totalSeconds: number) {
  return `${(Math.round((totalSeconds / 3600) * 10) / 10).toFixed(1)} hrs`;
}

function countBusinessDays(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T12:00:00`);
  const end = new Date(`${endDate}T12:00:00`);
  let count = 0;

  for (const current = new Date(start); current <= end; current.setDate(current.getDate() + 1)) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) {
      count += 1;
    }
  }

  return count;
}

function formatRequestDates(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T12:00:00`);
  const end = new Date(`${endDate}T12:00:00`);
  const sameDay = startDate === endDate;
  const startText = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const endText = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return sameDay ? end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : `${startText} - ${endText}`;
}

function getTodayDateInputValue() {
  return new Date().toISOString().split('T')[0];
}

export default function StratosApp() {
  const initialState = getInitialState();
  const [currentScreen, setCurrentScreen] = useState<Screen>(() => getScreenFromHash());
  const [apiStatus, setApiStatus] = useState<'connecting' | 'online' | 'offline'>('connecting');
  const [hasLoadedRemote, setHasLoadedRemote] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(initialState.isAuthenticated);
  const [user, setUser] = useState<User>(initialState.user);
  const [shifts, setShifts] = useState<Shift[]>(initialState.shifts);
  const [upcomingShifts, setUpcomingShifts] = useState<Shift[]>(initialState.upcomingShifts);
  const [timeOffRequests, setTimeOffRequests] = useState<TimeOffRequest[]>(initialState.timeOffRequests);
  const [notifications, setNotifications] = useState<Notification[]>(initialState.notifications);
  const [settings, setSettings] = useState<AppSettings>(initialState.settings);
  const [clockState, setClockState] = useState<ClockState>(initialState.clockState);
  const [lastSubmittedRequestId, setLastSubmittedRequestId] = useState<string | null>(initialState.lastSubmittedRequestId);
  const [loginForm, setLoginForm] = useState<LoginFormState>(DEFAULT_LOGIN_FORM);
  const [loginError, setLoginError] = useState('');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editForm, setEditForm] = useState({ name: initialState.user.name, phone: initialState.user.phone });
  const [requestForm, setRequestForm] = useState<TimeOffFormState>(DEFAULT_TIME_OFF_FORM);
  const [requestError, setRequestError] = useState('');
  const [now, setNow] = useState(Date.now());

  const applyPersistedState = (state: PersistedState) => {
    setIsAuthenticated(state.isAuthenticated);
    setUser(state.user);
    setShifts(state.shifts);
    setUpcomingShifts(state.upcomingShifts);
    setTimeOffRequests(state.timeOffRequests);
    setNotifications(state.notifications);
    setSettings(state.settings);
    setClockState(state.clockState);
    setLastSubmittedRequestId(state.lastSubmittedRequestId);
  };
  const { mutationError, setMutationError, runMutation } = useOptimisticMutation({
    apiStatus,
    hasLoadedRemote,
    applyPersistedState,
    setApiStatus,
  });

  const navigateTo = (screen: Screen) => {
    setCurrentScreen(screen);
    if (typeof window !== 'undefined') {
      window.location.hash = screen;
    }
  };

  useEffect(() => {
    const handleHashChange = () => {
      const nextScreen = getScreenFromHash();
      setCurrentScreen(isAuthenticated ? (nextScreen === 'login' ? 'dashboard' : nextScreen) : 'login');
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [isAuthenticated]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const persistedState: PersistedState = {
      isAuthenticated,
      user,
      shifts,
      upcomingShifts,
      timeOffRequests,
      notifications,
      settings,
      clockState,
      lastSubmittedRequestId,
    };

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(persistedState));
  }, [clockState, isAuthenticated, lastSubmittedRequestId, notifications, settings, shifts, timeOffRequests, upcomingShifts, user]);

  useEffect(() => {
    let isActive = true;

    fetchPersistedStateFromApi()
      .then((state) => {
        if (!isActive) {
          return;
        }

        applyPersistedState(state);
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        setApiStatus('online');
        setHasLoadedRemote(true);
      })
      .catch(() => {
        if (!isActive) {
          return;
        }

        setApiStatus('offline');
        setHasLoadedRemote(true);
      });

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    document.body.classList.toggle('theme-night', settings.darkMode);
  }, [settings.darkMode]);

  useEffect(() => {
    setEditForm({ name: user.name, phone: user.phone });
  }, [user]);

  useEffect(() => {
    if (!clockState.isClockedIn && !clockState.isBreakActive) {
      return;
    }

    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [clockState.isBreakActive, clockState.isClockedIn]);

  const activeWorkSeconds =
    clockState.isClockedIn && !clockState.isBreakActive && clockState.lastResumedAt
      ? Math.max(Math.floor((now - new Date(clockState.lastResumedAt).getTime()) / 1000), 0)
      : 0;
  const totalWorkedSeconds = clockState.accumulatedWorkSeconds + activeWorkSeconds;
  const currentBreakElapsed =
    clockState.isBreakActive && clockState.breakStartedAt
      ? Math.min(Math.max(Math.floor((now - new Date(clockState.breakStartedAt).getTime()) / 1000), 0), BREAK_LIMIT_SECONDS)
      : 0;
  const breakTimeRemaining = clockState.isBreakActive ? Math.max(BREAK_LIMIT_SECONDS - currentBreakElapsed, 0) : BREAK_LIMIT_SECONDS;
  const totalBreakSeconds = clockState.accumulatedBreakSeconds + currentBreakElapsed;

  useEffect(() => {
    if (clockState.isBreakActive && breakTimeRemaining === 0) {
      setClockState((prev) => ({
        ...prev,
        isBreakActive: false,
        breakStartedAt: null,
        lastResumedAt: new Date().toISOString(),
        accumulatedBreakSeconds: prev.accumulatedBreakSeconds + BREAK_LIMIT_SECONDS,
      }));
    }
  }, [breakTimeRemaining, clockState.isBreakActive]);

  const unreadCount = notifications.filter((notification) => notification.unread).length;
  const currentShift = upcomingShifts[0];
  const lastSubmittedRequest = timeOffRequests.find((request) => request.id === lastSubmittedRequestId) ?? null;

  const usedDays = timeOffRequests.reduce<Record<LeaveType, number>>(
    (totals, request) => {
      if (request.status !== 'Rejected') {
        totals[request.type] += request.businessDays;
      }
      return totals;
    },
    { Vacation: 0, Sick: 0, Personal: 0, Bereavement: 0 },
  );

  const balances = {
    Vacation: Math.max(BALANCE_LIMITS.Vacation - usedDays.Vacation, 0),
    Sick: Math.max(BALANCE_LIMITS.Sick - usedDays.Sick, 0),
    Personal: Math.max(BALANCE_LIMITS.Personal - usedDays.Personal, 0),
  };

  const markNotificationRead = async (notificationId: string) => {
    await runMutation({
      request: () => patchNotificationUnread(notificationId, false),
      fallback: () =>
        setNotifications((prev) =>
          prev.map((notification) =>
            notification.id === notificationId ? { ...notification, unread: false } : notification,
          ),
        ),
      errorMessage: 'Could not update notification state.',
    });
  };

  const mutationBanner = mutationError ? (
    <div className="mb-6 rounded-xl border border-error/20 bg-error/10 px-4 py-3 text-sm font-medium text-error">
      {mutationError}
    </div>
  ) : null;

  const handleClockIn = async () => {
    const nowDate = new Date();
    await runMutation({
      request: () => postClockEvent('clock-in'),
      fallback: () =>
        setClockState({
          isClockedIn: true,
          lastClockInAt: nowDate.toISOString(),
          lastResumedAt: nowDate.toISOString(),
          accumulatedWorkSeconds: 0,
          isBreakActive: false,
          breakStartedAt: null,
          accumulatedBreakSeconds: 0,
        }),
      errorMessage: 'Could not clock in.',
    });
  };

  const handleStartBreak = async () => {
    if (!clockState.isClockedIn || clockState.isBreakActive) {
      return;
    }

    const nowIso = new Date().toISOString();
    const workSecondsSinceResume = clockState.lastResumedAt ? getElapsedSeconds(clockState.lastResumedAt) : 0;

    await runMutation({
      request: () => postClockEvent('break-start'),
      fallback: () =>
        setClockState((prev) => ({
          ...prev,
          isBreakActive: true,
          breakStartedAt: nowIso,
          lastResumedAt: null,
          accumulatedWorkSeconds: prev.accumulatedWorkSeconds + workSecondsSinceResume,
        })),
      errorMessage: 'Could not start break.',
    });
  };

  const handleStopBreak = async () => {
    if (!clockState.isBreakActive || !clockState.breakStartedAt) {
      return;
    }

    const nowIso = new Date().toISOString();
    const breakSeconds = Math.min(getElapsedSeconds(clockState.breakStartedAt), BREAK_LIMIT_SECONDS);

    await runMutation({
      request: () => postClockEvent('break-stop'),
      fallback: () =>
        setClockState((prev) => ({
          ...prev,
          isBreakActive: false,
          breakStartedAt: null,
          lastResumedAt: nowIso,
          accumulatedBreakSeconds: prev.accumulatedBreakSeconds + breakSeconds,
        })),
      errorMessage: 'Could not stop break.',
    });
  };

  const handleClockOut = async () => {
    const nowDate = new Date();
    const startDate = clockState.lastClockInAt ? new Date(clockState.lastClockInAt) : nowDate;
    const { date, day } = formatShiftDate(startDate);
    const completedShift: Shift = {
      id: `shift-${nowDate.getTime()}`,
      date,
      day,
      location: currentShift?.location ?? 'Main Office - North Wing',
      status: 'Completed',
      startTime: formatClockTime(startDate),
      endTime: formatClockTime(nowDate),
      break: formatBreakDuration(totalBreakSeconds),
      total: formatShiftTotal(totalWorkedSeconds),
      teamLeader: currentShift?.teamLeader,
    };

    await runMutation({
      request: () => postClockEvent('clock-out'),
      fallback: () => {
        setShifts((prev) => [completedShift, ...prev].slice(0, 12));
        setClockState(INITIAL_CLOCK_STATE);
      },
      errorMessage: 'Could not clock out.',
    });
  };

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!loginForm.employeeId.trim() || !loginForm.password.trim()) {
      setLoginError('Enter your employee ID and password to continue.');
      return;
    }

    setLoginError('');
    setMutationError(null);
    await runMutation({
      request: () => patchSessionAuth(true),
      fallback: () => setIsAuthenticated(true),
      errorMessage: 'Could not sign in.',
    });
    setLoginForm(DEFAULT_LOGIN_FORM);
    navigateTo('dashboard');
  };

  const handleLogout = async () => {
    await runMutation({
      request: () => patchSessionAuth(false),
      fallback: () => setIsAuthenticated(false),
      errorMessage: 'Could not log out.',
    });
    setIsEditingProfile(false);
    setRequestError('');
    navigateTo('login');
  };

  const handleNotificationAction = async (notification: Notification) => {
    await markNotificationRead(notification.id);

    if (notification.action?.type === 'start' && !clockState.isClockedIn) {
      await handleClockIn();
    }

    navigateTo(notification.action?.targetScreen ?? 'alerts');
  };

  const handleNotificationOpen = async (notification: Notification) => {
    await markNotificationRead(notification.id);
    if (notification.action?.targetScreen) {
      navigateTo(notification.action.targetScreen);
    }
  };

  const handleCreateShiftSwap = async () => {
    const newNotification: Notification = {
      id: `notification-${Date.now()}`,
      type: 'update',
      title: 'Shift Swap Drafted',
      message: 'A shift swap request draft is ready for manager review.',
      time: 'Just now',
      unread: true,
      action: {
        label: 'View Schedule',
        type: 'open',
        targetScreen: 'schedule',
      },
    };

    await runMutation({
      request: () => postShiftSwapDraft(),
      fallback: () => setNotifications((prev) => [newNotification, ...prev]),
      errorMessage: 'Could not create shift swap draft.',
    });
    navigateTo('alerts');
  };

  const handleSubmitTimeOffRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!requestForm.startDate || !requestForm.endDate) {
      setRequestError('Choose a start date and end date before submitting.');
      return;
    }

    if (requestForm.endDate < requestForm.startDate) {
      setRequestError('The end date needs to be on or after the start date.');
      return;
    }

    const businessDays = countBusinessDays(requestForm.startDate, requestForm.endDate);
    if (businessDays === 0) {
      setRequestError('Choose at least one weekday for this request.');
      return;
    }

    if (businessDays > balances[requestForm.type]) {
      setRequestError(`You only have ${balances[requestForm.type]} ${requestForm.type.toLowerCase()} day(s) available.`);
      return;
    }

    const newRequest: TimeOffRequest = {
      id: `request-${Date.now()}`,
      type: requestForm.type,
      title: `${requestForm.type} Request`,
      dates: formatRequestDates(requestForm.startDate, requestForm.endDate),
      duration: `${businessDays} ${businessDays === 1 ? 'Day' : 'Days'}`,
      businessDays,
      status: 'Pending',
      submissionDate: getTodayDateInputValue(),
      approver: 'David Chen',
      notes: requestForm.notes.trim(),
    };

    const approvalNotification: Notification = {
      id: `notification-${Date.now() + 1}`,
      type: 'update',
      title: 'Time Off Submitted',
      message: `${newRequest.title} is pending manager review.`,
      time: 'Just now',
      unread: settings.notificationsEnabled,
      action: {
        label: 'View Requests',
        type: 'view',
        targetScreen: 'time-off',
      },
    };

    setRequestError('');
    setMutationError(null);
    await runMutation({
      request: () => postTimeOffRequest(requestForm.type, requestForm.startDate, requestForm.endDate, requestForm.notes),
      fallback: () => {
        setTimeOffRequests((prev) => [newRequest, ...prev]);
        setNotifications((prev) => [approvalNotification, ...prev]);
        setLastSubmittedRequestId(newRequest.id);
      },
      errorMessage: 'Could not submit time off request.',
    });
    setRequestForm(DEFAULT_TIME_OFF_FORM);
    navigateTo('request-submitted');
  };

  const handleSaveProfile = async () => {
    const name = editForm.name.trim() || user.name;
    const phone = editForm.phone.trim() || user.phone;

    await runMutation({
      request: () => patchUserProfile(name, phone),
      fallback: () => setUser({ ...user, name, phone }),
      errorMessage: 'Could not save profile changes.',
    });
    setIsEditingProfile(false);
  };

  const handleToggleNotifications = async () => {
    const nextValue = !settings.notificationsEnabled;
    await runMutation({
      request: () => patchSettings({ notificationsEnabled: nextValue }),
      fallback: () => setSettings((prev) => ({ ...prev, notificationsEnabled: nextValue })),
      errorMessage: 'Could not update notification preferences.',
    });
  };

  const handleToggleDarkMode = async () => {
    const nextValue = !settings.darkMode;
    await runMutation({
      request: () => patchSettings({ darkMode: nextValue }),
      fallback: () => setSettings((prev) => ({ ...prev, darkMode: nextValue })),
      errorMessage: 'Could not update theme preference.',
    });
  };

  const renderLogin = () => (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden bg-background">
      <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-primary/15 rounded-full blur-[120px]"></div>
      <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] bg-surface-container-highest opacity-40 rounded-full blur-[100px]"></div>
      <main className="w-full max-w-[440px] z-10">
        <div className="flex flex-col items-start mb-12">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-primary flex items-center justify-center rounded-xl">
              <BadgeCheck className="text-white" size={24} />
            </div>
            <span className="font-headline font-extrabold text-xl tracking-[0.2em] text-primary uppercase">Stratos</span>
          </div>
          <h1 className="font-headline font-bold text-[3.5rem] leading-[1.1] tracking-tight text-on-surface mb-2">
            Welcome <br />Back
          </h1>
          <p className="text-on-surface-variant font-body text-lg">Secure access to your professional workspace.</p>
        </div>
        {mutationBanner}
        <div className="surface-container-lowest glass-panel rounded-xl p-8 lg:p-10 shadow-[0px_20px_40px_rgba(7,30,39,0.06)] border border-white/40">
          <form className="space-y-6" onSubmit={handleLogin}>
            <div className="space-y-2">
              <label className="block text-[0.75rem] font-semibold uppercase tracking-widest text-on-surface-variant ml-1">Employee ID</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-outline">
                  <Badge size={20} />
                </div>
                <input
                  className="w-full h-14 pl-12 pr-4 bg-surface-container-highest border-0 rounded-lg text-on-surface focus:ring-2 focus:ring-primary transition-all duration-300 placeholder:text-outline/50"
                  placeholder="EMP-884291"
                  type="text"
                  value={loginForm.employeeId}
                  onChange={(event) => setLoginForm((prev) => ({ ...prev, employeeId: event.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="block text-[0.75rem] font-semibold uppercase tracking-widest text-on-surface-variant ml-1">Password</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-outline">
                  <Shield size={20} />
                </div>
                <input
                  className="w-full h-14 pl-12 pr-4 bg-surface-container-highest border-0 rounded-lg text-on-surface focus:ring-2 focus:ring-primary transition-all duration-300 placeholder:text-outline/50"
                  placeholder="••••••••"
                  type="password"
                  value={loginForm.password}
                  onChange={(event) => setLoginForm((prev) => ({ ...prev, password: event.target.value }))}
                />
              </div>
            </div>
            {loginError && <p className="text-sm font-medium text-error">{loginError}</p>}
            <div className="flex items-center justify-between">
              <button type="button" className="text-sm font-semibold text-primary hover:text-primary-container transition-colors duration-200" onClick={() => setLoginForm({ employeeId: user.id, password: 'demo-access' })}>
                Use demo credentials
              </button>
              <span className="text-xs font-semibold text-on-surface-variant">{apiStatus === 'online' ? 'API connected' : apiStatus === 'offline' ? 'Offline fallback' : 'Connecting API'}</span>
            </div>
            <button type="submit" className="w-full h-14 bg-gradient-to-br from-primary to-primary-container text-white font-headline font-bold rounded-lg shadow-lg hover:shadow-xl active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-2">
              Sign In
              <ChevronRight size={20} />
            </button>
          </form>
        </div>
      </main>
    </div>
  );

  const renderDashboard = () => (
    <Layout currentScreen="dashboard" onNavigate={navigateTo} user={user} banner={mutationBanner}>
      <section className="mb-10 pt-4">
        <h2 className="font-headline font-extrabold text-[3.5rem] leading-[1.1] text-primary tracking-tight mb-2">
          Good Morning,
          <br />
          {user.name.split(' ')[0]}.
        </h2>
        <p className="text-on-surface-variant font-medium text-lg">Ready to begin your scheduled shift?</p>
      </section>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="md:col-span-2">
          <ClockCard
            isClockedIn={clockState.isClockedIn}
            onClockIn={handleClockIn}
            onClockOut={handleClockOut}
            onStartBreak={handleStartBreak}
            onStopBreak={handleStopBreak}
            isBreakActive={clockState.isBreakActive}
            breakTimeRemaining={breakTimeRemaining}
            elapsedTime={formatHoursAndMinutes(totalWorkedSeconds)}
            startTime={clockState.lastClockInAt ? formatClockTime(new Date(clockState.lastClockInAt)) : undefined}
          />
        </div>
        <ProgressCard progress={Math.floor(totalWorkedSeconds / 60)} />
        <div className="bg-surface-container-highest rounded-xl p-6">
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">15-Minute Breaks</h4>
              <p className="text-sm text-on-surface-variant">Break usage today: {formatBreakDuration(totalBreakSeconds)}</p>
            </div>
            <button type="button" onClick={() => navigateTo('history')} className="text-sm font-bold text-primary hover:underline">
              View History
            </button>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-surface-container-lowest/50 rounded-lg">
              <span className="text-sm font-semibold text-on-surface-variant">Morning Break</span>
              <span className={`text-[10px] font-bold ${clockState.isBreakActive ? 'text-secondary' : 'text-slate-400'}`}>
                {clockState.isBreakActive ? 'IN PROGRESS' : clockState.isClockedIn ? 'AVAILABLE' : 'LOCKED'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-4">
              <button
                onClick={handleStartBreak}
                className={`flex items-center justify-center gap-2 py-3 rounded-lg font-bold text-sm transition-all ${clockState.isClockedIn && !clockState.isBreakActive ? 'bg-primary text-white hover:opacity-90' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                disabled={!clockState.isClockedIn || clockState.isBreakActive}
              >
                <Timer size={18} />
                Start Break
              </button>
              <button
                onClick={handleStopBreak}
                className={`flex items-center justify-center gap-2 py-3 rounded-lg font-bold text-sm transition-all ${clockState.isBreakActive ? 'bg-tertiary text-white hover:opacity-90' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                disabled={!clockState.isBreakActive}
              >
                <LogOut size={18} />
                Stop Break
              </button>
            </div>
            {!clockState.isClockedIn && <p className="text-[11px] text-center text-on-surface-variant/60 italic pt-2">Clock in required to access breaks.</p>}
          </div>
        </div>
        <div className="md:col-span-2">
          <ComplianceCard />
        </div>
      </div>
    </Layout>
  );

  const renderHistory = () => (
    <Layout currentScreen="history" onNavigate={navigateTo} user={user} title="Recent Shifts" banner={mutationBanner}>
      <div className="flex justify-between items-center mb-6">
        <h2 className="font-headline text-2xl font-bold text-primary">Recent Shifts</h2>
        <span className="text-on-surface-variant font-label text-sm font-medium">Latest {shifts.length} records</span>
      </div>
      <div className="space-y-6">
        {shifts.map((shift) => (
          <ShiftCard key={shift.id} shift={shift} />
        ))}
      </div>
    </Layout>
  );

  const renderSchedule = () => (
    <Layout currentScreen="schedule" onNavigate={navigateTo} user={user} title="Weekly Schedule" banner={mutationBanner}>
      <section className="mt-4 mb-8 overflow-x-auto no-scrollbar">
        <div className="flex gap-2 pb-2">
          {upcomingShifts.map((shift, index) => {
            const date = shift.date.split(' ')[1] ?? shift.date;
            const isActive = index === 0;
            return (
              <div key={shift.id} className={`flex-shrink-0 w-16 h-20 rounded-xl flex flex-col items-center justify-center transition-all ${isActive ? 'bg-primary-container text-on-primary shadow-lg' : 'bg-surface-container-low text-on-surface opacity-80 scale-95'}`}>
                <span className={`text-xs font-label ${isActive ? 'text-on-primary-container' : 'text-on-surface-variant'}`}>{shift.day}</span>
                <span className="text-xl font-headline font-extrabold">{date}</span>
                {isActive && <div className="w-1.5 h-1.5 rounded-full bg-secondary-container mt-1"></div>}
              </div>
            );
          })}
        </div>
      </section>
      <section className="space-y-6">
        <div className="group relative bg-surface-container-lowest rounded-xl p-6 shadow-[0px_20px_40px_rgba(7,30,39,0.06)] overflow-hidden border border-outline-variant/10">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary-container/5 rounded-full -mr-12 -mt-12"></div>
          <div className="flex justify-between items-start mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full bg-secondary"></div>
                <span className="text-xs font-semibold tracking-wider text-secondary uppercase">{clockState.isClockedIn ? 'Current Shift' : 'Next Shift'}</span>
              </div>
              <h2 className="text-2xl font-headline font-extrabold text-primary">{currentShift ? `${currentShift.startTime} - ${currentShift.endTime}` : 'No shift scheduled'}</h2>
            </div>
            <button type="button" onClick={() => navigateTo('profile')} className="text-outline hover:text-primary transition-colors">
              <Settings size={20} />
            </button>
          </div>
          {currentShift && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center text-primary">
                  <Search size={20} />
                </div>
                <div>
                  <p className="text-xs text-on-surface-variant font-medium">Location</p>
                  <p className="text-sm font-semibold text-on-surface">{currentShift.location}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center text-primary">
                  <Users size={20} />
                </div>
                <div>
                  <p className="text-xs text-on-surface-variant font-medium">Team Leader</p>
                  <p className="text-sm font-semibold text-on-surface">{currentShift.teamLeader ?? 'Operations Lead'}</p>
                </div>
              </div>
            </div>
          )}
          <div className="mt-8">
            <button type="button" onClick={clockState.isClockedIn ? handleStartBreak : handleClockIn} className="w-full py-4 bg-secondary text-on-secondary rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-transform">
              <Timer size={20} />
              {clockState.isBreakActive ? 'Break Running' : clockState.isClockedIn ? 'Start Break' : 'Clock In For Shift'}
            </button>
          </div>
        </div>
        <div className="space-y-4">
          {upcomingShifts.map((shift) => (
            <ShiftCard key={shift.id} shift={shift} variant="schedule" />
          ))}
        </div>
      </section>
      <button type="button" onClick={handleCreateShiftSwap} className="fixed bottom-24 right-6 w-14 h-14 bg-primary text-on-primary rounded-xl shadow-[0px_20px_40px_rgba(7,30,39,0.2)] flex items-center justify-center active:scale-90 transition-transform" aria-label="Create shift swap request">
        <Plus size={24} />
      </button>
    </Layout>
  );

  const renderTimeOff = () => (
    <Layout currentScreen="time-off" onNavigate={navigateTo} user={user} title="Time Off" banner={mutationBanner}>
      <section className="mb-10">
        <p className="font-headline text-on-surface-variant font-medium tracking-wide mb-1">YOUR BALANCES</p>
        <h2 className="font-headline text-primary font-extrabold text-4xl tracking-tighter">Plan your next break.</h2>
      </section>
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mb-12">
        <div className="md:col-span-12 lg:col-span-5">
          <BalanceCard type="Vacation" balance={balances.Vacation} maxBalance={BALANCE_LIMITS.Vacation} expiry="Dec 31, 2026" variant="large" />
        </div>
        <div className="md:col-span-6 lg:col-span-3">
          <BalanceCard type="Sick" balance={balances.Sick} maxBalance={BALANCE_LIMITS.Sick} />
        </div>
        <div className="md:col-span-6 lg:col-span-4">
          <BalanceCard type="Personal" balance={balances.Personal} maxBalance={BALANCE_LIMITS.Personal} description="Available for non-medical personal emergencies or appointments." variant="wide" />
        </div>
      </div>
      <section className="mb-12">
        <div className="flex justify-between items-end mb-6">
          <div>
            <h3 className="font-headline text-2xl font-bold text-on-surface tracking-tight">Recent Requests</h3>
            <p className="text-on-surface-variant text-sm font-medium">Tracking your upcoming and past absences</p>
          </div>
          <button type="button" onClick={() => navigateTo('request-submitted')} className="text-primary font-bold text-sm hover:underline transition-all" disabled={!lastSubmittedRequest}>
            {lastSubmittedRequest ? 'Latest Submission' : 'No recent submission'}
          </button>
        </div>
        <div className="space-y-4">
          {timeOffRequests.map((request) => (
            <RequestItem key={request.id} request={request} />
          ))}
        </div>
      </section>
      <div className="bg-surface-container-high rounded-2xl p-8 flex flex-col md:flex-row items-center gap-8 border border-white/50">
        <div className="flex-1">
          <h4 className="font-headline text-xl font-bold text-primary mb-2">Need more time?</h4>
          <p className="text-on-surface-variant leading-relaxed">Requests update your available balances immediately in this demo, so the team can spot overlaps and plan coverage earlier.</p>
        </div>
        <div className="w-full md:w-48 h-32 bg-surface-container-highest rounded-xl overflow-hidden shadow-inner flex items-center justify-center">
          <CalendarDays className="text-primary/20 w-16 h-16" />
        </div>
      </div>
      <button type="button" onClick={() => navigateTo('new-request')} className="fixed bottom-28 right-6 md:right-12 z-50 bg-primary text-white flex items-center gap-3 px-6 py-4 rounded-xl shadow-[0px_20px_40px_rgba(0,49,120,0.25)] hover:scale-105 active:scale-95 transition-all">
        <Plus size={24} />
        <span className="font-headline font-bold tracking-tight">Request Time Off</span>
      </button>
    </Layout>
  );

  const renderNewRequest = () => (
    <Layout currentScreen="time-off" onNavigate={navigateTo} user={user} title="New Request" showBottomBar={false} banner={mutationBanner}>
      <section className="mb-10">
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary to-primary-container p-8 text-white shadow-lg">
          <div className="relative z-10">
            <h2 className="text-3xl font-extrabold tracking-tight mb-2">Plan Your Rest</h2>
            <p className="text-on-primary-container font-light leading-relaxed max-w-md">
              Submit your request for time off. Your current vacation balance is <span className="font-bold text-white">{balances.Vacation} days</span>.
            </p>
          </div>
          <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-white/10 rounded-full blur-3xl"></div>
        </div>
      </section>
      <form className="space-y-8" onSubmit={handleSubmitTimeOffRequest}>
        <div className="space-y-4">
          <label className="block font-headline font-bold text-lg tracking-tight text-on-surface">Type of Leave</label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative group">
              <select
                className="w-full h-14 pl-4 pr-10 bg-surface-container-highest border-none rounded-xl text-on-surface font-medium appearance-none focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
                value={requestForm.type}
                onChange={(event) => setRequestForm((prev) => ({ ...prev, type: event.target.value as LeaveType }))}
              >
                <option>Vacation</option>
                <option>Sick</option>
                <option>Personal</option>
                <option>Bereavement</option>
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                <ChevronRight size={20} className="rotate-90 text-on-surface-variant" />
              </div>
            </div>
            <div className="bg-surface-container-low p-4 rounded-xl flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-surface-container-highest flex items-center justify-center">
                <Info className="text-primary" size={20} />
              </div>
              <span className="text-xs font-medium text-on-surface-variant leading-tight">Requests for 5+ days usually need at least 2 weeks notice.</span>
            </div>
          </div>
        </div>
        <div className="bg-surface-container-low p-6 rounded-xl space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant px-1">Start Date</label>
              <input className="w-full h-12 bg-surface-container-lowest border border-outline-variant/30 rounded-lg px-4 font-medium focus:ring-0 focus:border-primary transition-colors" type="date" min={getTodayDateInputValue()} value={requestForm.startDate} onChange={(event) => setRequestForm((prev) => ({ ...prev, startDate: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant px-1">End Date</label>
              <input className="w-full h-12 bg-surface-container-lowest border border-outline-variant/30 rounded-lg px-4 font-medium focus:ring-0 focus:border-primary transition-colors" type="date" min={requestForm.startDate || getTodayDateInputValue()} value={requestForm.endDate} onChange={(event) => setRequestForm((prev) => ({ ...prev, endDate: event.target.value }))} />
            </div>
          </div>
          {requestForm.startDate && requestForm.endDate && requestForm.endDate >= requestForm.startDate && (
            <div className="rounded-xl bg-surface-container-lowest p-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Estimated Duration</p>
                <p className="text-lg font-headline font-bold text-primary">{countBusinessDays(requestForm.startDate, requestForm.endDate)} business day(s)</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Available</p>
                <p className="text-sm font-semibold text-on-surface">{balances[requestForm.type]} {requestForm.type.toLowerCase()} day(s)</p>
              </div>
            </div>
          )}
        </div>
        <div className="space-y-3">
          <label className="block font-headline font-bold text-lg tracking-tight text-on-surface">
            Reason/Notes <span className="text-on-surface-variant font-normal text-sm">(Optional)</span>
          </label>
          <textarea className="w-full bg-surface-container-highest border-none rounded-xl p-4 text-on-surface placeholder:text-outline focus:ring-2 focus:ring-primary/20 transition-all resize-none" placeholder="Briefly describe the reason for your request..." rows={4} value={requestForm.notes} onChange={(event) => setRequestForm((prev) => ({ ...prev, notes: event.target.value }))}></textarea>
        </div>
        {requestError && <p className="text-sm font-medium text-error">{requestError}</p>}
        <div className="pt-6 flex flex-col gap-4">
          <button type="submit" className="w-full h-14 bg-secondary text-white font-headline font-bold text-lg rounded-xl shadow-lg shadow-secondary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2">
            Submit Request
            <Send size={20} />
          </button>
          <button type="button" onClick={() => navigateTo('time-off')} className="w-full py-3 text-center text-on-surface-variant font-medium hover:text-primary transition-colors">
            Cancel
          </button>
        </div>
      </form>
    </Layout>
  );

  const renderRequestSubmitted = () => (
    <Layout currentScreen="dashboard" onNavigate={navigateTo} user={user} title="Request Submitted" showBottomBar={false} banner={mutationBanner}>
      <div className="relative overflow-hidden bg-surface-container-low rounded-xl p-8 md:p-16 text-center">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-secondary-container/20 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 bg-primary-container/10 rounded-full blur-3xl"></div>
        <div className="relative z-10 flex flex-col items-center">
          <div className="w-24 h-24 mb-8 flex items-center justify-center rounded-full bg-secondary text-on-secondary shadow-[0px_20px_40px_rgba(27,109,36,0.15)]">
            <CheckCircle2 size={48} />
          </div>
          <h1 className="font-headline font-extrabold text-4xl md:text-5xl text-primary mb-6 tracking-tight">Request Submitted</h1>
          <p className="font-body text-lg md:text-xl text-on-surface-variant max-w-lg mx-auto mb-12 leading-relaxed">
            {lastSubmittedRequest ? <>Your request for <span className="font-bold text-on-surface">{lastSubmittedRequest.type} ({lastSubmittedRequest.dates})</span> has been sent to your manager for approval.</> : 'Your latest request has been sent to your manager for approval.'}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-md">
            <button type="button" onClick={() => navigateTo('time-off')} className="flex items-center justify-center gap-2 bg-primary text-white font-semibold py-4 px-8 rounded-xl hover:opacity-90 active:scale-95 transition-all shadow-[0px_20px_40px_rgba(7,30,39,0.06)]">
              <Eye size={20} />
              View Status
            </button>
            <button type="button" onClick={() => navigateTo('dashboard')} className="flex items-center justify-center gap-2 bg-surface-container-highest text-primary font-semibold py-4 px-8 rounded-xl hover:bg-surface-container transition-all">
              <Home size={20} />
              Back to Home
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );

  const renderScreen = () => {
    if (!isAuthenticated && currentScreen !== 'login') {
      return renderLogin();
    }

    switch (currentScreen) {
      case 'login':
        return renderLogin();
      case 'dashboard':
        return renderDashboard();
      case 'history':
        return renderHistory();
      case 'schedule':
        return renderSchedule();
      case 'time-off':
        return renderTimeOff();
      case 'new-request':
        return renderNewRequest();
      case 'request-submitted':
        return renderRequestSubmitted();
      case 'alerts':
        return (
          <AlertsScreen
            banner={mutationBanner}
            notifications={notifications}
            unreadCount={unreadCount}
            onAction={handleNotificationAction}
            onNavigate={navigateTo}
            onOpen={handleNotificationOpen}
            user={user}
          />
        );
      case 'profile':
        return (
          <ProfileScreen
            apiStatus={apiStatus}
            banner={mutationBanner}
            editForm={editForm}
            isEditingProfile={isEditingProfile}
            onEditFormChange={setEditForm}
            onLogout={handleLogout}
            onNavigate={navigateTo}
            onSaveProfile={handleSaveProfile}
            onToggleDarkMode={handleToggleDarkMode}
            onToggleNotifications={handleToggleNotifications}
            setIsEditingProfile={setIsEditingProfile}
            settings={settings}
            user={user}
          />
        );
      default:
        return <div>Screen not found</div>;
    }
  };

  return <AnimatePresence mode="wait">{renderScreen()}</AnimatePresence>;
}
