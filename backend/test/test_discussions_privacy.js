const assert = require('node:assert/strict');
const { initDB, dbHelper, _resetForTesting } = require('../src/config/db');
const { runMigrations } = require('../src/config/migrate');
const discussionController = require('../src/controllers/discussionController');
const searchController = require('../src/controllers/searchController');
const activityController = require('../src/controllers/activityController');

function createMockReqRes({ user, body = {}, params = {}, query = {} } = {}) {
  const req = { user, body, params, query };
  let statusCode = 200;
  let responseData = null;

  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      responseData = data;
      return this;
    },
    get statusCode() {
      return statusCode;
    },
    get data() {
      return responseData;
    }
  };

  return { req, res };
}

async function runDiscussionsPrivacyTest() {
  console.log('--- Starting Private Discussions & Targeted Notifications Test ---');
  _resetForTesting({ wipe: true });

  try {
    await initDB();
    await runMigrations();

    // 1. Setup Roles
    await dbHelper.run("INSERT INTO roles (id, name) VALUES (1, 'admin'), (2, 'hod'), (3, 'faculty'), (4, 'student') ON CONFLICT (id) DO NOTHING");

    // 2. Setup Users
    const facultyA = await dbHelper.run(`
      INSERT INTO users (full_name, username, password_hash, email, role_id, status)
      VALUES ('Dr. Faculty A', 'faculty.a', 'hash', 'faculty.a@college.edu', 3, 'active')
    `);
    const facultyB = await dbHelper.run(`
      INSERT INTO users (full_name, username, password_hash, email, role_id, status)
      VALUES ('Dr. Faculty B', 'faculty.b', 'hash', 'faculty.b@college.edu', 3, 'active')
    `);
    const student1 = await dbHelper.run(`
      INSERT INTO users (full_name, username, password_hash, email, role_id, status, roll_number)
      VALUES ('Student One', 'student.one', 'hash', 'student1@college.edu', 4, 'active', '22BD1A0501')
    `);
    const student2 = await dbHelper.run(`
      INSERT INTO users (full_name, username, password_hash, email, role_id, status, roll_number)
      VALUES ('Student Two', 'student.two', 'hash', 'student2@college.edu', 4, 'active', '22BD1A0502')
    `);
    const admin = await dbHelper.run(`
      INSERT INTO users (full_name, username, password_hash, email, role_id, status)
      VALUES ('System Admin', 'sys.admin', 'hash', 'admin@college.edu', 1, 'active')
    `);

    const userFacultyA = { id: facultyA.lastID, full_name: 'Dr. Faculty A', role_name: 'faculty', role_id: 3 };
    const userFacultyB = { id: facultyB.lastID, full_name: 'Dr. Faculty B', role_name: 'faculty', role_id: 3 };
    const userStudent1 = { id: student1.lastID, full_name: 'Student One', role_name: 'student', role_id: 4 };
    const userStudent2 = { id: student2.lastID, full_name: 'Student Two', role_name: 'student', role_id: 4 };
    const userAdmin = { id: admin.lastID, full_name: 'System Admin', role_name: 'admin', role_id: 1 };

    // 3. Faculty A uploads a file
    const fileA = await dbHelper.run(`
      INSERT INTO files (name, original_name, file_type, mime_type, size, storage_path, owner_id, visibility, approval_status)
      VALUES ('Lecture_01_AI_Search.pdf', 'Lecture_01_AI_Search.pdf', 'pdf', 'application/pdf', 1024, 'storage_path_01.pdf', $1, 'public', 'approved')
    `, [userFacultyA.id]);

    // 4. Student 1 asks a private doubt on Faculty A's file
    console.log('1. Student 1 creates private doubt...');
    const { req: createReq, res: createRes } = createMockReqRes({
      user: userStudent1,
      body: {
        fileId: fileA.lastID,
        subject: 'Clarification on A* heuristic admissibility',
        messageType: 'doubt',
        messageBody: 'Can you explain why h(n) <= h*(n) guarantees optimality in tree search?'
      }
    });

    await discussionController.createDiscussion(createReq, createRes);
    assert.equal(createRes.statusCode, 200, 'Student 1 should successfully create private doubt');
    const conversationId = createRes.data.id;
    assert.ok(conversationId > 0, 'Conversation ID must be generated');

    // 5. Verify targeted notification ONLY sent to Faculty A (not to Student 2, Faculty B, or Admin)
    console.log('2. Verifying targeted notification recipient...');
    const notifsFacultyA = await dbHelper.all('SELECT * FROM notifications WHERE user_id = $1', [userFacultyA.id]);
    assert.equal(notifsFacultyA.length, 1, 'Faculty A must receive exactly 1 notification');
    assert.ok(notifsFacultyA[0].message.includes('Clarification on A*'), 'Notification must mention the discussion topic');

    const notifsFacultyB = await dbHelper.all('SELECT * FROM notifications WHERE user_id = $1', [userFacultyB.id]);
    assert.equal(notifsFacultyB.length, 0, 'Unrelated Faculty B must receive 0 notifications');

    const notifsStudent2 = await dbHelper.all('SELECT * FROM notifications WHERE user_id = $1', [userStudent2.id]);
    assert.equal(notifsStudent2.length, 0, 'Unrelated Student 2 must receive 0 notifications');

    const notifsAdmin = await dbHelper.all('SELECT * FROM notifications WHERE user_id = $1', [userAdmin.id]);
    assert.equal(notifsAdmin.length, 0, 'Admin must receive 0 private doubt notifications');

    // 6. Test strict authorization: Unrelated parties CANNOT access conversation messages
    console.log('3. Enforcing 403 Forbidden for unauthorized parties...');

    // Student 2 tries to view messages -> 403 Forbidden
    const { req: s2Req, res: s2Res } = createMockReqRes({ user: userStudent2, params: { id: conversationId } });
    await discussionController.getConversationMessages(s2Req, s2Res);
    assert.equal(s2Res.statusCode, 403, 'Student 2 must receive 403 Forbidden');

    // Faculty B tries to view messages -> 403 Forbidden
    const { req: fbReq, res: fbRes } = createMockReqRes({ user: userFacultyB, params: { id: conversationId } });
    await discussionController.getConversationMessages(fbReq, fbRes);
    assert.equal(fbRes.statusCode, 403, 'Faculty B must receive 403 Forbidden');

    // Admin tries to view messages -> 403 Forbidden (Strict 2-party privacy)
    const { req: admReq, res: admRes } = createMockReqRes({ user: userAdmin, params: { id: conversationId } });
    await discussionController.getConversationMessages(admReq, admRes);
    assert.equal(admRes.statusCode, 403, 'Admin must receive 403 Forbidden');

    // Student 2 tries to post reply -> 403 Forbidden
    const { req: s2ReplyReq, res: s2ReplyRes } = createMockReqRes({
      user: userStudent2,
      params: { id: conversationId },
      body: { messageBody: 'I am eavesdropping!' }
    });
    await discussionController.postReply(s2ReplyReq, s2ReplyRes);
    assert.equal(s2ReplyRes.statusCode, 403, 'Unauthorized student cannot reply (403)');

    // 7. Authorized Faculty A views messages and replies
    console.log('4. Authorized Faculty A views and replies...');
    const { req: faReq, res: faRes } = createMockReqRes({ user: userFacultyA, params: { id: conversationId } });
    await discussionController.getConversationMessages(faReq, faRes);
    assert.equal(faRes.statusCode, 200, 'Faculty A can view messages');
    assert.equal(faRes.data.length, 1, 'Should have initial question');

    const { req: faReplyReq, res: faReplyRes } = createMockReqRes({
      user: userFacultyA,
      params: { id: conversationId },
      body: { messageBody: 'Admissibility prevents overestimating the true cost to goal, ensuring BFS/A* expands optimal path first.' }
    });
    await discussionController.postReply(faReplyReq, faReplyRes);
    assert.equal(faReplyRes.statusCode, 200, 'Faculty A can successfully post reply');

    // 8. Targeted notification to Student 1 only
    console.log('5. Verifying reply notification delivered to asking student...');
    const notifsStudent1 = await dbHelper.all('SELECT * FROM notifications WHERE user_id = $1', [userStudent1.id]);
    assert.equal(notifsStudent1.length, 1, 'Student 1 must receive exactly 1 reply notification');
    assert.equal(notifsStudent1[0].event_type, 'doubt_faculty_replied');

    // 9. Verify private discussion content is completely excluded from Global Search
    console.log('6. Verifying discussion content is excluded from global search...');
    const { req: searchReq, res: searchRes } = createMockReqRes({
      user: userAdmin,
      query: { q: 'heuristic admissibility' }
    });
    await searchController.search(searchReq, searchRes);
    assert.equal(searchRes.statusCode, 200);
    assert.equal(searchRes.data.results.length, 0, 'Private discussion message content must NOT appear in global file search');

    // 10. Verify private discussions are excluded from global activity logs
    console.log('7. Verifying discussion content is excluded from activity logs...');
    const { req: actReq, res: actRes } = createMockReqRes({
      user: userAdmin,
      query: { search: 'admissibility' }
    });
    await activityController.getActivityLogs(actReq, actRes);
    assert.equal(actRes.statusCode, 200);
    assert.equal(actRes.data.logs.length, 0, 'Private discussions must not be logged in public activity logs');

    console.log('PASSED: Private discussions 2-party isolation, 403 enforcement, and targeted notifications verified 100%!');
  } finally {
    _resetForTesting({ wipe: true });
  }
}

runDiscussionsPrivacyTest().catch(err => {
  console.error('FAILED: Discussions privacy test failed:', err);
  process.exit(1);
});
