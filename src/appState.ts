import { AppSettings, ClockState, LeaveType, LoginFormState, Notification, PersistedState, Shift, TimeOffFormState, TimeOffRequest, User } from './types';

export const STORAGE_KEY = 'stratos-workforce-state-v1';
export const BREAK_LIMIT_SECONDS = 15 * 60;

export const MOCK_USER: User = {
  name: 'Alex Johnson',
  id: 'EMP-884291',
  email: 'alex.johnson@workforce.pro',
  phone: '+1 (555) 234-8890',
  photoUrl:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuD6_7coFqlouvKPL7qG_cqGYfBT3O1d7dtGPK-8o_RJqIQFp5kpg4no-picokXuHo4ayfwvLMLEADmJiovN4X9u0jawJh8M_P7P3V8H9kakW3VTjRxtBwhbm02oYvfqP1CmRvKV7lmljOt3fVf7sxK2Uukz-sfqUJUHG_CC5wQpWdqZsykXSWq--8eCSGjSihQJblS1fn4Q1qcNPDrxxTNl4o8uCRTm_6kN0QTv0JX8SFkFtE73jFlfPVAW0xwbDO4tgrQ7EomL44ql',
};

export const INITIAL_SHIFTS: Shift[] = [
  { id: '1', date: 'May 24', day: 'Fri', location: 'Main Office - North Wing', status: 'Completed', startTime: '08:00 AM', endTime: '04:30 PM', break: '00:30', total: '8.0 hrs' },
  { id: '2', date: 'May 23', day: 'Thu', location: 'Main Office - North Wing', status: 'Completed', startTime: '08:15 AM', endTime: '05:00 PM', break: '00:45', total: '8.0 hrs' },
  { id: '3', date: 'May 22', day: 'Wed', location: 'Remote Work', status: 'Completed', startTime: '09:00 AM', endTime: '06:00 PM', break: '01:00', total: '8.0 hrs' },
  { id: '4', date: 'May 21', day: 'Tue', location: 'Main Office - North Wing', status: 'Completed', startTime: '08:30 AM', endTime: '05:30 PM', break: '01:00', total: '8.0 hrs' },
  { id: '5', date: 'May 20', day: 'Mon', location: 'Main Office - North Wing', status: 'Completed', startTime: '08:45 AM', endTime: '04:45 PM', break: '01:30', total: '6.5 hrs' },
];

export const INITIAL_UPCOMING_SHIFTS: Shift[] = [
  { id: '6', date: 'May 21', day: 'TUE', location: 'Main Office - North Wing', status: 'Upcoming', startTime: '08:00 AM', endTime: '04:30 PM', break: '01:00', total: '8.0 hrs', teamLeader: 'Marcus Thorne' },
  { id: '7', date: 'May 22', day: 'WED', location: 'Regional Logistics Hub', status: 'Upcoming', startTime: '09:00 AM', endTime: '05:00 PM', break: '01:00', total: '8.0 hrs', teamLeader: 'Priya Lewis' },
  { id: '8', date: 'May 23', day: 'THU', location: 'Main Office - North Wing', status: 'Upcoming', startTime: '08:00 AM', endTime: '04:30 PM', break: '01:00', total: '8.0 hrs', teamLeader: 'Marcus Thorne' },
];

export const INITIAL_TIME_OFF_REQUESTS: TimeOffRequest[] = [
  { id: '1', type: 'Vacation', title: 'Summer Vacation', dates: 'Jul 12 - Jul 19, 2024', duration: '5 Days', businessDays: 5, status: 'Pending', submissionDate: '2024-05-10', approver: 'David Chen' },
  { id: '2', type: 'Sick', title: 'Sick Leave', dates: 'May 02, 2024', duration: '1 Day', businessDays: 1, status: 'Approved', submissionDate: '2024-05-01', approver: 'David Chen' },
];

export const INITIAL_NOTIFICATIONS: Notification[] = [
  { id: '1', type: 'approval', title: 'Shift Approved', message: 'Your shift for Tuesday, May 21 has been approved by Marcus Thorne.', time: 'Just now', unread: true, action: { label: 'View Schedule', type: 'view', targetScreen: 'schedule' } },
  { id: '2', type: 'reminder', title: 'Clock-in Reminder', message: "Don't forget to clock in for your shift starting in 15 minutes.", time: '15m ago', unread: true, action: { label: 'Start Shift', type: 'start', targetScreen: 'dashboard' } },
  { id: '3', type: 'update', title: 'Schedule Update', message: 'A new shift has been added to your weekly schedule for Friday.', time: 'Yesterday', unread: false, action: { label: 'Open Schedule', type: 'open', targetScreen: 'schedule' } },
  { id: '4', type: 'update', title: 'Time Off Update', message: "Your 'Summer Vacation' request is now pending review.", time: '2 days ago', unread: false, action: { label: 'View Requests', type: 'view', targetScreen: 'time-off' } },
];

export const INITIAL_SETTINGS: AppSettings = {
  notificationsEnabled: true,
  darkMode: false,
};

export const INITIAL_CLOCK_STATE: ClockState = {
  isClockedIn: false,
  lastClockInAt: null,
  lastResumedAt: null,
  accumulatedWorkSeconds: 0,
  isBreakActive: false,
  breakStartedAt: null,
  accumulatedBreakSeconds: 0,
};

export const DEFAULT_LOGIN_FORM: LoginFormState = {
  employeeId: '',
  password: '',
};

export const DEFAULT_TIME_OFF_FORM: TimeOffFormState = {
  type: 'Vacation',
  startDate: '',
  endDate: '',
  notes: '',
};

export const BALANCE_LIMITS: Record<LeaveType, number> = {
  Vacation: 20,
  Sick: 10,
  Personal: 5,
  Bereavement: 5,
};

export function createDefaultAppState(): PersistedState {
  return {
    isAuthenticated: false,
    user: structuredClone(MOCK_USER),
    shifts: structuredClone(INITIAL_SHIFTS),
    upcomingShifts: structuredClone(INITIAL_UPCOMING_SHIFTS),
    timeOffRequests: structuredClone(INITIAL_TIME_OFF_REQUESTS),
    notifications: structuredClone(INITIAL_NOTIFICATIONS),
    settings: structuredClone(INITIAL_SETTINGS),
    clockState: structuredClone(INITIAL_CLOCK_STATE),
    lastSubmittedRequestId: null,
  };
}
