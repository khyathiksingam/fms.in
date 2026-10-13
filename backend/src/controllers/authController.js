const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { promisify } = require('util');
const { dbHelper } = require('../config/db');
const { JWT_SECRET } = require('../middleware/auth');
const emailService = require('../services/emailService');
const { durationSince } = require('../services/sessionService');

const scrypt = promisify(crypto.scrypt);
const OTP_EXPIRY_MS = 10 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;

async function hashVerificationOtp(otp) {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(otp, salt, 64);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

async function verifyOtpHash(otp, storedHash) {
  const [saltHex, hashHex] = String(storedHash || '').split(':');
  if (!saltHex || !hashHex) return false;

  const salt = Buffer.from(saltHex, 'hex');
  const expectedHash = Buffer.from(hashHex, 'hex');
  if (salt.length !== 16 || expectedHash.length !== 64) return false;

  const actualHash = await scrypt(otp, salt, expectedHash.length);
  return crypto.timingSafeEqual(actualHash, expectedHash);
}

function otpTiming() {
  const issuedAt = Date.now();
  return {
    expiresAt: new Date(issuedAt + OTP_EXPIRY_MS).toISOString(),
    resendAvailableAt: new Date(issuedAt + OTP_RESEND_COOLDOWN_MS).toISOString(),
    sentAt: new Date(issuedAt).toISOString()
  };
}

function formatDuration(totalSeconds) {
  const seconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

async function issueStudentOtp(user) {
  const otp = String(crypto.randomInt(100000, 1000000));
  const otpHash = await hashVerificationOtp(otp);
  const timing = otpTiming();

  const claimed = await dbHelper.run(`
    UPDATE users
    SET verification_otp_hash = ?,
        verification_otp_expires_at = ?,
        verification_otp_attempts = 0,
        verification_otp_last_sent_at = ?,
        verification_token_hash = NULL,
        verification_token_expires_at = NULL,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
      AND (
        verification_otp_last_sent_at IS NULL
        OR verification_otp_last_sent_at <= ?
      )
  `, [
    otpHash,
    timing.expiresAt,
    timing.sentAt,
    user.id,
    new Date(Date.parse(timing.sentAt) - OTP_RESEND_COOLDOWN_MS).toISOString()
  ]);

  if (!claimed.changes) {
    const error = new Error('A new OTP was requested recently. Please wait before trying again.');
    error.statusCode = 429;
    throw error;
  }

  try {
    const delivery = await emailService.sendStudentVerificationOtp({
      to: user.email,
      studentName: user.full_name,
      otp
    });
    return { ...timing, messageId: delivery.messageId };
  } catch (error) {
    error.otpTiming = timing;
    throw error;
  }
}

function isCollegeEmail(email) {
  return /^[a-zA-Z0-9._%+-]+@vnrvjiet\.in$/i.test(email);
}

function sanitizeUserForSession(user) {
  if (!user || typeof user !== 'object') return user;
  const {
    password_hash,
    verification_otp_hash,
    verification_token_hash,
    ...safeUser
  } = user;

  safeUser.name = safeUser.full_name || safeUser.username || 'Student';
  safeUser.rollNumber = safeUser.roll_number || null;
  safeUser.role = safeUser.role_name || safeUser.role || null;
  return safeUser;
}

async function logUserActivity(user, action, req, metadata = {}, sessionId = null) {
  if (!user || !user.id) return;
  const payload = {
    ...metadata,
    ip: req.ip,
    userAgent: req.headers['user-agent']
  };
  await dbHelper.run(
    'INSERT INTO activity_logs (user_id, action, department_id, session_id, metadata) VALUES (?, ?, ?, ?, ?)',
    [user.id, action, user.department_id || null, sessionId, JSON.stringify(payload)]
  );
}

const authController = {
  async login(req, res) {
    try {
      const requiredRole = req.path === '/auth/student-login' ? 'student' : null;
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required.' });
      }

      const identifier = username.trim();
      const accountLookup = requiredRole === 'student'
        ? `r.name = 'student'
           AND (LOWER(u.username) = LOWER(?) OR LOWER(u.email) = LOWER(?) OR LOWER(COALESCE(u.roll_number, '')) = LOWER(?))`
        : `LOWER(u.username) = LOWER(?) OR LOWER(u.email) = LOWER(?)
           OR (u.roll_number IS NOT NULL AND LOWER(u.roll_number) = LOWER(?))`;
      const lookupParams = requiredRole === 'student'
        ? [identifier, identifier, identifier]
        : [identifier, identifier, identifier];
      const user = await dbHelper.get(`
        SELECT u.*, r.name as role_name, d.name as department_name, d.code as department_code
        FROM users u
        JOIN roles r ON u.role_id = r.id
        LEFT JOIN departments d ON u.department_id = d.id
        WHERE ${accountLookup}
      `, lookupParams);

      if (!user) {
        return res.status(401).json({ error: 'Incorrect username or password.' });
      }
      if ((requiredRole && user.role_name !== requiredRole) || (!requiredRole && user.role_name === 'student')) {
        return res.status(401).json({ error: requiredRole ? 'Incorrect student username or password.' : 'Students must use the Student Login page.' });
      }

      if (user.status === 'disabled') {
        return res.status(403).json({ error: 'Your account is disabled. Please contact the college administrator.' });
      }

      const isMatch = await bcrypt.compare(password, user.password_hash);
      if (!isMatch) {
        return res.status(401).json({ error: 'Incorrect username or password.' });
      }

      // Check student email verification status
      if (user.role_name === 'student' && (!user.email_verified || user.email_verified === 0)) {
        return res.status(403).json({
          error: 'Please verify your college email before logging in.',
          unverified: true,
          email: user.email
        });
      }

      const assignedDepartments = user.role_name === 'hod'
        ? await dbHelper.all(`
          SELECT d.id, d.name, d.code
          FROM hod_departments hd
          JOIN departments d ON d.id = hd.department_id
          WHERE hd.hod_id = ? AND d.active = 1
          ORDER BY d.display_group, d.sort_order, d.name
        `, [user.id])
        : [];
      if (assignedDepartments.length) {
        const currentDepartment = assignedDepartments.find(department => department.id === user.department_id) || assignedDepartments[0];
        user.department_id = currentDepartment.id;
        user.department_name = currentDepartment.name;
        user.department_code = currentDepartment.code;
        user.assigned_departments = assignedDepartments;
      }

      // Generate JWT Token (valid for 7 days)
      const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role_name },
        JWT_SECRET,
        { expiresIn: '7d', jwtid: crypto.randomUUID() }
      );

      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const sessionStart = await dbHelper.run(
        "INSERT INTO sessions (user_id, token, expires_at, last_seen_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)",
        [user.id, token, expiresAt]
      );
      const sessionId = sessionStart.lastID;

      if (user.role_name === 'student') {
        await dbHelper.run(`
          INSERT INTO student_resource_activity (user_id, roll_number, department_id, action)
          VALUES (?, ?, ?, 'student_login')
        `, [user.id, user.roll_number, user.department_id]);
      } else {
        const isFacultyRole = ['faculty', 'hod', 'admin'].includes(user.role_name);
        await logUserActivity(
          user,
          isFacultyRole ? 'Faculty Login' : 'User Login',
          req,
          { login_type: user.role_name || 'user', session_id: sessionId },
          sessionId
        );
      }

      const userProfile = sanitizeUserForSession(user);
      res.json({
        message: 'Login successful',
        token,
        user: userProfile
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Internal server error during login.' });
    }
  },

  async studentLogin(req, res) {
    return authController.login(req, res, 'student');
  },

  async me(req, res) {
    try {
      const user = await dbHelper.get(`
        SELECT u.id, u.full_name, u.username, u.email, u.status, u.avatar_url, u.must_change_password,
               u.roll_number, u.programme, u.academic_year, u.semester,
               u.role_id, r.name as role_name,
               u.department_id, d.name as department_name, d.code as department_code,
               u.created_at
        FROM users u
        JOIN roles r ON u.role_id = r.id
        LEFT JOIN departments d ON u.department_id = d.id
        WHERE u.id = ?
      `, [req.user.id]);

      if (!user) {
        return res.status(404).json({ error: 'User not found.' });
      }

      if (user.role_name === 'hod') {
        user.assigned_departments = await dbHelper.all(`
          SELECT d.id, d.name, d.code
          FROM hod_departments hd
          JOIN departments d ON d.id = hd.department_id
          WHERE hd.hod_id = ? AND d.active = 1
          ORDER BY d.display_group, d.sort_order, d.name
        `, [req.user.id]);
      }

      res.json({ user: sanitizeUserForSession(user) });
    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({ error: 'Failed to retrieve profile.' });
    }
  },

  async updateProfile(req, res) {
    try {
      const { full_name, email, avatar_url } = req.body;
      const userId = req.user.id;

      if (!full_name || !email) {
        return res.status(400).json({ error: 'Full name and email are required.' });
      }

      // Check email collision
      const existing = await dbHelper.get(
        "SELECT id FROM users WHERE LOWER(email) = LOWER(?) AND id != ?",
        [email.trim(), userId]
      );
      if (existing) {
        return res.status(400).json({ error: 'Email is already in use by another account.' });
      }

      await dbHelper.run(
        "UPDATE users SET full_name = ?, email = ?, avatar_url = COALESCE(?, avatar_url), updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [full_name.trim(), email.trim(), avatar_url || null, userId]
      );

      await dbHelper.run(
        "INSERT INTO activity_logs (user_id, action, department_id, metadata) VALUES (?, ?, ?, ?)",
        [userId, 'Profile Updated', req.user.department_id, JSON.stringify({ full_name, email })]
      );

      res.json({ message: 'Profile updated successfully.' });
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({ error: 'Failed to update profile.' });
    }
  },

  async changePassword(req, res) {
    try {
      const { currentPassword, newPassword } = req.body;
      const userId = req.user.id;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Current password and new password are required.' });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
      }

      const user = await dbHelper.get("SELECT password_hash FROM users WHERE id = ?", [userId]);
      const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
      if (!isMatch) {
        return res.status(400).json({ error: 'Current password does not match.' });
      }

      const newHash = await bcrypt.hash(newPassword, 10);
      await dbHelper.run(
        "UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [newHash, userId]
      );

      await dbHelper.run(
        "INSERT INTO activity_logs (user_id, action, department_id, metadata) VALUES (?, ?, ?, ?)",
        [userId, 'Password Changed', req.user.department_id, JSON.stringify({})]
      );

      res.json({ message: 'Password changed successfully.' });
    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({ error: 'Failed to change password.' });
    }
  },

  async logout(req, res) {
    try {
      const endedAt = new Date();
      const sessionDuration = durationSince(req.authSession.created_at, endedAt.toISOString());
      const result = await dbHelper.run(`
        UPDATE sessions
        SET ended_at = ?, end_reason = 'logout', duration_seconds = ?
        WHERE id = ? AND ended_at IS NULL AND expired_at IS NULL
      `, [endedAt.toISOString(), sessionDuration, req.authSession.id]);
      if (!result.changes) {
        return res.status(401).json({ error: 'This session has already ended. Please log in again.' });
      }

      if (req.user.role_name === 'student') {
        await dbHelper.run(`
          INSERT INTO student_resource_activity (user_id, roll_number, department_id, action)
          VALUES (?, ?, ?, 'student_logout')
        `, [req.user.id, req.user.roll_number || null, req.user.department_id]);
      } else {
        const isFacultyRole = req.user.role_name === 'faculty' || req.user.role_name === 'hod' || req.user.role_name === 'admin';
        await logUserActivity(req.user, isFacultyRole ? 'Faculty Logout' : 'User Logout', req, {
          logout_type: req.user.role_name || 'user',
          session_id: req.authSession.id,
          login_at: req.authSession.created_at,
          logout_at: endedAt.toISOString(),
          session_duration_seconds: sessionDuration,
          session_duration: formatDuration(sessionDuration)
        }, req.authSession.id);
      }
      res.json({ message: 'Logged out successfully.' });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({ error: 'Unable to record logout.' });
    }
  },

  async heartbeat(req, res) {
    res.status(204).end();
  },

  async studentRegister(req, res) {
    try {
      const settings = await dbHelper.get("SELECT student_self_registration FROM system_settings ORDER BY id ASC LIMIT 1");
      if (!settings || Number(settings.student_self_registration) !== 1) {
        return res.status(403).json({
          error: 'Student registration is currently disabled by the administrator.'
        });
      }

      const { full_name, roll_number, email, password, department_id } = req.body;
      const confirm_password = req.body.confirm_password || req.body.confirmPassword;

      // 2. Validate input fields
      if (!full_name || !full_name.trim()) {
        return res.status(400).json({ error: 'Full name is required.' });
      }
      if (!roll_number || !roll_number.trim()) {
        return res.status(400).json({ error: 'Student roll number is required.' });
      }
      if (!email || !email.trim()) {
        return res.status(400).json({ error: 'College email is required.' });
      }
      if (!password || password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
      }
      if (password !== confirm_password) {
        return res.status(400).json({ error: 'Passwords do not match.' });
      }

      const cleanFullName = full_name.trim();
      const cleanRollNumber = roll_number.trim().toUpperCase();
      const cleanEmail = email.trim().toLowerCase();

      if (!isCollegeEmail(cleanEmail)) {
        return res.status(400).json({
          error: 'Please register using your official college email (@vnrvjiet.in).'
        });
      }

      const existingEmail = await dbHelper.get(
        "SELECT id, email_verified FROM users WHERE LOWER(email) = LOWER(?)",
        [cleanEmail]
      );
      if (existingEmail) {
        return res.status(409).json({
          error: 'This college email is already registered.',
          canResend: Number(existingEmail.email_verified) !== 1,
          email: cleanEmail
        });
      }

      const existingRoll = await dbHelper.get(
        "SELECT id FROM users WHERE LOWER(roll_number) = LOWER(?)",
        [cleanRollNumber]
      );
      if (existingRoll) {
        return res.status(409).json({ error: 'This student roll number is already registered.' });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const otp = String(crypto.randomInt(100000, 1000000));
      const otpHash = await hashVerificationOtp(otp);
      const timing = otpTiming();
      let studentRole = await dbHelper.get("SELECT id FROM roles WHERE name = 'student'");
      if (!studentRole) {
        await dbHelper.run("INSERT OR IGNORE INTO roles (id, name) VALUES (4, 'student')");
        studentRole = await dbHelper.get("SELECT id FROM roles WHERE name = 'student'");
      }

      let baseUsername = cleanRollNumber.toLowerCase();
      let username = baseUsername;
      let suffix = 1;
      while (await dbHelper.get("SELECT id FROM users WHERE LOWER(username) = LOWER(?)", [username])) {
        username = `${baseUsername}_${suffix++}`;
      }

      const deptId = department_id ? Number(department_id) : null;

      await dbHelper.run(`
        INSERT INTO users (
          full_name, username, password_hash, email, role_id, department_id,
          status, roll_number, email_verified, verification_otp_hash,
          verification_otp_expires_at, verification_otp_attempts,
          verification_otp_last_sent_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'active', ?, 0, ?, ?, 0, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `, [
        cleanFullName,
        username,
        passwordHash,
        cleanEmail,
        studentRole.id,
        deptId,
        cleanRollNumber,
        otpHash,
        timing.expiresAt,
        timing.sentAt
      ]);

      try {
        const delivery = await emailService.sendStudentVerificationOtp({
          to: cleanEmail,
          studentName: cleanFullName,
          otp
        });
        return res.status(201).json({
          message: 'OTP sent successfully.',
          email: cleanEmail,
          expiresAt: timing.expiresAt,
          resendAvailableAt: timing.resendAvailableAt,
          messageId: delivery.messageId
        });
      } catch (error) {
        return res.status(502).json({
          error: error.message,
          deliveryFailed: true,
          email: cleanEmail,
          expiresAt: timing.expiresAt,
          resendAvailableAt: timing.resendAvailableAt
        });
      }
    } catch (error) {
      console.error('Student registration failed.');
      res.status(500).json({ error: 'Failed to create student account. Please try again.' });
    }
  },

  async verifyStudentEmail(req, res) {
    try {
      const email = String(req.body?.email || '').trim().toLowerCase();
      const otp = String(req.body?.otp || '').trim();
      if (!email || !/^\d{6}$/.test(otp)) {
        return res.status(400).json({ error: 'A registered email address and 6-digit OTP are required.' });
      }

      const user = await dbHelper.get(`
        SELECT u.id, u.full_name, u.email, u.roll_number, u.email_verified,
               u.verification_otp_hash, u.verification_otp_expires_at, u.verification_otp_attempts
        FROM users u
        JOIN roles r ON u.role_id = r.id
        WHERE LOWER(u.email) = LOWER(?) AND r.name = 'student'
      `, [email]);

      if (!user) {
        return res.status(404).json({ error: 'No student account was found for that email address.' });
      }

      if (Number(user.email_verified) === 1) {
        return res.status(409).json({ error: 'This email address is already verified.' });
      }

      if (Number(user.verification_otp_attempts) >= MAX_OTP_ATTEMPTS) {
        return res.status(429).json({ error: 'Maximum verification attempts reached. Resend an OTP to try again.' });
      }

      const expiresAt = Date.parse(user.verification_otp_expires_at || '');
      if (!user.verification_otp_hash || !Number.isFinite(expiresAt) || Date.now() >= expiresAt) {
        await dbHelper.run(
          'UPDATE users SET verification_otp_hash = NULL WHERE id = ?',
          [user.id]
        );
        return res.status(400).json({
          error: 'This OTP has expired. Resend an OTP to continue.',
          expired: true
        });
      }

      const matches = await verifyOtpHash(otp, user.verification_otp_hash);
      if (!matches) {
        await dbHelper.run(`
          UPDATE users
          SET verification_otp_attempts = verification_otp_attempts + 1,
              verification_otp_hash = CASE
                WHEN verification_otp_attempts + 1 >= ? THEN NULL
                ELSE verification_otp_hash
              END
          WHERE id = ? AND email_verified = 0 AND verification_otp_hash = ?
        `, [MAX_OTP_ATTEMPTS, user.id, user.verification_otp_hash]);
        const currentAttempts = await dbHelper.get(
          'SELECT verification_otp_attempts FROM users WHERE id = ?',
          [user.id]
        );
        const attempts = Number(currentAttempts?.verification_otp_attempts || MAX_OTP_ATTEMPTS);
        return res.status(attempts >= MAX_OTP_ATTEMPTS ? 429 : 400).json({
          error: attempts >= MAX_OTP_ATTEMPTS
            ? 'Maximum verification attempts reached. Resend an OTP to try again.'
            : `Incorrect OTP. ${MAX_OTP_ATTEMPTS - attempts} attempt(s) remaining.`,
          attemptsRemaining: Math.max(0, MAX_OTP_ATTEMPTS - attempts)
        });
      }

      if (Date.now() >= expiresAt) {
        await dbHelper.run(
          'UPDATE users SET verification_otp_hash = NULL WHERE id = ? AND verification_otp_hash = ?',
          [user.id, user.verification_otp_hash]
        );
        return res.status(400).json({ error: 'This OTP has expired. Resend an OTP to continue.', expired: true });
      }

      const verified = await dbHelper.run(`
        UPDATE users
        SET email_verified = 1,
            email_verified_at = CURRENT_TIMESTAMP,
            verification_otp_hash = NULL,
            verification_otp_expires_at = NULL,
            verification_otp_attempts = 0,
            verification_otp_last_sent_at = NULL,
            verification_token_hash = NULL,
            verification_token_expires_at = NULL,
            status = 'active',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND email_verified = 0 AND verification_otp_hash = ?
      `, [user.id, user.verification_otp_hash]);

      if (!verified.changes) {
        return res.status(400).json({ error: 'This OTP is no longer valid. Request the latest OTP.' });
      }

      await dbHelper.run(`
        INSERT INTO student_resource_activity (user_id, roll_number, action)
        VALUES (?, ?, 'student_email_verified')
      `, [user.id, user.roll_number || null]);

      return res.json({ message: 'Email verified successfully. You can now log in.', email: user.email });
    } catch (error) {
      console.error('Student OTP verification failed.');
      res.status(500).json({ error: 'Failed to verify email address.' });
    }
  },

  async resendStudentVerification(req, res) {
    try {
      const { email, roll_number } = req.body;
      const identifier = String(email || roll_number || '').trim().toLowerCase();
      if (!identifier) {
        return res.status(400).json({ error: 'Please provide your registered email or roll number.' });
      }

      const user = await dbHelper.get(`
        SELECT u.id, u.full_name, u.email, u.roll_number, u.email_verified,
               u.verification_otp_last_sent_at, r.name as role_name
        FROM users u
        JOIN roles r ON u.role_id = r.id
        WHERE (LOWER(u.email) = LOWER(?) OR LOWER(COALESCE(u.roll_number, '')) = LOWER(?))
          AND r.name = 'student'
      `, [identifier, identifier]);

      if (!user) {
        return res.status(404).json({ error: 'No student account was found for that email or roll number.' });
      }

      if (user.email_verified === 1) {
        return res.status(409).json({ error: 'This account has already been verified. You can log in directly.' });
      }

      const lastSentAt = Date.parse(user.verification_otp_last_sent_at || '');
      const elapsed = Date.now() - lastSentAt;
      if (Number.isFinite(lastSentAt) && elapsed < OTP_RESEND_COOLDOWN_MS) {
        const remainingSeconds = Math.ceil((OTP_RESEND_COOLDOWN_MS - elapsed) / 1000);
        return res.status(429).json({
          error: `Please wait ${remainingSeconds} seconds before requesting another OTP.`,
          remainingSeconds
        });
      }

      const timing = await issueStudentOtp(user);
      return res.json({
        message: 'OTP sent successfully.',
        email: user.email,
        expiresAt: timing.expiresAt,
        resendAvailableAt: timing.resendAvailableAt,
        messageId: timing.messageId
      });
    } catch (error) {
      if (error.statusCode === 429) {
        return res.status(429).json({ error: error.message });
      }
      if (error.otpTiming) {
        return res.status(502).json({
          error: error.message,
          deliveryFailed: true,
          expiresAt: error.otpTiming.expiresAt,
          resendAvailableAt: error.otpTiming.resendAvailableAt
        });
      }
      console.error('Student OTP resend failed.');
      return res.status(500).json({ error: 'Failed to resend OTP. Please try again.' });
    }
  },

  async changeStudentEmail(req, res) {
    try {
      const email = String(req.body?.email || '').trim().toLowerCase();
      const rollNumber = String(req.body?.roll_number || '').trim().toUpperCase();
      const password = String(req.body?.password || '');
      const newEmail = String(req.body?.new_email || '').trim().toLowerCase();
      if (!email || !rollNumber || !password || !newEmail) {
        return res.status(400).json({ error: 'Current email, roll number, password, and new email are required.' });
      }
      if (!isCollegeEmail(newEmail)) {
        return res.status(400).json({ error: 'Please use an official college email ending in @vnrvjiet.in.' });
      }

      const user = await dbHelper.get(`
        SELECT u.id, u.full_name, u.email, u.roll_number, u.password_hash,
               u.email_verified, r.name as role_name
        FROM users u
        JOIN roles r ON u.role_id = r.id
        WHERE LOWER(u.email) = LOWER(?) AND LOWER(u.roll_number) = LOWER(?)
          AND r.name = 'student'
      `, [email, rollNumber]);

      if (!user || !(await bcrypt.compare(password, user.password_hash))) {
        return res.status(401).json({ error: 'Current email, roll number, or password is incorrect.' });
      }
      if (Number(user.email_verified) === 1) {
        return res.status(409).json({ error: 'Verified student email addresses cannot be changed here.' });
      }
      if (email === newEmail) {
        return res.status(400).json({ error: 'Enter a different email address.' });
      }

      const existingEmail = await dbHelper.get(
        'SELECT id FROM users WHERE LOWER(email) = LOWER(?) AND id != ?',
        [newEmail, user.id]
      );
      if (existingEmail) {
        return res.status(409).json({ error: 'This college email is already registered.' });
      }

      await dbHelper.run(
        'UPDATE users SET email = ?, verification_otp_hash = NULL, verification_otp_expires_at = NULL, verification_otp_attempts = 0, verification_otp_last_sent_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [newEmail, user.id]
      );
      const timing = await issueStudentOtp({ ...user, email: newEmail });
      return res.json({
        message: 'OTP sent successfully.',
        email: newEmail,
        expiresAt: timing.expiresAt,
        resendAvailableAt: timing.resendAvailableAt,
        messageId: timing.messageId
      });
    } catch (error) {
      if (error.otpTiming) {
        return res.status(502).json({
          error: error.message,
          deliveryFailed: true,
          email: String(req.body?.new_email || '').trim().toLowerCase(),
          expiresAt: error.otpTiming.expiresAt,
          resendAvailableAt: error.otpTiming.resendAvailableAt
        });
      }
      console.error('Student email change failed.');
      return res.status(500).json({ error: 'Failed to change student email. Please try again.' });
    }
  }
};

module.exports = authController;
