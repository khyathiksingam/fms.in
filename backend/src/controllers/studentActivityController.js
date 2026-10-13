const { dbHelper } = require('../config/db');

const ACTIVITY_ACTIONS = [
  'student_login',
  'student_logout',
  'student_resource_opened',
  'student_resource_previewed',
  'student_resource_downloaded',
  'student_resource_searched',
  'student_resource_filtered'
];

function parsePage(value, fallback, max) {
  const parsed = Number(value === undefined ? fallback : value);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= max ? parsed : null;
}

function buildFilters(query, params) {
  let where = ' WHERE 1 = 1';
  const fields = [
    ['student_id', 'a.user_id'],
    ['roll_number', 'a.roll_number'],
    ['department_id', 'a.department_id'],
    ['faculty_uploader_id', 'a.faculty_uploader_id'],
    ['resource_type', 'a.resource_type'],
    ['regulation', 'a.regulation'],
    ['action', 'a.action']
  ];
  for (const [key, column] of fields) {
    const value = query[key];
    if (value !== undefined && value !== '') {
      where += ` AND ${column} = ?`;
      params.push(value);
    }
  }
  if (query.subject) {
    where += ' AND (LOWER(a.subject_code) LIKE ? OR LOWER(a.subject_name) LIKE ?)';
    const term = `%${query.subject.toLowerCase()}%`;
    params.push(term, term);
  }
  if (query.student) {
    where += ' AND (LOWER(s.full_name) LIKE ? OR CAST(a.user_id AS TEXT) = ?)';
    params.push(`%${query.student.toLowerCase()}%`, query.student);
  }
  if (query.from) {
    where += ' AND a.created_at >= ?';
    params.push(query.from);
  }
  if (query.to) {
    where += " AND a.created_at < datetime(?, '+1 day')";
    params.push(query.to);
  }
  return where;
}

