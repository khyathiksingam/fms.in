const path = require('path');
const fs = require('fs');
const { dbHelper } = require('../config/db');
const { getStoragePath } = require('../services/storageService');
const { processFileOCR } = require('../services/ocrService');
const { checkFileAccess } = require('../middleware/auth');

const versionController = {
  async uploadNewVersion(req, res) {
    try {
      const { id } = req.params; // file_id
      const { note } = req.body;
      const file = req.file;
      const user = req.user;

      if (!file) {
        return res.status(400).json({ error: 'Please select a file to upload as the new version.' });
      }

      const hasAccess = await checkFileAccess(id, user, 'edit');
      if (!hasAccess) {
        return res.status(403).json({ error: 'You do not have permission to upload versions for this file.' });
      }

      const existingFile = await dbHelper.get("SELECT * FROM files WHERE id = ?", [id]);
      if (!existingFile) {
        return res.status(404).json({ error: 'File not found.' });
      }

      const nextVersionNum = (existingFile.version || 1) + 1;
      const storedFilename = file.filename;
      const storedFullPath = getStoragePath(storedFilename);

      // Add to file_versions history
      await dbHelper.run(`
        INSERT INTO file_versions (file_id, version_number, storage_path, size, uploaded_by, note)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [id, nextVersionNum, storedFilename, file.size, user.id, note || `Version ${nextVersionNum}`]);

      // Update main file pointer
      await dbHelper.run(`
        UPDATE files 
        SET storage_path = ?, size = ?, mime_type = ?, version = ?, ocr_status = 'pending', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [storedFilename, file.size, file.mimetype || existingFile.mime_type, nextVersionNum, id]);

      // Run OCR for new version in background
      processFileOCR(id, storedFullPath, file.mimetype).catch(err => {
        console.error(`OCR error on new version for file ${id}:`, err);
      });

      // Activity log
      await dbHelper.run(`
        INSERT INTO activity_logs (user_id, action, file_id, department_id, metadata)
        VALUES (?, 'New File Version Uploaded', ?, ?, ?)
      `, [user.id, id, existingFile.department_id, JSON.stringify({ filename: existingFile.name, version: nextVersionNum, size: file.size })]);

      res.status(201).json({
        message: `Version ${nextVersionNum} uploaded successfully.`,
        version: nextVersionNum,
        size: file.size
      });
    } catch (error) {
      console.error('Upload new version error:', error);
      res.status(500).json({ error: 'Failed to upload new version.' });
    }
  },

  async getFileVersions(req, res) {
    try {
      const { id } = req.params;
      const user = req.user;

      const hasAccess = await checkFileAccess(id, user, 'view');
      if (!hasAccess) {
        return res.status(403).json({ error: 'You do not have permission to view version history.' });
      }

      const versions = await dbHelper.all(`
        SELECT fv.*, u.full_name as uploader_name, u.username as uploader_username
        FROM file_versions fv
        JOIN users u ON fv.uploaded_by = u.id
        WHERE fv.file_id = ?
        ORDER BY fv.version_number DESC
      `, [id]);

      const currentFile = await dbHelper.get("SELECT version FROM files WHERE id = ?", [id]);

      res.json({
        currentVersion: currentFile ? currentFile.version : 1,
        versions
      });
    } catch (error) {
      console.error('Get file versions error:', error);
      res.status(500).json({ error: 'Failed to retrieve file versions.' });
    }
  },

  async downloadVersion(req, res) {
    try {
      const { id, versionNumber } = req.params;
      const user = req.user;

      const hasAccess = await checkFileAccess(id, user, 'download');
      if (!hasAccess) {
        return res.status(403).json({ error: 'You do not have permission to download this version.' });
      }

      const file = await dbHelper.get("SELECT * FROM files WHERE id = ?", [id]);
      if (!file) {
        return res.status(404).json({ error: 'File not found.' });
      }

      const versionRecord = await dbHelper.get(
        "SELECT * FROM file_versions WHERE file_id = ? AND version_number = ?",
        [id, versionNumber]
      );

      if (!versionRecord) {
        return res.status(404).json({ error: `Version ${versionNumber} not found.` });
      }

      const fullPath = getStoragePath(versionRecord.storage_path);
      if (!fs.existsSync(fullPath)) {
        return res.status(404).json({ error: 'Version binary file not found on storage server.' });
      }

      const ext = path.extname(file.original_name);
      const baseName = path.basename(file.original_name, ext);
      const versionedFilename = `${baseName}_v${versionNumber}${ext}`;

      // Stream the actual bytes on disk; the recorded size may drift from storage.
      const stat = fs.statSync(fullPath);

      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(versionedFilename)}"`);
      res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
      res.setHeader('Content-Length', stat.size);

      const versionStream = fs.createReadStream(fullPath);
      versionStream.on('error', (streamError) => {
        console.error('Version download stream error:', streamError);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Failed to download version.' });
        } else {
          res.destroy(streamError);
        }
      });
      versionStream.pipe(res);
    } catch (error) {
      console.error('Download version error:', error);
      res.status(500).json({ error: 'Failed to download version.' });
    }
  },

  async restoreVersion(req, res) {
    try {
      const { id, versionNumber } = req.params;
      const user = req.user;

      const hasAccess = await checkFileAccess(id, user, 'edit');
      if (!hasAccess) {
        return res.status(403).json({ error: 'You do not have permission to restore versions for this file.' });
      }

      const file = await dbHelper.get("SELECT * FROM files WHERE id = ?", [id]);
      if (!file) {
        return res.status(404).json({ error: 'File not found.' });
      }

      const versionRecord = await dbHelper.get(
        "SELECT * FROM file_versions WHERE file_id = ? AND version_number = ?",
        [id, versionNumber]
      );

      if (!versionRecord) {
        return res.status(404).json({ error: `Version ${versionNumber} not found.` });
      }

      // Restore: set current file's storage_path and size to this version's storage_path
      await dbHelper.run(`
        UPDATE files 
        SET storage_path = ?, size = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `, [versionRecord.storage_path, versionRecord.size, id]);

      // Re-trigger OCR in background
      const fullPath = getStoragePath(versionRecord.storage_path);
      processFileOCR(id, fullPath, file.mime_type).catch(err => console.error(err));

      // Activity log
      await dbHelper.run(`
        INSERT INTO activity_logs (user_id, action, file_id, department_id, metadata)
        VALUES (?, 'File Version Restored', ?, ?, ?)
      `, [user.id, id, file.department_id, JSON.stringify({ filename: file.name, restored_version: versionNumber })]);

      res.json({ message: `File restored to Version ${versionNumber} successfully.` });
    } catch (error) {
      console.error('Restore version error:', error);
      res.status(500).json({ error: 'Failed to restore version.' });
    }
  }
};

module.exports = versionController;
