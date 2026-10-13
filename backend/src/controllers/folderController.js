const { dbHelper } = require('../config/db');

const folderController = {
  async getFolders(req, res) {
    try {
      const { parent_folder_id, department_id, scope } = req.query;
      const user = req.user;
      if (user.role_name === 'hod' && department_id &&
          !user.department_ids?.includes(Number(department_id))) {
        return res.status(403).json({ error: 'You are not assigned to the selected department.' });
      }

      let sql = `
        SELECT f.id, f.name, f.parent_folder_id, f.department_id, f.created_by, f.color, f.drive_link,
               f.created_at, f.updated_at,
               u.full_name as creator_name,
               d.name as department_name, d.code as department_code,
               (SELECT COUNT(*) FROM folders sub WHERE sub.parent_folder_id = f.id) as subfolder_count,
               (SELECT COUNT(*) FROM files file WHERE file.folder_id = f.id AND file.deleted_at IS NULL) as file_count
        FROM folders f
        JOIN users u ON f.created_by = u.id
        LEFT JOIN departments d ON f.department_id = d.id
        WHERE 1=1
      `;
      const params = [];

      if (parent_folder_id !== undefined && parent_folder_id !== 'all') {
        if (parent_folder_id === 'null' || parent_folder_id === '' || parent_folder_id === null) {
          sql += " AND f.parent_folder_id IS NULL";
        } else {
          sql += " AND f.parent_folder_id = ?";
          params.push(parent_folder_id);
        }
      }

      if (department_id) {
        sql += " AND f.department_id = ?";
        params.push(department_id);
      } else if (scope === 'my') {
        sql += " AND f.created_by = ?";
        params.push(user.id);
      } else if (user.role_name === 'faculty') {
        // Faculty sees department folders and their own folders
        sql += " AND (f.department_id = ? OR f.created_by = ?)";
        params.push(user.department_id || -1, user.id);
      } else if (user.role_name === 'hod') {
        // HOD sees department folders and their own folders
        sql += " AND (f.department_id = ? OR f.created_by = ?)";
        params.push(user.department_id || -1, user.id);
      }

      sql += " ORDER BY f.name ASC";

      const folders = await dbHelper.all(sql, params);
      res.json({ folders });
    } catch (error) {
      console.error('Get folders error:', error);
      res.status(500).json({ error: 'Failed to retrieve folders.' });
    }
  },

  async getFolderBreadcrumbs(req, res) {
    try {
      const { id } = req.params;
      const breadcrumbs = [];

      let currentId = id;
      while (currentId) {
        const folder = await dbHelper.get(`
          SELECT f.id, f.name, f.parent_folder_id, f.department_id, d.name as department_name
          FROM folders f
          LEFT JOIN departments d ON f.department_id = d.id
          WHERE f.id = ?
        `, [currentId]);

        if (!folder) break;
        if (req.user.role_name === 'hod' &&
            !req.user.department_ids?.includes(folder.department_id)) {
          return res.status(404).json({ error: 'Folder not found.' });
        }
        breadcrumbs.unshift(folder);
        currentId = folder.parent_folder_id;
      }

      res.json({ breadcrumbs });
    } catch (error) {
      console.error('Get breadcrumbs error:', error);
      res.status(500).json({ error: 'Failed to get folder path.' });
    }
  },

  async getFolderTree(req, res) {
    try {
      const user = req.user;
      let sql = `
        SELECT f.id, f.name, f.parent_folder_id, f.department_id, d.code as department_code
        FROM folders f
        LEFT JOIN departments d ON f.department_id = d.id
        WHERE 1=1
      `;
      const params = [];

      if (user.role_name === 'faculty') {
        sql += " AND (f.department_id = ? OR f.created_by = ?)";
        params.push(user.department_id || -1, user.id);
      } else if (user.role_name === 'hod') {
        sql += " AND (f.department_id = ? OR f.created_by = ?)";
        params.push(user.department_id || -1, user.id);
      }

      sql += " ORDER BY f.name ASC";
      const allFolders = await dbHelper.all(sql, params);

      res.json({ folders: allFolders });
    } catch (error) {
      console.error('Get folder tree error:', error);
      res.status(500).json({ error: 'Failed to retrieve folder hierarchy.' });
    }
  },

  async createFolder(req, res) {
    try {
      const { name, parent_folder_id, department_id, color } = req.body;
      const user = req.user;

      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Folder name is required.' });
      }

      let deptId = department_id || user.department_id || null;

      // If parent folder is specified, inherit parent's department_id
      if (parent_folder_id) {
        const parentFolder = await dbHelper.get("SELECT id, department_id FROM folders WHERE id = ?", [parent_folder_id]);
        if (!parentFolder) return res.status(404).json({ error: 'Parent folder not found.' });
        if (user.role_name === 'hod' &&
            !user.department_ids?.includes(parentFolder.department_id)) {
          return res.status(403).json({ error: 'You cannot create folders under an unrelated department.' });
        }
        if (parentFolder && parentFolder.department_id) {
          deptId = parentFolder.department_id;
        }
      }
      if (user.role_name === 'hod' && deptId && !user.department_ids?.includes(Number(deptId))) {
        return res.status(403).json({ error: 'You can only create folders in your assigned departments.' });
      }

      const result = await dbHelper.run(`
        INSERT INTO folders (name, parent_folder_id, department_id, created_by, color)
        VALUES (?, ?, ?, ?, ?)
      `, [name.trim(), parent_folder_id || null, deptId, user.id, color || 'blue']);

      const newFolderId = result.lastID;

      await dbHelper.run(
        "INSERT INTO activity_logs (user_id, action, folder_id, department_id, metadata) VALUES (?, ?, ?, ?, ?)",
        [user.id, 'Folder Created', newFolderId, deptId, JSON.stringify({ name: name.trim() })]
      );

      res.status(201).json({
        message: 'Folder created successfully.',
        folder: {
          id: newFolderId,
          name: name.trim(),
          parent_folder_id: parent_folder_id || null,
          department_id: deptId,
          created_by: user.id
        }
      });
    } catch (error) {
      console.error('Create folder error:', error);
      res.status(500).json({ error: 'Failed to create folder.' });
    }
  },

  async renameFolder(req, res) {
    try {
      const { id } = req.params;
      const { name } = req.body;
      const user = req.user;

      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'New folder name is required.' });
      }

      const folder = await dbHelper.get("SELECT * FROM folders WHERE id = ?", [id]);
      if (!folder) {
        return res.status(404).json({ error: 'Folder not found.' });
      }

      // Check permission
      if (user.role_name !== 'admin' && folder.created_by !== user.id &&
          !(user.role_name === 'hod' && user.department_ids?.includes(folder.department_id))) {
        return res.status(403).json({ error: 'You do not have permission to rename this folder.' });
      }

      await dbHelper.run(
        "UPDATE folders SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [name.trim(), id]
      );

      await dbHelper.run(
        "INSERT INTO activity_logs (user_id, action, folder_id, department_id, metadata) VALUES (?, ?, ?, ?, ?)",
        [user.id, 'Folder Renamed', id, folder.department_id, JSON.stringify({ old_name: folder.name, new_name: name.trim() })]
      );

      res.json({ message: 'Folder renamed successfully.' });
    } catch (error) {
      console.error('Rename folder error:', error);
      res.status(500).json({ error: 'Failed to rename folder.' });
    }
  },

  async moveFolder(req, res) {
    try {
      const { id } = req.params;
      const { new_parent_id } = req.body;

      if (id == new_parent_id) {
        return res.status(400).json({ error: 'Cannot move folder into itself.' });
      }

      const folder = await dbHelper.get("SELECT * FROM folders WHERE id = ?", [id]);
      if (!folder) {
        return res.status(404).json({ error: 'Folder not found.' });
      }
      if (req.user.role_name !== 'admin' && folder.created_by !== req.user.id &&
          !(req.user.role_name === 'hod' && req.user.department_ids?.includes(folder.department_id))) {
        return res.status(403).json({ error: 'You do not have permission to move this folder.' });
      }
      if (new_parent_id) {
        const parent = await dbHelper.get('SELECT id, department_id FROM folders WHERE id = ?', [new_parent_id]);
        if (!parent) return res.status(404).json({ error: 'Destination folder not found.' });
        if (parent.department_id !== folder.department_id) {
          return res.status(400).json({ error: 'Folders can only be moved within the same department.' });
        }
      }

      await dbHelper.run(
        "UPDATE folders SET parent_folder_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [new_parent_id || null, id]
      );

      await dbHelper.run(
        "INSERT INTO activity_logs (user_id, action, folder_id, department_id, metadata) VALUES (?, ?, ?, ?, ?)",
        [req.user.id, 'Folder Moved', id, folder.department_id, JSON.stringify({ new_parent_id })]
      );

      res.json({ message: 'Folder moved successfully.' });
    } catch (error) {
      console.error('Move folder error:', error);
      res.status(500).json({ error: 'Failed to move folder.' });
    }
  },

  async deleteFolder(req, res) {
    try {
      const { id } = req.params;
      const folder = await dbHelper.get("SELECT * FROM folders WHERE id = ?", [id]);
      if (!folder) {
        return res.status(404).json({ error: 'Folder not found.' });
      }

      // Check permission
      if (req.user.role_name !== 'admin' && folder.created_by !== req.user.id &&
          !(req.user.role_name === 'hod' && req.user.department_ids?.includes(folder.department_id))) {
        return res.status(403).json({ error: 'You do not have permission to delete this folder.' });
      }

      // Soft delete files inside this folder
      await dbHelper.run(
        "UPDATE files SET deleted_at = CURRENT_TIMESTAMP WHERE folder_id = ?",
        [id]
      );

      // Delete folder record
      await dbHelper.run("DELETE FROM folders WHERE id = ?", [id]);

      await dbHelper.run(
        "INSERT INTO activity_logs (user_id, action, folder_id, department_id, metadata) VALUES (?, ?, ?, ?, ?)",
        [req.user.id, 'Folder Deleted', id, folder.department_id, JSON.stringify({ name: folder.name })]
      );

      res.json({ message: 'Folder and contents moved to Trash.' });
    } catch (error) {
      console.error('Delete folder error:', error);
      res.status(500).json({ error: 'Failed to delete folder.' });
    }
  }
};

module.exports = folderController;
