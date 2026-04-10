import express from 'express';
import { applyClockEvent, createShiftSwapDraft, createTimeOffRequest, resetAppState, readAppState, setNotificationUnread, updateAppSettings, updateSessionAuth, updateUserProfile } from './stateStore';
import { LeaveType } from '../src/types';

export function createApp() {
  const app = express();

  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_request, response) => {
    response.json({
      ok: true,
      service: 'stratos-workforce-api',
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/api/state', async (_request, response, next) => {
    try {
      const state = await readAppState();
      response.json(state);
    } catch (error) {
      next(error);
    }
  });

  app.put('/api/state', async (_request, response, next) => {
    try {
      response.status(410).json({
        error: 'PUT /api/state has been deprecated. Use targeted mutation endpoints instead.',
      });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/state/reset', async (_request, response, next) => {
    try {
      const state = await resetAppState();
      response.json(state);
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/time-off-requests', async (request, response, next) => {
    try {
      const { type, startDate, endDate, notes } = request.body as {
        type?: LeaveType;
        startDate?: string;
        endDate?: string;
        notes?: string;
      };

      if (!type || !startDate || !endDate) {
        response.status(400).json({ error: 'type, startDate, and endDate are required.' });
        return;
      }

      const allowedTypes: LeaveType[] = ['Vacation', 'Sick', 'Personal', 'Bereavement'];
      if (!allowedTypes.includes(type)) {
        response.status(400).json({ error: 'Invalid leave type.' });
        return;
      }

      const state = await createTimeOffRequest({ type, startDate, endDate, notes });
      response.status(201).json(state);
    } catch (error) {
      next(error);
    }
  });

  app.patch('/api/notifications/:id', async (request, response, next) => {
    try {
      const { id } = request.params;
      const { unread } = request.body as { unread?: boolean };

      if (typeof unread !== 'boolean') {
        response.status(400).json({ error: 'unread must be a boolean.' });
        return;
      }

      const state = await setNotificationUnread(id, unread);
      response.json(state);
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/clock-events', async (request, response, next) => {
    try {
      const { type } = request.body as { type?: 'clock-in' | 'break-start' | 'break-stop' | 'clock-out' };
      const allowedTypes = ['clock-in', 'break-start', 'break-stop', 'clock-out'];

      if (!type || !allowedTypes.includes(type)) {
        response.status(400).json({ error: `type must be one of: ${allowedTypes.join(', ')}` });
        return;
      }

      const state = await applyClockEvent(type);
      response.json(state);
    } catch (error) {
      next(error);
    }
  });

  app.patch('/api/session', async (request, response, next) => {
    try {
      const { isAuthenticated } = request.body as { isAuthenticated?: boolean };

      if (typeof isAuthenticated !== 'boolean') {
        response.status(400).json({ error: 'isAuthenticated must be a boolean.' });
        return;
      }

      const state = await updateSessionAuth(isAuthenticated);
      response.json(state);
    } catch (error) {
      next(error);
    }
  });

  app.patch('/api/profile', async (request, response, next) => {
    try {
      const { name, phone } = request.body as { name?: string; phone?: string };

      if (typeof name !== 'string' || typeof phone !== 'string') {
        response.status(400).json({ error: 'name and phone must be strings.' });
        return;
      }

      const state = await updateUserProfile({ name, phone });
      response.json(state);
    } catch (error) {
      next(error);
    }
  });

  app.patch('/api/settings', async (request, response, next) => {
    try {
      const { notificationsEnabled, darkMode } = request.body as {
        notificationsEnabled?: boolean;
        darkMode?: boolean;
      };

      if (typeof notificationsEnabled !== 'boolean' && typeof darkMode !== 'boolean') {
        response.status(400).json({ error: 'Provide notificationsEnabled and/or darkMode as booleans.' });
        return;
      }

      const state = await updateAppSettings({ notificationsEnabled, darkMode });
      response.json(state);
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/shift-swaps', async (_request, response, next) => {
    try {
      const state = await createShiftSwapDraft();
      response.status(201).json(state);
    } catch (error) {
      next(error);
    }
  });

  app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    const message = error instanceof Error ? error.message : 'Unexpected server error';
    const isClientError =
      message.startsWith('Cannot ') ||
      message.startsWith('Invalid ') ||
      message.startsWith('Insufficient ') ||
      message.endsWith('not found.') ||
      message.includes('required');
    response.status(isClientError ? 400 : 500).json({ error: message });
  });

  return app;
}
