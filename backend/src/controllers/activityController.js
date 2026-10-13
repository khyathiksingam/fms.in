const { dbHelper } = require('../config/db');

const activityController = {
  async getActivityLogs(req, res) {
    try {
      const user = req.user;
      const {
        action,
        user_id,
        department_id,
        start_date,
        end_date,
        search,
        page = 1,
        limit = 50
      } = req.query;

      let sql = `
        SELECT a.id, a.user_id, a.action, a.file_id, a.folder_id, a.department_id,
               a.metadata, a.created_at,
               a.session_id, s.created_at AS session_started_at,
               s.last_seen_at AS session_last_seen_at, s.ended_at AS session_logout_at,
               s.expired_at AS session_expired_at, s.end_reason AS session_end_reason,
               s.duration_seconds AS session_duration_seconds,
               u.full_name as user_name, u.username, u.email as user_email,
               d.name as department_name, d.code as department_code,
               f.name as file_name,
               fold.name as folder_name
        FROM activity_logs a
        LEFT JOIN users u ON a.user_id = u.id
        LEFT JOIN departments d ON a.department_id = d.id
        LEFT JOIN files f ON a.file_id = f.id
        LEFT JOIN folders fold ON a.folder_id = fold.id
        LEFT JOIN sessions s ON s.id = a.session_id
        WHERE 1=1
      `;
      const params = [];

      // RBAC
      if (user.role_name === 'faculty') {
        sql += " AND a.user_id = ?";
        params.push(user.id);
      } else if (user.role_name === 'hod') {
        const departmentIds = user.department_ids?.length ? user.department_ids : [user.department_id || -1];
        sql += ` AND (a.user_id = ? OR a.department_id IN (${departmentIds.map(() => '?').join(', ')}))`;
        params.push(user.id, ...departmentIds);
      }

      if (action) {
        sql += " AND a.action = ?";
        params.push(action);
      }

      if (user_id) {
        sql += " AND a.user_id = ?";
        params.push(user_id);
      }

      if (department_id) {
        sql += " AND a.department_id = ?";
        params.push(department_id);
      }

      if (start_date) {
        sql += " AND a.created_at >= ?";
        params.push(start_date);
      }

      if (end_date) {
        sql += " AND a.created_at <= ?";
        params.push(end_date + ' 23:59:59');
      }

      if (search) {
        sql += " AND (LOWER(a.action) LIKE ? OR LOWER(u.full_name) LIKE ? OR LOWER(f.name) LIKE ? OR LOWER(fold.name) LIKE ?)";
        const term = `%${search.toLowerCase()}%`;
        params.push(term, term, term, term);
      }

      sql += " ORDER BY a.created_at DESC";

      // Pagination
      const countSql = `SELECT COUNT(*) as total FROM (${sql})`;
      const countRes = await dbHelper.get(countSql, params);
      const total = countRes ? countRes.total : 0;

      const pageNum = Math.max(1, parseInt(page) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 50));
      const offset = (pageNum - 1) * limitNum;

      sql += ` LIMIT ${limitNum} OFFSET ${offset}`;

      const logs = await dbHelper.all(sql, params);

      // Parse metadata json
      const formattedLogs = logs.map(l => {
        const meta = typeof l.metadata === 'string' ? JSON.parse(l.metadata || '{}') : (l.metadata || {});
        return {
          ...l,
          metadata: meta
        };
      });

      res.json({
        logs: formattedLogs,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum)
        }
      });
    } catch (error) {
      console.error('Get activity logs error:', error);
      res.status(500).json({ error: 'Failed to retrieve activity logs.' });
    }
  }
};

module.exports = activityController;
