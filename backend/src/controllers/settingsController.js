const { dbHelper } = require('../config/db');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const LOGO_DIR = path.resolve(__dirname, '../../storage/logos');
const DEFAULT_COLLEGE = 'Your College';
const DEFAULT_SYSTEM = 'Faculty File Management System';
const DEFAULT_TYPES = 'pdf,doc,docx,xls,xlsx,ppt,pptx,txt,csv,jpg,jpeg,png,gif,svg,mp4,mov,avi,mp3,wav,zip,rar';

function validLogoPath(value) {
  return value === '' || value === '/logo.png' ||
    /^\/brand\/[a-z0-9-]+\.(png|jpg|webp|svg)$/.test(value) ||
    /^\/api\/public\/logo\/[a-f0-9-]{36}\.(png|jpg|webp|svg)$/.test(value);
}

const settingsController = {
  async getSettings(req, res) {
    try {
      let settings = await dbHelper.get("SELECT * FROM system_settings ORDER BY id ASC LIMIT 1");
      if (!settings) {
        await dbHelper.run(`
          INSERT INTO system_settings (college_name, system_name, max_upload_size_mb, allowed_file_types, student_self_registration)
          VALUES (?, ?, 100, ?, 0)
        `, [DEFAULT_COLLEGE, DEFAULT_SYSTEM, DEFAULT_TYPES]);
        settings = await dbHelper.get("SELECT * FROM system_settings ORDER BY id ASC LIMIT 1");
      }
      res.json({
        settings: {
          ...settings,
          student_self_registration: Boolean(settings.student_self_registration),
          college_logo: validLogoPath(settings.college_logo) ? settings.college_logo : '',
          system_logo: validLogoPath(settings.system_logo) ? settings.system_logo : ''
        }
      });
    } catch (error) {
      console.error('Get settings error:', error);
      res.status(500).json({ error: 'Failed to retrieve system settings.' });
    }
  },

  async updateSettings(req, res) {
    try {
      if (req.user?.role_name !== 'admin') {
        return res.status(403).json({ error: 'Only administrators can modify system settings.' });
      }

      const {
        college_name,
        system_name,
        college_logo,
        system_logo,
        max_upload_size_mb,
        allowed_file_types,
        student_self_registration
      } = req.body;

      const finalCollegeName = (college_name && college_name.trim()) ? college_name.trim() : DEFAULT_COLLEGE;
      const finalSystemName = (system_name && system_name.trim()) ? system_name.trim() : DEFAULT_SYSTEM;
      const currentSettings = await dbHelper.get("SELECT college_logo, system_logo, student_self_registration FROM system_settings ORDER BY id ASC LIMIT 1");
      const existingCollegeLogo = validLogoPath(currentSettings?.college_logo || '') ? (currentSettings?.college_logo || '') : '';
      const existingSystemLogo = validLogoPath(currentSettings?.system_logo || '') ? (currentSettings?.system_logo || '') : '';
      const finalLogo = college_logo === undefined ? existingCollegeLogo : college_logo;
      const finalSysLogo = system_logo === undefined ? existingSystemLogo : system_logo;
      if (typeof finalLogo !== 'string' || !validLogoPath(finalLogo) ||
          typeof finalSysLogo !== 'string' || !validLogoPath(finalSysLogo)) {
        return res.status(400).json({ error: 'Logo must use a server-managed image path.' });
      }
      const finalSize = Number(max_upload_size_mb) || 100;
      const finalTypes = (allowed_file_types && allowed_file_types.trim()) ? allowed_file_types.trim() : DEFAULT_TYPES;
      const finalStudentReg = student_self_registration !== undefined
        ? (student_self_registration === true || student_self_registration === 1 || student_self_registration === '1' ? 1 : 0)
        : (currentSettings?.student_self_registration ? 1 : 0);

      let settings = await dbHelper.get("SELECT id FROM system_settings ORDER BY id ASC LIMIT 1");
      if (!settings) {
        await dbHelper.run(`
          INSERT INTO system_settings (college_name, system_name, college_logo, system_logo, max_upload_size_mb, allowed_file_types, student_self_registration)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
          finalCollegeName,
          finalSystemName,
          finalLogo,
          finalSysLogo,
          finalSize,
          finalTypes,
          finalStudentReg
        ]);
      } else {
        await dbHelper.run(`
          UPDATE system_settings 
          SET college_name = ?,
              system_name = ?,
              college_logo = ?,
              system_logo = ?,
              max_upload_size_mb = ?,
              allowed_file_types = ?,
              student_self_registration = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [
          finalCollegeName,
          finalSystemName,
          finalLogo,
          finalSysLogo,
          finalSize,
          finalTypes,
          finalStudentReg,
          settings.id
        ]);
      }

      await dbHelper.run(`
        INSERT INTO activity_logs (user_id, action, metadata)
        VALUES (?, 'System Settings Updated', ?)
      `, [req.user.id, JSON.stringify({ college_name: finalCollegeName, system_name: finalSystemName, student_self_registration: Boolean(finalStudentReg) })]);

      const updated = await dbHelper.get("SELECT * FROM system_settings ORDER BY id ASC LIMIT 1");
      res.json({
        message: 'Settings updated successfully.',
        settings: {
          ...updated,
          student_self_registration: Boolean(updated.student_self_registration)
        }
      });
    } catch (error) {
      console.error('Update settings error:', error);
      res.status(500).json({ error: 'Failed to update system settings.' });
    }
  },

  async toggleStudentSelfRegistration(req, res) {
    try {
      if (req.user?.role_name !== 'admin') {
        return res.status(403).json({ error: 'Only administrators can modify student registration settings.' });
      }
      const { enabled } = req.body;
      const finalVal = (enabled === true || enabled === 1 || enabled === '1' || enabled === 'on') ? 1 : 0;
      let settings = await dbHelper.get("SELECT id FROM system_settings ORDER BY id ASC LIMIT 1");
      if (!settings) {
        await dbHelper.run("INSERT INTO system_settings (student_self_registration) VALUES (?)", [finalVal]);
      } else {
        await dbHelper.run("UPDATE system_settings SET student_self_registration = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [finalVal, settings.id]);
      }
      await dbHelper.run(
        "INSERT INTO activity_logs (user_id, action, metadata) VALUES (?, 'Student Registration Setting Changed', ?)",
        [req.user.id, JSON.stringify({ student_self_registration: Boolean(finalVal) })]
      );
      res.json({
        message: `Student self-registration is now ${finalVal ? 'enabled' : 'disabled'}.`,
        student_self_registration: Boolean(finalVal)
      });
    } catch (error) {
      console.error('Toggle student registration error:', error);
      res.status(500).json({ error: 'Failed to update student registration setting.' });
    }
  }
};

settingsController.uploadLogo = async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'Choose a PNG, JPG, WebP, or SVG logo file.' });
    const extension = path.extname(file.originalname).toLowerCase();
    const signature = file.buffer;
    let valid = false;

    if (extension === '.png') {
      valid = signature.length >= 8 && signature.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    } else if (extension === '.jpg' || extension === '.jpeg') {
      valid = signature.length >= 3 && signature[0] === 0xff && signature[1] === 0xd8 && signature[2] === 0xff;
    } else if (extension === '.webp') {
      valid = signature.length >= 12 && signature.toString('ascii', 0, 4) === 'RIFF' &&
        signature.toString('ascii', 8, 12) === 'WEBP';
    } else if (extension === '.svg') {
      const svg = signature.toString('utf8').trim();
      valid = /^<svg(?:\s|>)/i.test(svg) &&
        !/(?:<!DOCTYPE|<!ENTITY|<\s*(script|foreignObject|iframe|object|embed|style|animate|animateTransform|set)\b)/i.test(svg) &&
        !/\bon[a-z]+\s*=/i.test(svg) &&
        !/(?:href|src)\s*=\s*(?:"(?!#)[^"]*"|'(?!#)[^']*'|(?!#)[^\s>]+)/i.test(svg) &&
        !/@import|url\s*\(\s*["']?(?!#)[^)]+\)/i.test(svg);
    }
    if (!valid) return res.status(400).json({ error: 'The logo content does not match a safe supported image format.' });

    fs.mkdirSync(LOGO_DIR, { recursive: true });
    const normalizedExtension = extension === '.jpeg' ? '.jpg' : extension;
    const filename = `${crypto.randomUUID()}${normalizedExtension}`;
    fs.writeFileSync(path.join(LOGO_DIR, filename), signature, { flag: 'wx' });
    const logoPath = `/api/public/logo/${filename}`;
    let settings = await dbHelper.get('SELECT id FROM system_settings ORDER BY id ASC LIMIT 1');
    if (!settings) {
      const created = await dbHelper.run(
        `INSERT INTO system_settings (college_name, system_name, college_logo, system_logo)
         VALUES (?, ?, ?, ?)`,
        [DEFAULT_COLLEGE, DEFAULT_SYSTEM, logoPath, logoPath]
      );
      settings = { id: created.lastID };
    } else {
      await dbHelper.run(
        `UPDATE system_settings SET college_logo = ?, system_logo = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [logoPath, logoPath, settings.id]
      );
    }
    await dbHelper.run(
      `INSERT INTO activity_logs (user_id, action, metadata) VALUES (?, 'College Logo Updated', ?)`,
      [req.user.id, JSON.stringify({ path: logoPath })]
    );
    const updated = await dbHelper.get('SELECT * FROM system_settings WHERE id = ?', [settings.id]);
    res.json({ message: 'College logo updated.', settings: updated });
  } catch (error) {
    console.error('Upload college logo error:', error);
    res.status(500).json({ error: 'Unable to store the college logo.' });
  }
};

settingsController.getLogo = (req, res) => {
  const filename = req.params.filename;
  if (!/^[a-f0-9-]{36}\.(png|jpg|webp|svg)$/.test(filename)) {
    return res.status(404).json({ error: 'Logo not found.' });
  }
  const fullPath = path.join(LOGO_DIR, filename);
  if (!fs.existsSync(fullPath)) return res.status(404).json({ error: 'Logo not found.' });
  const type = path.extname(filename) === '.svg' ? 'image/svg+xml' :
    path.extname(filename) === '.webp' ? 'image/webp' :
    path.extname(filename) === '.png' ? 'image/png' : 'image/jpeg';
  res.setHeader('Content-Type', type);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  return res.sendFile(fullPath);
};

module.exports = settingsController;
