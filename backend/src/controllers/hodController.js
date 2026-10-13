const { dbHelper } = require('../config/db');

const hodController = {
  async dashboard(req, res) {
    try {
      const departmentId = Number(req.user.department_id);
      if (!req.user.department_ids?.includes(departmentId)) {
        return res.status(403).json({ error: 'You are not assigned to this department.' });
      }

      const department = await dbHelper.get(
        'SELECT id, name, code, display_group FROM departments WHERE id = ? AND active = 1',
        [departmentId]
      );
      if (!department) return res.status(404).json({ error: 'Assigned department not found.' });

      const [faculty, submissions, counts, activity, notifications] = await Promise.all([
        dbHelper.all(`
          SELECT u.id, u.full_name, u.username, u.avatar_url,
                 (SELECT COUNT(*) FROM files f WHERE f.owner_id = u.id AND f.department_id = ? AND f.deleted_at IS NULL) AS file_count
          FROM users u JOIN roles r ON r.id = u.role_id AND r.name = 'faculty'
          WHERE u.department_id = ? AND u.status = 'active'
          ORDER BY u.full_name
        `, [departmentId, departmentId]),
        dbHelper.all(`
          SELECT f.id, f.name, f.original_name, f.file_type, f.size, f.created_at,
                 f.approval_status, f.review_note, f.reviewed_at,
                 u.id AS uploader_id, u.full_name AS uploader_name,
                 d.name AS department_name
          FROM files f
          JOIN users u ON u.id = f.owner_id
          LEFT JOIN departments d ON d.id = f.department_id
          WHERE f.department_id = ? AND f.deleted_at IS NULL
          ORDER BY CASE f.approval_status WHEN 'pending' THEN 0 WHEN 'rejected' THEN 1 ELSE 2 END, f.created_at DESC
          LIMIT 30
        `, [departmentId]),
        dbHelper.all(`
          SELECT approval_status, COUNT(*) AS count
          FROM files
          WHERE department_id = ? AND deleted_at IS NULL
          GROUP BY approval_status
        `, [departmentId]),
        dbHelper.all(`
          SELECT a.id, a.action, a.created_at, a.metadata, u.full_name AS user_name,
                 f.name AS file_name
          FROM activity_logs a
          LEFT JOIN users u ON u.id = a.user_id
          LEFT JOIN files f ON f.id = a.file_id
          WHERE a.department_id = ?
          ORDER BY a.created_at DESC
          LIMIT 12
        `, [departmentId]),
        dbHelper.all(`
          SELECT id, title, message, read_status, link, created_at
          FROM notifications
          WHERE user_id = ?
          ORDER BY created_at DESC
          LIMIT 8
        `, [req.user.id])
      ]);

      const fileCounts = Object.fromEntries(counts.map(row => [row.approval_status, row.count]));
      res.json({
        department,
        assigned_departments: req.user.assigned_departments,
        faculty,
        submissions,
        stats: {
          pending: fileCounts.pending || 0,
          approved: fileCounts.approved || 0,
          rejected: fileCounts.rejected || 0,
          faculty: faculty.length
        },
        activity,
        notifications
      });
    } catch (error) {
      console.error('HOD dashboard error:', error);
      res.status(500).json({ error: 'Unable to load the department dashboard.' });
    }
  },

  async reviewSubmission(req, res) {
    try {
      const fileId = Number(req.params.id);
      const { status, review_note = '' } = req.body;
      if (!Number.isInteger(fileId) || fileId < 1 || !['approved', 'rejected'].includes(status) ||
          typeof review_note !== 'string' || review_note.length > 1000) {
        return res.status(400).json({ error: 'A valid review decision and note are required.' });
      }

      const file = await dbHelper.get(
        'SELECT id, name, owner_id, department_id, approval_status FROM files WHERE id = ? AND deleted_at IS NULL',
        [fileId]
      );
      if (!file || !req.user.department_ids?.includes(file.department_id)) {
        return res.status(404).json({ error: 'Submission not found in your assigned departments.' });
      }
      if (file.approval_status !== 'pending') {
        return res.status(409).json({ error: 'Only pending submissions can be reviewed.' });
      }

      await dbHelper.run(`
        UPDATE files
        SET approval_status = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP,
            review_note = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND approval_status = 'pending'
      `, [status, req.user.id, review_note.trim(), fileId]);
      await dbHelper.run(`
        INSERT INTO activity_logs (user_id, action, file_id, department_id, metadata)
        VALUES (?, ?, ?, ?, ?)
      `, [
        req.user.id,
        status === 'approved' ? 'Faculty Submission Approved' : 'Faculty Submission Rejected',
        fileId,
        file.department_id,
        JSON.stringify({ note: review_note.trim(), uploader_id: file.owner_id })
      ]);
      await dbHelper.run(`
        INSERT INTO notifications (user_id, title, message, link)
        VALUES (?, ?, ?, ?)
      `, [
        file.owner_id,
        status === 'approved' ? 'File approved' : 'File needs revision',
        status === 'approved'
          ? `Your file "${file.name}" was approved by the department HOD.`
          : `Your file "${file.name}" was returned for revision.${review_note.trim() ? ` Note: ${review_note.trim()}` : ''}`,
        '/files'
      ]);
      res.json({ message: status === 'approved' ? 'Submission approved.' : 'Submission rejected.' });
    } catch (error) {
      console.error('HOD review submission error:', error);
      res.status(500).json({ error: 'Unable to update the submission review.' });
    }
  }
};

module.exports = hodController;
