const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert');
const crypto = require('crypto');

async function runTest() {
  console.log('--- Starting Logo Persistence Test ---');

  const testDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ffms-logo-test-'));
  const testLogoDir = path.join(testDataDir, 'logos');
  fs.mkdirSync(testLogoDir, { recursive: true });

  process.env.FFMS_DATA_DIR = testDataDir;
  process.env.FFMS_LOGO_DIR = testLogoDir;
  process.env.ADMIN_PASSWORD = 'AdminLogoTestPass123!';

  const { initDB, dbHelper, _resetForTesting } = require('../src/config/db');
  const { runMigrations } = require('../src/config/migrate');
  const seed = require('../src/config/seed');
  const { updateBranding } = require('../src/config/updateBranding');

  try {
    // 1. Initial setup
    await initDB();
    await runMigrations();
    await seed();

    // 2. Simulate admin uploading a custom college logo
    const logoUuid = crypto.randomUUID();
    const logoFileName = `${logoUuid}.png`;
    const logoDiskPath = path.join(testLogoDir, logoFileName);
    const fakePng = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13]); // PNG magic header
    fs.writeFileSync(logoDiskPath, fakePng);

    const customLogoUrl = `/api/public/logo/${logoFileName}`;
    const customCollegeName = 'Apex University of Engineering & Technology';

    await dbHelper.run(`
      UPDATE system_settings
      SET college_name = ?, college_logo = ?, system_logo = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = (SELECT id FROM system_settings ORDER BY id ASC LIMIT 1)
    `, [customCollegeName, customLogoUrl, customLogoUrl]);

    // Verify settings updated
    let settings = await dbHelper.get("SELECT * FROM system_settings ORDER BY id ASC LIMIT 1");
    assert.strictEqual(settings.college_logo, customLogoUrl);
    assert.strictEqual(settings.college_name, customCollegeName);

    // 3. Test that updateBranding() safely preserves custom branding and does not overwrite it
    console.log('Testing updateBranding() safeguard...');
    const result = await updateBranding({ force: false });
    assert.strictEqual(result.college_logo, customLogoUrl, 'updateBranding must NOT overwrite custom logo');
    assert.strictEqual(result.college_name, customCollegeName, 'updateBranding must NOT overwrite custom college name');

    // 4. Simulate backend restart & redeploy
    console.log('Simulating container restart & redeploy...');
    _resetForTesting();

    await initDB();
    await seed();

    // 5. Verify custom logo and branding are 100% preserved
    settings = await dbHelper.get("SELECT * FROM system_settings ORDER BY id ASC LIMIT 1");
    assert.ok(settings, 'Settings must exist after redeploy');
    assert.strictEqual(settings.college_logo, customLogoUrl, 'Custom college logo must persist across restart/redeploy');
    assert.strictEqual(settings.system_logo, customLogoUrl, 'Custom system logo must persist across restart/redeploy');
    assert.strictEqual(settings.college_name, customCollegeName, 'Custom college name must persist across restart/redeploy');
    assert.ok(fs.existsSync(logoDiskPath), 'Logo file must still exist in durable storage directory');

    console.log('PASSED: Logo persistence test verified successfully!');
  } finally {
    _resetForTesting();
    try {
      fs.rmSync(testDataDir, { recursive: true, force: true });
    } catch (e) {
      // ignore
    }
  }
}

runTest().catch(err => {
  console.error('FAILED: Logo persistence test failed:', err);
  process.exit(1);
});
