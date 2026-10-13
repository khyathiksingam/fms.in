const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { initDB, dbHelper } = require('./db');
const { STORAGE_DIR, getStoragePath } = require('../services/storageService');

/**
 * Non-destructive initial seeder.
 * Ensures baseline system tables, default admin account, and core college files are always initialized.
 * NEVER deletes or wipes user uploaded files.
 */
async function seed() {
  console.log('--- Checking System Initialization (Permanent Cloud Storage) ---');
  await initDB();

  // 1. Seed Roles
  await dbHelper.run("INSERT OR IGNORE INTO roles (id, name) VALUES (1, 'admin'), (2, 'hod'), (3, 'faculty')");
  await dbHelper.run("INSERT OR IGNORE INTO roles (name) VALUES ('student')");

  // 2. Seed System Settings (100 GB Cloud Quota)
  const existingSettings = await dbHelper.get("SELECT COUNT(*) as count FROM system_settings");
  if (!existingSettings || existingSettings.count === 0) {
    await dbHelper.run(`
      INSERT INTO system_settings (
        college_name, system_name, college_logo, system_logo, max_upload_size_mb, allowed_file_types
      ) VALUES (
        'Vallurupalli Nageswara Rao Vignana Jyothi Institute of Engineering & Technology',
        'Faculty File Management System',
        '/brand/vnrvjiet-full-logo.png',
        '/brand/vnrvjiet-mark.png',
        1024,
        'pdf,doc,docx,xls,xlsx,ppt,pptx,txt,csv,jpg,jpeg,png,gif,svg,mp4,mov,avi,mp3,wav,zip,rar'
      )
    `);
  }

  // 3. Ensure Single College Department: CSE- (CYS, DS) and AI&DS (Code: CSE)
  const existingDept = await dbHelper.get("SELECT * FROM departments WHERE id = 1");
  if (!existingDept) {
    await dbHelper.run("INSERT INTO departments (id, name, code) VALUES (1, 'CSE- (CYS, DS) and AI&DS', 'CSE')");
  }

  // 4. Ensure an administrator exists without a built-in password.
  const existingAdmin = await dbHelper.get(`
    SELECT u.id
    FROM users u
    JOIN roles r ON r.id = u.role_id
    WHERE r.name = 'admin'
    ORDER BY u.id
    LIMIT 1
  `);
  if (!existingAdmin) {
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword) {
      throw new Error('Set ADMIN_PASSWORD in backend/.env to initialize the administrator account.');
    }
    const adminPass = await bcrypt.hash(adminPassword, 10);
    await dbHelper.run(`
      INSERT INTO users (full_name, username, password_hash, email, role_id, department_id, status)
      VALUES (?, ?, ?, ?, 1, 1, 'active')
    `, [
      process.env.ADMIN_FULL_NAME || 'System Administrator',
      process.env.ADMIN_USERNAME || 'admin',
      adminPass,
      process.env.ADMIN_EMAIL || 'admin@example.edu'
    ]);
  }

  await seedHodAccounts();

  // 5. Baseline Documents: Ensure core academic files are preserved and never vanish
  const fileCount = await dbHelper.get("SELECT COUNT(*) as count FROM files");
  if (!fileCount || fileCount.count === 0) {
    console.log('Seeding baseline academic documents to ensure 100% persistent cloud storage...');

    if (!fs.existsSync(STORAGE_DIR)) {
      fs.mkdirSync(STORAGE_DIR, { recursive: true });
    }

    const baselineFiles = [
      {
        name: 'What is the Uninformed Search Strategies in AI.docx',
        file_type: 'document',
        mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        size: 840000,
        drive_link: 'https://docs.google.com/document/d/1aZrGqu0sOMcQV_1zoa-ef2rvWSuxumHh/edit?usp=drive_link',
        text: 'Uninformed search algorithms (also known as blind search) have no additional information about states beyond that provided in the problem definition. Examples include Breadth-First Search (BFS), Depth-First Search (DFS), Uniform-Cost Search, Depth-Limited Search, and Iterative Deepening Search.'
      },
      {
        name: '~$ NOTES 2.docx',
        file_type: 'document',
        mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        size: 162,
        drive_link: '',
        text: 'Temporary working buffer and session lock file for AI Lecture Notes Section 2.'
      },
      {
        name: '~$troduction to AI.docx',
        file_type: 'document',
        mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        size: 162,
        drive_link: '',
        text: 'Temporary working buffer for Introduction to Artificial Intelligence and Machine Learning Fundamentals.'
      },
      {
        name: 'AI NOTES 2.pdf',
        file_type: 'pdf',
        mime_type: 'application/pdf',
        size: 2632000,
        drive_link: 'https://drive.google.com/file/d/1VLOYLXAhuPR3OsO9zFn1nk35dunSX3zr/view?usp=drive_link',
        text: 'Department of Computer Science & Engineering. Artificial Intelligence Unit II Notes: Knowledge Representation, First Order Logic, Inference Rules, Forward and Backward Chaining, Resolution refutation.'
      },
      {
        name: 'ai notes 3.docx',
        file_type: 'document',
        mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        size: 4184000,
        drive_link: 'https://docs.google.com/document/d/1DkfuhoDid9472fWKfNBiaI9K1jONn6Tz/edit?usp=drive_link',
        text: 'Artificial Intelligence Unit III Comprehensive Notes: Probabilistic Reasoning, Bayesian Networks, Conditional Independence, Markov Decision Processes, Game Playing, Min-Max search with Alpha-Beta Pruning.'
      },
      {
        name: 'ai notes 3.pdf',
        file_type: 'pdf',
        mime_type: 'application/pdf',
        size: 4550000,
        drive_link: 'https://drive.google.com/file/d/12succ16Vf6_5OWyvQz1-QtV0tnEAfLUf/view?usp=drive_link',
        text: 'Computer Science Unit 3 Handout. Statistical Learning, Hidden Markov Models, Exact Inference in Bayesian Networks, Variable Elimination Algorithm.'
      },
      {
        name: 'DEPARTMENT OF COMPUTER SCIENCE AND ENGINEERING (CSE-CYS).docx',
        file_type: 'document',
        mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        size: 4016000,
        drive_link: 'https://docs.google.com/document/d/1m-2JxiISorTM5Te3pYd1M7H3q8TqCwtP/edit?usp=drive_link',
        text: 'Department of Computer Science & Engineering. Academic Regulations, Course Outcomes (COs), Program Outcomes (POs), Program Specific Outcomes (PSOs).'
      },
      {
        name: 'lecture-bayesian-networks.pdf',
        file_type: 'pdf',
        mime_type: 'application/pdf',
        size: 1541000,
        drive_link: 'https://drive.google.com/file/d/1aDooxThb-_TwvEy8UQ3fk7B4Potxt9VU/view?usp=drive_link',
        text: 'Lecture Slides: Bayesian Networks and Directed Acyclic Graphs (DAG). Joint Probability Distribution factorization, d-separation, conditional probability tables (CPT).'
      },
      {
        name: 'min max.docx',
        file_type: 'document',
        mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        size: 889800,
        drive_link: 'https://docs.google.com/document/d/1YcA4hMs4OOWP7kpnmrGEm6JPYfj2itf_/edit?usp=drive_link',
        text: 'Adversarial Search: Minimax Algorithm and Alpha-Beta Pruning. Evaluation Functions, Game Tree State Space Search, Cut-offs, Horizon Effect.'
      },
      {
        name: 'prepages in AI course file.doc',
        file_type: 'document',
        mime_type: 'application/msword',
        size: 59900,
        drive_link: 'https://docs.google.com/document/d/1wyxD-UUqi6pwC0qOcJcSEKJ1dPV_qfDq/edit?usp=drive_link',
        text: 'Course File Preliminary Documentation: Syllabus, Lesson Plan, Time Table, Mapping of Course Outcomes to Program Outcomes, Teaching Schedule.'
      },
      {
        name: 'The objective of our study was to develop an intelligent system.docx',
        file_type: 'document',
        mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        size: 14725,
        drive_link: '',
        text: 'Research Study Abstract: The primary objective of this study was to design and implement an intelligent faculty file management and OCR-indexing platform for automated document categorization and search.'
      }
    ];

    for (const item of baselineFiles) {
      const storageFilename = `permanent_${Date.now()}_${item.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const fullPath = path.join(STORAGE_DIR, storageFilename);

      if (!fs.existsSync(fullPath)) {
        fs.writeFileSync(fullPath, Buffer.from(item.text, 'utf8'));
      }

      await dbHelper.run(`
        INSERT INTO files (
          name, original_name, file_type, mime_type, size,
          storage_path, folder_id, owner_id, department_id,
          version, ocr_status, extracted_text, drive_link, visibility
        ) VALUES (?, ?, ?, ?, ?, ?, NULL, 1, 1, 1, 'completed', ?, ?, 'public')
      `, [
        item.name,
        item.name,
        item.file_type,
        item.mime_type,
        item.size,
        storageFilename,
        item.text,
        item.drive_link
      ]);
    }
    console.log(`Successfully restored ${baselineFiles.length} baseline college documents into persistent cloud repository.`);
  }

  console.log('System verified: Database is 100% persistent and non-destructive. User files & folders are preserved.');
}

async function seedHodAccounts() {
  const temporaryPassword = process.env.FFMS_HOD_TEMP_PASSWORD;
  if (!temporaryPassword) {
    console.log('Skipping HOD account provisioning because FFMS_HOD_TEMP_PASSWORD is not configured.');
    return;
  }
  const hodRole = await dbHelper.get("SELECT id FROM roles WHERE name = 'hod'");
  const departments = await dbHelper.all('SELECT id, code FROM departments');
  const departmentIds = new Map(departments.map(department => [department.code.toUpperCase(), department.id]));
  const assignments = [
    ['AE', 'Dr. Shaik Amjad', 'shaik.amjad', null, 'hod.shaik.amjad'],
    ['BT', 'Dr. Krovvidi Sree Rama SivaSai', 'krovvidi.sreeramasivasai', null, 'hod.krovvidi.sree.rama.sivasai'],
    ['CE', 'Dr. K. Ramujee', 'k.ramujee', null, 'hod.k.ramujee'],
    ['EEE', 'Dr. V. Ramesh Babu', 'v.rameshbabu', null, 'hod.v.ramesh.babu'],
    ['ECE', 'Dr. P. Kishore', 'p.kishore', null, 'hod.p.kishore'],
    ['EVL', 'Dr. P. Kishore', 'p.kishore', null, 'hod.p.kishore'],
    ['EIE', 'Dr. S. Pranavanand', 's.pranavanand', null, 'hod.s.pranavanand'],
    ['ME', 'Dr. B.V.R. Ravi Kumar', 'bvr.ravikumar', null, 'hod.b.v.r.ravi.kumar'],
    ['CSECORE', 'V. Baby', 'v.baby', null, 'hod.v.baby'],
    ['CSBS', 'V. Baby', 'v.baby', null, 'hod.v.baby'],
    ['AIML', 'Y Sagar', 'y.sagar', 'Sagar Y', 'hod.sagar.y'],
    ['IOT', 'Y Sagar', 'y.sagar', 'Sagar Y', 'hod.sagar.y'],
    ['RAI', 'Y Sagar', 'y.sagar', 'Sagar Y', 'hod.sagar.y'],
    ['CYS', 'Dr. Pasupuleti Venkata Siva Kumar', 'pasupuleti.sivakumar', null, 'hod.pasupuleti.venkata.siva.kumar'],
    ['DS', 'Dr. Pasupuleti Venkata Siva Kumar', 'pasupuleti.sivakumar', null, 'hod.pasupuleti.venkata.siva.kumar'],
    ['AIDS', 'Dr. Pasupuleti Venkata Siva Kumar', 'pasupuleti.sivakumar', null, 'hod.pasupuleti.venkata.siva.kumar'],
    ['IT', 'Dr. N. Mangathayaru', 'n.mangathayaru', null, 'hod.n.mangathayaru'],
    ['CHEM', 'Dr. Jyotsna Cherukuri', 'jyotsna.cherukuri', null, 'hod.jyotsna.cherukuri'],
    ['ENG', 'Dr. Kanchana Sundaram', 'kanchana.sundaram', null, 'hod.kanchana.sundaram'],
    ['MMS', 'Dr. P. Aparna', 'p.aparna', null, 'hod.p.aparna'],
    ['PHY', 'Dr. Ashok Bhogi', 'ashok.bhogi', null, 'hod.ashok.bhogi']
  ];
  const usersByName = new Map();
  const assignedUserIds = new Set();
  const assignedHodsByDepartment = new Map();

  for (const [departmentCode, fullName, username, legacyName, legacyUsername] of assignments) {
    const departmentId = departmentIds.get(departmentCode);
    if (!departmentId) {
      console.warn(`Skipped HOD assignment for unknown department code ${departmentCode}.`);
      continue;
    }
    let hod = usersByName.get(fullName);
    if (!hod) {
      const lookupNames = [fullName, ...(legacyName ? [legacyName] : [])];
      const lookupUsernames = [username, ...(legacyUsername ? [legacyUsername] : [])];
      const matches = await dbHelper.all(
        `SELECT u.id, u.username, u.full_name
         FROM users u JOIN roles r ON r.id = u.role_id
         WHERE r.name = 'hod'
           AND (
             LOWER(TRIM(u.full_name)) IN (${lookupNames.map(() => 'LOWER(TRIM(?))').join(', ')})
             OR LOWER(u.username) IN (${lookupUsernames.map(() => 'LOWER(?)').join(', ')})
           )
         ORDER BY u.id`,
        [...lookupNames, ...lookupUsernames]
      );
      hod = matches.find(user => user.username.toLowerCase() === username.toLowerCase()) ||
        matches.find(user => user.username.toLowerCase() === legacyUsername?.toLowerCase()) ||
        matches.find(user => lookupNames.some(name => name.toLowerCase() === user.full_name.toLowerCase())) ||
        null;

      if (!hod) {
        const usernameOwner = await dbHelper.get('SELECT id FROM users WHERE LOWER(username) = LOWER(?)', [username]);
        if (usernameOwner) {
          throw new Error(`Cannot assign HOD login ${username}; that username already belongs to another account.`);
        }
        const emailBase = `hod.${username}@accounts.invalid`;
        let email = emailBase;
        let suffix = 1;
        while (await dbHelper.get('SELECT id FROM users WHERE LOWER(email) = LOWER(?)', [email])) {
          email = `hod.${username}.${suffix++}@accounts.invalid`;
        }

        const passwordHash = await bcrypt.hash(temporaryPassword, 10);
        const inserted = await dbHelper.run(`
          INSERT INTO users (full_name, username, password_hash, email, role_id, department_id, status, must_change_password)
          VALUES (?, ?, ?, ?, ?, ?, 'active', 1)
        `, [fullName, username, passwordHash, email, hodRole.id, departmentId]);
        hod = { id: inserted.lastID, username, full_name: fullName };
      }
      assignedUserIds.add(hod.id);
      usersByName.set(fullName, hod);

      for (const duplicate of matches) {
        if (duplicate.id === hod.id || assignedUserIds.has(duplicate.id)) continue;
        console.warn(`Disabling duplicate HOD account ${duplicate.username} for ${fullName}.`);
        await dbHelper.run("UPDATE users SET status = 'disabled', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [duplicate.id]);
        await dbHelper.run(`
          INSERT OR IGNORE INTO hod_departments (hod_id, department_id, assigned_at)
          SELECT ?, department_id, assigned_at FROM hod_departments WHERE hod_id = ?
        `, [hod.id, duplicate.id]);
        await dbHelper.run('UPDATE departments SET hod_id = ? WHERE hod_id = ?', [hod.id, duplicate.id]);
        await dbHelper.run('DELETE FROM hod_departments WHERE hod_id = ?', [duplicate.id]);
      }

      const existingUsername = hod.username || username;
      await dbHelper.run(`
        UPDATE users
        SET full_name = ?, username = ?, role_id = ?, department_id = ?,
            status = 'active', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [fullName, existingUsername, hodRole.id, departmentId, hod.id]);
    }

    assignedHodsByDepartment.set(departmentId, hod.id);
  }

  for (const [departmentId, hodId] of assignedHodsByDepartment) {
    await dbHelper.run(
      'DELETE FROM hod_departments WHERE department_id = ? AND hod_id != ?',
      [departmentId, hodId]
    );
    await dbHelper.run(
      'INSERT OR IGNORE INTO hod_departments (hod_id, department_id) VALUES (?, ?)',
      [hodId, departmentId]
    );
    await dbHelper.run('UPDATE departments SET hod_id = ? WHERE id = ?', [hodId, departmentId]);
  }
}

