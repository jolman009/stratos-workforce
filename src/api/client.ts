import { AppSettings, LeaveType, PersistedState } from '../types';

const API_STATE_ENDPOINT = '/api/state';
const API_SESSION_ENDPOINT = '/api/session';
const API_PROFILE_ENDPOINT = '/api/profile';
const API_SETTINGS_ENDPOINT = '/api/settings';
const API_NOTIFICATION_ENDPOINT = '/api/notifications';
const API_CLOCK_EVENTS_ENDPOINT = '/api/clock-events';
const API_TIME_OFF_REQUESTS_ENDPOINT = '/api/time-off-requests';
const API_SHIFT_SWAPS_ENDPOINT = '/api/shift-swaps';

async function requestPersistedState(endpoint: string, init?: RequestInit): Promise<PersistedState> {
  const response = await fetch(endpoint, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) {
        message = body.error;
      }
    } catch {
      // Ignore JSON parse failures and keep the default message.
    }
    throw new Error(message);
  }

  return (await response.json()) as PersistedState;
}

export async function fetchPersistedStateFromApi(): Promise<PersistedState> {
  return requestPersistedState(API_STATE_ENDPOINT);
}

export async function patchSessionAuth(isAuthenticated: boolean): Promise<PersistedState> {
  return requestPersistedState(API_SESSION_ENDPOINT, {
    method: 'PATCH',
    body: JSON.stringify({ isAuthenticated }),
  });
}

export async function patchUserProfile(name: string, phone: string): Promise<PersistedState> {
  return requestPersistedState(API_PROFILE_ENDPOINT, {
    method: 'PATCH',
    body: JSON.stringify({ name, phone }),
  });
}

export async function patchSettings(settingsPatch: Partial<AppSettings>): Promise<PersistedState> {
  return requestPersistedState(API_SETTINGS_ENDPOINT, {
    method: 'PATCH',
    body: JSON.stringify(settingsPatch),
  });
}

export async function patchNotificationUnread(notificationId: string, unread: boolean): Promise<PersistedState> {
  return requestPersistedState(`${API_NOTIFICATION_ENDPOINT}/${notificationId}`, {
    method: 'PATCH',
    body: JSON.stringify({ unread }),
  });
}

export async function postClockEvent(type: 'clock-in' | 'break-start' | 'break-stop' | 'clock-out'): Promise<PersistedState> {
  return requestPersistedState(API_CLOCK_EVENTS_ENDPOINT, {
    method: 'POST',
    body: JSON.stringify({ type }),
  });
}

export async function postTimeOffRequest(type: LeaveType, startDate: string, endDate: string, notes: string): Promise<PersistedState> {
  return requestPersistedState(API_TIME_OFF_REQUESTS_ENDPOINT, {
    method: 'POST',
    body: JSON.stringify({ type, startDate, endDate, notes }),
  });
}

export async function postShiftSwapDraft(): Promise<PersistedState> {
  return requestPersistedState(API_SHIFT_SWAPS_ENDPOINT, {
    method: 'POST',
  });
}
