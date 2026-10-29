const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

function getStorageDir() {
  const dir = path.resolve(
    process.env.STORAGE_UPLOAD_DIR ||
    process.env.FFMS_STORAGE_DIR ||
    (process.env.STORAGE_LOCAL_DIR ? path.join(process.env.STORAGE_LOCAL_DIR, 'uploads') : null) ||
    (process.env.FFMS_DATA_DIR ? path.join(process.env.FFMS_DATA_DIR, 'uploads') : null) ||
    path.resolve(__dirname, '../../storage/uploads')
  );
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

const STORAGE_DIR = getStorageDir();

function getStoragePath(storedFilename) {
  // Prevent directory traversal
  const safeFilename = path.basename(storedFilename);
  return path.join(getStorageDir(), safeFilename);
}

function generateStorageFilename(originalName) {
  const ext = path.extname(originalName).toLowerCase();
  const safeName = path.basename(originalName, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${uuidv4()}_${Date.now()}_${safeName}${ext}`;
}

function saveBuffer(buffer, originalName) {
  const storedFilename = generateStorageFilename(originalName);
  const fullPath = getStoragePath(storedFilename);
  fs.writeFileSync(fullPath, buffer);
  return {
    storedFilename,
    fullPath,
    size: buffer.length
  };
}

function deleteStoredFile(storedFilename) {
  try {
    if (!storedFilename || typeof storedFilename !== 'string') return false;
    let deleted = false;
    // Check if storedFilename is already a valid absolute path on disk
    if (path.isAbsolute(storedFilename) && fs.existsSync(storedFilename)) {
      try {
        fs.unlinkSync(storedFilename);
        deleted = true;
      } catch (e) {
        console.warn('Could not unlink direct absolute path:', storedFilename, e.message);
      }
    }
    const fullPath = getStoragePath(storedFilename);
    if (fs.existsSync(fullPath)) {
      try {
        fs.unlinkSync(fullPath);
        deleted = true;
      } catch (e) {
        console.warn('Could not unlink storage dir path:', fullPath, e.message);
      }
    }
    return deleted;
  } catch (err) {
    console.error('Error deleting stored file:', err);
    return false;
  }
}

function getFileStats(storedFilename) {
  const fullPath = getStoragePath(storedFilename);
  if (fs.existsSync(fullPath)) {
    return fs.statSync(fullPath);
  }
  return null;
}

module.exports = {
  STORAGE_DIR,
  getStoragePath,
  generateStorageFilename,
  saveBuffer,
  deleteStoredFile,
  getFileStats
};
