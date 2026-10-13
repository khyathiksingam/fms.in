const fs = require('fs');
const path = require('path');
const { dbHelper } = require('../config/db');
const { getStoragePath } = require('../services/storageService');

const PUBLIC_FILE_FILTER = `
  c.published = 1
  AND c.student_visible = 1
  AND f.deleted_at IS NULL
  AND f.visibility = 'public'
  AND EXISTS (
    SELECT 1 FROM departments active_department
    WHERE active_department.id = c.department_id AND active_department.active = 1
  )
  AND (LOWER(f.mime_type) = 'application/pdf' OR LOWER(f.name) LIKE '%.pdf')
`;

const CATALOGUE_SELECT = `
  SELECT c.id, c.file_id, c.program, c.regulation, c.academic_year,
         c.department_id, c.branch_code, c.semester, c.subject_code,
         c.subject_name, c.resource_type, c.student_visible,
         c.published, c.published_at, c.created_by,
         c.created_at, c.updated_at, f.name AS file_name,
         f.storage_path, f.original_name, f.mime_type, f.visibility, f.deleted_at,
         d.name AS department_name, d.code AS department_code,
         f.owner_id AS faculty_uploader_id, u.full_name AS faculty_uploader_name
  FROM syllabus_catalog c
  JOIN files f ON f.id = c.file_id
  LEFT JOIN departments d ON d.id = c.department_id
  LEFT JOIN users u ON u.id = f.owner_id
`;

function parsePage(value, fallback, max) {
  const parsed = Number(value === undefined ? fallback : value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > max) return null;
  return parsed;
}

function validateText(value, label, maxLength = 120) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maxLength) {
    return `${label} is required and must be no longer than ${maxLength} characters.`;
  }
  return null;
}

function isPdf(file) {
  return Boolean(file && (
    String(file.mime_type || '').toLowerCase() === 'application/pdf' ||
    path.extname(file.name || '').toLowerCase() === '.pdf' ||
    path.extname(file.original_name || '').toLowerCase() === '.pdf'
  ));
}

async function hasStoredPdfSignature(storagePath) {
  if (!storagePath) return false;
  let handle;
  try {
    handle = await fs.promises.open(getStoragePath(storagePath), 'r');
    const header = Buffer.alloc(1024);
    const { bytesRead } = await handle.read(header, 0, header.length, 0);
    return header.toString('latin1', 0, bytesRead).includes('%PDF-');
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  } finally {
    if (handle) await handle.close();
  }
}

async function filterValidStoredPdfs(records) {
  const validity = await Promise.all(records.map(record => hasStoredPdfSignature(record.storage_path)));
  return records.filter((record, index) => validity[index]);
}

function parseCatalogueBody(body, requireFile = true) {
  const fields = [
    ['program', 80, 'Program'],
    ['regulation', 80, 'Regulation'],
    ['academic_year', 40, 'Academic year'],
    ['branch_code', 80, 'Branch'],
    ['semester', 20, 'Semester'],
    ['subject_code', 80, 'Subject code'],
    ['subject_name', 200, 'Subject name']
  ];
  const values = {};
  for (const [key, max, label] of fields) {
    const value = body[key];
    const error = validateText(value, label, max);
    if (error) return { error };
    values[key] = value.trim();
  }

  const departmentId = Number(body.department_id);
  if (!Number.isInteger(departmentId) || departmentId < 1) {
    return { error: 'A valid department is required.' };
  }
  values.department_id = departmentId;

  if (requireFile || body.file_id !== undefined) {
    const fileId = Number(body.file_id);
    if (!Number.isInteger(fileId) || fileId < 1) return { error: 'A valid PDF file is required.' };
    values.file_id = fileId;
  }

  if (body.published !== undefined && ![true, false, 0, 1, '0', '1'].includes(body.published)) {
    return { error: 'Published must be true or false.' };
  }
  const resourceType = body.resource_type === undefined ? 'syllabus' : body.resource_type;
  if (!['syllabus', 'faculty_note'].includes(resourceType)) return { error: 'Resource type must be syllabus or faculty_note.' };
  if (body.student_visible !== undefined && ![true, false, 0, 1, '0', '1'].includes(body.student_visible)) {
    return { error: 'Student visibility must be true or false.' };
  }
  values.resource_type = resourceType;
  values.student_visible = body.student_visible === true || body.student_visible === 1 || body.student_visible === '1';
  values.published = body.published === true || body.published === 1 || body.published === '1';
  return { values };
}

