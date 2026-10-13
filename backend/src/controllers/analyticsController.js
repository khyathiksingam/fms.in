const { dbHelper } = require('../config/db');

const analyticsController = {
  async getDashboardStats(req, res) {
    try {
      const user = req.user;

      if (user.role_name === 'admin') {
        // Admin Dashboard Metrics
        const totalFaculty = await dbHelper.get("SELECT COUNT(*) as count FROM users u JOIN roles r ON u.role_id = r.id WHERE r.name = 'faculty' AND u.status = 'active'");
        const totalHods = await dbHelper.get("SELECT COUNT(*) as count FROM users u JOIN roles r ON u.role_id = r.id WHERE r.name = 'hod' AND u.status = 'active'");
        const totalDepts = await dbHelper.get("SELECT COUNT(*) as count FROM departments");
        const totalFiles = await dbHelper.get("SELECT COUNT(*) as count FROM files WHERE deleted_at IS NULL");
        const totalStorage = await dbHelper.get("SELECT COALESCE(SUM(size), 0) as bytes FROM files WHERE deleted_at IS NULL");
        
        // Files uploaded today
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const uploadedToday = await dbHelper.get(
          "SELECT COUNT(*) as count FROM files WHERE created_at >= ? AND deleted_at IS NULL",
          [todayStart.toISOString()]
        );

        // Recent activity
        const recentActivity = await dbHelper.all(`
          SELECT a.*, COALESCE(u.full_name, 'Potta Devika') as user_name, u.username, d.name as department_name
          FROM activity_logs a
          LEFT JOIN users u ON a.user_id = u.id
          LEFT JOIN departments d ON a.department_id = d.id
          ORDER BY a.created_at DESC
          LIMIT 8
        `);

        // Recent uploaded files
        const recentFiles = await dbHelper.all(`
          SELECT f.id, f.name, f.file_type, f.size, f.created_at, f.drive_link,
                 COALESCE(u.full_name, 'Potta Devika') as owner_name,
                 d.name as department_name, d.code as department_code
          FROM files f
          LEFT JOIN users u ON f.owner_id = u.id
          LEFT JOIN departments d ON f.department_id = d.id
          WHERE f.deleted_at IS NULL
          ORDER BY f.created_at DESC
          LIMIT 8
        `);

        return res.json({
          role: 'admin',
          stats: {
            totalFaculty: totalFaculty?.count || 0,
            totalHods: totalHods?.count || 0,
            totalDepartments: totalDepts?.count || 0,
            totalFiles: totalFiles?.count || 0,
            totalStorageBytes: totalStorage?.bytes || 0,
            filesUploadedToday: uploadedToday?.count || 0,
            storageQuotaBytes: 100 * 1024 * 1024 * 1024 // 100 GB quota
          },
          recentActivity,
          recentFiles
        });
      } else if (user.role_name === 'hod') {
        // HOD Dashboard Metrics
        const deptId = user.department_id;
        const deptFaculty = await dbHelper.get("SELECT COUNT(*) as count FROM users WHERE department_id = ? AND status = 'active'", [deptId]);
        const deptFiles = await dbHelper.get("SELECT COUNT(*) as count FROM files WHERE (department_id = ? OR owner_id = ?) AND deleted_at IS NULL", [deptId, user.id]);
        const deptStorage = await dbHelper.get("SELECT COALESCE(SUM(size), 0) as bytes FROM files WHERE (department_id = ? OR owner_id = ?) AND deleted_at IS NULL", [deptId, user.id]);
        
        const sharedFiles = await dbHelper.get(`
          SELECT COUNT(DISTINCT file_id) as count 
          FROM shared_files 
          WHERE shared_with_department = ? OR shared_with_user = ?
        `, [deptId, user.id]);

        const recentUploads = await dbHelper.all(`
          SELECT f.id, f.name, f.file_type, f.size, f.created_at, f.drive_link,
                 COALESCE(u.full_name, 'Potta Devika') as owner_name
          FROM files f
          LEFT JOIN users u ON f.owner_id = u.id
          WHERE (f.department_id = ? OR f.owner_id = ?) AND f.deleted_at IS NULL
          ORDER BY f.created_at DESC
          LIMIT 8
        `, [deptId, user.id]);

        const deptActivity = await dbHelper.all(`
          SELECT a.*, COALESCE(u.full_name, 'Potta Devika') as user_name, u.username
          FROM activity_logs a
          LEFT JOIN users u ON a.user_id = u.id
          WHERE a.department_id = ? OR a.user_id = ?
          ORDER BY a.created_at DESC
          LIMIT 8
        `, [deptId, user.id]);

        return res.json({
          role: 'hod',
          stats: {
            departmentFaculty: deptFaculty?.count || 0,
            departmentFiles: deptFiles?.count || 0,
            departmentStorageBytes: deptStorage?.bytes || 0,
            sharedFilesCount: sharedFiles?.count || 0,
            departmentName: user.department_name
          },
          recentUploads,
          recentFiles: recentUploads,
          deptActivity,
          recentActivity: deptActivity
        });
      } else {
        // Faculty Dashboard Metrics
        const myFiles = await dbHelper.get("SELECT COUNT(*) as count FROM files WHERE (owner_id = ? OR department_id = ?) AND deleted_at IS NULL", [user.id, user.department_id || -1]);
        const myStorage = await dbHelper.get("SELECT COALESCE(SUM(size), 0) as bytes FROM files WHERE (owner_id = ? OR department_id = ?) AND deleted_at IS NULL", [user.id, user.department_id || -1]);
        const myFolders = await dbHelper.get("SELECT COUNT(*) as count FROM folders WHERE created_by = ? OR department_id = ?", [user.id, user.department_id || -1]);
        
        const sharedWithMe = await dbHelper.get(`
          SELECT COUNT(DISTINCT sf.file_id) as count
          FROM shared_files sf
          JOIN files f ON sf.file_id = f.id
          WHERE (sf.shared_with_user = ? OR sf.shared_with_department = ?)
            AND f.deleted_at IS NULL AND f.owner_id != ?
        `, [user.id, user.department_id || -1, user.id]);

        const starredCount = await dbHelper.get("SELECT COUNT(*) as count FROM favorites fav JOIN files f ON fav.file_id = f.id WHERE fav.user_id = ? AND f.deleted_at IS NULL", [user.id]);

        const recentFiles = await dbHelper.all(`
          SELECT f.id, f.name, f.file_type, f.size, f.created_at, f.version, f.drive_link,
                 COALESCE(f.visibility, 'public') as visibility,
                 COALESCE(u.full_name, 'Potta Devika') as owner_name,
                 EXISTS(SELECT 1 FROM favorites fav WHERE fav.file_id = f.id AND fav.user_id = ?) as is_starred
          FROM files f
          LEFT JOIN users u ON f.owner_id = u.id
          WHERE (f.owner_id = ? OR (COALESCE(f.visibility, 'public') = 'public' AND (f.department_id = ? OR f.department_id IS NULL))) AND f.deleted_at IS NULL
          ORDER BY f.created_at DESC
          LIMIT 8
        `, [user.id, user.id, user.department_id || -1]);

        // Faculty activity stream: the faculty's own recent events (logins, logouts,
        // uploads, previews, downloads, submissions) so the dashboard stream is populated.
        const recentActivity = await dbHelper.all(`
          SELECT a.id, a.action, a.file_id, a.department_id, a.metadata, a.created_at,
                 u.full_name as user_name, u.username,
                 d.name as department_name, d.code as department_code,
                 f.name as file_name
          FROM activity_logs a
          LEFT JOIN users u ON a.user_id = u.id
          LEFT JOIN departments d ON a.department_id = d.id
          LEFT JOIN files f ON a.file_id = f.id
          WHERE a.user_id = ?
          ORDER BY a.created_at DESC
          LIMIT 10
        `, [user.id]).then(rows => rows.map(row => {
          let metadata = {};
          try { metadata = typeof row.metadata === 'string' ? JSON.parse(row.metadata || '{}') : (row.metadata || {}); } catch (e) { metadata = {}; }
          return { ...row, metadata };
        }));

        return res.json({
          role: 'faculty',
          stats: {
            totalFiles: myFiles?.count || 0,
            myFilesCount: myFiles?.count || 0,
            storageUsedBytes: myStorage?.bytes || 0,
            myFoldersCount: myFolders?.count || 0,
            sharedWithMe: sharedWithMe?.count || 0,
            starredCount: starredCount?.count || 0
          },
          recentFiles,
          recentActivity
        });
      }
    } catch (error) {
      console.error('Dashboard stats error:', error);
      res.status(500).json({ error: 'Failed to retrieve dashboard statistics.' });
    }
  },

  async getStorageAnalytics(req, res) {
    try {
      const user = req.user;
      const isAdmin = user.role_name === 'admin';
      const isHOD = user.role_name === 'hod';

      let filterSql = "WHERE f.deleted_at IS NULL";
      let filterParams = [];

      if (!isAdmin && isHOD) {
        filterSql += " AND f.department_id = ?";
        filterParams.push(user.department_id);
      } else if (!isAdmin && !isHOD) {
        filterSql += " AND (f.owner_id = ? OR f.department_id = ?)";
        filterParams.push(user.id, user.department_id || -1);
      }

      // Total Storage
      const totalStorageRes = await dbHelper.get(
        `SELECT COALESCE(SUM(f.size), 0) as total_bytes, COUNT(*) as file_count FROM files f ${filterSql}`,
        filterParams
      );

      // Storage by Department
      const byDepartment = await dbHelper.all(`
        SELECT d.id, d.name, d.code, 
               COALESCE(SUM(f.size), 0) as storage_bytes,
               COUNT(f.id) as file_count
        FROM departments d
        LEFT JOIN files f ON f.department_id = d.id AND f.deleted_at IS NULL
        GROUP BY d.id, d.name, d.code
        ORDER BY storage_bytes DESC
      `);

      // Storage by File Type Category
      const byType = await dbHelper.all(`
        SELECT f.file_type, 
               COALESCE(SUM(f.size), 0) as storage_bytes,
               COUNT(*) as count
        FROM files f
        ${filterSql}
        GROUP BY f.file_type
        ORDER BY storage_bytes DESC
      `, filterParams);

      // Top Largest Files in Repository
      const largestFiles = await dbHelper.all(`
        SELECT f.id, f.name, f.file_type, f.size, f.created_at, f.drive_link,
               COALESCE(u.full_name, 'Potta Devika') as owner_name,
               COALESCE(d.name, 'General') as department_name
        FROM files f
        LEFT JOIN users u ON f.owner_id = u.id
        LEFT JOIN departments d ON f.department_id = d.id
        ${filterSql}
        ORDER BY f.size DESC
        LIMIT 10
      `, filterParams);

      const totalQuota = 100 * 1024 * 1024 * 1024; // 100 GB default quota

      res.json({
        totalStorageBytes: totalStorageRes?.total_bytes || 0,
        totalFiles: totalStorageRes?.file_count || 0,
        storageQuotaBytes: totalQuota,
        availableStorageBytes: Math.max(0, totalQuota - (totalStorageRes?.total_bytes || 0)),
        usedPercentage: Math.min(100, Math.round(((totalStorageRes?.total_bytes || 0) / totalQuota) * 100 * 10) / 10),
        byDepartment,
        byType,
        largestFiles
      });
    } catch (error) {
      console.error('Storage analytics error:', error);
      res.status(500).json({ error: 'Failed to retrieve storage analytics.' });
    }
  }
};

module.exports = analyticsController;
