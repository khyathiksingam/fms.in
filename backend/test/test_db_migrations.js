const assert = require('node:assert/strict');
const { initDB, dbHelper, _resetForTesting } = require('../src/config/db');
const { runMigrations } = require('../src/config/migrate');

async function runMigrationsTest() {
  console.log('--- Starting Database Migrations Test ---');
  _resetForTesting({ wipe: true });

  try {
    await initDB();
    await runMigrations();

    // Check schema_migrations table
    const migrations = await dbHelper.all('SELECT version FROM schema_migrations ORDER BY version ASC');
    assert.ok(migrations.length >= 3, 'All migration files must be recorded in schema_migrations');
    assert.equal(migrations[0].version, '001_init_schema.sql');
    assert.equal(migrations[1].version, '002_seed_baseline_data.sql');
    assert.equal(migrations[2].version, '003_add_discussions_schema.sql');

    // Check core tables
    const tables = [
      'roles', 'departments', 'academic_regulations', 'system_settings',
      'users', 'folders', 'files', 'file_versions', 'shared_files',
      'syllabus_catalog', 'file_conversations', 'file_messages', 'notifications'
    ];

    for (const table of tables) {
      const res = await dbHelper.all(`SELECT * FROM ${table} LIMIT 1`);
      assert.ok(Array.isArray(res), `Table "${table}" must be accessible`);
    }

    // Check baseline roles seeded by migration 002
    const roles = await dbHelper.all('SELECT name FROM roles ORDER BY id ASC');
    const roleNames = roles.map(r => r.name);
    assert.ok(roleNames.includes('admin'), 'Admin role must exist');
    assert.ok(roleNames.includes('faculty'), 'Faculty role must exist');
    assert.ok(roleNames.includes('student'), 'Student role must exist');
    assert.ok(roleNames.includes('hod'), 'HOD role must exist');

    // Run migrations second time (idempotent test)
    console.log('Testing idempotency of migrations...');
    await runMigrations();
    const migrationsAfter = await dbHelper.all('SELECT version FROM schema_migrations ORDER BY version ASC');
    assert.equal(migrationsAfter.length, migrations.length, 'Re-running migrations must be idempotent');

    console.log('PASSED: Database migrations test verified successfully!');
  } finally {
    _resetForTesting({ wipe: true });
  }
}

runMigrationsTest().catch(err => {
  console.error('FAILED: Database migrations test failed:', err);
  process.exit(1);
});
