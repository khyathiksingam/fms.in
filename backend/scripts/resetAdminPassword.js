const fs = require('fs');
const path = require('path');
const readline = require('readline');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const { initDB, dbHelper, DB_FILE } = require('../src/config/db');

function quoteSql(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

async function resetExistingAdminPassword(username, password) {
  const cleanUsername = String(username || '').trim();
  if (!cleanUsername) throw new Error('An existing administrator username is required.');
  if (typeof password !== 'string' || password.length < 12) {
    throw new Error('Choose a password with at least 12 characters.');
  }
  if (Buffer.byteLength(password, 'utf8') > 72) {
    throw new Error('Choose a password no longer than 72 UTF-8 bytes.');
  }

  await initDB();
  const admin = await dbHelper.get(`
    SELECT u.id
    FROM users u
    JOIN roles r ON r.id = u.role_id
    WHERE LOWER(TRIM(u.username)) = LOWER(?)
      AND r.name = 'admin'
  `, [cleanUsername]);
  if (!admin) {
    throw new Error('No existing administrator account matches that username; no changes were made.');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const resetAt = new Date().toISOString();
  const userId = Number(admin.id);
  if (!Number.isSafeInteger(userId) || userId <= 0) {
    throw new Error('The administrator account has an invalid database identifier; no changes were made.');
  }

  const sql = `
    BEGIN IMMEDIATE;
    UPDATE users
    SET password_hash = ${quoteSql(passwordHash)},
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ${userId}
      AND role_id = (SELECT id FROM roles WHERE name = 'admin');
    UPDATE sessions
    SET ended_at = ${quoteSql(resetAt)},
        end_reason = 'password_reset',
        duration_seconds = MAX(0, CAST((julianday(${quoteSql(resetAt)}) - julianday(created_at)) * 86400 AS INTEGER))
    WHERE user_id = ${userId}
      AND ended_at IS NULL
      AND expired_at IS NULL;
    COMMIT;
  `;

  try {
    await dbHelper.exec(sql);
  } catch (error) {
    try {
      await dbHelper.exec('ROLLBACK;');
    } catch {
      // Preserve the original transaction failure.
    }
    throw new Error('The administrator password reset could not be committed.');
  }

  const revoked = await dbHelper.get(`
    SELECT COUNT(*) AS count
    FROM sessions
    WHERE user_id = ? AND ended_at = ? AND end_reason = 'password_reset'
  `, [userId, resetAt]);
  return { revokedSessions: revoked?.count || 0 };
}

function promptLine(message, { secret = false } = {}) {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') {
    return Promise.reject(new Error('Run this command in an interactive terminal so the password can be entered without echo.'));
  }

  readline.emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdout.write(message);

  return new Promise((resolve, reject) => {
    let value = '';
    const finish = (error, result) => {
      process.stdin.off('keypress', onKeypress);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write('\n');
      if (error) reject(error);
      else resolve(result);
    };
    const onKeypress = (character, key = {}) => {
      if (key.ctrl && key.name === 'c') {
        finish(new Error('Password reset cancelled.'));
      } else if (key.name === 'return' || key.name === 'enter') {
        finish(null, value);
      } else if (key.name === 'backspace') {
        value = value.slice(0, -1);
        if (!secret) process.stdout.write('\b \b');
      } else if (character && !key.ctrl && !key.meta) {
        value += character;
        if (!secret) process.stdout.write(character);
      }
    };
    process.stdin.on('keypress', onKeypress);
  });
}

async function main() {
  if (!fs.existsSync(DB_FILE)) {
    throw new Error(`Database not found at ${DB_FILE}; no database was created. Verify FFMS_DATA_DIR points to the existing persistent database.`);
  }

  await initDB();
  console.log(`Database file: ${DB_FILE}`);
  const admins = await dbHelper.all(`
    SELECT u.username, u.status
    FROM users u
    JOIN roles r ON r.id = u.role_id
    WHERE r.name = 'admin'
    ORDER BY u.id
  `);
  if (!admins.length) {
    throw new Error('No administrator accounts exist in the database; no account or database was created.');
  }
  console.log('Existing administrator accounts (username and status only):');
  admins.forEach(admin => console.log(`- ${admin.username} (${admin.status})`));

  const username = await promptLine('Existing administrator username: ');
  const password = await promptLine('New password (input hidden): ', { secret: true });
  const confirmation = await promptLine('Confirm new password (input hidden): ', { secret: true });
  if (password !== confirmation) throw new Error('Passwords did not match; no changes were made.');

  const result = await resetExistingAdminPassword(username, password);
  console.log(`Password updated for the existing administrator account. Revoked ${result.revokedSessions} active session(s). Account status and all other records were left unchanged.`);
  console.log('Restart the Express service immediately so its in-memory SQLite snapshot reloads this database file.');
}

if (require.main === module) {
  main().catch(error => {
    console.error(`Administrator password reset failed: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { resetExistingAdminPassword, DB_FILE };
