import 'dotenv/config';
import express from 'express';
import { applyClockEvent, createTimeOffRequest, resetAppState, readAppState, setNotificationUnread, writeAppState } from './stateStore';
import { LeaveType, PersistedState } from '../src/types';

const app = express();
const port = Number(process.env.PORT ?? 3001);

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

app.put('/api/state', async (request, response, next) => {
  try {
    const state = await writeAppState(request.body as PersistedState);
    response.json(state);
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

app.listen(port, () => {
  console.log(`Stratos Workforce API listening on http://localhost:${port}`);
});
