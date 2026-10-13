const { dbHelper } = require('../config/db');
const { checkFileAccess } = require('../middleware/auth');

const shareController = {
  async shareFile(req, res) {
    try {
      const { file_id } = req.params;
      const { user_ids, department_ids, permission = 'view_download' } = req.body;
      const user = req.user;

      const hasAccess = await checkFileAccess(file_id, user, 'edit');
      if (!hasAccess && user.role_name !== 'admin') {
        return res.status(403).json({ error: 'You do not have permission to share this file.' });
      }

      const file = await dbHelper.get("SELECT * FROM files WHERE id = ?", [file_id]);
      if (!file) {
        return res.status(404).json({ error: 'File not found.' });
      }

      if (user.role_name === 'hod') {
        const assignedIds = user.department_ids || [];
        if ((department_ids || []).some(id => !assignedIds.includes(Number(id)))) {
          return res.status(403).json({ error: 'You can only share files with your assigned departments.' });
        }
        for (const targetUserId of user_ids || []) {
          const targetUser = await dbHelper.get('SELECT department_id FROM users WHERE id = ?', [targetUserId]);
          if (!targetUser || !assignedIds.includes(targetUser.department_id)) {
            return res.status(403).json({ error: 'You can only share files with users in your assigned departments.' });
          }
        }
      }

      const validPerm = ['view', 'view_download', 'edit'].includes(permission) ? permission : 'view_download';
      let shareCount = 0;

      // Share with individual users
      if (Array.isArray(user_ids) && user_ids.length > 0) {
        for (const targetUserId of user_ids) {
          if (targetUserId == user.id) continue; // Don't share with self

          // Upsert share record
          const existing = await dbHelper.get(
            "SELECT id FROM shared_files WHERE file_id = ? AND shared_with_user = ?",
            [file_id, targetUserId]
          );

          if (existing) {
            await dbHelper.run(
              "UPDATE shared_files SET permission = ?, created_at = CURRENT_TIMESTAMP WHERE id = ?",
              [validPerm, existing.id]
            );
          } else {
            await dbHelper.run(`
              INSERT INTO shared_files (file_id, shared_by, shared_with_user, permission)
              VALUES (?, ?, ?, ?)
            `, [file_id, user.id, targetUserId, validPerm]);
          }

          // Send notification to recipient
          await dbHelper.run(`
            INSERT INTO notifications (user_id, title, message, link)
            VALUES (?, 'New File Shared', ?, ?)
          `, [
            targetUserId,
            `${user.full_name} shared "${file.name}" with you (${validPerm === 'edit' ? 'Can Edit' : validPerm === 'view_download' ? 'View & Download' : 'View Only'}).`,
            `/files?file_id=${file_id}`
          ]);

          shareCount++;
        }
      }

      // Share with departments
      if (Array.isArray(department_ids) && department_ids.length > 0) {
        for (const targetDeptId of department_ids) {
          const existing = await dbHelper.get(
            "SELECT id FROM shared_files WHERE file_id = ? AND shared_with_department = ?",
            [file_id, targetDeptId]
          );

          if (existing) {
            await dbHelper.run(
              "UPDATE shared_files SET permission = ?, created_at = CURRENT_TIMESTAMP WHERE id = ?",
              [validPerm, existing.id]
            );
          } else {
            await dbHelper.run(`
              INSERT INTO shared_files (file_id, shared_by, shared_with_department, permission)
              VALUES (?, ?, ?, ?)
            `, [file_id, user.id, targetDeptId, validPerm]);
          }

          // Notify department members
          const deptFaculty = await dbHelper.all("SELECT id FROM users WHERE department_id = ? AND id != ?", [targetDeptId, user.id]);
          const dept = await dbHelper.get("SELECT name FROM departments WHERE id = ?", [targetDeptId]);
          const deptName = dept ? dept.name : 'your department';

          for (const member of deptFaculty) {
            await dbHelper.run(`
              INSERT INTO notifications (user_id, title, message, link)
              VALUES (?, 'Department File Shared', ?, ?)
            `, [
              member.id,
              `${user.full_name} shared "${file.name}" with ${deptName}.`,
              `/files?file_id=${file_id}`
            ]);
          }

          shareCount++;
        }
      }

      // Activity log
      await dbHelper.run(`
        INSERT INTO activity_logs (user_id, action, file_id, department_id, metadata)
        VALUES (?, 'File Shared', ?, ?, ?)
      `, [user.id, file_id, file.department_id, JSON.stringify({ filename: file.name, permission: validPerm, user_count: (user_ids || []).length, dept_count: (department_ids || []).length })]);

      res.json({ message: `File shared successfully with ${shareCount} recipient(s).` });
    } catch (error) {
      console.error('Share file error:', error);
      res.status(500).json({ error: 'Failed to share file.' });
    }
  },

  async removeShare(req, res) {
    try {
      const { share_id } = req.params;
      const user = req.user;

      const share = await dbHelper.get(`
        SELECT sf.*, f.owner_id 
        FROM shared_files sf
        JOIN files f ON sf.file_id = f.id
        WHERE sf.id = ?
      `, [share_id]);

      if (!share) {
        return res.status(404).json({ error: 'Share record not found.' });
      }

      if (user.role_name !== 'admin' && share.owner_id !== user.id && share.shared_by !== user.id) {
        return res.status(403).json({ error: 'You do not have permission to revoke this share.' });
      }

      await dbHelper.run("DELETE FROM shared_files WHERE id = ?", [share_id]);

      res.json({ message: 'Access revoked successfully.' });
    } catch (error) {
      console.error('Remove share error:', error);
      res.status(500).json({ error: 'Failed to revoke sharing.' });
    }
  },

  async getSharedWithMe(req, res) {
    try {
      const user = req.user;
      const sql = `
        SELECT f.id, f.name, f.original_name, f.file_type, f.mime_type, f.size,
               f.storage_path, f.folder_id, f.owner_id, f.department_id,
               f.version, f.ocr_status, f.created_at, f.updated_at,
               u.full_name as owner_name, u.username as owner_username,
               d.name as department_name, d.code as department_code,
               sf.permission as shared_permission, sf.created_at as shared_at,
               sharer.full_name as shared_by_name,
               EXISTS(SELECT 1 FROM favorites fav WHERE fav.file_id = f.id AND fav.user_id = ?) as is_starred
        FROM shared_files sf
        JOIN files f ON sf.file_id = f.id
        JOIN users u ON f.owner_id = u.id
        JOIN users sharer ON sf.shared_by = sharer.id
        LEFT JOIN departments d ON f.department_id = d.id
        WHERE (sf.shared_with_user = ? OR sf.shared_with_department = ?)
          AND f.deleted_at IS NULL
          AND f.owner_id != ?
        ORDER BY sf.created_at DESC
      `;

      const files = await dbHelper.all(sql, [user.id, user.id, user.department_id || -1, user.id]);
      res.json({ files });
    } catch (error) {
      console.error('Get shared with me error:', error);
      res.status(500).json({ error: 'Failed to retrieve shared files.' });
    }
  }
};

module.exports = shareController;