const studentActivityController = {
  async recordStudentAction(req, res) {
    try {
      const { action } = req.body;
      if (!['student_resource_searched', 'student_resource_filtered'].includes(action)) {
        return res.status(400).json({ error: 'Student activity action is invalid.' });
      }
      await dbHelper.run(`
        INSERT INTO student_resource_activity (user_id, roll_number, department_id, action)
        VALUES (?, ?, ?, ?)
      `, [req.user.id, req.user.roll_number || null, req.user.department_id, action]);
      res.status(204).end();
    } catch (error) {
      console.error('Record student search/filter activity error:', error);
      res.status(500).json({ error: 'Unable to record student activity.' });
    }
  },

  async facultyActivity(req, res) {
    try {
      const page = parsePage(req.query.page, 1, 1000000);
      const limit = parsePage(req.query.limit, 25, 100);
      if (!page || !limit) return res.status(400).json({ error: 'Page and limit must be valid positive integers.' });
      if (!validateFilters(req.query, res)) return;
      const params = [];
      let where = buildFilters(req.query, params);
      where += " AND a.action IN ('student_resource_opened', 'student_resource_previewed', 'student_resource_downloaded')";
      if (req.user.role_name === 'faculty') {
        where += ' AND a.faculty_uploader_id = ?';
        params.push(req.user.id);
      } else if (req.user.role_name === 'hod') {
        where += ' AND a.department_id = ?';
        params.push(req.user.department_id || -1);
      } else if (req.user.role_name !== 'admin') {
        return res.status(403).json({ error: 'Access denied.' });
      }
      const base = `
        SELECT a.id, a.roll_number, a.file_id, a.catalogue_id, a.faculty_uploader_id,
               a.department_id, a.subject_code, a.subject_name, a.regulation,
               a.resource_type, a.action, a.created_at,
               s.full_name AS student_name, d.name AS department_name
        FROM student_resource_activity a
        LEFT JOIN users s ON s.id = a.user_id
        LEFT JOIN departments d ON d.id = a.department_id
      `;
      const count = await dbHelper.get(`SELECT COUNT(*) AS total FROM (${base}${where}) AS filtered`, params);
      const rows = await dbHelper.all(
        `${base}${where} ORDER BY a.created_at DESC, a.id DESC LIMIT ? OFFSET ?`,
        [...params, limit, (page - 1) * limit]
      );
      res.json({ activity: rows, pagination: { page, limit, total: count.total, totalPages: Math.ceil(count.total / limit) } });
    } catch (error) {
      console.error('Get faculty student activity error:', error);
      res.status(500).json({ error: 'Unable to load student resource activity.' });
    }
  },

  async adminMonitor(req, res) {
    try {
      const page = parsePage(req.query.page, 1, 1000000);
      const limit = parsePage(req.query.limit, 25, 100);
      if (!page || !limit) return res.status(400).json({ error: 'Page and limit must be valid positive integers.' });
      if (!validateFilters(req.query, res)) return;
      const params = [];
      const where = buildFilters(req.query, params);
      const base = `
        SELECT a.id, a.user_id AS student_id, a.roll_number, a.file_id,
               a.catalogue_id, a.faculty_uploader_id, a.department_id,
               a.subject_code, a.subject_name, a.regulation, a.resource_type,
               a.action, a.created_at, s.full_name AS student_name,
               d.name AS department_name, f.full_name AS faculty_uploader_name
        FROM student_resource_activity a
        LEFT JOIN users s ON s.id = a.user_id
        LEFT JOIN departments d ON d.id = a.department_id
        LEFT JOIN users f ON f.id = a.faculty_uploader_id
      `;
      const count = await dbHelper.get(`SELECT COUNT(*) AS total FROM (${base}${where}) AS filtered`, params);
      const activity = await dbHelper.all(
        `${base}${where} ORDER BY a.created_at DESC, a.id DESC LIMIT ? OFFSET ?`,
        [...params, limit, (page - 1) * limit]
      );
      const [loginHistory, mostAccessedSubjects, mostAccessedNotes, mostActiveStudents, activityByDepartment, activityByRegulation, activityByFaculty] = await Promise.all([
        dbHelper.all(`
          SELECT a.user_id AS student_id, a.roll_number, u.full_name AS student_name,
                 MAX(a.created_at) AS last_login
          FROM student_resource_activity a LEFT JOIN users u ON u.id = a.user_id
          WHERE a.action = 'student_login'
          GROUP BY a.user_id ORDER BY last_login DESC LIMIT 100
        `),
        dbHelper.all(`
          SELECT subject_code, subject_name, COUNT(*) AS access_count
          FROM student_resource_activity
          WHERE action IN ('student_resource_opened', 'student_resource_previewed', 'student_resource_downloaded')
          GROUP BY subject_code, subject_name ORDER BY access_count DESC LIMIT 10
        `),
        dbHelper.all(`
          SELECT subject_code, subject_name, COUNT(*) AS access_count
          FROM student_resource_activity
          WHERE resource_type = 'faculty_note'
            AND action IN ('student_resource_opened', 'student_resource_previewed', 'student_resource_downloaded')
          GROUP BY subject_code, subject_name ORDER BY access_count DESC LIMIT 10
        `),
        dbHelper.all(`
          SELECT a.user_id AS student_id, a.roll_number, u.full_name AS student_name, COUNT(*) AS activity_count
          FROM student_resource_activity a LEFT JOIN users u ON u.id = a.user_id
          GROUP BY a.user_id ORDER BY activity_count DESC LIMIT 10
        `),
        dbHelper.all(`
          SELECT d.name AS department_name, COUNT(*) AS activity_count
          FROM student_resource_activity a LEFT JOIN departments d ON d.id = a.department_id
          WHERE a.department_id IS NOT NULL GROUP BY a.department_id ORDER BY activity_count DESC
        `),
        dbHelper.all(`
          SELECT regulation, COUNT(*) AS activity_count FROM student_resource_activity
          WHERE regulation IS NOT NULL GROUP BY regulation ORDER BY activity_count DESC
        `),
        dbHelper.all(`
          SELECT f.full_name AS faculty_name, COUNT(*) AS activity_count
          FROM student_resource_activity a LEFT JOIN users f ON f.id = a.faculty_uploader_id
          WHERE a.faculty_uploader_id IS NOT NULL
          GROUP BY a.faculty_uploader_id ORDER BY activity_count DESC
        `)
      ]);
      res.json({
        activity,
        login_history: loginHistory,
        most_accessed_subjects: mostAccessedSubjects,
        most_accessed_faculty_notes: mostAccessedNotes,
        most_active_students: mostActiveStudents,
        activity_by_department: activityByDepartment,
        activity_by_regulation: activityByRegulation,
        activity_by_faculty: activityByFaculty,
        pagination: { page, limit, total: count.total, totalPages: Math.ceil(count.total / limit) }
      });
    } catch (error) {
      console.error('Get student activity monitor error:', error);
      res.status(500).json({ error: 'Unable to load student activity monitor.' });
    }
  }
};

function validateFilters(query, res) {
  for (const key of ['student', 'roll_number', 'subject', 'regulation']) {
    if (query[key] !== undefined && (typeof query[key] !== 'string' || query[key].length > 120)) {
      res.status(400).json({ error: 'An activity search filter is invalid or too long.' });
      return false;
    }
  }
  for (const key of ['student_id', 'department_id', 'faculty_uploader_id']) {
    if (query[key] !== undefined && query[key] !== '' && !/^\d+$/.test(String(query[key]))) {
      res.status(400).json({ error: 'Activity identifiers must be positive integers.' });
      return false;
    }
  }
  if (query.resource_type && !['syllabus', 'faculty_note'].includes(query.resource_type)) {
    res.status(400).json({ error: 'Resource type filter is invalid.' });
    return false;
  }
  if (query.action && !ACTIVITY_ACTIONS.includes(query.action)) {
    res.status(400).json({ error: 'Activity action filter is invalid.' });
    return false;
  }
  for (const key of ['from', 'to']) {
    if (query[key] && (typeof query[key] !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(query[key]))) {
      res.status(400).json({ error: 'Date filters must use YYYY-MM-DD.' });
      return false;
    }
  }
  return true;
}

module.exports = studentActivityController;
