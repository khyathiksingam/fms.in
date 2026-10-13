const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const seed = require('../src/config/seed');
const { dbHelper } = require('../src/config/db');

async function run() {
  await seed();
  const initial = await dbHelper.get(`
    SELECT u.id, u.password_hash, u.must_change_password
    FROM users u JOIN roles r ON r.id = u.role_id
    WHERE r.name = 'hod' AND u.username = 'hod.p.kishore'
  `);
  assert.ok(initial, 'New HOD account is seeded');
  assert.equal(initial.must_change_password, 1);

  const replacementHash = await bcrypt.hash('Preserve-this-existing-password-2026!', 10);
  await dbHelper.run('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?', [replacementHash, initial.id]);
  const beforeSecondRun = await dbHelper.get('SELECT COUNT(*) AS count FROM users WHERE role_id = (SELECT id FROM roles WHERE name = ?)', ['hod']);
  const initialMappingCount = await dbHelper.get('SELECT COUNT(*) AS count FROM hod_departments');

  await seed();
  const afterSecondRun = await dbHelper.get('SELECT password_hash, must_change_password FROM users WHERE id = ?', [initial.id]);
  const afterCount = await dbHelper.get('SELECT COUNT(*) AS count FROM users WHERE role_id = (SELECT id FROM roles WHERE name = ?)', ['hod']);
  const afterMappingCount = await dbHelper.get('SELECT COUNT(*) AS count FROM hod_departments');

  assert.equal(afterSecondRun.password_hash, replacementHash, 'Repeat seeding preserves an existing HOD password hash');
  assert.equal(afterSecondRun.must_change_password, 0, 'Repeat seeding preserves existing HOD password state');
  assert.equal(afterCount.count, beforeSecondRun.count, 'Repeat seeding does not duplicate HOD accounts');
  assert.equal(afterMappingCount.count, initialMappingCount.count, 'Repeat seeding does not duplicate HOD department assignments');
  console.log('HOD seeding migration is idempotent and preserves existing passwords.');
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