function appendFilters(query, params, options = {}) {
  const { includeUnpublished = false, filters = {} } = options;
  query += ` WHERE ${includeUnpublished ? '1 = 1' : PUBLIC_FILE_FILTER}`;
  const filterFields = [
    ['program', 'c.program'],
    ['regulation', 'c.regulation'],
    ['academic_year', 'c.academic_year'],
    ['department_id', 'c.department_id'],
    ['branch_code', 'c.branch_code'],
    ['semester', 'c.semester'],
    ['subject_id', 'c.id'],
    ['resource_type', 'c.resource_type'],
    ['owner_id', 'f.owner_id']
  ];
  for (const [key, column] of filterFields) {
    const value = filters[key];
    if (value !== undefined && value !== '') {
      query += ` AND ${column} = ?`;
      params.push(value);
    }
  }
  if (!includeUnpublished && filters.program_group) {
    const normalizedProgram = `LOWER(REPLACE(REPLACE(REPLACE(TRIM(c.program), '.', ''), ' ', ''), '-', ''))`;
    const categoryConditions = {
      btech: `${normalizedProgram} = 'btech'`,
      btech_minor: `(${normalizedProgram} LIKE '%btech%minor%' OR ${normalizedProgram} LIKE '%minor%btech%')`,
      btech_honors: `(${normalizedProgram} LIKE '%btech%honor%' OR ${normalizedProgram} LIKE '%btech%honour%' OR ${normalizedProgram} LIKE '%honor%btech%' OR ${normalizedProgram} LIKE '%honour%btech%')`,
      mtech: `${normalizedProgram} LIKE 'mtech%'`,
      mca: `${normalizedProgram} = 'mca'`
    };
    const categoryCondition = categoryConditions[filters.program_group];
    if (filters.program_group === 'other') {
      const knownCategories = Object.values(categoryConditions).map(condition => `NOT (${condition})`).join(' AND ');
      query += ` AND (${knownCategories})`;
    } else if (categoryCondition) {
      query += ` AND (${categoryCondition})`;
    }
  }
  if (!includeUnpublished && Array.isArray(filters.department_ids)) {
    const placeholders = filters.department_ids.map(() => '?').join(', ');
    query += ` AND c.department_id IN (${placeholders})`;
    params.push(...filters.department_ids);
  }
  if (includeUnpublished && filters.published !== undefined) {
    query += ' AND c.published = ?';
    params.push(filters.published);
  }
  const search = filters.q;
  if (search) {
    query += ` AND (
      LOWER(c.subject_name) LIKE ? OR LOWER(c.subject_code) LIKE ?
      OR LOWER(c.program) LIKE ? OR LOWER(c.regulation) LIKE ?
      OR LOWER(c.academic_year) LIKE ? OR LOWER(c.branch_code) LIKE ?
      OR LOWER(c.semester) LIKE ? OR LOWER(d.name) LIKE ? OR LOWER(d.code) LIKE ?
    )`;
    const term = `%${search.toLowerCase()}%`;
    params.push(term, term, term, term, term, term, term, term, term);
  }
  return query;
}

async function getPublicRecord(id) {
  const record = await dbHelper.get(
    `${CATALOGUE_SELECT} WHERE c.id = ? AND ${PUBLIC_FILE_FILTER}`,
    [id]
  );
  return record && await hasStoredPdfSignature(record.storage_path) ? record : null;
}

async function getValidPublicRecords(filters = {}) {
  const params = [];
  const query = appendFilters(CATALOGUE_SELECT, params, { filters });
  const records = await dbHelper.all(
    `${query} ORDER BY c.regulation DESC, c.academic_year DESC, c.semester, c.subject_code`,
    params
  );
  return filterValidStoredPdfs(records);
}

