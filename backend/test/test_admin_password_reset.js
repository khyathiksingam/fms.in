const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const testDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ffms-admin-reset-'));
process.env.FFMS_DATA_DIR = testDataDir;
process.env.NODE_ENV = 'test';

const { initDB, dbHelper } = require('../src/config/db');
const { resetExistingAdminPassword, DB_FILE: RESET_DB_FILE } = require('../scripts/resetAdminPassword');
const { DB_FILE: LOGIN_DB_FILE } = require('../src/config/db');
const authController = require('../src/controllers/authController');

function makeResponse() {
  return {
    statusCode: 200,
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
}

async function run() {
  try {
    assert.equal(RESET_DB_FILE, LOGIN_DB_FILE, 'Reset utility and login controller share the same resolved database file.');
    await initDB();
    await dbHelper.run("INSERT INTO roles (id, name) VALUES (1, 'admin'), (3, 'faculty')");
    const oldHash = await bcrypt.hash('Old-test-admin-password-2026!', 10);
    const admin = await dbHelper.run(`
      INSERT INTO users (full_name, username, password_hash, email, role_id, status)
      VALUES ('Test Administrator', 'administrator', ?, 'admin-reset@example.test', 1, 'active')
    `, [oldHash]);
    const faculty = await dbHelper.run(`
      INSERT INTO users (full_name, username, password_hash, email, role_id, status)
      VALUES ('Test Faculty', 'faculty-reset-test', ?, 'faculty-reset@example.test', 3, 'active')
    `, [oldHash]);
    const activeAdminSession = await dbHelper.run(`
      INSERT INTO sessions (user_id, token, expires_at, last_seen_at)
      VALUES (?, 'test-admin-session', '2099-01-01T00:00:00.000Z', CURRENT_TIMESTAMP)
    `, [admin.lastID]);
    const activeFacultySession = await dbHelper.run(`
      INSERT INTO sessions (user_id, token, expires_at, last_seen_at)
      VALUES (?, 'test-faculty-session', '2099-01-01T00:00:00.000Z', CURRENT_TIMESTAMP)
    `, [faculty.lastID]);

    const reset = await resetExistingAdminPassword('administrator', 'New-test-admin-password-2026!');
    const adminAfter = await dbHelper.get('SELECT password_hash, status FROM users WHERE id = ?', [admin.lastID]);
    const activeAdminSessionAfter = await dbHelper.get('SELECT ended_at, end_reason, duration_seconds FROM sessions WHERE id = ?', [activeAdminSession.lastID]);
    const facultySessionAfter = await dbHelper.get('SELECT ended_at FROM sessions WHERE id = ?', [activeFacultySession.lastID]);

    assert.equal(await bcrypt.compare('New-test-admin-password-2026!', adminAfter.password_hash), true);
    assert.equal(await bcrypt.compare('Old-test-admin-password-2026!', adminAfter.password_hash), false);
    assert.equal(adminAfter.status, 'active', 'The reset does not change account status.');
    assert.equal(activeAdminSessionAfter.end_reason, 'password_reset');
    assert.ok(activeAdminSessionAfter.ended_at);
    assert.ok(activeAdminSessionAfter.duration_seconds >= 0);
    assert.equal(facultySessionAfter.ended_at, null, 'Other users’ sessions remain unchanged.');
    assert.equal(reset.revokedSessions, 1);

    const loginResponse = makeResponse();
    await authController.login({
      path: '/auth/login',
      body: { username: 'administrator', password: 'New-test-admin-password-2026!' },
      ip: '127.0.0.1',
      headers: { 'user-agent': 'admin-reset-regression-test' }
    }, loginResponse);
    assert.equal(loginResponse.statusCode, 200, 'Login succeeds immediately after resetting the same database account.');
    assert.equal(loginResponse.body.user.username, 'administrator');
    assert.equal(loginResponse.body.user.role_name, 'admin');
    assert.ok(loginResponse.body.token, 'Successful login returns a session token.');
    assert.equal(await bcrypt.compare('New-test-admin-password-2026!', adminAfter.password_hash), true,
      'The login-compatible bcrypt verifier accepts the new hash.');

    let diagnosticLine = '';
    const originalInfo = console.info;
    process.env.AUTH_DIAGNOSTICS = 'true';
    console.info = message => { diagnosticLine = message; };
    try {
      const failedLoginResponse = makeResponse();
      await authController.login({
        path: '/auth/login',
        body: { username: 'administrator', password: 'Incorrect-test-password-2026!' },
        ip: '127.0.0.1',
        headers: { 'user-agent': 'admin-reset-diagnostic-test' }
      }, failedLoginResponse);
      assert.equal(failedLoginResponse.statusCode, 401);
    } finally {
      console.info = originalInfo;
      delete process.env.AUTH_DIAGNOSTICS;
    }
    const diagnostic = JSON.parse(diagnosticLine);
    assert.equal(diagnostic.database_file, LOGIN_DB_FILE);
    assert.equal(diagnostic.account_exists, true);
    assert.equal(diagnostic.administrator_exists, true);
    assert.equal(diagnostic.failure_category, 'password_mismatch');
    assert.equal(diagnosticLine.includes('"administrator"'), false, 'Diagnostics do not log the username.');
    assert.equal(diagnosticLine.includes('Incorrect-test-password-2026!'), false, 'Diagnostics do not log the password.');
    assert.equal(diagnosticLine.includes(adminAfter.password_hash), false, 'Diagnostics do not log password hashes.');

    const secondPassword = 'Restart-test-admin-password-2026!';
    const resetInSeparateProcess = `
      const { resetExistingAdminPassword } = require('./backend/scripts/resetAdminPassword');
      resetExistingAdminPassword('administrator', process.env.FFMS_TEST_ADMIN_PASSWORD)
        .then(() => process.stdout.write('reset-complete'))
        .catch(error => { console.error(error.message); process.exit(1); });
    `;
    execFileSync(process.execPath, ['-e', resetInSeparateProcess], {
      cwd: path.resolve(__dirname, '../..'),
      env: { ...process.env, FFMS_TEST_ADMIN_PASSWORD: secondPassword },
      stdio: ['ignore', 'ignore', 'pipe']
    });

    const staleProcessResponse = makeResponse();
    await authController.login({
      path: '/auth/login',
      body: { username: 'administrator', password: secondPassword },
      ip: '127.0.0.1',
      headers: { 'user-agent': 'admin-reset-stale-process-test' }
    }, staleProcessResponse);
    assert.equal(staleProcessResponse.statusCode, 401,
      'A running process retains its previously loaded sql.js database snapshot after an external reset.');

    const loginAfterBackendRestart = `
      const authController = require('./backend/src/controllers/authController');
      const response = {
        statusCode: 200,
        status(code) { this.statusCode = code; return this; },
        json() {}
      };
      authController.login({
        path: '/auth/login',
        body: { username: 'administrator', password: process.env.FFMS_TEST_ADMIN_PASSWORD },
        ip: '127.0.0.1',
        headers: { 'user-agent': 'admin-reset-restart-test' }
      }, response).then(() => process.stdout.write(String(response.statusCode)))
        .catch(error => { console.error(error.message); process.exit(1); });
    `;
    const restartedStatus = execFileSync(process.execPath, ['-e', loginAfterBackendRestart], {
      cwd: path.resolve(__dirname, '../..'),
      env: { ...process.env, FFMS_TEST_ADMIN_PASSWORD: secondPassword },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    });
    assert.equal(restartedStatus.trim().slice(-3), '200',
      'A restarted process reads the reset hash from the same persisted database file and accepts the password.');

    await assert.rejects(
      resetExistingAdminPassword('missing-admin', 'Another-test-admin-password-2026!'),
      /No existing administrator account matches/
    );
    await assert.rejects(
      resetExistingAdminPassword('faculty-reset-test', 'Another-test-admin-password-2026!'),
      /No existing administrator account matches/
    );
    await assert.rejects(
      resetExistingAdminPassword('administrator', 'short'),
      /at least 12 characters/
    );
    const adminAfterRejectedResets = await dbHelper.get('SELECT password_hash FROM users WHERE id = ?', [admin.lastID]);
    assert.equal(adminAfterRejectedResets.password_hash, adminAfter.password_hash);
    console.log('Administrator reset updates only an existing admin, enforces password verification, and revokes only that admin’s sessions.');
  } finally {
    fs.rmSync(testDataDir, { recursive: true, force: true });
  }
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
