const bcrypt = require('bcryptjs');
const { dbHelper } = require('../config/db');

const userController = {
  async getAllUsers(req, res) {
    try {
      const { role, department_id, status, search } = req.query;

      let sql = `
        SELECT u.id, u.full_name, u.username, u.email, u.status, u.avatar_url,
               u.roll_number, u.programme, u.academic_year, u.semester,
               u.email_verified, u.email_verified_at,
               u.role_id, r.name as role_name,
               u.department_id, d.name as department_name, d.code as department_code,
               u.created_at, u.updated_at,
               (SELECT COUNT(*) FROM files f WHERE f.owner_id = u.id AND f.deleted_at IS NULL) as file_count,
               (SELECT COALESCE(SUM(f.size), 0) FROM files f WHERE f.owner_id = u.id AND f.deleted_at IS NULL) as storage_used
        FROM users u
        JOIN roles r ON u.role_id = r.id
        LEFT JOIN departments d ON u.department_id = d.id
        WHERE 1=1
      `;
      const params = [];

      if (req.user.role_name === 'hod') {
        const departmentIds = req.user.department_ids || [];
        if (!departmentIds.length) return res.json({ users: [] });
        sql += ` AND u.department_id IN (${departmentIds.map(() => '?').join(',')})`;
        params.push(...departmentIds);
      }

      if (role) {
        sql += " AND r.name = ?";
        params.push(role);
      }

      if (department_id) {
        if (req.user.role_name === 'hod' &&
            !req.user.department_ids?.includes(Number(department_id))) {
          return res.status(403).json({ error: 'You are not assigned to the selected department.' });
        }
        sql += " AND u.department_id = ?";
        params.push(department_id);
      }

      if (status) {
        sql += " AND u.status = ?";
        params.push(status);
      }

      if (search) {
        sql += " AND (LOWER(u.full_name) LIKE ? OR LOWER(u.username) LIKE ? OR LOWER(u.email) LIKE ? OR LOWER(COALESCE(u.roll_number, '')) LIKE ?)";
        const term = `%${search.toLowerCase()}%`;
        params.push(term, term, term, term);
      }

      sql += " ORDER BY u.created_at DESC";

      const users = await dbHelper.all(sql, params);
      res.json({ users });
    } catch (error) {
      console.error('Get all users error:', error);
      res.status(500).json({ error: 'Failed to retrieve users.' });
    }
  },

  async getUserById(req, res) {
    try {
      const { id } = req.params;
      const user = await dbHelper.get(`
        SELECT u.id, u.full_name, u.username, u.email, u.status, u.avatar_url,
               u.roll_number, u.programme, u.academic_year, u.semester,
               u.email_verified, u.email_verified_at,
               u.role_id, r.name as role_name,
               u.department_id, d.name as department_name, d.code as department_code,
               u.created_at, u.updated_at
        FROM users u
        JOIN roles r ON u.role_id = r.id
        LEFT JOIN departments d ON u.department_id = d.id
        WHERE u.id = ?
      `, [id]);

      if (!user) {
        return res.status(404).json({ error: 'User not found.' });
      }
      if (req.user.role_name === 'hod' &&
          !(req.user.department_ids || [req.user.department_id]).includes(user.department_id)) {
        return res.status(404).json({ error: 'User not found.' });
      }

      res.json({ user });
    } catch (error) {
      console.error('Get user by id error:', error);
      res.status(500).json({ error: 'Failed to retrieve user.' });
    }
  },

  async createUser(req, res) {
    try {
      const { full_name, username, password, email, role_id, department_id, status } = req.body;
      const { roll_number, programme, academic_year, semester } = req.body;

      if (!full_name || !username || !password || !email || !role_id) {
        return res.status(400).json({ error: 'Full name, username, password, email, and role are required.' });
      }

      // Check username / email uniqueness
      const existingUser = await dbHelper.get(
        "SELECT id FROM users WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)",
        [username.trim(), email.trim()]
      );

      if (existingUser) {
        return res.status(400).json({ error: 'Username or email already exists in the system.' });
      }

      const role = await dbHelper.get("SELECT name FROM roles WHERE id = ?", [role_id]);
      if (!role) return res.status(400).json({ error: 'Selected role does not exist.' });
      if (role.name === 'student') {
        if (typeof roll_number !== 'string' || !roll_number.trim() || roll_number.trim().length > 40 ||
            typeof programme !== 'string' || !programme.trim() || programme.trim().length > 80 ||
            typeof academic_year !== 'string' || !academic_year.trim() || academic_year.trim().length > 40 ||
            typeof semester !== 'string' || !semester.trim() || semester.trim().length > 20 ||
            !Number.isInteger(Number(department_id)) || Number(department_id) < 1) {
          return res.status(400).json({ error: 'Student accounts require a roll number, programme, department, academic year, and semester.' });
        }
        const studentDepartment = await dbHelper.get('SELECT id FROM departments WHERE id = ? AND active = 1', [Number(department_id)]);
        if (!studentDepartment) return res.status(400).json({ error: 'Select an active department for the student.' });
        const duplicateRoll = await dbHelper.get('SELECT id FROM users WHERE LOWER(roll_number) = LOWER(?)', [roll_number.trim()]);
        if (duplicateRoll) return res.status(409).json({ error: 'A student account already uses this roll number.' });
      }
      const passwordHash = await bcrypt.hash(password, 10);
      const userStatus = status || 'active';

      const result = await dbHelper.run(`
        INSERT INTO users (
          full_name, username, password_hash, email, role_id, department_id, status,
          roll_number, programme, academic_year, semester, must_change_password,
          email_verified, email_verified_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `, [
        full_name.trim(), username.trim(), passwordHash, email.trim(), role_id,
        department_id || null, userStatus,
        role.name === 'student' ? roll_number.trim() : null,
        role.name === 'student' ? programme.trim() : null,
        role.name === 'student' ? academic_year.trim() : null,
        role.name === 'student' ? semester.trim() : null,
        role.name === 'hod' ? 1 : 0,
        // Accounts provisioned directly by an administrator are trusted and do not
        // need to complete the self-registration email OTP flow before signing in.
        1
      ]);

      const newUserId = result.lastID;

      // If user is HOD, update department hod_id
      if (role && role.name === 'hod' && department_id) {
        await dbHelper.run("UPDATE departments SET hod_id = ? WHERE id = ?", [newUserId, department_id]);
        await dbHelper.run('INSERT OR IGNORE INTO hod_departments (hod_id, department_id) VALUES (?, ?)', [newUserId, department_id]);
      }

      // Create a welcome notification
      await dbHelper.run(`
        INSERT INTO notifications (user_id, title, message)
        VALUES (?, ?, ?)
      `, [newUserId, 'Welcome to FFMS', `Welcome ${full_name}! Your account has been set up successfully.`]);

      // Log activity
      await dbHelper.run(
        "INSERT INTO activity_logs (user_id, action, department_id, metadata) VALUES (?, ?, ?, ?)",
        [req.user.id, 'User Created', department_id || req.user.department_id, JSON.stringify({ created_user_id: newUserId, username, role: role ? role.name : role_id })]
      );

      res.status(201).json({
        message: 'User created successfully.',
        userId: newUserId
      });
    } catch (error) {
      console.error('Create user error:', error);
      res.status(500).json({ error: 'Failed to create user.' });
    }
  },

  async updateUser(req, res) {
    try {
      const { id } = req.params;
      const { full_name, username, email, role_id, department_id, status } = req.body;
      const { roll_number, programme, academic_year, semester } = req.body;

      const existing = await dbHelper.get("SELECT * FROM users WHERE id = ?", [id]);
      if (!existing) {
        return res.status(404).json({ error: 'User not found.' });
      }

      const targetRole = await dbHelper.get('SELECT name FROM roles WHERE id = ?', [role_id || existing.role_id]);
      if (!targetRole) return res.status(400).json({ error: 'Selected role does not exist.' });
      if (targetRole.name === 'student') {
        if (typeof roll_number !== 'string' || !roll_number.trim() || roll_number.trim().length > 40 ||
            typeof programme !== 'string' || !programme.trim() || programme.trim().length > 80 ||
            typeof academic_year !== 'string' || !academic_year.trim() || academic_year.trim().length > 40 ||
            typeof semester !== 'string' || !semester.trim() || semester.trim().length > 20 ||
            !Number.isInteger(Number(department_id)) || Number(department_id) < 1) {
          return res.status(400).json({ error: 'Student accounts require a roll number, programme, department, academic year, and semester.' });
        }
        const studentDepartment = await dbHelper.get('SELECT id FROM departments WHERE id = ? AND active = 1', [Number(department_id)]);
        if (!studentDepartment) return res.status(400).json({ error: 'Select an active department for the student.' });
        const duplicateRoll = await dbHelper.get(
          'SELECT id FROM users WHERE LOWER(roll_number) = LOWER(?) AND id != ?',
          [roll_number.trim(), id]
        );
        if (duplicateRoll) return res.status(409).json({ error: 'A student account already uses this roll number.' });
      }

      // Check collision
      if (username || email) {
        const collision = await dbHelper.get(
          "SELECT id FROM users WHERE (LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)) AND id != ?",
          [username || '', email || '', id]
        );
        if (collision) {
          return res.status(400).json({ error: 'Username or email already taken by another account.' });
        }
      }

      await dbHelper.run(`
        UPDATE users 
        SET full_name = ?,
            username = ?,
            email = ?,
            role_id = ?,
            department_id = ?,
            status = ?,
            roll_number = ?,
            programme = ?,
            academic_year = ?,
            semester = ?,
            must_change_password = CASE WHEN ? = 1 THEN 1 ELSE must_change_password END,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [
        full_name ? full_name.trim() : existing.full_name,
        username ? username.trim() : existing.username,
        email ? email.trim() : existing.email,
        role_id ? Number(role_id) : existing.role_id,
        department_id ? Number(department_id) : null,
        status || existing.status,
        targetRole.name === 'student' ? roll_number.trim() : existing.roll_number,
        targetRole.name === 'student' ? programme.trim() : existing.programme,
        targetRole.name === 'student' ? academic_year.trim() : existing.academic_year,
        targetRole.name === 'student' ? semester.trim() : existing.semester,
        targetRole.name === 'hod' && existing.role_id !== Number(role_id || existing.role_id) ? 1 : 0,
        id
      ]);

      if (existing.role_id !== Number(role_id || existing.role_id) && targetRole.name !== 'hod') {
        await dbHelper.run('DELETE FROM hod_departments WHERE hod_id = ?', [id]);
        await dbHelper.run('UPDATE departments SET hod_id = NULL WHERE hod_id = ?', [id]);
      }

      if (role_id && department_id) {
        if (targetRole.name === 'hod') {
          await dbHelper.run("UPDATE departments SET hod_id = ? WHERE id = ?", [id, department_id]);
          await dbHelper.run('INSERT OR IGNORE INTO hod_departments (hod_id, department_id) VALUES (?, ?)', [id, department_id]);
        }
      }

      // Log activity
      await dbHelper.run(
        "INSERT INTO activity_logs (user_id, action, department_id, metadata) VALUES (?, ?, ?, ?)",
        [req.user.id, 'User Modified', department_id || existing.department_id, JSON.stringify({ target_user_id: id, updated_fields: { full_name, username, email, role_id, department_id, status } })]
      );

      res.json({ message: 'User updated successfully.' });
    } catch (error) {
      console.error('Update user error:', error);
      res.status(500).json({ error: 'Failed to update user.' });
    }
  },

  async toggleUserStatus(req, res) {
    try {
      const { id } = req.params;
      const user = await dbHelper.get("SELECT * FROM users WHERE id = ?", [id]);
      if (!user) {
        return res.status(404).json({ error: 'User not found.' });
      }

      const newStatus = user.status === 'active' ? 'disabled' : 'active';
      await dbHelper.run(
        "UPDATE users SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [newStatus, id]
      );

      await dbHelper.run(
        "INSERT INTO activity_logs (user_id, action, department_id, metadata) VALUES (?, ?, ?, ?)",
        [req.user.id, `User ${newStatus === 'active' ? 'Enabled' : 'Disabled'}`, user.department_id, JSON.stringify({ target_user_id: id, username: user.username })]
      );

      res.json({ message: `User status changed to ${newStatus}.`, status: newStatus });
    } catch (error) {
      console.error('Toggle status error:', error);
      res.status(500).json({ error: 'Failed to update user status.' });
    }
  },

  async resetPassword(req, res) {
    try {
      const { id } = req.params;
      const { new_password } = req.body;

      if (!new_password || new_password.length < 6) {
        return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
      }

      const user = await dbHelper.get("SELECT * FROM users WHERE id = ?", [id]);
      if (!user) {
        return res.status(404).json({ error: 'User not found.' });
      }

      const passwordHash = await bcrypt.hash(new_password, 10);
      const targetRole = await dbHelper.get('SELECT name FROM roles WHERE id = ?', [user.role_id]);
      await dbHelper.run(
        "UPDATE users SET password_hash = ?, must_change_password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [passwordHash, targetRole?.name === 'hod' ? 1 : user.must_change_password, id]
      );

      await dbHelper.run(
        "INSERT INTO activity_logs (user_id, action, department_id, metadata) VALUES (?, ?, ?, ?)",
        [req.user.id, 'User Password Reset', user.department_id, JSON.stringify({ target_user_id: id, username: user.username })]
      );

      res.json({ message: `Password for ${user.full_name} has been reset successfully.` });
    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({ error: 'Failed to reset password.' });
    }
  },

  async deleteUser(req, res) {
    try {
      const { id } = req.params;
      const user = await dbHelper.get("SELECT * FROM users WHERE id = ?", [id]);
      if (!user) {
        return res.status(404).json({ error: 'User not found.' });
      }

      if (user.id === req.user.id) {
        return res.status(400).json({ error: 'You cannot delete your own active account.' });
      }

      // Check if user is HOD
      await dbHelper.run("UPDATE departments SET hod_id = NULL WHERE hod_id = ?", [id]);

      // Delete user
      await dbHelper.run("DELETE FROM users WHERE id = ?", [id]);

      await dbHelper.run(
        "INSERT INTO activity_logs (user_id, action, department_id, metadata) VALUES (?, ?, ?, ?)",
        [req.user.id, 'User Deleted', user.department_id, JSON.stringify({ deleted_user_id: id, username: user.username })]
      );

      res.json({ message: 'User deleted successfully.' });
    } catch (error) {
      console.error('Delete user error:', error);
      res.status(500).json({ error: 'Failed to delete user.' });
    }
  },

  async getRoles(req, res) {
    try {
      const roles = await dbHelper.all("SELECT * FROM roles ORDER BY id ASC");
      res.json({ roles });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch roles.' });
    }
  }
};

module.exports = userController;
