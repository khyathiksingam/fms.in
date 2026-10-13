const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { STORAGE_DIR, generateStorageFilename } = require('../services/storageService');

// Multer disk storage engine saving directly to private uploads directory
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(STORAGE_DIR)) {
      fs.mkdirSync(STORAGE_DIR, { recursive: true });
    }
    cb(null, STORAGE_DIR);
  },
  filename: (req, file, cb) => {
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const storedFilename = generateStorageFilename(originalName);
    cb(null, storedFilename);
  }
});

// File filter for security
const fileFilter = (req, file, cb) => {
  // Allowed extensions check
  const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
  const blockedExtensions = ['exe', 'bat', 'cmd', 'sh', 'vbs', 'ps1', 'msi', 'com', 'scr'];

  if (blockedExtensions.includes(ext)) {
    return cb(new Error(`Executable or script file type .${ext} is not allowed for security reasons.`), false);
  }

  cb(null, true);
};

const upload = multer({
  storage,
  limits: {
    fileSize: 1024 * 1024 * 1024 // 1GB (1024MB) max file upload limit
  },
  fileFilter
});

module.exports = upload;
