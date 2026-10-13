const { dbHelper } = require('../config/db');

function parseBoolean(value) {
  if ([true, 1, '1'].includes(value)) return 1;
  if ([false, 0, '0'].includes(value)) return 0;
  return null;
}

function parsePayload(body, partial = false) {
  const values = {};
  const code = body.code === undefined ? undefined : String(body.code).trim().toUpperCase();
  const displayName = body.display_name === undefined ? undefined : String(body.display_name).trim();
  const programme = body.programme === undefined ? undefined : String(body.programme).trim();
  const effectiveFrom = body.effective_from === undefined ? undefined : String(body.effective_from).trim();
  const description = body.description === undefined ? undefined : String(body.description).trim();
  const sortOrder = body.sort_order === undefined ? undefined : Number(body.sort_order);
  const active = body.active === undefined ? undefined : parseBoolean(body.active);

  if (!partial || code !== undefined) {
    if (!code || code.length > 30 || !/^[A-Z0-9][A-Z0-9._-]*$/.test(code)) {
      return { error: 'Regulation code is required and must contain only letters, numbers, dots, underscores, or hyphens.' };
    }
    values.code = code;
  }
  if (!partial || displayName !== undefined) {
    if (!displayName || displayName.length > 100) return { error: 'Display name is required and must be no longer than 100 characters.' };
    values.display_name = displayName;
  }
  if (programme !== undefined) {
    if (programme.length > 80) return { error: 'Programme must be no longer than 80 characters.' };
    values.programme = programme || null;
  } else if (!partial) {
    values.programme = null;
  }
  if (effectiveFrom !== undefined) {
    if (effectiveFrom.length > 80) return { error: 'Effective-from text must be no longer than 80 characters.' };
    values.effective_from = effectiveFrom || null;
  } else if (!partial) values.effective_from = null;
  if (description !== undefined) {
    if (description.length > 500) return { error: 'Description must be no longer than 500 characters.' };
    values.description = description;
  } else if (!partial) values.description = '';
  if (sortOrder !== undefined) {
    if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 100000) return { error: 'Sort order must be a non-negative integer.' };
    values.sort_order = sortOrder;
  } else if (!partial) {
    values.sort_order = 0;
  }
  if (active !== undefined) {
    if (active === null) return { error: 'Active status must be true or false.' };
    values.active = active;
  } else if (!partial) {
    values.active = 1;
  }
  return { values };
}

const academicRegulationController = {
  async list(req, res) {
    try {
      const regulations = await dbHelper.all(`
        SELECT r.id, r.code, r.display_name, r.programme, r.effective_from, r.description,
               r.active, r.sort_order,
               r.created_at, r.updated_at,
               (SELECT COUNT(*) FROM syllabus_catalog c WHERE c.regulation = r.code) AS linked_syllabus_count
        FROM academic_regulations r
        ORDER BY r.sort_order ASC, r.code COLLATE NOCASE ASC
      `);
      res.json({ regulations });
    } catch (error) {
      console.error('List academic regulations error:', error);
      res.status(500).json({ error: 'Unable to load academic regulations.' });
    }
  },

  async create(req, res) {
    try {
      const parsed = parsePayload(req.body);
      if (parsed.error) return res.status(400).json({ error: parsed.error });
      const { code, display_name, programme, effective_from, description, active, sort_order } = parsed.values;
      const existing = await dbHelper.get('SELECT id FROM academic_regulations WHERE LOWER(code) = LOWER(?)', [code]);
      if (existing) return res.status(409).json({ error: 'A regulation with this code already exists.' });
      const result = await dbHelper.run(`
        INSERT INTO academic_regulations (code, display_name, programme, effective_from, description, active, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [code, display_name, programme, effective_from, description, active, sort_order]);
      await dbHelper.run(
        'INSERT INTO activity_logs (user_id, action, metadata) VALUES (?, ?, ?)',
        [req.user.id, 'Academic Regulation Created', JSON.stringify({ id: result.lastID, code })]
      );
      res.status(201).json({ id: result.lastID, message: 'Academic regulation created.' });
    } catch (error) {
      console.error('Create academic regulation error:', error);
      res.status(500).json({ error: 'Unable to create academic regulation.' });
    }
  },

  async update(req, res) {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Regulation id is invalid.' });
      const parsed = parsePayload(req.body, true);
      if (parsed.error) return res.status(400).json({ error: parsed.error });
      if (!Object.keys(parsed.values).length) return res.status(400).json({ error: 'At least one regulation field must be provided.' });
      const regulation = await dbHelper.get('SELECT id, code FROM academic_regulations WHERE id = ?', [id]);
      if (!regulation) return res.status(404).json({ error: 'Academic regulation not found.' });
      const values = parsed.values;
      if (values.code) {
        const duplicate = await dbHelper.get('SELECT id FROM academic_regulations WHERE LOWER(code) = LOWER(?) AND id != ?', [values.code, id]);
        if (duplicate) return res.status(409).json({ error: 'A regulation with this code already exists.' });
      }
      const assignments = Object.keys(values).map(key => `${key} = ?`).join(', ');
      await dbHelper.run(
        `UPDATE academic_regulations SET ${assignments}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [...Object.values(values), id]
      );
      if (values.code && values.code !== regulation.code) {
        await dbHelper.run('UPDATE syllabus_catalog SET regulation = ? WHERE regulation = ?', [values.code, regulation.code]);
      }
      await dbHelper.run(
        'INSERT INTO activity_logs (user_id, action, metadata) VALUES (?, ?, ?)',
        [req.user.id, 'Academic Regulation Modified', JSON.stringify({ id, previous_code: regulation.code, ...values })]
      );
      res.json({ message: 'Academic regulation updated.' });
    } catch (error) {
      console.error('Update academic regulation error:', error);
      res.status(500).json({ error: 'Unable to update academic regulation.' });
    }
  },

  async setStatus(req, res) {
    try {
      const id = Number(req.params.id);
      const active = parseBoolean(req.body.active);
      if (!Number.isInteger(id) || id < 1 || active === null) {
        return res.status(400).json({ error: 'A valid regulation id and active status are required.' });
      }
      const regulation = await dbHelper.get('SELECT id, code FROM academic_regulations WHERE id = ?', [id]);
      if (!regulation) return res.status(404).json({ error: 'Academic regulation not found.' });
      await dbHelper.run('UPDATE academic_regulations SET active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [active, id]);
      await dbHelper.run(
        'INSERT INTO activity_logs (user_id, action, metadata) VALUES (?, ?, ?)',
        [req.user.id, active ? 'Academic Regulation Activated' : 'Academic Regulation Deactivated', JSON.stringify({ id, code: regulation.code })]
      );
      res.json({ message: active ? 'Academic regulation activated.' : 'Academic regulation deactivated.' });
    } catch (error) {
      console.error('Update academic regulation status error:', error);
      res.status(500).json({ error: 'Unable to update academic regulation status.' });
    }
  }
};

module.exports = academicRegulationController;
