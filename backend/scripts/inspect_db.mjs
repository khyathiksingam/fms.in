import fs from 'node:fs';
import path from 'node:path';
import initSqlJs from 'sql.js';

async function inspect() {
  const SQL = await initSqlJs();
  const dbBuffer = fs.readFileSync('backend/data/ffms.sqlite');
  const db = new SQL.Database(dbBuffer);
  
  const tablesResult = db.exec("SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
  const tables = tablesResult[0]?.values || [];
  
  console.log(`=== FOUND ${tables.length} TABLES ===`);
  for (const [name] of tables) {
    const countRes = db.exec(`SELECT count(*) FROM "${name}"`);
    const count = countRes[0]?.values[0][0] || 0;
    console.log(`${name.padEnd(30)}: ${count}`);
  }
}

inspect().catch(console.error);
