const jwt = require('jsonwebtoken');
const { dbHelper } = require('../config/db');
const { expireSessionToken } = require('../services/sessionService');

const JWT_SECRET = process.env.JWT_SECRET || 'ffms_secret_college_key_2026_super_secure';

/**
 * Middleware to authenticate requests via Bearer token
 */
async function authenticate(req, res, next) {
  try {
    let token = null;
    const authHeader = req.headers.authorization;
    if (/^\/public\/syllabus\/\d+\/(preview|download)$/.test(req.path) && req.query.token) {
      return res.status(400).json({ error: 'Use the Authorization header for student resource access.' });
    }
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (req.query.token) {
      // Allow token in query param for downloads/previews
      token = req.query.token;
    }

    if (!token) {
      return res.status(401).json({ error: 'Authentication required. Please log in.' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        await expireSessionToken(token);
      }
      return res.status(401).json({ error: 'Invalid or expired session. Please log in again.' });
    }

    const session = await dbHelper.get(`
      SELECT id, user_id, expires_at, created_at, last_seen_at, ended_at, expired_at,
             end_reason, duration_seconds
      FROM sessions
      WHERE token = ?
    `, [token]);
    if (!session || session.user_id !== decoded.id || session.ended_at || session.expired_at) {
      return res.status(401).json({ error: 'This session is no longer active. Please log in again.' });
    }
    if (Date.parse(session.expires_at) <= Date.now()) {
      await expireSessionToken(token);
      return res.status(401).json({ error: 'Your session expired. Please log in again.' });
    }

    // Fetch fresh user data including role and department
    const user = await dbHelper.get(`
      SELECT u.id, u.full_name, u.username, u.email, u.status, u.avatar_url,
             u.roll_number, u.programme, u.academic_year, u.semester,
             u.role_id, u.must_change_password, r.name as role_name,
             u.department_id, d.name as department_name, d.code as department_code
      FROM users u
      JOIN roles r ON u.role_id = r.id
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE u.id = ?
    `, [decoded.id]);

    if (!user) {
      return res.status(401).json({ error: 'User account not found.' });
    }

    if (user.status === 'disabled') {
      return res.status(403).json({ error: 'Your account has been disabled. Please contact the administrator.' });
    }

    if (user.role_name === 'hod') {
      let assignedDepartments = await dbHelper.all(`
        SELECT d.id, d.name, d.code
        FROM hod_departments hd
        JOIN departments d ON d.id = hd.department_id
        WHERE hd.hod_id = ? AND d.active = 1
        ORDER BY d.display_group, d.sort_order, d.name
      `, [user.id]);
      if (assignedDepartments.length === 0 && user.department_id) {
        assignedDepartments = await dbHelper.all(
          'SELECT id, name, code FROM departments WHERE id = ? AND active = 1',
          [user.department_id]
        );
      }
      const requestedDepartmentId = req.headers['x-active-department-id'];
      if (requestedDepartmentId !== undefined) {
        const selectedDepartment = assignedDepartments.find(department => String(department.id) === String(requestedDepartmentId));
        if (!selectedDepartment) {
          return res.status(403).json({ error: 'You are not assigned to the selected department.' });
        }
        user.department_id = selectedDepartment.id;
        user.department_name = selectedDepartment.name;
        user.department_code = selectedDepartment.code;
      } else {
        const defaultDepartment = assignedDepartments.find(department => department.id === user.department_id) || assignedDepartments[0];
        if (defaultDepartment) {
          user.department_id = defaultDepartment.id;
          user.department_name = defaultDepartment.name;
          user.department_code = defaultDepartment.code;
        }
      }
      user.assigned_departments = assignedDepartments;
      user.department_ids = assignedDepartments.map(department => department.id);
    }

    if (user.role_name === 'student' &&
        !(/^\/auth\/(me|logout|heartbeat)$/.test(req.path) ||
          /^\/student\/activity$/.test(req.path) ||
          /^\/public\/syllabus\/\d+\/(preview|download)$/.test(req.path))) {
      return res.status(403).json({ error: 'Student accounts cannot access Faculty Portal resources.' });
    }

    if (user.must_change_password &&
        !/^\/auth\/(me|change-password|logout|heartbeat)$/.test(req.path)) {
      return res.status(403).json({ error: 'Change your temporary password before continuing.', code: 'PASSWORD_CHANGE_REQUIRED' });
    }

    await dbHelper.run(`
      UPDATE sessions SET last_seen_at = CURRENT_TIMESTAMP
      WHERE id = ? AND ended_at IS NULL AND expired_at IS NULL
    `, [session.id]);
    req.user = user;
    req.authSession = session;
    next();
  } catch (error) {
    console.error('Auth Middleware Error:', error);
    res.status(500).json({ error: 'Authentication processing error.' });
  }
}

/**
 * Require one of the specified roles
 * @param  {...string} roles - e.g. 'admin', 'hod', 'faculty'
 */
function requireRoles(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    if (!roles.includes(req.user.role_name)) {
      return res.status(403).json({ 
        error: `Access denied. Requires one of: [${roles.join(', ')}]. Your role is ${req.user.role_name}.` 
      });
    }
    next();
  };
}

/**
 * Check if the user is authorized to access/modify a specific file
 * @param {'view' | 'download' | 'edit' | 'delete'} requiredPermission
 */
async function checkFileAccess(fileId, user, requiredPermission = 'view') {
  if (!fileId || !user) return false;

  // Admin has full access to all files
  if (user.role_name === 'admin') return true;

  const file = await dbHelper.get(`
    SELECT f.*, d.name as department_name
    FROM files f
    LEFT JOIN departments d ON f.department_id = d.id
    WHERE f.id = ?
  `, [fileId]);

  if (!file) return false;

  if (user.role_name === 'hod' && file.owner_id !== user.id &&
      !(user.department_ids || [user.department_id]).includes(file.department_id)) {
    return false;
  }

  // Owner has full control over their own file (both public and private)
  if (file.owner_id === user.id) return true;

  // If file is marked private and user is NOT owner (and NOT admin), deny access
  if (file.visibility === 'private') {
    return false;
  }

  // Public files: any authenticated faculty in the college/department has view & download access
  if (file.visibility === 'public' || !file.visibility) {
    if (requiredPermission === 'view' || requiredPermission === 'download') {
      return true;
    }
  }

  // HOD has access to files in their department
  if (user.role_name === 'hod' && (user.department_ids || [user.department_id]).includes(file.department_id)) {
    return true;
  }

  // Check explicit direct sharing with user
  const directShare = await dbHelper.get(`
    SELECT permission FROM shared_files
    WHERE file_id = ? AND shared_with_user = ?
  `, [fileId, user.id]);

  if (directShare) {
    if (requiredPermission === 'view') return true;
    if (requiredPermission === 'download' && ['view_download', 'edit'].includes(directShare.permission)) return true;
    if (requiredPermission === 'edit' && directShare.permission === 'edit') return true;
  }

  // Check department-wide sharing
  if (user.department_id) {
    const deptShare = await dbHelper.get(`
      SELECT permission FROM shared_files
      WHERE file_id = ? AND shared_with_department = ?
    `, [fileId, user.department_id]);

    if (deptShare) {
      if (requiredPermission === 'view') return true;
      if (requiredPermission === 'download' && ['view_download', 'edit'].includes(deptShare.permission)) return true;
      if (requiredPermission === 'edit' && deptShare.permission === 'edit') return true;
    }
  }

  return false;
}

module.exports = {
  JWT_SECRET,
  authenticate,
  requireRoles,
  checkFileAccess
};
