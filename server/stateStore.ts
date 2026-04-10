import { mkdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { BALANCE_LIMITS, BREAK_LIMIT_SECONDS, createDefaultAppState } from '../src/appState';
import { LeaveType, Notification, PersistedState, Shift, TimeOffRequest } from '../src/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDirectory = path.resolve(__dirname, '..', 'data');
const databaseFilePath = path.join(dataDirectory, 'app-state.sqlite');
const legacyJsonFilePath = path.join(dataDirectory, 'app-state.json');

let database: DatabaseSync | null = null;
let initialized = false;
const NOW_LABEL = 'Just now';

export type ClockEventType = 'clock-in' | 'break-start' | 'break-stop' | 'clock-out';

export interface CreateTimeOffRequestInput {
  type: LeaveType;
  startDate: string;
  endDate: string;
  notes?: string;
}

export interface UpdateUserProfileInput {
  name: string;
  phone: string;
}

export interface UpdateSettingsInput {
  notificationsEnabled?: boolean;
  darkMode?: boolean;
}

function normalizeState(candidate: Partial<PersistedState> | null | undefined): PersistedState {
  const defaults = createDefaultAppState();
  return {
    ...defaults,
    ...candidate,
    user: candidate?.user ?? defaults.user,
    shifts: candidate?.shifts ?? defaults.shifts,
    upcomingShifts: candidate?.upcomingShifts ?? defaults.upcomingShifts,
    timeOffRequests: candidate?.timeOffRequests ?? defaults.timeOffRequests,
    notifications: candidate?.notifications ?? defaults.notifications,
    settings: candidate?.settings ?? defaults.settings,
    clockState: candidate?.clockState ?? defaults.clockState,
    lastSubmittedRequestId: candidate?.lastSubmittedRequestId ?? defaults.lastSubmittedRequestId,
  };
}

async function getLegacyJsonState(): Promise<PersistedState | null> {
  try {
    const raw = await readFile(legacyJsonFilePath, 'utf8');
    return normalizeState(JSON.parse(raw) as PersistedState);
  } catch {
    return null;
  }
}

function execTransaction<T>(db: DatabaseSync, work: () => T): T {
  db.exec('BEGIN');
  try {
    const result = work();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function getElapsedSeconds(fromIso: string | null, nowMs: number): number {
  if (!fromIso) {
    return 0;
  }

  return Math.max(Math.floor((nowMs - new Date(fromIso).getTime()) / 1000), 0);
}

function formatClockTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function formatShiftDate(date: Date): { date: string; day: string } {
  return {
    date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    day: date.toLocaleDateString('en-US', { weekday: 'short' }),
  };
}

function formatBreakDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.round((totalSeconds % 3600) / 60);
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

function formatShiftTotal(totalSeconds: number): string {
  return `${(Math.round((totalSeconds / 3600) * 10) / 10).toFixed(1)} hrs`;
}

function countBusinessDays(startDate: string, endDate: string): number {
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

function formatRequestDates(startDate: string, endDate: string): string {
  const start = new Date(`${startDate}T12:00:00`);
  const end = new Date(`${endDate}T12:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error('Invalid date format for time off request.');
  }

  if (startDate === endDate) {
    return end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  const startText = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const endText = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${startText} - ${endText}`;
}

function ensureSchema(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_session (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      is_authenticated INTEGER NOT NULL,
      last_submitted_request_id TEXT
    );

    CREATE TABLE IF NOT EXISTS user_profile (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      name TEXT NOT NULL,
      employee_id TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      photo_url TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      notifications_enabled INTEGER NOT NULL,
      dark_mode INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS clock_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      is_clocked_in INTEGER NOT NULL,
      last_clock_in_at TEXT,
      last_resumed_at TEXT,
      accumulated_work_seconds INTEGER NOT NULL,
      is_break_active INTEGER NOT NULL,
      break_started_at TEXT,
      accumulated_break_seconds INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS shifts (
      id TEXT PRIMARY KEY,
      bucket TEXT NOT NULL CHECK (bucket IN ('history', 'upcoming')),
      sort_order INTEGER NOT NULL,
      date_label TEXT NOT NULL,
      day_label TEXT NOT NULL,
      location TEXT NOT NULL,
      status TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      break_duration TEXT NOT NULL,
      total_duration TEXT NOT NULL,
      team_leader TEXT
    );

    CREATE TABLE IF NOT EXISTS time_off_requests (
      id TEXT PRIMARY KEY,
      sort_order INTEGER NOT NULL,
      leave_type TEXT NOT NULL,
      title TEXT NOT NULL,
      dates TEXT NOT NULL,
      duration TEXT NOT NULL,
      business_days INTEGER NOT NULL,
      status TEXT NOT NULL,
      approver TEXT,
      submission_date TEXT NOT NULL,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      sort_order INTEGER NOT NULL,
      notification_type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      time_label TEXT NOT NULL,
      unread INTEGER NOT NULL,
      action_label TEXT,
      action_type TEXT,
      action_target_screen TEXT
    );

    CREATE TABLE IF NOT EXISTS app_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      state_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
}

function hasNormalizedData(db: DatabaseSync): boolean {
  const row = db.prepare('SELECT COUNT(*) as count FROM user_profile').get() as { count: number };
  return row.count > 0;
}

function getLegacyBlobState(db: DatabaseSync): PersistedState | null {
  const row = db.prepare('SELECT state_json FROM app_state WHERE id = 1').get() as { state_json: string } | undefined;
  if (!row) {
    return null;
  }

  return normalizeState(JSON.parse(row.state_json) as PersistedState);
}

function replaceSingleRowTables(db: DatabaseSync, state: PersistedState) {
  db.prepare(
    `INSERT INTO app_session (id, is_authenticated, last_submitted_request_id)
     VALUES (1, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       is_authenticated = excluded.is_authenticated,
       last_submitted_request_id = excluded.last_submitted_request_id`,
  ).run(state.isAuthenticated ? 1 : 0, state.lastSubmittedRequestId);

  db.prepare(
    `INSERT INTO user_profile (id, name, employee_id, email, phone, photo_url)
     VALUES (1, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       employee_id = excluded.employee_id,
       email = excluded.email,
       phone = excluded.phone,
       photo_url = excluded.photo_url`,
  ).run(state.user.name, state.user.id, state.user.email, state.user.phone, state.user.photoUrl);

  db.prepare(
    `INSERT INTO app_settings (id, notifications_enabled, dark_mode)
     VALUES (1, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       notifications_enabled = excluded.notifications_enabled,
       dark_mode = excluded.dark_mode`,
  ).run(state.settings.notificationsEnabled ? 1 : 0, state.settings.darkMode ? 1 : 0);

  db.prepare(
    `INSERT INTO clock_state (
       id,
       is_clocked_in,
       last_clock_in_at,
       last_resumed_at,
       accumulated_work_seconds,
       is_break_active,
       break_started_at,
       accumulated_break_seconds
     )
     VALUES (1, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       is_clocked_in = excluded.is_clocked_in,
       last_clock_in_at = excluded.last_clock_in_at,
       last_resumed_at = excluded.last_resumed_at,
       accumulated_work_seconds = excluded.accumulated_work_seconds,
       is_break_active = excluded.is_break_active,
       break_started_at = excluded.break_started_at,
       accumulated_break_seconds = excluded.accumulated_break_seconds`,
  ).run(
    state.clockState.isClockedIn ? 1 : 0,
    state.clockState.lastClockInAt,
    state.clockState.lastResumedAt,
    state.clockState.accumulatedWorkSeconds,
    state.clockState.isBreakActive ? 1 : 0,
    state.clockState.breakStartedAt,
    state.clockState.accumulatedBreakSeconds,
  );
}

function replaceShiftRows(db: DatabaseSync, bucket: 'history' | 'upcoming', shifts: Shift[]) {
  db.prepare('DELETE FROM shifts WHERE bucket = ?').run(bucket);

  const insertShift = db.prepare(
    `INSERT INTO shifts (
       id,
       bucket,
       sort_order,
       date_label,
       day_label,
       location,
       status,
       start_time,
       end_time,
       break_duration,
       total_duration,
       team_leader
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  shifts.forEach((shift, index) => {
    insertShift.run(
      shift.id,
      bucket,
      index,
      shift.date,
      shift.day,
      shift.location,
      shift.status,
      shift.startTime,
      shift.endTime,
      shift.break,
      shift.total,
      shift.teamLeader ?? null,
    );
  });
}

function replaceTimeOffRequests(db: DatabaseSync, requests: TimeOffRequest[]) {
  db.prepare('DELETE FROM time_off_requests').run();

  const insertRequest = db.prepare(
    `INSERT INTO time_off_requests (
       id,
       sort_order,
       leave_type,
       title,
       dates,
       duration,
       business_days,
       status,
       approver,
       submission_date,
       notes
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  requests.forEach((request, index) => {
    insertRequest.run(
      request.id,
      index,
      request.type,
      request.title,
      request.dates,
      request.duration,
      request.businessDays,
      request.status,
      request.approver ?? null,
      request.submissionDate,
      request.notes ?? null,
    );
  });
}

function replaceNotifications(db: DatabaseSync, notifications: Notification[]) {
  db.prepare('DELETE FROM notifications').run();

  const insertNotification = db.prepare(
    `INSERT INTO notifications (
       id,
       sort_order,
       notification_type,
       title,
       message,
       time_label,
       unread,
       action_label,
       action_type,
       action_target_screen
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  notifications.forEach((notification, index) => {
    insertNotification.run(
      notification.id,
      index,
      notification.type,
      notification.title,
      notification.message,
      notification.time,
      notification.unread ? 1 : 0,
      notification.action?.label ?? null,
      notification.action?.type ?? null,
      notification.action?.targetScreen ?? null,
    );
  });
}

function insertNotificationAtTop(db: DatabaseSync, notification: Notification) {
  db.prepare('UPDATE notifications SET sort_order = sort_order + 1').run();
  db.prepare(
    `INSERT INTO notifications (
       id,
       sort_order,
       notification_type,
       title,
       message,
       time_label,
       unread,
       action_label,
       action_type,
       action_target_screen
     ) VALUES (?, 0, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    notification.id,
    notification.type,
    notification.title,
    notification.message,
    notification.time,
    notification.unread ? 1 : 0,
    notification.action?.label ?? null,
    notification.action?.type ?? null,
    notification.action?.targetScreen ?? null,
  );
}

function insertHistoryShiftAtTop(db: DatabaseSync, shift: Shift) {
  db.prepare(`UPDATE shifts SET sort_order = sort_order + 1 WHERE bucket = 'history'`).run();
  db.prepare(
    `INSERT INTO shifts (
       id,
       bucket,
       sort_order,
       date_label,
       day_label,
       location,
       status,
       start_time,
       end_time,
       break_duration,
       total_duration,
       team_leader
     ) VALUES (?, 'history', 0, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    shift.id,
    shift.date,
    shift.day,
    shift.location,
    shift.status,
    shift.startTime,
    shift.endTime,
    shift.break,
    shift.total,
    shift.teamLeader ?? null,
  );
}

function persistNormalizedState(db: DatabaseSync, state: PersistedState): PersistedState {
  const normalized = normalizeState(state);

  execTransaction(db, () => {
    replaceSingleRowTables(db, normalized);
    replaceShiftRows(db, 'history', normalized.shifts);
    replaceShiftRows(db, 'upcoming', normalized.upcomingShifts);
    replaceTimeOffRequests(db, normalized.timeOffRequests);
    replaceNotifications(db, normalized.notifications);
  });

  return normalized;
}

function hydrateNormalizedState(db: DatabaseSync): PersistedState {
  const defaults = createDefaultAppState();

  const session = db.prepare(
    'SELECT is_authenticated, last_submitted_request_id FROM app_session WHERE id = 1',
  ).get() as { is_authenticated: number; last_submitted_request_id: string | null } | undefined;

  const user = db.prepare(
    'SELECT name, employee_id, email, phone, photo_url FROM user_profile WHERE id = 1',
  ).get() as
    | { name: string; employee_id: string; email: string; phone: string; photo_url: string }
    | undefined;

  const settings = db.prepare(
    'SELECT notifications_enabled, dark_mode FROM app_settings WHERE id = 1',
  ).get() as { notifications_enabled: number; dark_mode: number } | undefined;

  const clockState = db.prepare(
    `SELECT
       is_clocked_in,
       last_clock_in_at,
       last_resumed_at,
       accumulated_work_seconds,
       is_break_active,
       break_started_at,
       accumulated_break_seconds
     FROM clock_state
     WHERE id = 1`,
  ).get() as
    | {
        is_clocked_in: number;
        last_clock_in_at: string | null;
        last_resumed_at: string | null;
        accumulated_work_seconds: number;
        is_break_active: number;
        break_started_at: string | null;
        accumulated_break_seconds: number;
      }
    | undefined;

  const shifts = db.prepare(
    `SELECT id, date_label, day_label, location, status, start_time, end_time, break_duration, total_duration, team_leader
     FROM shifts
     WHERE bucket = 'history'
     ORDER BY sort_order ASC`,
  ).all() as Array<{
    id: string;
    date_label: string;
    day_label: string;
    location: string;
    status: Shift['status'];
    start_time: string;
    end_time: string;
    break_duration: string;
    total_duration: string;
    team_leader: string | null;
  }>;

  const upcomingShifts = db.prepare(
    `SELECT id, date_label, day_label, location, status, start_time, end_time, break_duration, total_duration, team_leader
     FROM shifts
     WHERE bucket = 'upcoming'
     ORDER BY sort_order ASC`,
  ).all() as Array<{
    id: string;
    date_label: string;
    day_label: string;
    location: string;
    status: Shift['status'];
    start_time: string;
    end_time: string;
    break_duration: string;
    total_duration: string;
    team_leader: string | null;
  }>;

  const timeOffRequests = db.prepare(
    `SELECT id, leave_type, title, dates, duration, business_days, status, approver, submission_date, notes
     FROM time_off_requests
     ORDER BY sort_order ASC`,
  ).all() as Array<{
    id: string;
    leave_type: TimeOffRequest['type'];
    title: string;
    dates: string;
    duration: string;
    business_days: number;
    status: TimeOffRequest['status'];
    approver: string | null;
    submission_date: string;
    notes: string | null;
  }>;

  const notifications = db.prepare(
    `SELECT
       id,
       notification_type,
       title,
       message,
       time_label,
       unread,
       action_label,
       action_type,
       action_target_screen
     FROM notifications
     ORDER BY sort_order ASC`,
  ).all() as Array<{
    id: string;
    notification_type: Notification['type'];
    title: string;
    message: string;
    time_label: string;
    unread: number;
    action_label: string | null;
    action_type: NonNullable<Notification['action']>['type'] | null;
    action_target_screen: NonNullable<Notification['action']>['targetScreen'] | null;
  }>;

  return normalizeState({
    isAuthenticated: session ? session.is_authenticated === 1 : defaults.isAuthenticated,
    user: user
      ? {
          name: user.name,
          id: user.employee_id,
          email: user.email,
          phone: user.phone,
          photoUrl: user.photo_url,
        }
      : defaults.user,
    settings: settings
      ? {
          notificationsEnabled: settings.notifications_enabled === 1,
          darkMode: settings.dark_mode === 1,
        }
      : defaults.settings,
    clockState: clockState
      ? {
          isClockedIn: clockState.is_clocked_in === 1,
          lastClockInAt: clockState.last_clock_in_at,
          lastResumedAt: clockState.last_resumed_at,
          accumulatedWorkSeconds: clockState.accumulated_work_seconds,
          isBreakActive: clockState.is_break_active === 1,
          breakStartedAt: clockState.break_started_at,
          accumulatedBreakSeconds: clockState.accumulated_break_seconds,
        }
      : defaults.clockState,
    shifts: shifts.map((shift) => ({
      id: shift.id,
      date: shift.date_label,
      day: shift.day_label,
      location: shift.location,
      status: shift.status,
      startTime: shift.start_time,
      endTime: shift.end_time,
      break: shift.break_duration,
      total: shift.total_duration,
      teamLeader: shift.team_leader ?? undefined,
    })),
    upcomingShifts: upcomingShifts.map((shift) => ({
      id: shift.id,
      date: shift.date_label,
      day: shift.day_label,
      location: shift.location,
      status: shift.status,
      startTime: shift.start_time,
      endTime: shift.end_time,
      break: shift.break_duration,
      total: shift.total_duration,
      teamLeader: shift.team_leader ?? undefined,
    })),
    timeOffRequests: timeOffRequests.map((request) => ({
      id: request.id,
      type: request.leave_type,
      title: request.title,
      dates: request.dates,
      duration: request.duration,
      businessDays: request.business_days,
      status: request.status,
      approver: request.approver ?? undefined,
      submissionDate: request.submission_date,
      notes: request.notes ?? undefined,
    })),
    notifications: notifications.map((notification) => ({
      id: notification.id,
      type: notification.notification_type,
      title: notification.title,
      message: notification.message,
      time: notification.time_label,
      unread: notification.unread === 1,
      action: notification.action_label && notification.action_type
        ? {
            label: notification.action_label,
            type: notification.action_type,
            targetScreen: notification.action_target_screen ?? undefined,
          }
        : undefined,
    })),
    lastSubmittedRequestId: session?.last_submitted_request_id ?? defaults.lastSubmittedRequestId,
  });
}

async function ensureDatabase(): Promise<DatabaseSync> {
  if (database) {
    return database;
  }

  await mkdir(dataDirectory, { recursive: true });
  database = new DatabaseSync(databaseFilePath);
  ensureSchema(database);

  if (!initialized) {
    if (!hasNormalizedData(database)) {
      const migratedState = getLegacyBlobState(database) ?? (await getLegacyJsonState()) ?? createDefaultAppState();
      persistNormalizedState(database, migratedState);

      if (getLegacyBlobState(database)) {
        database.prepare('DELETE FROM app_state WHERE id = 1').run();
      }

      await rm(legacyJsonFilePath, { force: true });
    }

    initialized = true;
  }

  return database;
}

export async function readAppState(): Promise<PersistedState> {
  const db = await ensureDatabase();
  return hydrateNormalizedState(db);
}

export async function writeAppState(state: PersistedState): Promise<PersistedState> {
  const db = await ensureDatabase();
  return persistNormalizedState(db, state);
}

export async function resetAppState(): Promise<PersistedState> {
  const db = await ensureDatabase();
  return persistNormalizedState(db, createDefaultAppState());
}

export async function createTimeOffRequest(input: CreateTimeOffRequestInput): Promise<PersistedState> {
  const db = await ensureDatabase();
  const startDate = input.startDate;
  const endDate = input.endDate;

  if (!startDate || !endDate) {
    throw new Error('Start date and end date are required.');
  }

  if (endDate < startDate) {
    throw new Error('End date must be on or after start date.');
  }

  const businessDays = countBusinessDays(startDate, endDate);
  if (businessDays <= 0) {
    throw new Error('Time off request must include at least one weekday.');
  }

  const usedRow = db.prepare(
    `SELECT COALESCE(SUM(business_days), 0) as used_days
     FROM time_off_requests
     WHERE leave_type = ? AND status != 'Rejected'`,
  ).get(input.type) as { used_days: number };
  const usedDays = usedRow?.used_days ?? 0;
  const availableDays = Math.max(BALANCE_LIMITS[input.type] - usedDays, 0);

  if (businessDays > availableDays) {
    throw new Error(`Insufficient ${input.type.toLowerCase()} balance.`);
  }

  const requestId = `request-${Date.now()}`;
  const notificationId = `notification-${Date.now() + 1}`;
  const datesLabel = formatRequestDates(startDate, endDate);
  const durationLabel = `${businessDays} ${businessDays === 1 ? 'Day' : 'Days'}`;
  const submissionDate = new Date().toISOString().split('T')[0];

  execTransaction(db, () => {
    db.prepare('UPDATE time_off_requests SET sort_order = sort_order + 1').run();
    db.prepare(
      `INSERT INTO time_off_requests (
         id,
         sort_order,
         leave_type,
         title,
         dates,
         duration,
         business_days,
         status,
         approver,
         submission_date,
         notes
       ) VALUES (?, 0, ?, ?, ?, ?, ?, 'Pending', ?, ?, ?)`,
    ).run(
      requestId,
      input.type,
      `${input.type} Request`,
      datesLabel,
      durationLabel,
      businessDays,
      'David Chen',
      submissionDate,
      input.notes?.trim() || null,
    );

    db.prepare(
      `INSERT INTO app_session (id, is_authenticated, last_submitted_request_id)
       VALUES (1, COALESCE((SELECT is_authenticated FROM app_session WHERE id = 1), 0), ?)
       ON CONFLICT(id) DO UPDATE SET last_submitted_request_id = excluded.last_submitted_request_id`,
    ).run(requestId);

    insertNotificationAtTop(db, {
      id: notificationId,
      type: 'update',
      title: 'Time Off Submitted',
      message: `${input.type} Request is pending manager review.`,
      time: NOW_LABEL,
      unread: true,
      action: {
        label: 'View Requests',
        type: 'view',
        targetScreen: 'time-off',
      },
    });
  });

  return hydrateNormalizedState(db);
}

export async function updateSessionAuth(isAuthenticated: boolean): Promise<PersistedState> {
  const db = await ensureDatabase();
  db.prepare(
    `INSERT INTO app_session (id, is_authenticated, last_submitted_request_id)
     VALUES (
       1,
       ?,
       COALESCE((SELECT last_submitted_request_id FROM app_session WHERE id = 1), NULL)
     )
     ON CONFLICT(id) DO UPDATE SET is_authenticated = excluded.is_authenticated`,
  ).run(isAuthenticated ? 1 : 0);

  return hydrateNormalizedState(db);
}

export async function updateUserProfile(input: UpdateUserProfileInput): Promise<PersistedState> {
  const db = await ensureDatabase();
  const name = input.name.trim();
  const phone = input.phone.trim();

  if (!name || !phone) {
    throw new Error('name and phone are required.');
  }

  const existing = db.prepare(
    'SELECT employee_id, email, photo_url FROM user_profile WHERE id = 1',
  ).get() as { employee_id: string; email: string; photo_url: string } | undefined;

  if (!existing) {
    throw new Error('User profile not initialized.');
  }

  db.prepare(
    `INSERT INTO user_profile (id, name, employee_id, email, phone, photo_url)
     VALUES (1, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name = excluded.name, phone = excluded.phone`,
  ).run(name, existing.employee_id, existing.email, phone, existing.photo_url);

  return hydrateNormalizedState(db);
}

export async function updateAppSettings(input: UpdateSettingsInput): Promise<PersistedState> {
  const db = await ensureDatabase();
  const current = db.prepare(
    'SELECT notifications_enabled, dark_mode FROM app_settings WHERE id = 1',
  ).get() as { notifications_enabled: number; dark_mode: number } | undefined;

  if (!current) {
    throw new Error('App settings not initialized.');
  }

  const notificationsEnabled =
    typeof input.notificationsEnabled === 'boolean' ? input.notificationsEnabled : current.notifications_enabled === 1;
  const darkMode = typeof input.darkMode === 'boolean' ? input.darkMode : current.dark_mode === 1;

  db.prepare(
    `INSERT INTO app_settings (id, notifications_enabled, dark_mode)
     VALUES (1, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       notifications_enabled = excluded.notifications_enabled,
       dark_mode = excluded.dark_mode`,
  ).run(notificationsEnabled ? 1 : 0, darkMode ? 1 : 0);

  return hydrateNormalizedState(db);
}

export async function createShiftSwapDraft(): Promise<PersistedState> {
  const db = await ensureDatabase();
  const notificationId = `notification-${Date.now()}`;

  execTransaction(db, () => {
    insertNotificationAtTop(db, {
      id: notificationId,
      type: 'update',
      title: 'Shift Swap Drafted',
      message: 'A shift swap request draft is ready for manager review.',
      time: NOW_LABEL,
      unread: true,
      action: {
        label: 'View Schedule',
        type: 'open',
        targetScreen: 'schedule',
      },
    });
  });

  return hydrateNormalizedState(db);
}

export async function setNotificationUnread(notificationId: string, unread: boolean): Promise<PersistedState> {
  const db = await ensureDatabase();
  const result = db.prepare('UPDATE notifications SET unread = ? WHERE id = ?').run(unread ? 1 : 0, notificationId);
  if (result.changes === 0) {
    throw new Error('Notification not found.');
  }

  return hydrateNormalizedState(db);
}

export async function applyClockEvent(eventType: ClockEventType): Promise<PersistedState> {
  const db = await ensureDatabase();
  const now = new Date();
  const nowIso = now.toISOString();
  const nowMs = now.getTime();

  execTransaction(db, () => {
    const clock = db.prepare(
      `SELECT
         is_clocked_in,
         last_clock_in_at,
         last_resumed_at,
         accumulated_work_seconds,
         is_break_active,
         break_started_at,
         accumulated_break_seconds
       FROM clock_state
       WHERE id = 1`,
    ).get() as
      | {
          is_clocked_in: number;
          last_clock_in_at: string | null;
          last_resumed_at: string | null;
          accumulated_work_seconds: number;
          is_break_active: number;
          break_started_at: string | null;
          accumulated_break_seconds: number;
        }
      | undefined;

    if (!clock) {
      throw new Error('Clock state not initialized.');
    }

    if (eventType === 'clock-in') {
      db.prepare(
        `UPDATE clock_state SET
           is_clocked_in = 1,
           last_clock_in_at = ?,
           last_resumed_at = ?,
           accumulated_work_seconds = 0,
           is_break_active = 0,
           break_started_at = NULL,
           accumulated_break_seconds = 0
         WHERE id = 1`,
      ).run(nowIso, nowIso);
      return;
    }

    if (clock.is_clocked_in !== 1) {
      throw new Error('Cannot apply this event while clocked out.');
    }

    if (eventType === 'break-start') {
      if (clock.is_break_active === 1) {
        throw new Error('Break is already active.');
      }

      const addedWork = getElapsedSeconds(clock.last_resumed_at, nowMs);
      db.prepare(
        `UPDATE clock_state SET
           is_break_active = 1,
           break_started_at = ?,
           last_resumed_at = NULL,
           accumulated_work_seconds = accumulated_work_seconds + ?
         WHERE id = 1`,
      ).run(nowIso, addedWork);
      return;
    }

    if (eventType === 'break-stop') {
      if (clock.is_break_active !== 1) {
        throw new Error('No active break to stop.');
      }

      const addedBreak = Math.min(getElapsedSeconds(clock.break_started_at, nowMs), BREAK_LIMIT_SECONDS);
      db.prepare(
        `UPDATE clock_state SET
           is_break_active = 0,
           break_started_at = NULL,
           last_resumed_at = ?,
           accumulated_break_seconds = accumulated_break_seconds + ?
         WHERE id = 1`,
      ).run(nowIso, addedBreak);
      return;
    }

    if (eventType === 'clock-out') {
      const addedWork = clock.is_break_active === 1 ? 0 : getElapsedSeconds(clock.last_resumed_at, nowMs);
      const addedBreak = clock.is_break_active === 1
        ? Math.min(getElapsedSeconds(clock.break_started_at, nowMs), BREAK_LIMIT_SECONDS)
        : 0;

      const totalWorkSeconds = clock.accumulated_work_seconds + addedWork;
      const totalBreakSeconds = clock.accumulated_break_seconds + addedBreak;
      const start = clock.last_clock_in_at ? new Date(clock.last_clock_in_at) : now;
      const { date, day } = formatShiftDate(start);

      const upcoming = db.prepare(
        `SELECT location, team_leader FROM shifts WHERE bucket = 'upcoming' ORDER BY sort_order ASC LIMIT 1`,
      ).get() as { location: string; team_leader: string | null } | undefined;

      insertHistoryShiftAtTop(db, {
        id: `shift-${Date.now()}`,
        date,
        day,
        location: upcoming?.location ?? 'Main Office - North Wing',
        status: 'Completed',
        startTime: formatClockTime(start),
        endTime: formatClockTime(now),
        break: formatBreakDuration(totalBreakSeconds),
        total: formatShiftTotal(totalWorkSeconds),
        teamLeader: upcoming?.team_leader ?? undefined,
      });

      db.prepare(
        `UPDATE clock_state SET
           is_clocked_in = 0,
           last_clock_in_at = NULL,
           last_resumed_at = NULL,
           accumulated_work_seconds = 0,
           is_break_active = 0,
           break_started_at = NULL,
           accumulated_break_seconds = 0
         WHERE id = 1`,
      ).run();
      return;
    }

    throw new Error('Unknown clock event type.');
  });

  return hydrateNormalizedState(db);
}
