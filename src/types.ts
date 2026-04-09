export type Screen = 'login' | 'dashboard' | 'history' | 'schedule' | 'time-off' | 'new-request' | 'alerts' | 'profile' | 'request-submitted';
export type LeaveType = 'Vacation' | 'Sick' | 'Personal' | 'Bereavement';

export interface LoginFormState {
  employeeId: string;
  password: string;
}

export interface TimeOffFormState {
  type: LeaveType;
  startDate: string;
  endDate: string;
  notes: string;
}

export interface AppSettings {
  notificationsEnabled: boolean;
  darkMode: boolean;
}

export interface ClockState {
  isClockedIn: boolean;
  lastClockInAt: string | null;
  lastResumedAt: string | null;
  accumulatedWorkSeconds: number;
  isBreakActive: boolean;
  breakStartedAt: string | null;
  accumulatedBreakSeconds: number;
}

export interface Shift {
  id: string;
  date: string;
  day: string;
  location: string;
  status: 'Completed' | 'Upcoming' | 'In Progress';
  startTime: string;
  endTime: string;
  break: string;
  total: string;
  teamLeader?: string;
}

export interface TimeOffRequest {
  id: string;
  type: LeaveType;
  title: string;
  dates: string;
  duration: string;
  businessDays: number;
  status: 'Pending' | 'Approved' | 'Rejected';
  approver?: string;
  submissionDate: string;
  notes?: string;
}

export interface Notification {
  id: string;
  type: 'approval' | 'reminder' | 'update';
  title: string;
  message: string;
  time: string;
  unread: boolean;
  action?: {
    label: string;
    type: 'view' | 'start' | 'open';
    targetScreen?: Screen;
  };
}

export interface User {
  name: string;
  id: string;
  email: string;
  phone: string;
  photoUrl: string;
}

export interface PersistedState {
  isAuthenticated: boolean;
  user: User;
  shifts: Shift[];
  upcomingShifts: Shift[];
  timeOffRequests: TimeOffRequest[];
  notifications: Notification[];
  settings: AppSettings;
  clockState: ClockState;
  lastSubmittedRequestId: string | null;
}