async function seedSyllabusCatalog() {
  try {
    const count = await dbHelper.get("SELECT COUNT(*) as count FROM syllabus_catalog");
    if (count && count.count > 0) return;

    const admin = await dbHelper.get(`
      SELECT u.id
      FROM users u
      JOIN roles r ON r.id = u.role_id
      WHERE r.name = 'admin' AND u.status = 'active'
      ORDER BY u.id
      LIMIT 1
    `);
    const adminId = admin ? admin.id : 1;

    const items = [
      {
        name: 'Computer_Networks_Syllabus_2026.pdf',
        storage_path: '2cfb2661-f405-46d8-b306-578d7aa5d75f_1787814260513_Computer_Networks_Syllabus_2026.pdf',
        size: 769,
        program: 'B.Tech',
        regulation: 'R22',
        academic_year: '2025-26',
        department_id: 15,
        branch_code: 'CSE',
        semester: '4',
        subject_code: '22PC1CS401',
        subject_name: 'Computer Networks',
        resource_type: 'syllabus'
      },
      {
        name: 'DBMS_Lab_Manual_v2.pdf',
        storage_path: 'd918e5e6-7624-4e99-bd27-f72d14ea4e3e_1787814260518_DBMS_Lab_Manual_v2.pdf',
        size: 741,
        program: 'B.Tech',
        regulation: 'R22',
        academic_year: '2025-26',
        department_id: 15,
        branch_code: 'CSE',
        semester: '4',
        subject_code: '22PC2CS402',
        subject_name: 'Database Management Systems Laboratory',
        resource_type: 'syllabus'
      },
      {
        name: 'AI_NOTES_2.pdf',
        storage_path: 'permanent_1791277024446_AI_NOTES_2.pdf',
        size: 2632000,
        program: 'B.Tech',
        regulation: 'R22',
        academic_year: '2025-26',
        department_id: 17,
        branch_code: 'AIML',
        semester: '5',
        subject_code: '22PC1AI501',
        subject_name: 'Artificial Intelligence & Neural Networks',
        resource_type: 'faculty_note'
      },
      {
        name: 'lecture-bayesian-networks.pdf',
        storage_path: 'permanent_1791277024479_lecture-bayesian-networks.pdf',
        size: 1541000,
        program: 'B.Tech',
        regulation: 'R22',
        academic_year: '2025-26',
        department_id: 21,
        branch_code: 'DS',
        semester: '6',
        subject_code: '22PC1DS601',
        subject_name: 'Probabilistic Graphical Models & Bayesian Networks',
        resource_type: 'faculty_note'
      },
      {
        name: 'SIH26091.pdf',
        storage_path: '25b34f91-05d4-41dd-91bb-914cdf92c04d_1791279835211_SIH26091.pdf',
        size: 1244850,
        program: 'B.Tech',
        regulation: 'R22',
        academic_year: '2025-26',
        department_id: 23,
        branch_code: 'IT',
        semester: '6',
        subject_code: '22PW1IT601',
        subject_name: 'Software Project Engineering & Hackathon Technical Guidelines',
        resource_type: 'syllabus'
      }
    ];

    for (const item of items) {
      const fullPath = getStoragePath(item.storage_path);
      if (!fs.existsSync(fullPath)) {
        console.warn(`Skipping seeded syllabus without a stored PDF: ${item.name}`);
        continue;
      }
      const descriptor = fs.openSync(fullPath, 'r');
      const header = Buffer.alloc(1024);
      let bytesRead;
      try {
        bytesRead = fs.readSync(descriptor, header, 0, header.length, 0);
      } finally {
        fs.closeSync(descriptor);
      }
      if (!header.toString('latin1', 0, bytesRead).includes('%PDF-')) {
        console.warn(`Skipping seeded syllabus containing non-PDF data: ${item.name}`);
        continue;
      }
      let file = await dbHelper.get("SELECT id FROM files WHERE storage_path = ? OR name = ?", [item.storage_path, item.name]);
      if (!file) {
        const res = await dbHelper.run(`
          INSERT INTO files (
            name, original_name, file_type, mime_type, size,
            storage_path, folder_id, owner_id, department_id,
            version, ocr_status, visibility, approval_status
          ) VALUES (?, ?, 'pdf', 'application/pdf', ?, ?, NULL, ?, ?, 1, 'completed', 'public', 'approved')
        `, [item.name, item.name, item.size, item.storage_path, adminId, item.department_id]);
        file = { id: res.lastID };
      }
      await dbHelper.run(`
        INSERT OR IGNORE INTO syllabus_catalog (
          file_id, program, regulation, academic_year,
          department_id, branch_code, semester, subject_code,
          subject_name, published, published_at, created_by,
          resource_type, student_visible
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, ?, ?, 1)
      `, [
        file.id, item.program, item.regulation, item.academic_year,
        item.department_id, item.branch_code, item.semester, item.subject_code,
        item.subject_name, adminId, item.resource_type
      ]);
    }
  } catch (err) {
    console.error('Failed to seed syllabus catalog:', err);
  }
}

module.exports = async function seedAll() {
  await seed();
  await seedSyllabusCatalog();
};
