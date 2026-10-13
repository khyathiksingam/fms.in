const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

const DB_DIR = path.resolve(process.env.FFMS_DATA_DIR || path.resolve(__dirname, '../../data'));
const DB_FILE = path.join(DB_DIR, 'ffms.sqlite');

let db = null;
let SQL = null;

async function initDB() {
  if (db) return db;

  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  SQL = await initSqlJs();

  if (fs.existsSync(DB_FILE)) {
    const fileBuffer = fs.readFileSync(DB_FILE);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  // Enable foreign keys
  db.run("PRAGMA foreign_keys = ON;");

  // Create tables
  createSchema();
  saveDB();

  return db;
}

function saveDB() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_FILE, buffer);
}

function createSchema() {
  db.run(`
    CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL
    );

    CREATE TABLE IF NOT EXISTS departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      code TEXT UNIQUE NOT NULL,
      hod_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      role_id INTEGER NOT NULL,
      department_id INTEGER,
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'disabled')),
      must_change_password INTEGER NOT NULL DEFAULT 0,
      avatar_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (role_id) REFERENCES roles(id),
      FOREIGN KEY (department_id) REFERENCES departments(id)
    );

    CREATE TABLE IF NOT EXISTS folders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      parent_folder_id INTEGER,
      department_id INTEGER,
      created_by INTEGER NOT NULL,
      color TEXT DEFAULT 'blue',
      drive_link TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (parent_folder_id) REFERENCES folders(id) ON DELETE CASCADE,
      FOREIGN KEY (department_id) REFERENCES departments(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      original_name TEXT NOT NULL,
      file_type TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size INTEGER NOT NULL,
      storage_path TEXT NOT NULL,
      folder_id INTEGER,
      owner_id INTEGER NOT NULL,
      department_id INTEGER,
      version INTEGER DEFAULT 1,
      ocr_status TEXT DEFAULT 'pending' CHECK(ocr_status IN ('pending', 'processing', 'completed', 'failed', 'unsupported')),
      extracted_text TEXT DEFAULT '',
      is_favorite INTEGER DEFAULT 0,
      drive_link TEXT DEFAULT '',
      visibility TEXT DEFAULT 'public' CHECK(visibility IN ('public', 'private')),
      approval_status TEXT NOT NULL DEFAULT 'approved' CHECK(approval_status IN ('pending', 'approved', 'rejected')),
      reviewed_by INTEGER,
      reviewed_at DATETIME,
      review_note TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      deleted_at DATETIME DEFAULT NULL,
      FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL,
      FOREIGN KEY (owner_id) REFERENCES users(id),
      FOREIGN KEY (department_id) REFERENCES departments(id)
    );

    CREATE TABLE IF NOT EXISTS file_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_id INTEGER NOT NULL,
      version_number INTEGER NOT NULL,
      storage_path TEXT NOT NULL,
      size INTEGER NOT NULL,
      uploaded_by INTEGER NOT NULL,
      note TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
      FOREIGN KEY (uploaded_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS file_permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      permission_type TEXT NOT NULL CHECK(permission_type IN ('view', 'download', 'edit', 'delete', 'full')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS shared_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_id INTEGER NOT NULL,
      shared_by INTEGER NOT NULL,
      shared_with_user INTEGER,
      shared_with_department INTEGER,
      permission TEXT DEFAULT 'view_download' CHECK(permission IN ('view', 'view_download', 'edit')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
      FOREIGN KEY (shared_by) REFERENCES users(id),
      FOREIGN KEY (shared_with_user) REFERENCES users(id),
      FOREIGN KEY (shared_with_department) REFERENCES departments(id)
    );

    CREATE TABLE IF NOT EXISTS favorites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      file_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, file_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      action TEXT NOT NULL,
      file_id INTEGER,
      folder_id INTEGER,
      department_id INTEGER,
      metadata TEXT DEFAULT '{}',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE SET NULL,
      FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      read_status INTEGER DEFAULT 0,
      link TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS system_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      college_name TEXT DEFAULT 'Your College',
      system_name TEXT DEFAULT 'Faculty File Management System',
      college_logo TEXT DEFAULT '',
      system_logo TEXT DEFAULT '',
      max_upload_size_mb INTEGER DEFAULT 50,
      allowed_file_types TEXT DEFAULT 'pdf,doc,docx,xls,xlsx,ppt,pptx,txt,csv,jpg,jpeg,png,gif,svg,mp4,mov,avi,mp3,wav,zip,rar',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token TEXT UNIQUE NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS syllabus_catalog (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_id INTEGER NOT NULL UNIQUE,
      program TEXT NOT NULL,
      regulation TEXT NOT NULL,
      academic_year TEXT NOT NULL,
      department_id INTEGER NOT NULL,
      branch_code TEXT NOT NULL,
      semester TEXT NOT NULL,
      subject_code TEXT NOT NULL,
      subject_name TEXT NOT NULL,
      published INTEGER NOT NULL DEFAULT 0 CHECK (published IN (0, 1)),
      published_at DATETIME,
      created_by INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
      FOREIGN KEY (department_id) REFERENCES departments(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    -- Performance Indexes
    CREATE INDEX IF NOT EXISTS idx_files_folder ON files(folder_id);
    CREATE INDEX IF NOT EXISTS idx_files_owner ON files(owner_id);
    CREATE INDEX IF NOT EXISTS idx_files_dept ON files(department_id);
    CREATE INDEX IF NOT EXISTS idx_files_deleted ON files(deleted_at);
    CREATE INDEX IF NOT EXISTS idx_shared_user ON shared_files(shared_with_user);
    CREATE INDEX IF NOT EXISTS idx_shared_dept ON shared_files(shared_with_department);
    CREATE INDEX IF NOT EXISTS idx_activity_user ON activity_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_activity_dept ON activity_logs(department_id);
    CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, read_status);
    CREATE INDEX IF NOT EXISTS idx_syllabus_published ON syllabus_catalog(published);
    CREATE INDEX IF NOT EXISTS idx_syllabus_program ON syllabus_catalog(program);
    CREATE INDEX IF NOT EXISTS idx_syllabus_regulation ON syllabus_catalog(regulation);
    CREATE INDEX IF NOT EXISTS idx_syllabus_department ON syllabus_catalog(department_id);
    CREATE INDEX IF NOT EXISTS idx_syllabus_semester ON syllabus_catalog(semester);
    CREATE INDEX IF NOT EXISTS idx_syllabus_subject_code ON syllabus_catalog(subject_code);
    CREATE INDEX IF NOT EXISTS idx_syllabus_subject_name ON syllabus_catalog(subject_name);
  `);

  try { db.run("ALTER TABLE folders ADD COLUMN drive_link TEXT DEFAULT ''"); } catch (e) {}
  try { db.run("ALTER TABLE files ADD COLUMN drive_link TEXT DEFAULT ''"); } catch (e) {}
  try { db.run("ALTER TABLE files ADD COLUMN visibility TEXT DEFAULT 'public'"); } catch (e) {}
  ensureColumn('departments', 'display_group', "TEXT NOT NULL DEFAULT 'OTHER'");
  ensureColumn('departments', 'active', 'INTEGER NOT NULL DEFAULT 1');
  ensureColumn('departments', 'sort_order', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn('users', 'roll_number', 'TEXT');
  ensureColumn('users', 'programme', 'TEXT');
  ensureColumn('users', 'academic_year', 'TEXT');
  ensureColumn('users', 'semester', 'TEXT');
  ensureColumn('users', 'must_change_password', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn('users', 'email_verified', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn('users', 'email_verified_at', 'DATETIME');
  ensureColumn('users', 'verification_token_hash', 'TEXT');
  ensureColumn('users', 'verification_token_expires_at', 'DATETIME');
  ensureColumn('users', 'verification_otp_hash', 'TEXT');
  ensureColumn('users', 'verification_otp_expires_at', 'DATETIME');
  ensureColumn('users', 'verification_otp_attempts', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn('users', 'verification_otp_last_sent_at', 'DATETIME');
  ensureColumn('system_settings', 'student_self_registration', 'INTEGER NOT NULL DEFAULT 0');
  db.run("INSERT OR IGNORE INTO roles (id, name) VALUES (4, 'student');");
  db.run("UPDATE users SET email_verified = 1 WHERE role_id != 4 AND (email_verified IS NULL OR email_verified = 0);");
  ensureColumn('files', 'approval_status', "TEXT NOT NULL DEFAULT 'approved'");
  ensureColumn('files', 'reviewed_by', 'INTEGER');
  ensureColumn('files', 'reviewed_at', 'DATETIME');
  ensureColumn('files', 'review_note', "TEXT DEFAULT ''");
  ensureColumn('syllabus_catalog', 'resource_type', "TEXT NOT NULL DEFAULT 'syllabus'");
  ensureColumn('syllabus_catalog', 'student_visible', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn('sessions', 'last_seen_at', 'DATETIME');
  ensureColumn('sessions', 'ended_at', 'DATETIME');
  ensureColumn('sessions', 'expired_at', 'DATETIME');
  ensureColumn('sessions', 'end_reason', 'TEXT');
  ensureColumn('sessions', 'duration_seconds', 'INTEGER');
  ensureColumn('activity_logs', 'session_id', 'INTEGER');
  db.run('UPDATE sessions SET last_seen_at = COALESCE(last_seen_at, created_at)');
  db.run(`
    CREATE TABLE IF NOT EXISTS academic_regulations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      display_name TEXT NOT NULL,
      programme TEXT,
      effective_from TEXT,
      description TEXT NOT NULL DEFAULT '',
      active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_academic_regulations_active_order ON academic_regulations(active, sort_order, code);
  `);
  ensureColumn('academic_regulations', 'effective_from', 'TEXT');
  ensureColumn('academic_regulations', 'description', "TEXT NOT NULL DEFAULT ''");
  db.run(`
    CREATE TABLE IF NOT EXISTS hod_departments (
      hod_id INTEGER NOT NULL,
      department_id INTEGER NOT NULL,
      assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (hod_id, department_id),
      FOREIGN KEY (hod_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_hod_departments_department ON hod_departments(department_id, hod_id);
    INSERT OR IGNORE INTO hod_departments (hod_id, department_id)
      SELECT d.hod_id, d.id
      FROM departments d
      JOIN users u ON u.id = d.hod_id
      JOIN roles r ON r.id = u.role_id AND r.name = 'hod'
      WHERE d.hod_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_files_review_status ON files(approval_status, department_id, created_at);
    UPDATE syllabus_catalog SET student_visible = 1
    WHERE published = 1 AND resource_type = 'syllabus' AND student_visible = 0;
    CREATE INDEX IF NOT EXISTS idx_syllabus_resource_type ON syllabus_catalog(resource_type);
    CREATE INDEX IF NOT EXISTS idx_syllabus_student_visible ON syllabus_catalog(student_visible);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_roll_number ON users(roll_number) WHERE roll_number IS NOT NULL AND TRIM(roll_number) != '';
    CREATE TABLE IF NOT EXISTS student_resource_activity (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      roll_number TEXT,
      file_id INTEGER,
      catalogue_id INTEGER,
      faculty_uploader_id INTEGER,
      department_id INTEGER,
      subject_code TEXT,
      subject_name TEXT,
      regulation TEXT,
      resource_type TEXT,
      action TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE SET NULL,
      FOREIGN KEY (catalogue_id) REFERENCES syllabus_catalog(id) ON DELETE SET NULL,
      FOREIGN KEY (faculty_uploader_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_student_activity_user_date ON student_resource_activity(user_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_student_activity_uploader_date ON student_resource_activity(faculty_uploader_id, created_at);
  `);

  const regulations = ['R25', 'R22', 'A19', 'R19', 'R18', 'R15', 'R13', 'R12', 'R11'];
  regulations.forEach((code, index) => {
    const year = `20${code.slice(1)}`;
    db.run(
      'INSERT OR IGNORE INTO academic_regulations (code, display_name, programme, effective_from, description, active, sort_order) VALUES (?, ?, NULL, ?, ?, 1, ?)',
      [code, code, `${year} onwards`, `Academic regulation ${code} for the applicable admission cohorts.`, index + 1]
    );
    db.run(`
      UPDATE academic_regulations
      SET effective_from = CASE WHEN effective_from IS NULL OR effective_from = '' THEN ? ELSE effective_from END,
          description = CASE WHEN description IS NULL OR description = '' THEN ? ELSE description END
      WHERE code = ?
    `, [`${year} onwards`, `Academic regulation ${code} for the applicable admission cohorts.`, code]);
  });

  const departments = [
    ['Automobile Engineering', 'AE', 'ENGINEERING', 10],
    ['Biotechnology', 'BT', 'ENGINEERING', 20],
    ['Civil Engineering', 'CE', 'ENGINEERING', 30],
    ['Electrical & Electronics Engineering', 'EEE', 'ENGINEERING', 40],
    ['Electronics and Communication Engineering', 'ECE', 'ENGINEERING', 50],
    ['Electronics Engineering – VLSI Design and Technology', 'EVL', 'ENGINEERING', 60],
    ['Electronics and Instrumentation Engineering', 'EIE', 'ENGINEERING', 70],
    ['Mechanical Engineering', 'ME', 'ENGINEERING', 80],
    ['Computer Science & Engineering', 'CSECORE', 'CSE & IT', 10],
    ['Computer Science and Business Systems', 'CSBS', 'CSE & IT', 20],
    ['CSE – Artificial Intelligence & Machine Learning', 'AIML', 'CSE & IT', 30],
    ['CSE – Internet of Things', 'IOT', 'CSE & IT', 40],
    ['CSE – Robotics & Artificial Intelligence', 'RAI', 'CSE & IT', 50],
    ['CSE – Cyber Security', 'CYS', 'CSE & IT', 60],
    ['CSE – Data Science', 'DS', 'CSE & IT', 70],
    ['Artificial Intelligence & Data Science', 'AIDS', 'CSE & IT', 80],
    ['Information Technology', 'IT', 'CSE & IT', 90],
    ['Chemistry', 'CHEM', 'SCIENCES & HUMANITIES', 10],
    ['English', 'ENG', 'SCIENCES & HUMANITIES', 20],
    ['Mathematics & Management Sciences', 'MMS', 'SCIENCES & HUMANITIES', 30],
    ['Physics', 'PHY', 'SCIENCES & HUMANITIES', 40]
  ];
  db.run(
    "INSERT OR IGNORE INTO departments (id, name, code, display_group, active, sort_order) VALUES (1, 'CSE- (CYS, DS) and AI&DS', 'CSE', 'CSE & IT', 1, 1000)"
  );
  db.run(
    "UPDATE departments SET display_group = 'CSE & IT', sort_order = 1000 WHERE UPPER(code) = 'CSE' AND display_group = 'OTHER' AND sort_order = 0"
  );
  departments.forEach(([name, code, displayGroup, sortOrder]) => {
    db.run(
      'INSERT OR IGNORE INTO departments (name, code, display_group, active, sort_order) VALUES (?, ?, ?, 1, ?)',
      [name, code, displayGroup, sortOrder]
    );
    db.run(
      "UPDATE departments SET display_group = ?, sort_order = ? WHERE (UPPER(code) = ? OR LOWER(TRIM(name)) = LOWER(?)) AND display_group = 'OTHER' AND sort_order = 0",
      [displayGroup, sortOrder, code, name]
    );
  });
}

function ensureColumn(table, name, definition) {
  const result = db.exec(`PRAGMA table_info(${table})`);
  const columns = result[0]?.values.map(row => row[1]) || [];
  if (!columns.includes(name)) {
    db.run(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
  }
}

function sanitizeParams(params = []) {
  if (!Array.isArray(params)) {
    return [params === undefined ? null : params];
  }
  return params.map(p => (p === undefined ? null : p));
}

// Database helper functions providing clean promise-based async interface
const dbHelper = {
  async query(sql, params = []) {
    await initDB();
    const safeParams = sanitizeParams(params);
    const stmt = db.prepare(sql);
    stmt.bind(safeParams);
    const results = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  },

  async get(sql, params = []) {
    const rows = await this.query(sql, params);
    return rows.length > 0 ? rows[0] : null;
  },

  async all(sql, params = []) {
    return this.query(sql, params);
  },

  async run(sql, params = []) {
    await initDB();
    const safeParams = sanitizeParams(params);
    db.run(sql, safeParams);
    const res = db.exec("SELECT last_insert_rowid() as id, changes() as changes");
    const lastId = res && res[0] && res[0].values[0] ? res[0].values[0][0] : null;
    const changes = res && res[0] && res[0].values[0] ? res[0].values[0][1] : 0;
    saveDB();
    return { lastID: lastId, changes: changes };
  },

  async exec(sql) {
    await initDB();
    db.exec(sql);
    saveDB();
  },

  save() {
    saveDB();
  }
};

module.exports = {
  initDB,
  dbHelper
};
