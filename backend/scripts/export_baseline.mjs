import fs from 'node:fs';
import initSqlJs from 'sql.js';

async function exportBaseline() {
  const SQL = await initSqlJs();
  const db = new SQL.Database(fs.readFileSync('backend/data/ffms.sqlite'));
  for (const table of ['roles', 'departments', 'academic_regulations', 'system_settings']) {
    const res = db.exec(`SELECT * FROM "${table}"`);
    console.log(`\n=== DATA FOR ${table} ===`);
    if (res[0]) {
      console.log('Columns:', res[0].columns);
      console.log('Rows:', JSON.stringify(res[0].values, null, 2));
    }
  }
}

exportBaseline().catch(console.error);
