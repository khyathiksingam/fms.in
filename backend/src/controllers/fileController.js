const path = require('path');
const fs = require('fs');
const { dbHelper } = require('../config/db');
const { getStoragePath, deleteStoredFile } = require('../services/storageService');
const { processFileOCR } = require('../services/ocrService');
const { checkFileAccess } = require('../middleware/auth');

function getFileTypeCategory(ext, mimeType) {
  ext = ext.toLowerCase().replace('.', '');
  if (['pdf'].includes(ext)) return 'pdf';
  if (['doc', 'docx', 'odt', 'rtf', 'txt', 'md'].includes(ext)) return 'document';
  if (['xls', 'xlsx', 'csv', 'ods'].includes(ext)) return 'spreadsheet';
  if (['ppt', 'pptx', 'odp'].includes(ext)) return 'presentation';
  if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp'].includes(ext)) return 'image';
  if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)) return 'video';
  if (['mp3', 'wav', 'ogg', 'm4a', 'flac'].includes(ext)) return 'audio';
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'archive';
  return 'other';
}
const fileController = {
  async uploadFiles(req, res) {
    try {
      const files = req.files || (req.file ? [req.file] : []);
      const { folder_id, department_id, visibility } = req.body;
      const user = req.user;
      const fileVisibility = visibility === 'private' ? 'private' : 'public';

      if (!files || files.length === 0) {
        return res.status(400).json({ error: 'No files were provided for upload.' });
      }

      let targetDeptId = department_id || user.department_id || null;

      // If uploaded inside a folder, inherit folder's department
      if (folder_id && folder_id !== 'null' && folder_id !== '') {
        const folder = await dbHelper.get("SELECT department_id FROM folders WHERE id = ?", [folder_id]);
        if (folder && folder.department_id) {
          targetDeptId = folder.department_id;
        }
      }
      if (user.role_name === 'hod' && targetDeptId &&
          !user.department_ids?.includes(Number(targetDeptId))) {
        return res.status(403).json({ error: 'You can only upload files to your assigned departments.' });
      }

      const uploadedResults = [];

      for (const file of files) {
        const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
        const ext = path.extname(originalName).toLowerCase();
        const fileTypeCategory = getFileTypeCategory(ext, file.mimetype);
        const storedFilename = file.filename;
        const storedFullPath = getStoragePath(storedFilename);

        const result = await dbHelper.run(`
          INSERT INTO files (
            name, original_name, file_type, mime_type, size,
            storage_path, folder_id, owner_id, department_id,
            version, ocr_status, visibility, approval_status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'pending', ?, ?)
        `, [
          originalName,
          originalName,
          fileTypeCategory,
          file.mimetype || 'application/octet-stream',
          file.size,
          storedFilename,
          (folder_id && folder_id !== 'null' && folder_id !== '') ? folder_id : null,
          user.id,
          targetDeptId,
          fileVisibility,
          user.role_name === 'faculty' ? 'pending' : 'approved'
        ]);

        const insertedFile = result.lastID
          ? { id: result.lastID }
          : await dbHelper.get('SELECT id FROM files WHERE storage_path = ?', [storedFilename]);
        if (!insertedFile) throw new Error('Uploaded file record could not be retrieved.');
        const fileId = insertedFile.id;

        // Record initial version 1
        await dbHelper.run(`
          INSERT INTO file_versions (file_id, version_number, storage_path, size, uploaded_by, note)
          VALUES (?, 1, ?, ?, ?, 'Initial upload')
        `, [fileId, storedFilename, file.size, user.id]);

        // Trigger asynchronous background OCR indexing
        processFileOCR(fileId, storedFullPath, file.mimetype).catch(err => {
          console.error(`Error in background OCR for file ${fileId}:`, err);
        });

        // Activity log
        await dbHelper.run(`
          INSERT INTO activity_logs (user_id, action, file_id, folder_id, department_id, metadata)
          VALUES (?, 'File Uploaded', ?, ?, ?, ?)
        `, [
          user.id,
          fileId,
          (folder_id && folder_id !== 'null') ? folder_id : null,
          targetDeptId,
          JSON.stringify({ name: originalName, size: file.size, type: fileTypeCategory })
        ]);

        uploadedResults.push({
          id: fileId,
          name: originalName,
          size: file.size,
          file_type: fileTypeCategory,
          ocr_status: 'pending'
        });
      }

      // In-app Notification for user
      await dbHelper.run(`
        INSERT INTO notifications (user_id, title, message)
        VALUES (?, 'Upload Complete', ?)
      `, [
        user.id,
        files.length === 1 
          ? `File "${uploadedResults[0].name}" was uploaded successfully.` 
          : `${files.length} files were uploaded successfully.`
      ]);

      res.status(201).json({
        message: 'File(s) uploaded successfully.',
        files: uploadedResults
      });
    } catch (error) {
      console.error('File upload error:', error);
      res.status(500).json({ error: 'File upload failed: ' + error.message });
    }
  },

  async getFiles(req, res) {
    try {
      const user = req.user;
      const {
        scope, // 'all', 'my', 'department', 'shared', 'favorites', 'recent', 'trash'
        folder_id,
        department_id,
        file_type,
        search,
        sort = 'newest', // 'name_asc', 'name_desc', 'newest', 'oldest', 'largest', 'smallest', 'type'
        page = 1,
        limit = 50
      } = req.query;

      if (user.role_name === 'hod' && department_id &&
          !user.department_ids?.includes(Number(department_id))) {
        return res.status(403).json({ error: 'You are not assigned to the selected department.' });
      }

      let sql = `
        SELECT f.id, f.name, f.original_name, f.file_type, f.mime_type, f.size,
               f.storage_path, f.folder_id, f.owner_id, f.department_id, f.drive_link,
               COALESCE(f.visibility, 'public') as visibility, f.approval_status, f.reviewed_at, f.review_note,
               f.version, f.ocr_status, f.created_at, f.updated_at, f.deleted_at,
               COALESCE(u.full_name, 'Potta Devika') as owner_name, u.username as owner_username,
               d.name as department_name, d.code as department_code,
               (SELECT c.id FROM syllabus_catalog c WHERE c.file_id = f.id) AS catalogue_id,
               fold.name as folder_name,
               EXISTS(SELECT 1 FROM favorites fav WHERE fav.file_id = f.id AND fav.user_id = ?) as is_starred,
               (SELECT COUNT(*) FROM shared_files sf WHERE sf.file_id = f.id) as share_count
        FROM files f
        LEFT JOIN users u ON f.owner_id = u.id
        LEFT JOIN departments d ON f.department_id = d.id
        LEFT JOIN folders fold ON f.folder_id = fold.id
        WHERE 1=1
      `;
      const params = [user.id];

      // Trash vs Active files
      if (scope === 'trash') {
        sql += " AND f.deleted_at IS NOT NULL";
        // Permissions for Trash
        if (user.role_name === 'faculty') {
          sql += " AND f.owner_id = ?";
          params.push(user.id);
        } else if (user.role_name === 'hod') {
          sql += " AND (f.department_id = ? OR f.owner_id = ?)";
          params.push(user.department_id || -1, user.id);
        }
      } else {
        sql += " AND f.deleted_at IS NULL";

        // Scope filter
        if (scope === 'favorites') {
          sql += " AND EXISTS(SELECT 1 FROM favorites fav WHERE fav.file_id = f.id AND fav.user_id = ?)";
          params.push(user.id);
        } else if (scope === 'shared') {
          sql += ` AND (
            EXISTS(SELECT 1 FROM shared_files sf WHERE sf.file_id = f.id AND sf.shared_with_user = ?)
            OR EXISTS(SELECT 1 FROM shared_files sf WHERE sf.file_id = f.id AND sf.shared_with_department = ?)
          ) AND f.owner_id != ?`;
          params.push(user.id, user.department_id || -1, user.id);
        } else if (scope === 'recent') {
          // Handled via sorting & date filter
        } else if (scope === 'my') {
          sql += " AND f.owner_id = ?";
          params.push(user.id);
        } else if (scope === 'department') {
          sql += " AND f.department_id = ?";
          params.push(department_id || user.department_id || -1);
        } else {
          // General file browsing RBAC:
          if (user.role_name === 'faculty') {
            sql += ` AND (
              f.owner_id = ? 
              OR (COALESCE(f.visibility, 'public') = 'public' AND (f.department_id = ? OR f.department_id IS NULL))
              OR EXISTS(SELECT 1 FROM shared_files sf WHERE sf.file_id = f.id AND (sf.shared_with_user = ? OR sf.shared_with_department = ?))
            )`;
            params.push(user.id, user.department_id || -1, user.id, user.department_id || -1);
          } else if (user.role_name === 'hod') {
            if (!folder_id && !department_id) {
              sql += ` AND (
                f.department_id = ? 
                OR f.owner_id = ?
                OR (COALESCE(f.visibility, 'public') = 'public' AND f.department_id = ?)
              )`;
              params.push(user.department_id || -1, user.id, user.department_id || -1);
            }
          }
        }

        // Folder filter
        if (folder_id !== undefined && folder_id !== 'all' && scope !== 'favorites' && scope !== 'shared' && scope !== 'recent') {
          if (folder_id === 'null' || folder_id === '' || folder_id === null) {
            sql += " AND f.folder_id IS NULL";
          } else {
            sql += " AND f.folder_id = ?";
            params.push(folder_id);
          }
        }

        // Department filter
        if (department_id && scope !== 'department') {
          sql += " AND f.department_id = ?";
          params.push(department_id);
        }
      }

      if (user.role_name === 'hod') {
        sql += ' AND (f.owner_id = ? OR f.department_id = ?)';
        params.push(user.id, user.department_id || -1);
      }

      // File type filter
      if (file_type && file_type !== 'all') {
        sql += " AND f.file_type = ?";
        params.push(file_type);
      }

      // Keyword search
      if (search && search.trim()) {
        sql += " AND (LOWER(f.name) LIKE ? OR LOWER(f.original_name) LIKE ?)";
        const term = `%${search.trim().toLowerCase()}%`;
        params.push(term, term);
      }

      // Sorting
      switch (sort) {
        case 'name_asc':
          sql += " ORDER BY f.name ASC";
          break;
        case 'name_desc':
          sql += " ORDER BY f.name DESC";
          break;
        case 'oldest':
          sql += " ORDER BY f.created_at ASC";
          break;
        case 'largest':
          sql += " ORDER BY f.size DESC";
          break;
        case 'smallest':
          sql += " ORDER BY f.size ASC";
          break;
        case 'type':
          sql += " ORDER BY f.file_type ASC, f.name ASC";
          break;
        case 'newest':
        default:
          sql += " ORDER BY f.created_at DESC";
          break;
      }

      // Count total for pagination
      const countSql = `SELECT COUNT(*) as total FROM (${sql})`;
      const countRes = await dbHelper.get(countSql, params);
      const total = countRes ? countRes.total : 0;

      // Pagination
      const pageNum = parseInt(page) || 1;
      const limitNum = parseInt(limit) || 50;
      const offset = (pageNum - 1) * limitNum;

      sql += ` LIMIT ${limitNum} OFFSET ${offset}`;

      const files = await dbHelper.all(sql, params);

      res.json({
        files,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum)
        }
      });
    } catch (error) {
      console.error('Get files error:', error);
      res.status(500).json({ error: 'Failed to retrieve files.' });
    }
  },

  async getFileById(req, res) {
    try {
      const { id } = req.params;
      const user = req.user;

      const hasAccess = await checkFileAccess(id, user, 'view');
      if (!hasAccess) {
        return res.status(403).json({ error: 'You do not have permission to access this file.' });
      }

      const file = await dbHelper.get(`
        SELECT f.*, 
               u.full_name as owner_name, u.email as owner_email,
               d.name as department_name, d.code as department_code,
               fold.name as folder_name,
               EXISTS(SELECT 1 FROM favorites fav WHERE fav.file_id = f.id AND fav.user_id = ?) as is_starred
        FROM files f
        JOIN users u ON f.owner_id = u.id
        LEFT JOIN departments d ON f.department_id = d.id
        LEFT JOIN folders fold ON f.folder_id = fold.id
        WHERE f.id = ?
      `, [user.id, id]);

      if (!file) {
        return res.status(404).json({ error: 'File not found.' });
      }

      // Get sharing list
      const shares = await dbHelper.all(`
        SELECT sf.*, 
               u.full_name as shared_with_user_name, u.email as shared_with_user_email,
               d.name as shared_with_department_name
        FROM shared_files sf
        LEFT JOIN users u ON sf.shared_with_user = u.id
        LEFT JOIN departments d ON sf.shared_with_department = d.id
        WHERE sf.file_id = ?
      `, [id]);

      // Get versions
      const versions = await dbHelper.all(`
        SELECT fv.*, u.full_name as uploader_name
        FROM file_versions fv
        JOIN users u ON fv.uploaded_by = u.id
        WHERE fv.file_id = ?
        ORDER BY fv.version_number DESC
      `, [id]);

      res.json({ file, shares, versions });
    } catch (error) {
      console.error('Get file by id error:', error);
      res.status(500).json({ error: 'Failed to retrieve file details.' });
    }
  },

  async downloadFile(req, res) {
    try {
      const { id } = req.params;
      const user = req.user;

      const hasAccess = await checkFileAccess(id, user, 'download');
      if (!hasAccess) {
        return res.status(403).json({ error: 'You do not have permission to download this file.' });
      }

      const file = await dbHelper.get("SELECT * FROM files WHERE id = ?", [id]);
      if (!file) {
        return res.status(404).json({ error: 'File not found.' });
      }

      const fullPath = getStoragePath(file.storage_path);
      if (!fs.existsSync(fullPath)) {
        return res.status(404).json({ error: 'Physical file not found in storage.' });
      }

      // Log download activity
      await dbHelper.run(`
        INSERT INTO activity_logs (user_id, action, file_id, department_id, metadata)
        VALUES (?, 'File Downloaded', ?, ?, ?)
      `, [user.id, file.id, file.department_id, JSON.stringify({ name: file.name })]);

      // Always stream the real bytes on disk. The database size can drift from the
      // stored file (e.g. a truncated or partially written upload), so we rely on the
      // actual file size for Content-Length to keep the response consistent and avoid
      // terminating the socket mid-download.
      const stat = fs.statSync(fullPath);

      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.original_name)}"`);
      res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
      res.setHeader('Content-Length', stat.size);

      const fileStream = fs.createReadStream(fullPath);
      fileStream.on('error', (streamError) => {
        console.error('Download stream error:', streamError);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Download failed.' });
        } else {
          res.destroy(streamError);
        }
      });
      fileStream.pipe(res);
    } catch (error) {
      console.error('Download error:', error);
      res.status(500).json({ error: 'Download failed.' });
    }
  },

  async previewFile(req, res) {
    try {
      const { id } = req.params;
      const user = req.user;

      const hasAccess = await checkFileAccess(id, user, 'view');
      if (!hasAccess) {
        return res.status(403).json({ error: 'You do not have permission to preview this file.' });
      }

      const file = await dbHelper.get("SELECT * FROM files WHERE id = ?", [id]);
      if (!file) {
        return res.status(404).json({ error: 'File not found.' });
      }

      const fullPath = getStoragePath(file.storage_path);
      if (!fs.existsSync(fullPath)) {
        return res.status(404).json({ error: 'File not found on storage server.' });
      }

      // Log preview activity occasionally
      await dbHelper.run(`
        INSERT INTO activity_logs (user_id, action, file_id, department_id, metadata)
        VALUES (?, 'File Previewed', ?, ?, ?)
      `, [user.id, file.id, file.department_id, JSON.stringify({ name: file.name })]);

      // Support Range headers for HTML5 video/audio streaming
      const stat = fs.statSync(fullPath);
      const fileSize = stat.size;
      const range = req.headers.range;

      if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = (end - start) + 1;
        const stream = fs.createReadStream(fullPath, { start, end });
        const head = {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize,
          'Content-Type': file.mime_type,
        };
        res.writeHead(206, head);
        stream.pipe(res);
      } else {
        res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
        res.setHeader('Content-Length', fileSize);
        res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file.original_name)}"`);
        const stream = fs.createReadStream(fullPath);
        stream.pipe(res);
      }
    } catch (error) {
      console.error('Preview error:', error);
      res.status(500).json({ error: 'Failed to preview file.' });
    }
  },

  async renameFile(req, res) {
    try {
      const { id } = req.params;
      const { name } = req.body;
      const user = req.user;

      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'New file name is required.' });
      }

      const hasAccess = await checkFileAccess(id, user, 'edit');
      if (!hasAccess) {
        return res.status(403).json({ error: 'You do not have permission to rename this file.' });
      }

      const file = await dbHelper.get("SELECT * FROM files WHERE id = ?", [id]);
      if (!file) {
        return res.status(404).json({ error: 'File not found.' });
      }

      await dbHelper.run(
        "UPDATE files SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [name.trim(), id]
      );

      await dbHelper.run(`
        INSERT INTO activity_logs (user_id, action, file_id, department_id, metadata)
        VALUES (?, 'File Renamed', ?, ?, ?)
      `, [user.id, id, file.department_id, JSON.stringify({ old_name: file.name, new_name: name.trim() })]);

      res.json({ message: 'File renamed successfully.' });
    } catch (error) {
      console.error('Rename file error:', error);
      res.status(500).json({ error: 'Failed to rename file.' });
    }
  },

  async moveFile(req, res) {
    try {
      const { id } = req.params;
      const { folder_id, department_id } = req.body;
      const user = req.user;

      const hasAccess = await checkFileAccess(id, user, 'edit');
      if (!hasAccess) {
        return res.status(403).json({ error: 'You do not have permission to move this file.' });
      }

      const file = await dbHelper.get("SELECT * FROM files WHERE id = ?", [id]);
      if (!file) {
        return res.status(404).json({ error: 'File not found.' });
      }

      let newDeptId = department_id || file.department_id;
      if (folder_id) {
        const targetFolder = await dbHelper.get("SELECT department_id FROM folders WHERE id = ?", [folder_id]);
        if (targetFolder && targetFolder.department_id) {
          newDeptId = targetFolder.department_id;
        }
      }

      await dbHelper.run(`
        UPDATE files 
        SET folder_id = ?, department_id = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `, [folder_id || null, newDeptId, id]);

      await dbHelper.run(`
        INSERT INTO activity_logs (user_id, action, file_id, folder_id, department_id, metadata)
        VALUES (?, 'File Moved', ?, ?, ?, ?)
      `, [user.id, id, folder_id || null, newDeptId, JSON.stringify({ filename: file.name })]);

      res.json({ message: 'File moved successfully.' });
    } catch (error) {
      console.error('Move file error:', error);
      res.status(500).json({ error: 'Failed to move file.' });
    }
  },

  async toggleStar(req, res) {
    try {
      const { id } = req.params;
      const user = req.user;

      const existing = await dbHelper.get(
        "SELECT id FROM favorites WHERE user_id = ? AND file_id = ?",
        [user.id, id]
      );

      if (existing) {
        await dbHelper.run("DELETE FROM favorites WHERE user_id = ? AND file_id = ?", [user.id, id]);
        res.json({ is_starred: false, message: 'Removed from starred favorites.' });
      } else {
        await dbHelper.run("INSERT INTO favorites (user_id, file_id) VALUES (?, ?)", [user.id, id]);
        res.json({ is_starred: true, message: 'Added to starred favorites.' });
      }
    } catch (error) {
      console.error('Toggle star error:', error);
      res.status(500).json({ error: 'Failed to update star status.' });
    }
  },

  async deleteFile(req, res) {
    try {
      const { id } = req.params;
      const user = req.user;

      const file = await dbHelper.get("SELECT * FROM files WHERE id = ?", [id]);
      if (!file) {
        return res.status(404).json({ error: 'File not found.' });
      }

      // Check delete permission (owner, HOD for dept, or admin)
      const canDelete = user.role_name === 'admin' || 
                        file.owner_id === user.id || 
                        (user.role_name === 'hod' && user.department_ids?.includes(file.department_id));

      if (!canDelete) {
        return res.status(403).json({ error: 'You do not have permission to delete this file.' });
      }

      // Move to Trash (Soft delete)
      await dbHelper.run(
        "UPDATE files SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [id]
      );

      await dbHelper.run(`
        INSERT INTO activity_logs (user_id, action, file_id, department_id, metadata)
        VALUES (?, 'File Moved to Trash', ?, ?, ?)
      `, [user.id, id, file.department_id, JSON.stringify({ filename: file.name })]);

      res.json({ message: 'File moved to Trash.' });
    } catch (error) {
      console.error('Delete file error:', error);
      res.status(500).json({ error: 'Failed to delete file.' });
    }
  },

  async batchMoveToTrash(req, res) {
    try {
      const user = req.user;
      const { file_ids } = req.body;

      if (!file_ids || !Array.isArray(file_ids) || file_ids.length === 0) {
        return res.status(400).json({ error: 'No files specified.' });
      }

      let deletedCount = 0;
      for (const id of file_ids) {
        const file = await dbHelper.get("SELECT * FROM files WHERE id = ?", [id]);
        if (file && (user.role_name === 'admin' || file.owner_id === user.id || (user.role_name === 'hod' && user.department_ids?.includes(file.department_id)))) {
          await dbHelper.run("UPDATE files SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [id]);
          deletedCount++;
        }
      }

      await dbHelper.run(`
        INSERT INTO activity_logs (user_id, action, department_id, metadata)
        VALUES (?, 'Batch Moved to Trash', ?, ?)
      `, [user.id, user.department_id, JSON.stringify({ count: deletedCount })]);

      res.json({ success: true, count: deletedCount, message: `${deletedCount} file(s) moved to Trash.` });
    } catch (error) {
      console.error('Batch trash error:', error);
      res.status(500).json({ error: 'Failed to delete selected files.' });
    }
  },

  async batchChangeVisibility(req, res) {
    try {
      const user = req.user;
      const { file_ids, visibility } = req.body;

      if (!file_ids || !Array.isArray(file_ids) || file_ids.length === 0) {
        return res.status(400).json({ error: 'No files specified.' });
      }

      const newVisibility = visibility === 'private' ? 'private' : 'public';
      let updatedCount = 0;
      for (const id of file_ids) {
        const file = await dbHelper.get("SELECT * FROM files WHERE id = ?", [id]);
        if (file && (user.role_name === 'admin' || file.owner_id === user.id)) {
          await dbHelper.run("UPDATE files SET visibility = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [newVisibility, id]);
          updatedCount++;
        }
      }

      res.json({ success: true, count: updatedCount, message: `${updatedCount} file(s) marked as ${newVisibility}.` });
    } catch (error) {
      console.error('Batch visibility error:', error);
      res.status(500).json({ error: 'Failed to update visibility.' });
    }
  },

  async restoreFile(req, res) {
    try {
      const { id } = req.params;
      const user = req.user;

      const file = await dbHelper.get("SELECT * FROM files WHERE id = ?", [id]);
      if (!file) {
        return res.status(404).json({ error: 'File not found.' });
      }

      await dbHelper.run(
        "UPDATE files SET deleted_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [id]
      );

      await dbHelper.run(`
        INSERT INTO activity_logs (user_id, action, file_id, department_id, metadata)
        VALUES (?, 'File Restored', ?, ?, ?)
      `, [user.id, id, file.department_id, JSON.stringify({ filename: file.name })]);

      res.json({ message: 'File restored successfully from Trash.' });
    } catch (error) {
      console.error('Restore file error:', error);
      res.status(500).json({ error: 'Failed to restore file.' });
    }
  },

  async restoreAllTrash(req, res) {
    try {
      const user = req.user;
      let sql = "SELECT * FROM files WHERE deleted_at IS NOT NULL";
      const params = [];

      if (user.role_name === 'faculty') {
        sql += " AND owner_id = ?";
        params.push(user.id);
      } else if (user.role_name === 'hod') {
        sql += " AND (department_id = ? OR owner_id = ?)";
        params.push(user.department_id || -1, user.id);
      }

      const files = await dbHelper.all(sql, params);
      if (files.length === 0) {
        return res.json({ message: 'No files in Trash to restore.', count: 0 });
      }

      for (const f of files) {
        await dbHelper.run("UPDATE files SET deleted_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [f.id]);
      }

      await dbHelper.run(`
        INSERT INTO activity_logs (user_id, action, department_id, metadata)
        VALUES (?, 'All Files Restored from Trash', ?, ?)
      `, [user.id, user.department_id, JSON.stringify({ count: files.length })]);

      res.json({ success: true, count: files.length, message: `All ${files.length} file(s) successfully restored from Trash.` });
    } catch (error) {
      console.error('Restore all trash error:', error);
      res.status(500).json({ error: 'Failed to restore all files from trash.' });
    }
  },

  async restoreSelectedTrash(req, res) {
    try {
      const user = req.user;
      const { file_ids } = req.body;

      if (!file_ids || !Array.isArray(file_ids) || file_ids.length === 0) {
        return res.status(400).json({ error: 'No files specified for restoration.' });
      }

      let restoredCount = 0;
      for (const id of file_ids) {
        const file = await dbHelper.get("SELECT * FROM files WHERE id = ?", [id]);
        if (file && (user.role_name === 'admin' || file.owner_id === user.id || (user.role_name === 'hod' && user.department_ids?.includes(file.department_id)))) {
          await dbHelper.run("UPDATE files SET deleted_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [id]);
          restoredCount++;
        }
      }

      res.json({ success: true, count: restoredCount, message: `${restoredCount} file(s) restored successfully.` });
    } catch (error) {
      console.error('Restore selected trash error:', error);
      res.status(500).json({ error: 'Failed to restore selected files.' });
    }
  },

  async permanentlyDeleteFile(req, res) {
    try {
      const { id } = req.params;
      const user = req.user;

      const file = await dbHelper.get("SELECT * FROM files WHERE id = ?", [id]);
      if (!file) {
        return res.status(404).json({ error: 'File not found.' });
      }

      const canPermDelete = user.role_name === 'admin' || file.owner_id === user.id;
      if (!canPermDelete) {
        return res.status(403).json({ error: 'Only Admin or file owner can permanently delete files.' });
      }

      // Delete physical file from storage
      deleteStoredFile(file.storage_path);

      // Delete physical version files
      const versions = await dbHelper.all("SELECT storage_path FROM file_versions WHERE file_id = ?", [id]);
      for (const v of versions) {
        if (v.storage_path !== file.storage_path) {
          deleteStoredFile(v.storage_path);
        }
      }

      // Delete DB records (cascade deletes versions, permissions, favorites, shares)
      await dbHelper.run("DELETE FROM files WHERE id = ?", [id]);

      await dbHelper.run(`
        INSERT INTO activity_logs (user_id, action, department_id, metadata)
        VALUES (?, 'File Permanently Deleted', ?, ?)
      `, [user.id, file.department_id, JSON.stringify({ filename: file.name })]);

      res.json({ message: 'File permanently deleted.' });
    } catch (error) {
      console.error('Permanent delete error:', error);
      res.status(500).json({ error: 'Failed to permanently delete file.' });
    }
  },

  async emptyTrash(req, res) {
    try {
      const user = req.user;
      let sql = "SELECT * FROM files WHERE deleted_at IS NOT NULL";
      const params = [];

      if (user.role_name === 'faculty') {
        sql += " AND owner_id = ?";
        params.push(user.id);
      } else if (user.role_name === 'hod') {
        sql += " AND (department_id = ? OR owner_id = ?)";
        params.push(user.department_id || -1, user.id);
      }

      const filesToDelete = await dbHelper.all(sql, params);

      for (const file of filesToDelete) {
        deleteStoredFile(file.storage_path);
        await dbHelper.run("DELETE FROM files WHERE id = ?", [file.id]);
      }

      await dbHelper.run(`
        INSERT INTO activity_logs (user_id, action, department_id, metadata)
        VALUES (?, 'Trash Emptied', ?, ?)
      `, [user.id, user.department_id, JSON.stringify({ count: filesToDelete.length })]);

      res.json({ message: `${filesToDelete.length} files permanently deleted.` });
    } catch (error) {
      console.error('Empty trash error:', error);
      res.status(500).json({ error: 'Failed to empty trash.' });
    }
  },

  async toggleVisibility(req, res) {
    try {
      const { id } = req.params;
      const { visibility } = req.body;
      const user = req.user;

      const file = await dbHelper.get("SELECT * FROM files WHERE id = ?", [id]);
      if (!file) {
        return res.status(404).json({ error: 'File not found.' });
      }

      if (user.role_name !== 'admin' && file.owner_id !== user.id) {
        return res.status(403).json({ error: 'You do not have permission to change visibility for this file.' });
      }

      const newVisibility = visibility === 'private' ? 'private' : 'public';
      await dbHelper.run("UPDATE files SET visibility = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [newVisibility, id]);

      await dbHelper.run(`
        INSERT INTO activity_logs (user_id, action, file_id, department_id, metadata)
        VALUES (?, 'File Visibility Changed', ?, ?, ?)
      `, [user.id, id, file.department_id, JSON.stringify({ visibility: newVisibility, name: file.name })]);

      res.json({ success: true, visibility: newVisibility, message: `File is now ${newVisibility}.` });
    } catch (error) {
      console.error('Toggle visibility error:', error);
      res.status(500).json({ error: 'Failed to update file visibility.' });
    }
  }
};

module.exports = fileController;
