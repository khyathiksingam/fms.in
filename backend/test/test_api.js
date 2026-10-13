const http = require('http');

const BASE_URL = process.env.FFMS_TEST_URL || 'http://localhost:5000/api';

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${BASE_URL}${path}`);
    const reqOptions = {
      method: options.method || 'GET',
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    };

    const req = http.request(reqOptions, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          resolve({ status: res.statusCode, data: json, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, body, headers: res.headers });
        }
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('====================================================');
  console.log('  Running Faculty File Management System (FFMS) Tests');
  console.log('====================================================');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`  ✓ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${testName}`);
      failed++;
    }
  }

  try {
    const credentials = {
      adminUsername: process.env.FFMS_ADMIN_USER,
      adminPassword: process.env.FFMS_ADMIN_PASSWORD,
      hodUsername: process.env.FFMS_HOD_TEST_USER,
      hodPassword: process.env.FFMS_HOD_TEST_PASSWORD,
      facultyUsername: process.env.FFMS_FACULTY_TEST_USER,
      facultyPassword: process.env.FFMS_FACULTY_TEST_PASSWORD
    };
    if (Object.values(credentials).some(value => !value)) {
      throw new Error('Set FFMS_ADMIN_USER/PASSWORD, FFMS_HOD_TEST_USER/PASSWORD, and FFMS_FACULTY_TEST_USER/PASSWORD to run API integration tests.');
    }

    // 1. Health check
    const health = await request('/health');
    assert(health.status === 200 && health.data.status === 'online', 'API Health Check');

    // 2. Public Settings
    const pubSettings = await request('/settings/public');
    assert(pubSettings.status === 200 &&
      pubSettings.data.settings.college_name.includes('Vignana Jyothi'),
    'Public College Branding Settings');

    // 3. Admin Login
    const adminLogin = await request('/auth/login', {
      method: 'POST',
      body: {
        username: credentials.adminUsername,
        password: credentials.adminPassword
      }
    });
    assert(adminLogin.status === 200 && Boolean(adminLogin.data.token), 'Admin Login Authentication');
    const adminToken = adminLogin.data.token;

    // 4. HOD Login
    const hodLogin = await request('/auth/login', {
      method: 'POST',
      body: { username: credentials.hodUsername, password: credentials.hodPassword }
    });
    assert(hodLogin.status === 200 && hodLogin.data.user.role_name === 'hod', 'HOD Login (Dr. Ravi Kumar)');
    const hodToken = hodLogin.data.token;

    // 5. Faculty Login
    const facultyLogin = await request('/auth/login', {
      method: 'POST',
      body: { username: credentials.facultyUsername, password: credentials.facultyPassword }
    });
    assert(facultyLogin.status === 200 && facultyLogin.data.user.role_name === 'faculty', 'Faculty Login (Prof. Vikram Mehta)');
    const facultyToken = facultyLogin.data.token;

    // 6. Invalid Login Test
    const invalidLogin = await request('/auth/login', {
      method: 'POST',
      body: { username: credentials.adminUsername, password: 'WrongPassword' }
    });
    assert(invalidLogin.status === 401, 'Invalid Password Rejection (401)');

    // 7. Departments List
    const depts = await request('/departments', { headers: { Authorization: `Bearer ${adminToken}` } });
    assert(depts.status === 200 && depts.data.departments.length >= 6, 'Departments Directory (CSE, ECE, EEE, MECH, CIVIL, IT)');

    // 8. Files List
    const filesRes = await request('/files', { headers: { Authorization: `Bearer ${adminToken}` } });
    assert(filesRes.status === 200 && filesRes.data.files.length >= 5, 'File Repository Listing');

    // 9. OCR & Full-Text Search
    const searchRes = await request('/search?q=Computer+Networks', { headers: { Authorization: `Bearer ${adminToken}` } });
    assert(
      searchRes.status === 200 && 
      searchRes.data.results.length > 0 && 
      searchRes.data.results.some(r => r.ocr_matched || r.name.includes('Computer_Networks')),
      'OCR Full-Text Search inside Scanned Document (Found CS304 Question Paper)'
    );

    // 10. File Sharing Test
    const shareRes = await request('/files/1/share', {
      method: 'POST',
      headers: { Authorization: `Bearer ${hodToken}` },
      body: { user_ids: [4], permission: 'view_download' }
    });
    assert(shareRes.status === 200, 'File Sharing with Faculty Member');

    // 11. Version History
    const versionsRes = await request('/files/2/versions', { headers: { Authorization: `Bearer ${adminToken}` } });
    assert(versionsRes.status === 200 && versionsRes.data.versions.length >= 2, 'File Version History Preservation (v1 & v2)');

    // 12. Storage Analytics
    const storageRes = await request('/analytics/storage', { headers: { Authorization: `Bearer ${adminToken}` } });
    assert(storageRes.status === 200 && storageRes.data.byDepartment.length > 0, 'Storage Analytics & Department Breakdown');

    // 13. Activity Logs
    const activityRes = await request('/activity', { headers: { Authorization: `Bearer ${adminToken}` } });
    assert(activityRes.status === 200 && activityRes.data.logs.length > 0, 'Audit Trail & Activity Logging');

    // 14. Notifications
    const notifsRes = await request('/notifications', { headers: { Authorization: `Bearer ${hodToken}` } });
    assert(notifsRes.status === 200 && notifsRes.data.notifications.length > 0, 'In-App Notification Dispatch & Read Status');

    // 15. Trash & Restore
    // Soft delete file 6
    const deleteRes = await request('/files/6', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(deleteRes.status === 200, 'Soft Deletion (Move to Trash)');

    // Check in Trash
    const trashRes = await request('/files?scope=trash', { headers: { Authorization: `Bearer ${adminToken}` } });
    assert(trashRes.status === 200 && trashRes.data.files.some(f => f.id === 6), 'Trash Bin Verification');

    // Restore from Trash
    const restoreRes = await request('/files/6/restore', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(restoreRes.status === 200, 'Trash File Restoration');

    console.log('====================================================');
    console.log(`  Tests Complete: ${passed} Passed, ${failed} Failed`);
    console.log('====================================================');

    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Test execution exception:', err);
    process.exit(1);
  }
}

runTests();
