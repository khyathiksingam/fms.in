const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert');
const bcrypt = require('bcryptjs');

async function runTest() {
  console.log('--- Starting Password Persistence Test ---');

  // Set up isolated temporary data directory
  const testDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ffms-pwd-test-'));
  process.env.FFMS_DATA_DIR = testDataDir;
  process.env.ADMIN_PASSWORD = 'InitialAdminPassword123!';
  process.env.FFMS_HOD_TEMP_PASSWORD = 'InitialHodPassword123!';

  const { initDB, dbHelper, _resetForTesting, getDbFile } = require('../src/config/db');
  const { runMigrations } = require('../src/config/migrate');
  const seed = require('../src/config/seed');

  try {
    // 1. Initial boot and seed
    await initDB();
    await runMigrations();
    await seed();

    const dbFile = getDbFile();
    if (dbFile) {
      assert.ok(fs.existsSync(dbFile), 'Database file should exist in FFMS_DATA_DIR');
    }

    // Verify admin created with initial password
    let admin = await dbHelper.get("SELECT * FROM users WHERE role_id = (SELECT id FROM roles WHERE name = 'admin') LIMIT 1");
    assert.ok(admin, 'Admin account should exist');
    assert.ok(await bcrypt.compare('InitialAdminPassword123!', admin.password_hash), 'Initial admin password must match');

    // 2. User changes password
    const newPassword = 'ChangedAdminPassword999#';
    const newHash = await bcrypt.hash(newPassword, 10);
    await dbHelper.run(
      "UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [newHash, admin.id]
    );

    // Verify password was changed
    admin = await dbHelper.get("SELECT * FROM users WHERE id = ?", [admin.id]);
    assert.ok(await bcrypt.compare(newPassword, admin.password_hash), 'New password must match before restart');
    assert.ok(!(await bcrypt.compare('InitialAdminPassword123!', admin.password_hash)), 'Old password must fail before restart');
    assert.strictEqual(admin.must_change_password, 0);

    // Also change an HOD password
    let hod = await dbHelper.get(`
      SELECT u.id, u.username, u.password_hash, u.must_change_password
      FROM users u JOIN roles r ON r.id = u.role_id
      WHERE r.name = 'hod' AND u.username IN ('p.kishore', 'hod.p.kishore')
    `);
    assert.ok(hod, 'HOD account should exist');
    const newHodPassword = 'NewHodPassword456!';
    const newHodHash = await bcrypt.hash(newHodPassword, 10);
    await dbHelper.run(
      "UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [newHodHash, hod.id]
    );

    // 3. Simulate backend restart & redeployment cycle
    console.log('Simulating container restart & redeploy with re-seeding...');
    _resetForTesting(); // drop in-memory state

    // Change environment ADMIN_PASSWORD to simulate redeploy with env vars
    process.env.ADMIN_PASSWORD = 'DifferentEnvPassword777!';
    process.env.FFMS_HOD_TEMP_PASSWORD = 'DifferentHodEnvPassword888!';

    // Re-initialize and re-run seed() as happens on startup in server.js
    await initDB();
    await seed();

    // 4. Verify admin account preserved the changed password
    const adminAfterRedeploy = await dbHelper.get("SELECT * FROM users WHERE id = ?", [admin.id]);
    assert.ok(adminAfterRedeploy, 'Admin account should still exist');
    assert.ok(
      await bcrypt.compare(newPassword, adminAfterRedeploy.password_hash),
      'Admin password MUST remain the user-changed password after restart/redeploy'
    );
    assert.ok(
      !(await bcrypt.compare('InitialAdminPassword123!', adminAfterRedeploy.password_hash)),
      'Initial password must NOT work after restart/redeploy'
    );
    assert.ok(
      !(await bcrypt.compare('DifferentEnvPassword777!', adminAfterRedeploy.password_hash)),
      'Env ADMIN_PASSWORD must NOT overwrite existing admin password on redeploy'
    );
    assert.strictEqual(adminAfterRedeploy.must_change_password, 0, 'must_change_password must remain 0');

    // 5. Verify HOD account preserved the changed password
    const hodAfterRedeploy = await dbHelper.get("SELECT * FROM users WHERE id = ?", [hod.id]);
    assert.ok(
      await bcrypt.compare(newHodPassword, hodAfterRedeploy.password_hash),
      'HOD password MUST remain the user-changed password after restart/redeploy'
    );
    assert.ok(
      !(await bcrypt.compare('InitialHodPassword123!', hodAfterRedeploy.password_hash)),
      'Initial HOD password must NOT work after restart/redeploy'
    );
    assert.ok(
      !(await bcrypt.compare('DifferentHodEnvPassword888!', hodAfterRedeploy.password_hash)),
      'Env FFMS_HOD_TEMP_PASSWORD must NOT overwrite existing HOD password on redeploy'
    );

    console.log('PASSED: Password persistence across redeployment verified successfully!');
  } finally {
    // Clean up
    _resetForTesting();
    try {
      fs.rmSync(testDataDir, { recursive: true, force: true });
    } catch (e) {
      // ignore cleanup errors on temp
    }
  }
}

runTest().catch(err => {
  console.error('FAILED: Password persistence test failed:', err);
  process.exit(1);
});