function sendPdf(req, res, record, download) {
  const storagePath = record.storage_path || record.file_storage_path || (record.file && record.file.storage_path);
  if (!storagePath) return res.status(404).json({ error: 'Syllabus PDF is unavailable.' });
  const fullPath = getStoragePath(storagePath);
  if (!fs.existsSync(fullPath)) return res.status(404).json({ error: 'Syllabus PDF is unavailable.' });

  const stat = fs.statSync(fullPath);
  const signature = Buffer.alloc(Math.min(1024, stat.size));
  const descriptor = fs.openSync(fullPath, 'r');
  let bytesRead;
  try {
    bytesRead = fs.readSync(descriptor, signature, 0, signature.length, 0);
  } finally {
    fs.closeSync(descriptor);
  }
  if (!signature.toString('latin1', 0, bytesRead).includes('%PDF-')) {
    console.error('Stored syllabus resource is not a PDF:', record.storage_path);
    return res.status(422).json({ error: 'The stored syllabus resource is not a valid PDF.' });
  }

  const range = req.headers.range;
  const safeName = path.basename(record.original_name || record.name || 'syllabus.pdf');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `${download ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(safeName)}`
  );

  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match || (!match[1] && !match[2])) {
      res.setHeader('Content-Range', `bytes */${stat.size}`);
      return res.status(416).end();
    }
    const start = match[1] ? Number(match[1]) : Math.max(0, stat.size - Number(match[2]));
    const end = match[2] && match[1] ? Number(match[2]) : stat.size - 1;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= stat.size) {
      res.setHeader('Content-Range', `bytes */${stat.size}`);
      return res.status(416).end();
    }
    const boundedEnd = Math.min(end, stat.size - 1);
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${boundedEnd}/${stat.size}`,
      'Content-Length': boundedEnd - start + 1
    });
    return fs.createReadStream(fullPath, { start, end: boundedEnd }).pipe(res);
  }

  res.setHeader('Content-Length', stat.size);
  return fs.createReadStream(fullPath).pipe(res);
}

const syllabusController = {
  async getPublicMasterData(req, res) {
    try {
      res.setHeader('Cache-Control', 'no-store');
      const [regulations, departments, resources] = await Promise.all([
        dbHelper.all(`
          SELECT r.id, r.code, r.display_name, r.programme, r.effective_from, r.description, r.sort_order
          FROM academic_regulations r
          WHERE r.active = 1
          ORDER BY r.sort_order ASC, r.code COLLATE NOCASE ASC
        `),
        dbHelper.all(`
          SELECT d.id, d.name, d.code, d.display_group, d.sort_order
          FROM departments d
          WHERE d.active = 1
          ORDER BY CASE d.display_group
                     WHEN 'ENGINEERING' THEN 1
                     WHEN 'CSE & IT' THEN 2
                     WHEN 'SCIENCES & HUMANITIES' THEN 3
                     ELSE 4
                   END, d.sort_order ASC, d.name COLLATE NOCASE ASC
        `),
        getValidPublicRecords()
      ]);
      const regulationCounts = new Map();
      const departmentCounts = new Map();
      for (const resource of resources) {
        regulationCounts.set(resource.regulation, (regulationCounts.get(resource.regulation) || 0) + 1);
        departmentCounts.set(resource.department_id, (departmentCounts.get(resource.department_id) || 0) + 1);
      }
      res.json({
        regulations: regulations.map(row => ({ ...row, document_count: regulationCounts.get(row.code) || 0 })),
        departments: departments.map(row => ({ ...row, document_count: departmentCounts.get(row.id) || 0 }))
      });
    } catch (error) {
      console.error('Get public syllabus master data error:', error);
      res.status(500).json({ error: 'Unable to load syllabus directory data.' });
    }
  },

  async getCatalogueMasterData(req, res) {
    try {
      const [regulations, departments] = await Promise.all([
        dbHelper.all('SELECT id, code, display_name, programme, effective_from, description, sort_order FROM academic_regulations WHERE active = 1 ORDER BY sort_order, code COLLATE NOCASE'),
        (async () => {
          let sql = 'SELECT id, name, code, display_group, sort_order FROM departments WHERE active = 1';
          const params = [];
          if (req.user.role_name === 'faculty') {
            sql += ' AND id = ?';
            params.push(req.user.department_id || -1);
          } else if (req.user.role_name === 'hod') {
            const departmentIds = req.user.department_ids?.length
              ? req.user.department_ids
              : [req.user.department_id || -1];
            sql += ` AND id IN (${departmentIds.map(() => '?').join(', ')})`;
            params.push(...departmentIds);
          }
          sql += ' ORDER BY display_group, sort_order, name COLLATE NOCASE';
          return dbHelper.all(sql, params);
        })()
      ]);
      res.json({ regulations, departments });
    } catch (error) {
      console.error('Get syllabus catalogue master data error:', error);
      res.status(500).json({ error: 'Unable to load catalogue departments and regulations.' });
    }
  },

  async getPublicFilters(req, res) {
    try {
      res.setHeader('Cache-Control', 'no-store');
      const [regulations, departments, resources] = await Promise.all([
        dbHelper.all('SELECT code AS value, display_name, effective_from, description, sort_order FROM academic_regulations WHERE active = 1 ORDER BY sort_order, code COLLATE NOCASE'),
        dbHelper.all(`SELECT id, name, code, display_group, sort_order FROM departments WHERE active = 1 ORDER BY CASE display_group WHEN 'ENGINEERING' THEN 1 WHEN 'CSE & IT' THEN 2 WHEN 'SCIENCES & HUMANITIES' THEN 3 ELSE 4 END, sort_order, name COLLATE NOCASE`),
        getValidPublicRecords()
      ]);
      const programCounts = new Map();
      for (const row of resources) programCounts.set(row.program, (programCounts.get(row.program) || 0) + 1);
      const uniqueSorted = (key, compare) => [...new Set(resources.map(row => row[key]))].sort(compare);
      res.json({
        programs: [...programCounts].map(([value, count]) => ({ value, count })).sort((a, b) => a.value.localeCompare(b.value)),
        regulations: regulations.map(row => row.value),
        regulation_details: regulations,
        academic_years: uniqueSorted('academic_year', (a, b) => b.localeCompare(a)),
        departments,
        branches: uniqueSorted('branch_code', (a, b) => a.localeCompare(b)),
        semesters: uniqueSorted('semester', (a, b) => Number(a) - Number(b)),
        subjects: resources.map(({ id, program, regulation, academic_year, subject_code, subject_name, resource_type, department_id, branch_code, semester, department_name, department_code, faculty_uploader_id, faculty_uploader_name }) => ({
          id, program, regulation, academic_year, subject_code, subject_name,
          resource_type, department_id, branch_code, semester, department_name,
          department_code, faculty_uploader_id, faculty_uploader_name
        }))
      });
    } catch (error) {
      console.error('Get public syllabus filters error:', error);
      res.status(500).json({ error: 'Unable to load syllabus filters.' });
    }
  },

  async getAvailableFiles(req, res) {
    try {
      const currentCatalogueId = req.query.catalogue_id === undefined ? null : Number(req.query.catalogue_id);
      if (currentCatalogueId !== null && (!Number.isInteger(currentCatalogueId) || currentCatalogueId < 1)) {
        return res.status(400).json({ error: 'Catalogue entry id must be valid.' });
      }
      let sql = `
        SELECT f.id, f.name, f.original_name, f.mime_type, f.size, f.visibility,
               f.department_id, f.approval_status, f.storage_path,
               d.code AS department_code
        FROM files f
        LEFT JOIN syllabus_catalog c ON c.file_id = f.id
        LEFT JOIN departments d ON d.id = f.department_id
        WHERE f.deleted_at IS NULL
          AND (LOWER(f.mime_type) = 'application/pdf' OR LOWER(f.name) LIKE '%.pdf')
          AND (c.id IS NULL OR c.id = ?)
      `;
      const params = [currentCatalogueId || -1];
      if (req.user.role_name === 'faculty') {
        sql += ' AND f.owner_id = ?';
        params.push(req.user.id);
      } else if (req.user.role_name === 'hod') {
        const departmentIds = req.user.department_ids?.length
          ? req.user.department_ids
          : [req.user.department_id].filter(Boolean);
        if (!departmentIds.length) return res.json({ files: [] });
        sql += ` AND (f.owner_id = ? OR f.department_id IN (${departmentIds.map(() => '?').join(', ') }))`;
        params.push(req.user.id, ...departmentIds);
      }
      sql += ` ORDER BY f.name COLLATE NOCASE
        LIMIT 500
      `;
      const files = await dbHelper.all(sql, params);
      const validFiles = await filterValidStoredPdfs(files);
      res.json({ files: validFiles.map(({ storage_path, ...file }) => file) });
    } catch (error) {
      console.error('Get available syllabus PDFs error:', error);
      res.status(500).json({ error: 'Unable to load available PDF files.' });
    }
  },

  async getCatalogueFilters(req, res) {
    try {
      const [programs, regulations, years, departments, branches, semesters] = await Promise.all([
        dbHelper.all('SELECT DISTINCT program AS value FROM syllabus_catalog ORDER BY program'),
        dbHelper.all('SELECT code AS value FROM academic_regulations WHERE active = 1 ORDER BY sort_order, code COLLATE NOCASE'),
        dbHelper.all('SELECT DISTINCT academic_year AS value FROM syllabus_catalog ORDER BY academic_year DESC'),
        dbHelper.all("SELECT id, name, code FROM departments WHERE active = 1 ORDER BY name COLLATE NOCASE"),
        dbHelper.all('SELECT DISTINCT branch_code AS value FROM syllabus_catalog ORDER BY branch_code'),
        dbHelper.all('SELECT DISTINCT semester AS value FROM syllabus_catalog ORDER BY CAST(semester AS INTEGER), semester')
      ]);
      res.json({
        programs: programs.map(row => row.value),
        regulations: regulations.map(row => row.value),
        academic_years: years.map(row => row.value),
        departments,
        branches: branches.map(row => row.value),
        semesters: semesters.map(row => row.value)
      });
    } catch (error) {
      console.error('Get catalogue filters error:', error);
      res.status(500).json({ error: 'Unable to load catalogue filters.' });
    }
  },

  async getPublicSyllabus(req, res) {
    try {
      res.setHeader('Cache-Control', 'no-store');
      const page = parsePage(req.query.page, 1, 1000000);
      const limit = parsePage(req.query.limit, 20, 100);
      if (!page || !limit) return res.status(400).json({ error: 'Page and limit must be valid positive integers.' });
      const filters = {};
      for (const key of ['program', 'regulation', 'academic_year', 'department_id', 'branch_code', 'semester', 'subject_id']) {
        if (req.query[key] !== undefined && req.query[key] !== '') filters[key] = req.query[key];
      }
      if (req.query.resource_type !== undefined) {
        if (!['syllabus', 'faculty_note'].includes(req.query.resource_type)) {
          return res.status(400).json({ error: 'Resource type filter is invalid.' });
        }
        filters.resource_type = req.query.resource_type;
      }
      if (req.query.program_group !== undefined) {
        const validGroups = ['btech', 'btech_minor', 'btech_honors', 'mtech', 'mca', 'other'];
        if (typeof req.query.program_group !== 'string' || !validGroups.includes(req.query.program_group)) {
          return res.status(400).json({ error: 'Program group filter is invalid.' });
        }
        filters.program_group = req.query.program_group;
      }
      if (req.query.department_ids !== undefined) {
        if (typeof req.query.department_ids !== 'string' ||
            req.query.department_ids.length > 1000 ||
            !/^\d+(,\d+)*$/.test(req.query.department_ids)) {
          return res.status(400).json({ error: 'Department filter must contain valid identifiers.' });
        }
        const departmentIds = req.query.department_ids.split(',').map(Number);
        if (departmentIds.some(id => !Number.isSafeInteger(id) || id < 1)) {
          return res.status(400).json({ error: 'Department filter must contain valid identifiers.' });
        }
        filters.department_ids = [...new Set(departmentIds)];
      }
      for (const key of ['program', 'regulation', 'academic_year', 'branch_code', 'semester']) {
        if (filters[key] !== undefined && (typeof filters[key] !== 'string' || filters[key].length > 120)) {
          return res.status(400).json({ error: 'A syllabus filter value is invalid or too long.' });
        }
      }
      if (filters.department_id !== undefined &&
          (typeof filters.department_id !== 'string' || !/^\d+$/.test(filters.department_id) ||
           !Number.isSafeInteger(Number(filters.department_id)) || Number(filters.department_id) < 1)) {
        return res.status(400).json({ error: 'Department filter must be a valid identifier.' });
      }
      if (filters.subject_id !== undefined &&
          (typeof filters.subject_id !== 'string' || !/^\d+$/.test(filters.subject_id) ||
           !Number.isSafeInteger(Number(filters.subject_id)) || Number(filters.subject_id) < 1)) {
        return res.status(400).json({ error: 'Subject filter must be a valid identifier.' });
      }
      if (req.query.q !== undefined) {
        if (typeof req.query.q !== 'string' || req.query.q.length > 120) {
          return res.status(400).json({ error: 'Search text must be no longer than 120 characters.' });
        }
        filters.q = req.query.q.trim();
      }

      const params = [];
      let sql = appendFilters(CATALOGUE_SELECT, params, { filters });
      sql += ' ORDER BY c.regulation DESC, c.academic_year DESC, c.semester, c.subject_code';
      const rows = await filterValidStoredPdfs(await dbHelper.all(sql, params));
      const total = rows.length;
      // Never expose internal storage paths or soft-delete/visibility columns to the
      // public (anonymous) Student Portal listing.
      res.json({
        syllabus: rows.slice((page - 1) * limit, page * limit).map(({ deleted_at, visibility, storage_path, ...row }) => row),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
      });
    } catch (error) {
      console.error('Get public syllabus error:', error);
      res.status(500).json({ error: 'Unable to load syllabus records.' });
    }
  },

  async previewPublicSyllabus(req, res) {
    return syllabusController.streamPublicSyllabus(req, res, false);
  },

  async downloadPublicSyllabus(req, res) {
    return syllabusController.streamPublicSyllabus(req, res, true);
  },

  async streamPublicSyllabus(req, res, download) {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id < 1) return res.status(404).json({ error: 'Syllabus not found.' });
      const record = await getPublicRecord(id);
      if (!record) return res.status(404).json({ error: 'Syllabus not found.' });
      const file = await dbHelper.get(
        `SELECT id, name, original_name, mime_type, storage_path, visibility, deleted_at
         FROM files WHERE id = ?`,
        [record.file_id]
      );
      if (!file || file.deleted_at !== null || file.visibility !== 'public' || !isPdf(file)) {
        return res.status(404).json({ error: 'Syllabus not found.' });
      }
      const pdfRecord = { ...file, ...record, storage_path: file.storage_path, original_name: file.original_name || record.original_name };
      if (req.user && req.user.role_name === 'student') {
        await dbHelper.run(`
          INSERT INTO student_resource_activity (
            user_id, roll_number, file_id, catalogue_id, faculty_uploader_id,
            department_id, subject_code, subject_name, regulation, resource_type, action
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          req.user.id, req.user.roll_number || null, file.id, record.id,
          record.faculty_uploader_id, record.department_id, record.subject_code,
          record.subject_name, record.regulation, record.resource_type,
          download ? 'student_resource_downloaded' : 'student_resource_previewed'
        ]);
      }
      return sendPdf(req, res, pdfRecord, download);
    } catch (error) {
      console.error('Public syllabus file error:', error);
      return res.status(500).json({ error: 'Unable to open this syllabus file.' });
    }
  },

  async getCatalogue(req, res) {
    try {
      const page = parsePage(req.query.page, 1, 1000000);
      const limit = parsePage(req.query.limit, 50, 100);
      if (!page || !limit) return res.status(400).json({ error: 'Page and limit must be valid positive integers.' });
      const filters = {};
      for (const key of ['program', 'regulation', 'academic_year', 'department_id', 'branch_code', 'semester']) {
        if (req.query[key] !== undefined && req.query[key] !== '') filters[key] = req.query[key];
      }
      for (const key of ['program', 'regulation', 'academic_year', 'branch_code', 'semester']) {
        if (filters[key] !== undefined && (typeof filters[key] !== 'string' || filters[key].length > 120)) {
          return res.status(400).json({ error: 'A syllabus filter value is invalid or too long.' });
        }
      }
      if (filters.department_id !== undefined && (typeof filters.department_id !== 'string' || !/^\d+$/.test(filters.department_id))) {
        return res.status(400).json({ error: 'Department filter must be a valid identifier.' });
      }
      if (req.query.published !== undefined) {
        if (!['0', '1'].includes(req.query.published)) return res.status(400).json({ error: 'Published filter must be 0 or 1.' });
        filters.published = req.query.published;
      }
      if (req.query.q !== undefined) {
        if (typeof req.query.q !== 'string' || req.query.q.length > 120) {
          return res.status(400).json({ error: 'Search text must be no longer than 120 characters.' });
        }
        filters.q = req.query.q.trim();
      }
      const params = [];
      let sql = appendFilters(CATALOGUE_SELECT, params, { includeUnpublished: true, filters });
      if (req.user.role_name === 'faculty') {
        sql += ' AND (f.owner_id = ? OR c.created_by = ?)';
        params.push(req.user.id, req.user.id);
      } else if (req.user.role_name === 'hod') {
        sql += ' AND c.department_id = ?';
        params.push(req.user.department_id || -1);
      }
      const count = await dbHelper.get(`SELECT COUNT(*) AS total FROM (${sql}) AS filtered`, params);
      sql += ' ORDER BY c.updated_at DESC, c.id DESC LIMIT ? OFFSET ?';
      const rows = await dbHelper.all(sql, [...params, limit, (page - 1) * limit]);
      res.json({ syllabus: rows, pagination: { page, limit, total: count.total, totalPages: Math.ceil(count.total / limit) } });
    } catch (error) {
      console.error('Get syllabus catalogue error:', error);
      res.status(500).json({ error: 'Unable to load the syllabus catalogue.' });
    }
  },

  async createCatalogueEntry(req, res) {
    try {
      const parsed = parseCatalogueBody(req.body);
      if (parsed.error) return res.status(400).json({ error: parsed.error });
      const values = parsed.values;
      const file = await dbHelper.get(
        'SELECT id, owner_id, department_id, name, original_name, mime_type, storage_path, visibility, deleted_at FROM files WHERE id = ?',
        [values.file_id]
      );
      if (!file || file.deleted_at !== null) return res.status(404).json({ error: 'Active file not found.' });
      if (!isPdf(file)) return res.status(400).json({ error: 'Only PDF files can be added to the syllabus catalogue.' });
      if (!await hasStoredPdfSignature(file.storage_path)) return res.status(400).json({ error: 'The uploaded file does not contain valid PDF data.' });
      if (req.user.role_name === 'admin' && values.published && file.visibility !== 'public') {
        return res.status(400).json({ error: 'Only public files can be published in the syllabus library.' });
      }
      if (req.user.role_name !== 'admin' && file.owner_id !== req.user.id &&
          !(req.user.role_name === 'hod' && req.user.department_ids?.includes(file.department_id))) {
        return res.status(403).json({ error: 'You may only submit your own PDF files or files from your department.' });
      }
      if ((req.user.role_name === 'faculty' && (!req.user.department_id || values.department_id !== req.user.department_id || file.department_id !== req.user.department_id)) ||
          (req.user.role_name === 'hod' && !req.user.department_ids?.includes(values.department_id))) {
        return res.status(403).json({ error: 'You may only submit resources for your assigned department.' });
      }
      const department = await dbHelper.get('SELECT id FROM departments WHERE id = ? AND active = 1', [values.department_id]);
      if (!department) return res.status(400).json({ error: 'The selected department does not exist.' });
      const regulation = await dbHelper.get('SELECT id FROM academic_regulations WHERE code = ? AND active = 1', [values.regulation]);
      if (!regulation) return res.status(400).json({ error: 'The selected regulation is not active.' });
      const published = req.user.role_name === 'admin' && values.published;
      const created = await dbHelper.run(`
        INSERT INTO syllabus_catalog (
          file_id, program, regulation, academic_year, department_id, branch_code,
          semester, subject_code, subject_name, resource_type, student_visible,
          published, published_at, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE NULL END, ?)
      `, [
        values.file_id, values.program, values.regulation, values.academic_year,
        values.department_id, values.branch_code, values.semester, values.subject_code,
        values.subject_name, values.resource_type, values.student_visible ? 1 : 0,
        published ? 1 : 0, published ? 1 : 0, req.user.id
      ]);
      await dbHelper.run(
        `INSERT INTO activity_logs (user_id, action, file_id, department_id, metadata)
         VALUES (?, ?, ?, ?, ?)`,
        [
          req.user.id,
          published ? 'Syllabus Published' : 'Syllabus Submitted',
          file.id,
          values.department_id,
          JSON.stringify({ catalogue_id: created.lastID, subject_code: values.subject_code })
        ]
      );
      res.status(201).json({ message: published ? 'Syllabus published.' : 'Syllabus submitted for review.', id: created.lastID });
    } catch (error) {
      if (/UNIQUE constraint failed: syllabus_catalog\.file_id/.test(error.message)) {
        return res.status(409).json({ error: 'This PDF already has a syllabus catalogue entry.' });
      }
      console.error('Create syllabus catalogue entry error:', error);
      res.status(500).json({ error: 'Unable to create syllabus catalogue entry.' });
    }
  },

  async updateCatalogueEntry(req, res) {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id < 1) return res.status(404).json({ error: 'Syllabus entry not found.' });
      const parsed = parseCatalogueBody(req.body, false);
      if (parsed.error) return res.status(400).json({ error: parsed.error });
      const existing = await dbHelper.get('SELECT * FROM syllabus_catalog WHERE id = ?', [id]);
      if (!existing) return res.status(404).json({ error: 'Syllabus entry not found.' });
      const scope = await dbHelper.get('SELECT f.owner_id, f.department_id FROM files f WHERE f.id = ?', [existing.file_id]);
      if (req.user.role_name === 'faculty' && scope.owner_id !== req.user.id && existing.created_by !== req.user.id) {
        return res.status(403).json({ error: 'You may only edit syllabus resources you submitted or uploaded.' });
      }
      if (req.user.role_name === 'hod' && !req.user.department_ids?.includes(existing.department_id)) {
        return res.status(403).json({ error: 'You may only edit syllabus resources in your department.' });
      }
      const department = await dbHelper.get('SELECT id FROM departments WHERE id = ?', [parsed.values.department_id]);
      if (!department) return res.status(400).json({ error: 'The selected department does not exist.' });
      const regulation = await dbHelper.get('SELECT id, active FROM academic_regulations WHERE code = ?', [parsed.values.regulation]);
      if (!regulation || (!regulation.active && parsed.values.regulation !== existing.regulation)) {
        return res.status(400).json({ error: 'Select an active academic regulation.' });
      }

      const fileId = parsed.values.file_id || existing.file_id;
      const file = await dbHelper.get('SELECT id, name, original_name, mime_type, storage_path, deleted_at FROM files WHERE id = ?', [fileId]);
      if (!file || file.deleted_at !== null || !isPdf(file)) {
        return res.status(400).json({ error: 'The catalogue entry must reference an active PDF file.' });
      }
      if (!await hasStoredPdfSignature(file.storage_path)) {
        return res.status(400).json({ error: 'The selected file does not contain valid PDF data.' });
      }
      const fileDetails = await dbHelper.get('SELECT visibility, owner_id, department_id FROM files WHERE id = ?', [fileId]);
      if (req.user.role_name === 'faculty' && fileDetails.owner_id !== req.user.id) {
        return res.status(403).json({ error: 'You may only manage PDF files you uploaded.' });
      }
      if (req.user.role_name === 'hod' && !req.user.department_ids?.includes(fileDetails.department_id)) {
        return res.status(403).json({ error: 'You may only manage PDF files in your department.' });
      }
      const published = req.user.role_name === 'admin'
        ? (req.body.published === undefined ? Boolean(existing.published) : parsed.values.published)
        : Boolean(existing.published);
      if (published && fileDetails.visibility !== 'public') {
        return res.status(400).json({ error: 'Only public files can be published in the syllabus library.' });
      }
      const changedPublishState = Boolean(existing.published) !== published;
      await dbHelper.run(`
        UPDATE syllabus_catalog
        SET file_id = ?, program = ?, regulation = ?, academic_year = ?,
            department_id = ?, branch_code = ?, semester = ?, subject_code = ?,
            subject_name = ?, resource_type = ?, student_visible = ?, published = ?,
            published_at = CASE WHEN ? = 1 THEN COALESCE(published_at, CURRENT_TIMESTAMP) ELSE NULL END,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [
        fileId, parsed.values.program, parsed.values.regulation, parsed.values.academic_year,
        parsed.values.department_id, parsed.values.branch_code, parsed.values.semester,
        parsed.values.subject_code, parsed.values.subject_name, parsed.values.resource_type,
        parsed.values.student_visible ? 1 : 0, published ? 1 : 0,
        published ? 1 : 0, id
      ]);
      if (changedPublishState) {
        await dbHelper.run(
          `INSERT INTO activity_logs (user_id, action, file_id, department_id, metadata)
           VALUES (?, ?, ?, ?, ?)`,
          [
            req.user.id,
            published ? 'Syllabus Published' : 'Syllabus Unpublished',
            fileId,
            parsed.values.department_id,
            JSON.stringify({ catalogue_id: id, subject_code: parsed.values.subject_code })
          ]
        );
      }
      await dbHelper.run(
        `INSERT INTO activity_logs (user_id, action, file_id, department_id, metadata)
         VALUES (?, 'Syllabus Updated', ?, ?, ?)`,
        [
          req.user.id,
          fileId,
          parsed.values.department_id,
          JSON.stringify({ catalogue_id: id, subject_code: parsed.values.subject_code })
        ]
      );
      res.json({ message: 'Syllabus catalogue entry updated.' });
    } catch (error) {
      if (/UNIQUE constraint failed: syllabus_catalog\.file_id/.test(error.message)) {
        return res.status(409).json({ error: 'This PDF already has a syllabus catalogue entry.' });
      }
      console.error('Update syllabus catalogue entry error:', error);
      res.status(500).json({ error: 'Unable to update syllabus catalogue entry.' });
    }
  },

  async setPublished(req, res) {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id < 1 || typeof req.body.published !== 'boolean') {
        return res.status(400).json({ error: 'A valid entry id and published boolean are required.' });
      }
      const entry = await dbHelper.get(`
        SELECT c.id, c.file_id, c.department_id, c.subject_code, c.published, f.visibility, f.deleted_at, f.storage_path
        FROM syllabus_catalog c JOIN files f ON f.id = c.file_id
        WHERE c.id = ?
      `, [id]);
      if (!entry) return res.status(404).json({ error: 'Syllabus entry not found.' });
      if (req.body.published && (entry.deleted_at !== null || entry.visibility !== 'public')) {
        return res.status(400).json({ error: 'Only active public files can be published.' });
      }
      if (req.body.published && !await hasStoredPdfSignature(entry.storage_path)) {
        return res.status(400).json({ error: 'Only files containing valid PDF data can be published.' });
      }
      const published = req.body.published ? 1 : 0;
      await dbHelper.run(`
        UPDATE syllabus_catalog
        SET published = ?,
            published_at = CASE WHEN ? = 1 THEN COALESCE(published_at, CURRENT_TIMESTAMP) ELSE NULL END,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [published, published, id]);
      if (Boolean(entry.published) !== req.body.published) {
        await dbHelper.run(
          `INSERT INTO activity_logs (user_id, action, file_id, department_id, metadata)
           VALUES (?, ?, ?, ?, ?)`,
          [
            req.user.id,
            published ? 'Syllabus Published' : 'Syllabus Unpublished',
            entry.file_id,
            entry.department_id,
            JSON.stringify({ catalogue_id: id, subject_code: entry.subject_code })
          ]
        );
      }
      res.json({ message: published ? 'Syllabus published.' : 'Syllabus unpublished.' });
    } catch (error) {
      console.error('Set syllabus published state error:', error);
      res.status(500).json({ error: 'Unable to update syllabus publication status.' });
    }
  },

  async deleteCatalogueEntry(req, res) {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id < 1) return res.status(404).json({ error: 'Syllabus entry not found.' });
      const entry = await dbHelper.get('SELECT id, file_id, department_id, subject_code FROM syllabus_catalog WHERE id = ?', [id]);
      if (!entry) return res.status(404).json({ error: 'Syllabus entry not found.' });
      const file = await dbHelper.get('SELECT owner_id FROM files WHERE id = ?', [entry.file_id]);
      if (req.user.role_name === 'faculty' && file.owner_id !== req.user.id) {
        return res.status(403).json({ error: 'You may only unlink resources you uploaded.' });
      }
      if (req.user.role_name === 'hod' && !req.user.department_ids?.includes(entry.department_id)) {
        return res.status(403).json({ error: 'You may only unlink resources in your department.' });
      }
      await dbHelper.run('DELETE FROM syllabus_catalog WHERE id = ?', [id]);
      await dbHelper.run(
        `INSERT INTO activity_logs (user_id, action, file_id, department_id, metadata)
         VALUES (?, 'Syllabus Catalogue Unlinked', ?, ?, ?)`,
        [req.user.id, entry.file_id, entry.department_id, JSON.stringify({ catalogue_id: id, subject_code: entry.subject_code })]
      );
      res.json({ message: 'Syllabus metadata unlinked. The stored file was not deleted.' });
    } catch (error) {
      console.error('Delete syllabus catalogue entry error:', error);
      res.status(500).json({ error: 'Unable to unlink the syllabus catalogue entry.' });
    }
  }
};

module.exports = syllabusController;
