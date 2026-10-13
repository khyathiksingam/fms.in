const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { dbHelper } = require('../src/config/db');
const { JWT_SECRET, authenticate } = require('../src/middleware/auth');
const { durationSince } = require('../src/services/sessionService');

async function run() {
  const user = await dbHelper.get(`
    SELECT u.id, u.username
    FROM users u
    JOIN roles r ON r.id = u.role_id
    WHERE r.name IN ('faculty', 'hod', 'admin')
    ORDER BY CASE r.name WHEN 'faculty' THEN 1 WHEN 'hod' THEN 2 ELSE 3 END, u.id
    LIMIT 1
  `);
  assert.ok(user, 'A staff account is available for session tests');

  const token = jwt.sign(
    { id: user.id, username: user.username, role: 'faculty' },
    JWT_SECRET,
    { expiresIn: -10, jwtid: `expired-test-${Date.now()}` }
  );
  const expiresAt = '2000-01-01T00:00:00.000Z';
  const created = await dbHelper.run(`
    INSERT INTO sessions (user_id, token, expires_at, last_seen_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
  `, [user.id, token, expiresAt]);

  const req = {
    path: '/auth/me',
    query: {},
    headers: { authorization: `Bearer ${token}` }
  };
  const res = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };
  let nextCalled = false;
  await authenticate(req, res, () => { nextCalled = true; });

  const session = await dbHelper.get('SELECT expired_at, end_reason, duration_seconds FROM sessions WHERE id = ?', [created.lastID]);
  const expirationEvents = await dbHelper.all(
    "SELECT action, session_id, metadata FROM activity_logs WHERE session_id = ? AND action = 'Faculty Session Expired'",
    [created.lastID]
  );
  assert.equal(res.statusCode, 401, 'An expired JWT is rejected');
  assert.equal(nextCalled, false, 'An expired JWT does not reach the protected handler');
  assert.equal(session.end_reason, 'token_expired', 'The database records expiry separately from logout');
  assert.ok(session.expired_at, 'The session has a recorded expiry');
  assert.ok(session.duration_seconds >= 0, 'Observed session duration is nonnegative');
  assert.equal(expirationEvents.length, 1, 'Expiry tracking writes one server-side activity event');
  assert.equal(expirationEvents[0].action, 'Faculty Session Expired');
  assert.equal(expirationEvents[0].session_id, created.lastID);
  assert.equal(JSON.parse(expirationEvents[0].metadata).end_reason, 'token_expired');
  assert.equal(durationSince('2026-01-01T00:00:00.000Z', '2026-01-01T00:01:00.000Z'), 60,
    'Session duration is calculated from the recorded start and end times');

  await authenticate(req, res, () => { nextCalled = true; });
  const eventsAfterRepeatedRequest = await dbHelper.all(
    "SELECT id FROM activity_logs WHERE session_id = ? AND action = 'Faculty Session Expired'",
    [created.lastID]
  );
  assert.equal(eventsAfterRepeatedRequest.length, 1, 'Repeated expired-token requests do not duplicate expiry events');

  console.log('Expired-session timing, duration, and exactly-once tracking verified.');
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
