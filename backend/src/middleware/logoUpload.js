const multer = require('multer');
const path = require('path');

const MIME_BY_EXTENSION = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml'
};

module.exports = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
  fileFilter(req, file, callback) {
    const extension = path.extname(file.originalname).toLowerCase();
    if (MIME_BY_EXTENSION[extension] !== file.mimetype) {
      return callback(new Error('Logo must be a PNG, JPG, WebP, or SVG image.'));
    }
    callback(null, true);
  }
});
