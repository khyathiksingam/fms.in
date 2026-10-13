const { dbHelper } = require('../config/db');

function durationSince(start, end) {
  const parseUtc = value => {
    const text = String(value || '');
    return Date.parse(/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(text) ? text : `${text.replace(' ', 'T')}Z`);
  };
  const startTime = parseUtc(start);
  const endTime = parseUtc(end);
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) return null;
  return Math.max(0, Math.floor((endTime - startTime) / 1000));
}

async function expireSession(session) {
  const duration = durationSince(session.created_at, session.last_seen_at || session.created_at);
  const result = await dbHelper.run(`
    UPDATE sessions
    SET expired_at = expires_at, end_reason = 'token_expired', duration_seconds = ?
    WHERE id = ? AND ended_at IS NULL AND expired_at IS NULL
      AND datetime(expires_at) <= CURRENT_TIMESTAMP
  `, [duration, session.id]);
  if (!result.changes) return false;

  const user = await dbHelper.get(`
    SELECT u.id, u.department_id, r.name AS role_name
    FROM users u JOIN roles r ON r.id = u.role_id
    WHERE u.id = ?
  `, [session.user_id]);
  if (user && ['faculty', 'hod', 'admin'].includes(user.role_name)) {
    await dbHelper.run(`
      INSERT INTO activity_logs (user_id, action, department_id, session_id, metadata, created_at)
      VALUES (?, 'Faculty Session Expired', ?, ?, ?, ?)
    `, [
      user.id,
      user.department_id,
      session.id,
      JSON.stringify({
        end_reason: 'token_expired',
        last_seen_at: session.last_seen_at || session.created_at,
        session_duration_seconds: duration
      }),
      session.expires_at
    ]);
  }
  return true;
}

async function expireElapsedSessions() {
  const sessions = await dbHelper.all(`
    SELECT id, user_id, expires_at, created_at, last_seen_at
    FROM sessions
    WHERE ended_at IS NULL AND expired_at IS NULL
      AND datetime(expires_at) <= CURRENT_TIMESTAMP
  `);
  for (const session of sessions) {
    await expireSession(session);
  }
}

async function expireSessionToken(token) {
  const session = await dbHelper.get(`
    SELECT id, user_id, expires_at, created_at, last_seen_at
    FROM sessions
    WHERE token = ? AND ended_at IS NULL AND expired_at IS NULL
  `, [token]);
  if (session) await expireSession(session);
}

module.exports = {
  durationSince,
  expireElapsedSessions,
  expireSessionToken
};
