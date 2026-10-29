const fs = require('fs');
const path = require('path');
const { getPool, dbHelper } = require('./db');

async function runMigrations() {
  console.log('--- Running PostgreSQL Database Migrations ---');
  await dbHelper.initDB();

  // Create schema_migrations table if not exists
  try {
    await dbHelper.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMP
      );
    `);
  } catch (err) {
    if (!err.message.includes('already exists') && !err.message.includes('Not supported')) {
      throw err;
    }
  }

  const appliedRows = await dbHelper.query('SELECT version FROM schema_migrations ORDER BY version ASC');
  const appliedVersions = new Set(appliedRows.map(r => r.version));

  const migrationsDir = path.resolve(__dirname, '../../migrations');
  if (!fs.existsSync(migrationsDir)) {
    console.log('No migrations directory found at:', migrationsDir);
    return;
  }

  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    if (appliedVersions.has(file)) {
      console.log(`[Flyway/Migrate] Migration ${file} already applied.`);
      continue;
    }

    console.log(`[Flyway/Migrate] Applying migration: ${file}...`);
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

    // Execute within a transaction
    try {
      await dbHelper.query('BEGIN');
      await dbHelper.query(sql);
      await dbHelper.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file]);
      await dbHelper.query('COMMIT');
      console.log(`[Flyway/Migrate] Successfully applied migration: ${file}`);
    } catch (err) {
      await dbHelper.query('ROLLBACK').catch(() => {});
      console.error(`[Flyway/Migrate] Failed to apply migration ${file}:`, err);
      throw err;
    }
  }

  console.log('--- All PostgreSQL Migrations Applied Successfully ---');
}

if (require.main === module) {
  runMigrations()
    .then(() => {
      console.log('Migrations finished.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}

module.exports = { runMigrations };
