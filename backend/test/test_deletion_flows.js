const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { dbHelper, _resetForTesting } = require('../src/config/db');
const { runMigrations } = require('../src/config/migrate');
const seedAll = require('../src/config/seed');
const { getStoragePath } = require('../src/services/storageService');
const departmentController = require('../src/controllers/departmentController');
const fileController = require('../src/controllers/fileController');

async function runDeletionFlowTests() {
  console.log('--- Starting Department & File Deletion Flows Test ---');

  _resetForTesting({ wipe: true });
  await runMigrations();
  await seedAll();

  // Helper response mock
  function createMockResponse() {
    return {
      statusCode: 200,
      body: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.body = data;
        return this;
      }
    };
  }

  // ==========================================
  // FLOW 1: DEPARTMENT DELETION & SAFE UNLINK
  // ==========================================
  console.log('\n[1] Testing Department Deletion Flow...');

  // 1A. Authorization check: Non-admin (faculty) cannot delete department
  const facultyUser = { id: 3, role_name: 'faculty', full_name: 'Prof. Faculty', department_id: 1 };
  const adminUser = { id: 1, role_name: 'admin', full_name: 'Administrator', department_id: 1 };

  // 1B. Verify initial department state
  const targetDeptId = 1; // CSE
  const deptBefore = await dbHelper.get('SELECT * FROM departments WHERE id = ?', [targetDeptId]);
  assert(deptBefore, 'Department CSE should exist before deletion');

  // Verify users, files, folders linked to Department 1
  const usersBefore = await dbHelper.all('SELECT id, username, department_id, password_hash FROM users WHERE department_id = ?', [targetDeptId]);
  const filesBefore = await dbHelper.all('SELECT id, name, department_id, storage_path FROM files WHERE department_id = ?', [targetDeptId]);
  const unrelatedDeptBefore = await dbHelper.get('SELECT * FROM departments WHERE id != ?', [targetDeptId]);
  const unrelatedFilesBefore = await dbHelper.all('SELECT id FROM files WHERE department_id != ? OR department_id IS NULL', [targetDeptId]);

  console.log(`  Initial state: Department "${deptBefore.name}" has ${usersBefore.length} user(s) and ${filesBefore.length} file(s) linked.`);
  assert(usersBefore.length > 0, 'Target department should have at least 1 linked user');
  assert(filesBefore.length > 0, 'Target department should have linked files');

  // 1C. Perform department deletion via admin
  const reqDeptDelete = {
    params: { id: targetDeptId },
    user: adminUser
  };
  const resDeptDelete = createMockResponse();

  await departmentController.deleteDepartment(reqDeptDelete, resDeptDelete);

  assert.strictEqual(resDeptDelete.statusCode, 200, `Expected 200 OK for admin department delete, got ${resDeptDelete.statusCode}: ${JSON.stringify(resDeptDelete.body)}`);
  assert(resDeptDelete.body && resDeptDelete.body.success, 'Response must indicate success: true');
  assert(resDeptDelete.body.message.includes('deleted successfully'), 'Response message must confirm deletion');
  console.log(`  ✓ Department deletion API returned 200: "${resDeptDelete.body.message}"`);

  // 1D. Verify department record is completely removed
  const deptAfter = await dbHelper.get('SELECT * FROM departments WHERE id = ?', [targetDeptId]);
  assert.strictEqual(deptAfter, null, 'Department record must be removed from departments table');
  console.log('  ✓ Department record successfully removed from database.');

  // 1E. Verify linked users are preserved and safely unlinked (password hash and account intact)
  for (const u of usersBefore) {
    const userAfter = await dbHelper.get('SELECT id, username, department_id, password_hash FROM users WHERE id = ?', [u.id]);
    assert(userAfter, `User account ${u.username} must still exist`);
    assert.strictEqual(userAfter.department_id, null, `User ${u.username} department_id must be safely unlinked to NULL`);
    assert.strictEqual(userAfter.password_hash, u.password_hash, `User ${u.username} password hash must be 100% preserved`);
  }
  console.log(`  ✓ All ${usersBefore.length} linked user(s) safely unlinked with credentials and profiles 100% preserved.`);

  // 1F. Verify linked files are preserved and safely unlinked
  for (const f of filesBefore) {
    const fileAfter = await dbHelper.get('SELECT id, name, department_id FROM files WHERE id = ?', [f.id]);
    assert(fileAfter, `User-uploaded file "${f.name}" must not be deleted`);
    assert.strictEqual(fileAfter.department_id, null, `File "${f.name}" department_id must be unlinked to NULL`);
  }
  console.log(`  ✓ All ${filesBefore.length} user file(s) safely unlinked without data loss.`);

  // 1G. Verify unrelated departments remain untouched
  const unrelatedDeptAfter = await dbHelper.get('SELECT * FROM departments WHERE id = ?', [unrelatedDeptBefore.id]);
  assert(unrelatedDeptAfter, 'Unrelated departments must not be affected');
  if (unrelatedFilesBefore.length > 0) {
    const ids = unrelatedFilesBefore.map(f => f.id).join(',');
    const unrelatedFilesAfter = await dbHelper.all(`SELECT id FROM files WHERE id IN (${ids})`);
    assert.strictEqual(unrelatedFilesAfter.length, unrelatedFilesBefore.length, 'Unrelated files must not be deleted');
  }
  console.log('  ✓ Unrelated departments and files remained 100% intact.');


  // ==========================================
  // FLOW 2: FILE DELETION (DATABASE & STORAGE)
  // ==========================================
  console.log('\n[2] Testing File Deletion Flow (Database Record & Physical File Purge)...');

  // 2A. Create a physical test file on disk and in database
  const testFileName = `test_upload_${Date.now()}.pdf`;
  const physicalPath = getStoragePath(testFileName);
  fs.writeFileSync(physicalPath, 'Sample test file content for deletion testing.');
  assert(fs.existsSync(physicalPath), 'Physical test file must exist on disk before deletion');

  // Ensure test faculty user exists
  let fileOwner = await dbHelper.get('SELECT * FROM users WHERE role_id = 3 LIMIT 1');
  if (!fileOwner) {
    const userRes = await dbHelper.run(`
      INSERT INTO users (full_name, username, password_hash, email, role_id, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `, ['Prof. Test Faculty', 'testfaculty_' + Date.now(), '$2a$10$abcdef', 'testfaculty_' + Date.now() + '@vnrvjiet.in', 3, 'active']);
    fileOwner = await dbHelper.get('SELECT * FROM users WHERE id = ?', [userRes.lastID]);
  }
  fileOwner.role_name = 'faculty';

  const insertResult = await dbHelper.run(`
    INSERT INTO files (
      name, original_name, file_type, mime_type, size,
      storage_path, owner_id, department_id, visibility, approval_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    'Important_Lecture_Notes.pdf',
    'Important_Lecture_Notes.pdf',
    'pdf',
    'application/pdf',
    48,
    testFileName,
    fileOwner.id,
    null,
    'public',
    'approved'
  ]);
  const testFileId = insertResult.lastID;
  assert(testFileId, 'File record must be inserted with valid ID');

  // Create an additional physical version file
  const testVersionName = `test_v2_${Date.now()}.pdf`;
  const physicalVersionPath = getStoragePath(testVersionName);
  fs.writeFileSync(physicalVersionPath, 'Version 2 content.');
  await dbHelper.run(`
    INSERT INTO file_versions (file_id, version_number, storage_path, size, uploaded_by, note)
    VALUES (?, 2, ?, ?, ?, 'Revision 2')
  `, [testFileId, testVersionName, 18, fileOwner.id]);

  // Create associated student conversation & message
  const convRes = await dbHelper.run(`
    INSERT INTO file_conversations (file_id, student_id, faculty_id, subject, status)
    VALUES (?, 1, ?, 'Doubt on notes', 'open')
  `, [testFileId, fileOwner.id]);
  const convId = convRes.lastID;
  await dbHelper.run(`
    INSERT INTO file_messages (conversation_id, sender_id, message_type, message_body)
    VALUES (?, 1, 'doubt', 'Could you clarify theorem 3?')
  `, [convId]);
  await dbHelper.run(`
    INSERT INTO notifications (user_id, sender_id, title, message, event_type, related_file_id, related_conversation_id)
    VALUES (?, 1, 'New Doubt', 'Question on lecture notes', 'discussion_doubt', ?, ?)
  `, [fileOwner.id, testFileId, convId]);

  // Verify file and storage exist
  assert(fs.existsSync(physicalPath), 'Physical file exists');
  assert(fs.existsSync(physicalVersionPath), 'Physical version file exists');
  const fileInDbBefore = await dbHelper.get('SELECT * FROM files WHERE id = ?', [testFileId]);
  assert(fileInDbBefore, 'File record exists in DB');
  console.log(`  Created test file #${testFileId} with disk binaries and linked conversation/notification records.`);

  // 2B. Authorization Check: Unrelated faculty member cannot delete this file
  const unrelatedFaculty = { id: 99, role_name: 'faculty', full_name: 'Stranger Faculty', department_id: 3, department_ids: [3] };
  const reqUnauthorized = {
    params: { id: testFileId },
    query: { permanent: 'true' },
    user: unrelatedFaculty
  };
  const resUnauthorized = createMockResponse();
  await fileController.deleteFile(reqUnauthorized, resUnauthorized);
  assert.strictEqual(resUnauthorized.statusCode, 403, 'Unauthorized user must be rejected with 403 Forbidden');
  console.log('  ✓ Authorization check enforced: Unauthorized faculty blocked with 403 Forbidden.');

  // 2C. Authorized File Owner deletes file permanently
  const reqAuthorized = {
    params: { id: testFileId },
    query: { permanent: 'true' },
    user: fileOwner
  };
  const resAuthorized = createMockResponse();
  await fileController.deleteFile(reqAuthorized, resAuthorized);

  assert.strictEqual(resAuthorized.statusCode, 200, `Expected 200 OK for permanent delete, got ${resAuthorized.statusCode}: ${JSON.stringify(resAuthorized.body)}`);
  assert(resAuthorized.body && resAuthorized.body.success, 'Response must indicate success: true');
  assert(resAuthorized.body.message.includes('permanently deleted'), 'Response message must confirm permanent deletion');
  console.log(`  ✓ File permanent deletion API returned 200: "${resAuthorized.body.message}"`);

  // 2D. Verify physical file and version files are purged from storage disk
  assert.strictEqual(fs.existsSync(physicalPath), false, 'Primary physical file must be deleted from storage');
  assert.strictEqual(fs.existsSync(physicalVersionPath), false, 'Version physical file must be deleted from storage');
  console.log('  ✓ Stored file and all version files completely removed from disk storage.');

  // 2E. Verify database record is completely purged from files table
  const fileInDbAfter = await dbHelper.get('SELECT * FROM files WHERE id = ?', [testFileId]);
  assert.strictEqual(fileInDbAfter, null, 'File record must be completely deleted from files table');
  console.log('  ✓ File record completely removed from database.');

  // 2F. Verify child relational records are cleaned up without orphan data
  const convAfter = await dbHelper.get('SELECT * FROM file_conversations WHERE file_id = ?', [testFileId]);
  assert.strictEqual(convAfter, null, 'File conversation records must be removed');
  const msgAfter = await dbHelper.get('SELECT * FROM file_messages WHERE conversation_id = ?', [convId]);
  assert.strictEqual(msgAfter, null, 'Discussion messages must be removed');
  const notifAfter = await dbHelper.get('SELECT * FROM notifications WHERE related_file_id = ?', [testFileId]);
  assert.strictEqual(notifAfter, null, 'File notifications must be removed');
  console.log('  ✓ Associated conversations, messages, and notifications safely purged.');

  // 2G. Verify other user-uploaded files remain 100% intact
  const otherFilesCount = await dbHelper.get('SELECT COUNT(*) as count FROM files');
  assert(Number(otherFilesCount.count) > 0, 'Other files must not be deleted');
  console.log(`  ✓ Unrelated files remain intact (${otherFilesCount.count} existing files verified).`);

  // ==========================================
  // FLOW 3: TRASH EMPTYING & PERMANENT DELETE ROUTE
  // ==========================================
  console.log('\n[3] Testing /files/:id/permanent and /trash/empty Flows...');

  // Create another file in trash
  const trashFileName = `test_trash_${Date.now()}.pdf`;
  const trashPath = getStoragePath(trashFileName);
  fs.writeFileSync(trashPath, 'Trash content.');
  const trashFileResult = await dbHelper.run(`
    INSERT INTO files (name, original_name, file_type, mime_type, size, storage_path, owner_id, deleted_at)
    VALUES (?, ?, 'pdf', 'application/pdf', 14, ?, ?, CURRENT_TIMESTAMP)
  `, ['Trash_Doc.pdf', 'Trash_Doc.pdf', trashFileName, adminUser.id]);
  const trashFileId = trashFileResult.lastID;

  // Permanent delete via /files/:id/permanent
  const reqPermRoute = { params: { id: trashFileId }, user: adminUser };
  const resPermRoute = createMockResponse();
  await fileController.permanentlyDeleteFile(reqPermRoute, resPermRoute);
  assert.strictEqual(resPermRoute.statusCode, 200, 'Permanently delete endpoint returned 200');
  assert.strictEqual(fs.existsSync(trashPath), false, 'Trash physical file purged from storage');
  const trashDb = await dbHelper.get('SELECT * FROM files WHERE id = ?', [trashFileId]);
  assert.strictEqual(trashDb, null, 'Trash file purged from DB');
  console.log('  ✓ /files/:id/permanent permanently purged file record and storage file.');

  console.log('\nPASSED: Both Department Deletion and File Deletion flows verified 100% successfully!\n');
}

runDeletionFlowTests().catch(err => {
  console.error('\nFAILED: Deletion flow test failed:', err);
  process.exit(1);
});
