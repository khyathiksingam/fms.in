const { newDb } = require('pg-mem');
const db = newDb();
const pg = db.adapters.createPg();
const pool = new pg.Pool();

async function test() {
  await pool.query('CREATE TABLE test (id SERIAL PRIMARY KEY, name VARCHAR(50))');
  const res = await pool.query('INSERT INTO test (name) VALUES ($1) RETURNING id', ['alice']);
  console.log('Inserted id:', res.rows[0].id);
  const rows = await pool.query('SELECT * FROM test WHERE id = $1', [1]);
  console.log('Found:', rows.rows[0]);
}
test().catch(console.error);
