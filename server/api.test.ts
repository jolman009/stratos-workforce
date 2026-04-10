import assert from 'node:assert/strict';
import http from 'node:http';
import { AddressInfo } from 'node:net';
import { createApp } from './app';

async function main() {
  const app = createApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const request = async (path: string, init?: RequestInit) => {
    const response = await fetch(`${baseUrl}${path}`, init);
    const body = await response.json();
    return { response, body };
  };

  try {
    await request('/api/state/reset', { method: 'POST' });

    let result = await request('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Jordan Miles', phone: '+1 (555) 111-2222' }),
    });
    assert.equal(result.response.status, 200);
    assert.equal(result.body.user.name, 'Jordan Miles');
    assert.equal(result.body.user.phone, '+1 (555) 111-2222');

    result = await request('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ darkMode: true, notificationsEnabled: false }),
    });
    assert.equal(result.response.status, 200);
    assert.equal(result.body.settings.darkMode, true);
    assert.equal(result.body.settings.notificationsEnabled, false);

    result = await request('/api/session', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isAuthenticated: true }),
    });
    assert.equal(result.response.status, 200);
    assert.equal(result.body.isAuthenticated, true);

    result = await request('/api/notifications/1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unread: false }),
    });
    assert.equal(result.response.status, 200);
    assert.equal(result.body.notifications[0].unread, false);

    result = await request('/api/clock-events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'clock-in' }),
    });
    assert.equal(result.response.status, 200);
    assert.equal(result.body.clockState.isClockedIn, true);

    result = await request('/api/clock-events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'break-start' }),
    });
    assert.equal(result.response.status, 200);
    assert.equal(result.body.clockState.isBreakActive, true);

    result = await request('/api/clock-events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'break-stop' }),
    });
    assert.equal(result.response.status, 200);
    assert.equal(result.body.clockState.isBreakActive, false);

    result = await request('/api/clock-events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'clock-out' }),
    });
    assert.equal(result.response.status, 200);
    assert.equal(result.body.clockState.isClockedIn, false);
    assert.equal(result.body.shifts[0].status, 'Completed');

    result = await request('/api/time-off-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'Personal', startDate: '2026-04-13', endDate: '2026-04-14', notes: 'Family appointment' }),
    });
    assert.equal(result.response.status, 201);
    assert.equal(result.body.timeOffRequests[0].type, 'Personal');
    assert.equal(result.body.timeOffRequests[0].duration, '2 Days');
    assert.equal(result.body.notifications[0].title, 'Time Off Submitted');

    result = await request('/api/shift-swaps', { method: 'POST' });
    assert.equal(result.response.status, 201);
    assert.equal(result.body.notifications[0].title, 'Shift Swap Drafted');

    await request('/api/state/reset', { method: 'POST' });
    console.log('API tests passed');
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
