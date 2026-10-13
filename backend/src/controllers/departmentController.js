const { dbHelper } = require('../config/db');

const DEPARTMENT_GROUPS = ['ENGINEERING', 'CSE & IT', 'SCIENCES & HUMANITIES', 'OTHER'];

function parseActive(value, fallback = 1) {
  if (value === undefined) return fallback;
  if ([true, 1, '1'].includes(value)) return 1;
  if ([false, 0, '0'].includes(value)) return 0;
  return null;
}

const departmentController = {
  async getPublicDepartments(req, res) {
    try {
      const departments = await dbHelper.all(`
        SELECT d.id, d.name, d.code, d.display_group, d.sort_order,
               (SELECT GROUP_CONCAT(u.full_name, ' · ')
                FROM hod_departments hd JOIN users u ON u.id = hd.hod_id
                JOIN roles r ON r.id = u.role_id AND r.name = 'hod'
                WHERE hd.department_id = d.id) AS hod_names,
               (SELECT COUNT(*) FROM users fu JOIN roles fr ON fr.id = fu.role_id
                WHERE fu.department_id = d.id AND fu.status = 'active' AND fr.name = 'faculty') AS faculty_count
        FROM departments d
        WHERE d.active = 1
          AND NOT (d.id = 1 AND d.code = 'CSE' AND d.name = 'CSE- (CYS, DS) and AI&DS')
        ORDER BY CASE d.display_group
                   WHEN 'ENGINEERING' THEN 1
                   WHEN 'CSE & IT' THEN 2
                   WHEN 'SCIENCES & HUMANITIES' THEN 3
                   ELSE 4
                 END, d.sort_order, d.name
      `);
      res.json({ departments });
    } catch (error) {
      console.error('Public department list error:', error);
      res.status(500).json({ error: 'Unable to load department information.' });
    }
  },

  async getPublicDepartmentById(req, res) {
    try {
      const department = await dbHelper.get(`
        SELECT d.id, d.name, d.code, d.display_group,
               (SELECT GROUP_CONCAT(u.full_name, ' · ')
                FROM hod_departments hd JOIN users u ON u.id = hd.hod_id
                JOIN roles r ON r.id = u.role_id AND r.name = 'hod'
                WHERE hd.department_id = d.id) AS hod_names
        FROM departments d
        WHERE d.id = ? AND d.active = 1
          AND NOT (d.id = 1 AND d.code = 'CSE' AND d.name = 'CSE- (CYS, DS) and AI&DS')
      `, [req.params.id]);
      if (!department) return res.status(404).json({ error: 'Department not found.' });

      const faculty = await dbHelper.all(`
        SELECT u.id, u.full_name
        FROM users u
        JOIN roles r ON r.id = u.role_id AND r.name = 'faculty'
        WHERE u.department_id = ? AND u.status = 'active'
        ORDER BY u.full_name
      `, [department.id]);
      res.json({ department, faculty });
    } catch (error) {
      console.error('Public department detail error:', error);
      res.status(500).json({ error: 'Unable to load department information.' });
    }
  },

  async getPublicFaculty(req, res) {
    try {
      const faculty = await dbHelper.all(`
        SELECT u.id, u.full_name, d.id AS department_id, d.name AS department_name,
               d.code AS department_code, d.display_group
        FROM users u
        JOIN roles r ON r.id = u.role_id AND r.name = 'faculty'
        JOIN departments d ON d.id = u.department_id AND d.active = 1
        WHERE u.status = 'active'
          AND NOT (d.id = 1 AND d.code = 'CSE' AND d.name = 'CSE- (CYS, DS) and AI&DS')
        ORDER BY CASE d.display_group
                   WHEN 'ENGINEERING' THEN 1
                   WHEN 'CSE & IT' THEN 2
                   WHEN 'SCIENCES & HUMANITIES' THEN 3
                   ELSE 4
                 END, d.sort_order, d.name, u.full_name
      `);
      res.json({ faculty });
    } catch (error) {
      console.error('Public faculty directory error:', error);
      res.status(500).json({ error: 'Unable to load faculty information.' });
    }
  },

  async getAllDepartments(req, res) {
    try {
      let sql = `
        SELECT d.id, d.name, d.code, d.hod_id, d.display_group, d.active, d.sort_order, d.created_at,
               u.full_name as hod_name, u.email as hod_email, u.username as hod_username,
               (SELECT GROUP_CONCAT(hu.full_name, ' · ')
                FROM hod_departments hd JOIN users hu ON hu.id = hd.hod_id
                JOIN roles hr ON hr.id = hu.role_id AND hr.name = 'hod'
                WHERE hd.department_id = d.id) AS assigned_hod_names,
               (SELECT COUNT(*) FROM users fu WHERE fu.department_id = d.id AND fu.status = 'active') as faculty_count,
               (SELECT COUNT(*) FROM files f WHERE f.department_id = d.id AND f.deleted_at IS NULL) as file_count,
               (SELECT COALESCE(SUM(f.size), 0) FROM files f WHERE f.department_id = d.id AND f.deleted_at IS NULL) as storage_used,
               (SELECT COUNT(*) FROM syllabus_catalog c WHERE c.department_id = d.id) as syllabus_count
        FROM departments d
        LEFT JOIN users u ON d.hod_id = u.id
      `;
      const params = [];
      if (req.user.role_name === 'hod') {
        const ids = req.user.department_ids || [];
        if (!ids.length) return res.json({ departments: [] });
        sql += ` WHERE d.id IN (${ids.map(() => '?').join(',')})`;
        params.push(...ids);
      }
      sql += ` ORDER BY CASE d.display_group
                   WHEN 'ENGINEERING' THEN 1
                   WHEN 'CSE & IT' THEN 2
                   WHEN 'SCIENCES & HUMANITIES' THEN 3
                   ELSE 4
                 END, d.sort_order ASC, d.name ASC
      `;
      const departments = await dbHelper.all(sql, params);

      res.json({ departments });
    } catch (error) {
      console.error('Get departments error:', error);
      res.status(500).json({ error: 'Failed to retrieve departments.' });
    }
  },

  async getDepartmentById(req, res) {
    try {
      const { id } = req.params;
      const department = await dbHelper.get(`
        SELECT d.id, d.name, d.code, d.hod_id, d.created_at,
               u.full_name as hod_name, u.email as hod_email,
               (SELECT COUNT(*) FROM users fu WHERE fu.department_id = d.id AND fu.status = 'active') as faculty_count,
               (SELECT COUNT(*) FROM files f WHERE f.department_id = d.id AND f.deleted_at IS NULL) as file_count,
               (SELECT COALESCE(SUM(f.size), 0) FROM files f WHERE f.department_id = d.id AND f.deleted_at IS NULL) as storage_used
        FROM departments d
        LEFT JOIN users u ON d.hod_id = u.id
        WHERE d.id = ?
      `, [id]);

      if (!department) {
        return res.status(404).json({ error: 'Department not found.' });
      }
      if (req.user.role_name === 'hod' &&
          !req.user.department_ids?.includes(Number(id))) {
        return res.status(404).json({ error: 'Department not found.' });
      }

      // Fetch faculty in this department
      const faculty = await dbHelper.all(`
        SELECT u.id, u.full_name, u.username, u.email, u.status, u.avatar_url, r.name as role_name
        FROM users u
        JOIN roles r ON u.role_id = r.id
        WHERE u.department_id = ?
        ORDER BY u.full_name ASC
      `, [id]);

      res.json({ department, faculty });
    } catch (error) {
      console.error('Get department by id error:', error);
      res.status(500).json({ error: 'Failed to retrieve department.' });
    }
  },

  async createDepartment(req, res) {
    try {
      const { name, code, hod_id } = req.body;
      const displayGroup = req.body.display_group || 'OTHER';
      const active = parseActive(req.body.active);
      const sortOrder = req.body.sort_order === undefined ? 0 : Number(req.body.sort_order);

      if (typeof name !== 'string' || !name.trim() || name.trim().length > 120 ||
          typeof code !== 'string' || !code.trim() || code.trim().length > 40) {
        return res.status(400).json({ error: 'Department name and department code are required.' });
      }
      if (!DEPARTMENT_GROUPS.includes(displayGroup) || active === null ||
          !Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 100000) {
        return res.status(400).json({ error: 'Department group, active status, or sort order is invalid.' });
      }

      // Check uniqueness
      const existing = await dbHelper.get(
        "SELECT id FROM departments WHERE LOWER(name) = LOWER(?) OR LOWER(code) = LOWER(?)",
        [name.trim(), code.trim()]
      );
      if (existing) {
        return res.status(400).json({ error: 'Department name or code already exists.' });
      }

      const result = await dbHelper.run(
        "INSERT INTO departments (name, code, hod_id, display_group, active, sort_order) VALUES (?, ?, ?, ?, ?, ?)",
        [name.trim(), code.trim().toUpperCase(), hod_id || null, displayGroup, active, sortOrder]
      );

      const newDeptId = result.lastID;

      // If HOD was specified, make sure that user has hod role and department_id
      if (hod_id) {
        const hodRole = await dbHelper.get("SELECT id FROM roles WHERE name = 'hod'");
        await dbHelper.run(
          "UPDATE users SET department_id = COALESCE(department_id, ?), role_id = COALESCE(?, role_id) WHERE id = ?",
          [newDeptId, hodRole ? hodRole.id : null, hod_id]
        );
        await dbHelper.run('INSERT OR IGNORE INTO hod_departments (hod_id, department_id) VALUES (?, ?)', [hod_id, newDeptId]);
      }

      // Automatically create root standard folders for this department
      const standardFolders = ['Academic', 'Question Papers', 'Lesson Plans', 'Lab Manuals', 'Research', 'Administration'];
      for (const folderName of standardFolders) {
        await dbHelper.run(
          "INSERT INTO folders (name, parent_folder_id, department_id, created_by) VALUES (?, NULL, ?, ?)",
          [folderName, newDeptId, req.user.id]
        );
      }

      await dbHelper.run(
        "INSERT INTO activity_logs (user_id, action, department_id, metadata) VALUES (?, ?, ?, ?)",
        [req.user.id, 'Department Created', newDeptId, JSON.stringify({ name, code })]
      );

      res.status(201).json({ message: 'Department created successfully.', departmentId: newDeptId });
    } catch (error) {
      console.error('Create department error:', error);
      res.status(500).json({ error: 'Failed to create department.' });
    }
  },

  async updateDepartment(req, res) {
    try {
      const { id } = req.params;
      const { name, code, hod_id } = req.body;
      const displayGroup = req.body.display_group;
      const active = parseActive(req.body.active, undefined);
      const sortOrder = req.body.sort_order === undefined ? undefined : Number(req.body.sort_order);

      const dept = await dbHelper.get("SELECT * FROM departments WHERE id = ?", [id]);
      if (!dept) {
        return res.status(404).json({ error: 'Department not found.' });
      }

      if ((name !== undefined && (typeof name !== 'string' || !name.trim() || name.trim().length > 120)) ||
          (code !== undefined && (typeof code !== 'string' || !code.trim() || code.trim().length > 40))) {
        return res.status(400).json({ error: 'Department name or code is invalid.' });
      }
      if (name !== undefined || code !== undefined) {
        const collision = await dbHelper.get(
          "SELECT id FROM departments WHERE (LOWER(name) = LOWER(?) OR LOWER(code) = LOWER(?)) AND id != ?",
          [name === undefined ? dept.name : name.trim(), code === undefined ? dept.code : code.trim(), id]
        );
        if (collision) {
          return res.status(400).json({ error: 'Department name or code is already in use.' });
        }
      }
      if ((displayGroup !== undefined && !DEPARTMENT_GROUPS.includes(displayGroup)) ||
          (req.body.active !== undefined && active === null) ||
          (sortOrder !== undefined && (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 100000))) {
        return res.status(400).json({ error: 'Department group, active status, or sort order is invalid.' });
      }

      await dbHelper.run(`
        UPDATE departments 
        SET name = COALESCE(?, name),
            code = COALESCE(?, code),
            display_group = COALESCE(?, display_group),
            active = COALESCE(?, active),
            sort_order = COALESCE(?, sort_order),
            hod_id = COALESCE(?, hod_id)
        WHERE id = ?
      `, [
        name !== undefined ? name.trim() : null,
        code !== undefined ? code.trim().toUpperCase() : null,
        displayGroup === undefined ? null : displayGroup,
        active,
        sortOrder === undefined ? null : sortOrder,
        hod_id,
        id
      ]);

      if (hod_id !== undefined && hod_id !== null && Number(hod_id) !== dept.hod_id) {
        const targetHod = await dbHelper.get('SELECT id FROM users WHERE id = ?', [Number(hod_id)]);
        if (!targetHod) return res.status(400).json({ error: 'Selected HOD account does not exist.' });
        const hodRole = await dbHelper.get("SELECT id FROM roles WHERE name = 'hod'");
        await dbHelper.run(
          "UPDATE users SET department_id = COALESCE(department_id, ?), role_id = COALESCE(?, role_id) WHERE id = ?",
          [id, hodRole ? hodRole.id : null, Number(hod_id)]
        );
        if (dept.hod_id) await dbHelper.run('DELETE FROM hod_departments WHERE hod_id = ? AND department_id = ?', [dept.hod_id, id]);
        await dbHelper.run('INSERT OR IGNORE INTO hod_departments (hod_id, department_id) VALUES (?, ?)', [Number(hod_id), id]);
      } else if (hod_id === null && dept.hod_id) {
        await dbHelper.run('DELETE FROM hod_departments WHERE hod_id = ? AND department_id = ?', [dept.hod_id, id]);
        await dbHelper.run('UPDATE departments SET hod_id = NULL WHERE id = ?', [id]);
      }

      await dbHelper.run(
        "INSERT INTO activity_logs (user_id, action, department_id, metadata) VALUES (?, ?, ?, ?)",
        [req.user.id, 'Department Modified', id, JSON.stringify({ name, code, hod_id })]
      );

      res.json({ message: 'Department updated successfully.' });
    } catch (error) {
      console.error('Update department error:', error);
      res.status(500).json({ error: 'Failed to update department.' });
    }
  },

  async setStatus(req, res) {
    try {
      const id = Number(req.params.id);
      const active = parseActive(req.body.active, null);
      if (!Number.isInteger(id) || id < 1 || active === null) {
        return res.status(400).json({ error: 'A valid department id and active status are required.' });
      }
      const department = await dbHelper.get('SELECT id, name, code FROM departments WHERE id = ?', [id]);
      if (!department) return res.status(404).json({ error: 'Department not found.' });
      await dbHelper.run('UPDATE departments SET active = ? WHERE id = ?', [active, id]);
      await dbHelper.run(
        'INSERT INTO activity_logs (user_id, action, department_id, metadata) VALUES (?, ?, ?, ?)',
        [req.user.id, active ? 'Department Activated' : 'Department Deactivated', id, JSON.stringify({ name: department.name, code: department.code })]
      );
      res.json({ message: active ? 'Department activated.' : 'Department deactivated.' });
    } catch (error) {
      console.error('Update department status error:', error);
      res.status(500).json({ error: 'Failed to update department status.' });
    }
  },

  async assignHOD(req, res) {
    try {
      const { id } = req.params;
      const { user_id } = req.body;

      if (!user_id) {
        return res.status(400).json({ error: 'User ID is required to assign as HOD.' });
      }

      const departmentId = Number(id);
      const hodUserId = Number(user_id);
      const department = await dbHelper.get('SELECT id, hod_id FROM departments WHERE id = ?', [departmentId]);
      const hodUser = await dbHelper.get('SELECT id FROM users WHERE id = ?', [hodUserId]);
      const hodRole = await dbHelper.get("SELECT id FROM roles WHERE name = 'hod'");
      if (!department || !hodUser || !hodRole) return res.status(404).json({ error: 'Department or HOD account was not found.' });
      if (department.hod_id && department.hod_id !== hodUserId) {
        await dbHelper.run('DELETE FROM hod_departments WHERE hod_id = ? AND department_id = ?', [department.hod_id, departmentId]);
      }
      await dbHelper.run("UPDATE users SET department_id = COALESCE(department_id, ?), role_id = ? WHERE id = ?", [departmentId, hodRole.id, hodUserId]);
      await dbHelper.run('INSERT OR IGNORE INTO hod_departments (hod_id, department_id) VALUES (?, ?)', [hodUserId, departmentId]);
      await dbHelper.run("UPDATE departments SET hod_id = ? WHERE id = ?", [hodUserId, departmentId]);

      await dbHelper.run(
        "INSERT INTO activity_logs (user_id, action, department_id, metadata) VALUES (?, ?, ?, ?)",
        [req.user.id, 'HOD Assigned', id, JSON.stringify({ assigned_user_id: user_id })]
      );

      res.json({ message: 'HOD assigned successfully.' });
    } catch (error) {
      console.error('Assign HOD error:', error);
      res.status(500).json({ error: 'Failed to assign HOD.' });
    }
  },

  async deleteDepartment(req, res) {
    try {
      const { id } = req.params;
      const dept = await dbHelper.get("SELECT * FROM departments WHERE id = ?", [id]);
      if (!dept) {
        return res.status(404).json({ error: 'Department not found.' });
      }

      const links = await dbHelper.get(`
        SELECT
          (SELECT COUNT(*) FROM users WHERE department_id = ?) +
          (SELECT COUNT(*) FROM files WHERE department_id = ?) +
          (SELECT COUNT(*) FROM folders WHERE department_id = ?) +
          (SELECT COUNT(*) FROM syllabus_catalog WHERE department_id = ?) +
          (SELECT COUNT(*) FROM hod_departments WHERE department_id = ?) AS total
      `, [id, id, id, id, id]);
      if (links.total > 0) {
        return res.status(409).json({ error: 'This department has linked users or records. Deactivate it instead of deleting it.' });
      }
      await dbHelper.run('DELETE FROM hod_departments WHERE department_id = ?', [id]);
      await dbHelper.run("DELETE FROM departments WHERE id = ?", [id]);

      await dbHelper.run(
        "INSERT INTO activity_logs (user_id, action, department_id, metadata) VALUES (?, ?, ?, ?)",
        [req.user.id, 'Department Deleted', null, JSON.stringify({ name: dept.name, code: dept.code })]
      );

      res.json({ message: 'Department deleted successfully.' });
    } catch (error) {
      console.error('Delete department error:', error);
      res.status(500).json({ error: 'Failed to delete department.' });
    }
  }
};

module.exports = departmentController;
