const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const LEGACY_STORAGE_DIR = path.resolve(__dirname, '../../storage/uploads');
const DEFAULT_LOCAL_STORAGE_DIR = process.platform === 'win32' && process.env.LOCALAPPDATA
  ? path.join(process.env.LOCALAPPDATA, 'VNRVJIET', 'FFMS', 'uploads')
  : LEGACY_STORAGE_DIR;
const STORAGE_DIR = path.resolve(process.env.FFMS_STORAGE_DIR || DEFAULT_LOCAL_STORAGE_DIR);

// Ensure directory exists
if (!fs.existsSync(STORAGE_DIR)) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

function getStoragePath(storedFilename) {
  // Prevent directory traversal
  const safeFilename = path.basename(storedFilename);
  const currentPath = path.join(STORAGE_DIR, safeFilename);
  if (fs.existsSync(currentPath) || STORAGE_DIR === LEGACY_STORAGE_DIR) return currentPath;

  // Existing installations stored uploads beside the project, which may be in a
  // OneDrive-managed folder. Copy legacy files into local app storage on first use.
  const legacyPath = path.join(LEGACY_STORAGE_DIR, safeFilename);
  try {
    if (fs.existsSync(legacyPath)) {
      fs.copyFileSync(legacyPath, currentPath, fs.constants.COPYFILE_EXCL);
      return currentPath;
    }
  } catch (error) {
    if (error.code !== 'EEXIST') {
      console.warn(`Could not migrate legacy upload ${safeFilename}: ${error.code || error.message}`);
    }
  }
  return fs.existsSync(legacyPath) ? legacyPath : currentPath;
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
    const fullPath = getStoragePath(storedFilename);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
    return true;
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
