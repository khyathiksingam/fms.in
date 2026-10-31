const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

let pool = null;
let isMemoryPostgres = false;
let initPromise = null;
let memDbInstance = null;

function createSqlConverter() {
  return function convertSql(sql) {
    if (typeof sql !== 'string') return sql;

    // 1. Replace positional ? placeholders with $1, $2, $3...
    let index = 1;
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let converted = '';

    for (let i = 0; i < sql.length; i++) {
      const char = sql[i];
      if (char === "'" && (i === 0 || sql[i - 1] !== '\\')) {
        inSingleQuote = !inSingleQuote;
        converted += char;
      } else if (char === '"' && (i === 0 || sql[i - 1] !== '\\')) {
        inDoubleQuote = !inDoubleQuote;
        converted += char;
      } else if (char === '?' && !inSingleQuote && !inDoubleQuote) {
        converted += `$${index++}`;
      } else {
        converted += char;
      }
    }

    // 2. Convert SQLite INSERT OR IGNORE syntax to PostgreSQL ON CONFLICT DO NOTHING
    if (/INSERT\s+OR\s+IGNORE\s+INTO/i.test(converted)) {
      converted = converted.replace(/INSERT\s+OR\s+IGNORE\s+INTO/gi, 'INSERT INTO');
      if (/INSERT\s+INTO\s+roles\b/i.test(converted) && !/ON\s+CONFLICT/i.test(converted)) {
        converted = converted.trim().replace(/;+$/, '') + ' ON CONFLICT (name) DO NOTHING';
      } else if (/INSERT\s+INTO\s+hod_departments\b/i.test(converted) && !/ON\s+CONFLICT/i.test(converted)) {
        converted = converted.trim().replace(/;+$/, '') + ' ON CONFLICT (hod_id, department_id) DO NOTHING';
      } else if (/INSERT\s+INTO\s+departments\b/i.test(converted) && !/ON\s+CONFLICT/i.test(converted)) {
        converted = converted.trim().replace(/;+$/, '') + ' ON CONFLICT (id) DO NOTHING';
      } else if (!/ON\s+CONFLICT/i.test(converted)) {
        converted = converted.trim().replace(/;+$/, '') + ' ON CONFLICT DO NOTHING';
      }
    }

    // 3. Convert datetime('now') or DATETIME(..., '+1 day')
    converted = converted.replace(/datetime\('now'\)/gi, 'CURRENT_TIMESTAMP');
    converted = converted.replace(/datetime\(([^,]+),\s*'\+1 day'\)/gi, '($1::timestamp + interval \'1 day\')');
    converted = converted.replace(/\bdatetime\(expires_at\)/gi, 'expires_at');

    return converted;
  };
}

const convertSql = createSqlConverter();

function sanitizeParams(params = []) {
  if (!Array.isArray(params)) {
    return [params === undefined ? null : params];
  }
  return params.map(p => (p === undefined ? null : p));
}

async function initDB() {
  if (pool) return pool;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const dbUrl = process.env.DATABASE_URL;

    if (dbUrl && (dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://'))) {
      const isProduction = process.env.NODE_ENV === 'production' || dbUrl.includes('sslmode=require');
      pool = new Pool({
        connectionString: dbUrl,
        ssl: isProduction ? { rejectUnauthorized: false } : false,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000
      });
      isMemoryPostgres = false;
      const sanitized = dbUrl.replace(/:[^:@]+@/, ':***@');
      console.log(`[Database] Connected to managed PostgreSQL: ${sanitized}`);
    } else {
      // In-memory PostgreSQL instance for local development/testing without live PostgreSQL
      if (!memDbInstance) {
        const { newDb, DataType } = require('pg-mem');
        memDbInstance = newDb();
        memDbInstance.public.registerFunction({
          name: 'trim',
          args: [DataType.text],
          returns: DataType.text,
          implementation: (x) => (typeof x === 'string' ? x.trim() : x)
        });
      }
      const pgAdapter = memDbInstance.adapters.createPg();
      pool = new pgAdapter.Pool();
      isMemoryPostgres = true;
      console.log('[Database] Using in-memory PostgreSQL instance for testing/local execution.');
    }

    pool.on('error', (err) => {
      console.error('[Database Pool Error]:', err.message);
    });

    return pool;
  })();

  return initPromise;
}

function getPool() {
  if (!pool) {
    throw new Error('Database pool not initialized. Call await initDB() first.');
  }
  return pool;
}

function _resetForTesting(options = {}) {
  if (pool) {
    pool.end().catch(() => {});
  }
  pool = null;
  initPromise = null;
  isMemoryPostgres = false;
  if (options && options.wipe) {
    memDbInstance = null;
  }
}

function getDbFile() {
  return null;
}

const dbHelper = {
  async initDB() {
    return initDB();
  },

  async query(sql, params = []) {
    await initDB();
    const safeParams = sanitizeParams(params);
    const converted = convertSql(sql);
    const res = await pool.query(converted, safeParams);
    return res.rows || [];
  },

  async get(sql, params = []) {
    const rows = await this.query(sql, params);
    return rows.length > 0 ? rows[0] : null;
  },

  async all(sql, params = []) {
    return this.query(sql, params);
  },

  async run(sql, params = []) {
    await initDB();
    const safeParams = sanitizeParams(params);
    let converted = convertSql(sql);

    // If it's an INSERT statement without RETURNING, append RETURNING id to capture lastID
    const isInsert = /^\s*INSERT\s+INTO/i.test(converted);
    const hasReturning = /RETURNING\b/i.test(converted);
    if (isInsert && !hasReturning) {
      converted = converted.trim().replace(/;+$/, '') + ' RETURNING id';
    }

    try {
      const res = await pool.query(converted, safeParams);
      const lastID = res.rows && res.rows[0] && res.rows[0].id !== undefined
        ? Number(res.rows[0].id)
        : null;
      return { lastID, changes: res.rowCount || (res.rows ? res.rows.length : 0) };
    } catch (err) {
      // If appending RETURNING id caused a syntax error on tables without an 'id' column, fallback without RETURNING
      if (isInsert && !hasReturning && err.message && err.message.includes('id')) {
        const fallbackSql = convertSql(sql);
        const res = await pool.query(fallbackSql, safeParams);
        return { lastID: null, changes: res.rowCount || 0 };
      }
      throw err;
    }
  },

  async exec(sql) {
    await initDB();
    await pool.query(sql);
  },

  async transaction(callback) {
    await initDB();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const tx = {
        async query(sql, params = []) {
          const safeParams = sanitizeParams(params);
          const converted = convertSql(sql);
          const res = await client.query(converted, safeParams);
          return res.rows || [];
        },
        async get(sql, params = []) {
          const rows = await this.query(sql, params);
          return rows.length > 0 ? rows[0] : null;
        },
        async all(sql, params = []) {
          return this.query(sql, params);
        },
        async run(sql, params = []) {
          const safeParams = sanitizeParams(params);
          let converted = convertSql(sql);
          const isInsert = /^\s*INSERT\s+INTO/i.test(converted);
          const hasReturning = /RETURNING\b/i.test(converted);
          if (isInsert && !hasReturning) {
            converted = converted.trim().replace(/;+$/, '') + ' RETURNING id';
          }
          try {
            const res = await client.query(converted, safeParams);
            const lastID = res.rows && res.rows[0] && res.rows[0].id !== undefined
              ? Number(res.rows[0].id)
              : null;
            return { lastID, changes: res.rowCount || (res.rows ? res.rows.length : 0) };
          } catch (err) {
            if (isInsert && !hasReturning && err.message && err.message.includes('id')) {
              const fallbackSql = convertSql(sql);
              const res = await client.query(fallbackSql, safeParams);
              return { lastID: null, changes: res.rowCount || 0 };
            }
            throw err;
          }
        },
        async exec(sql) {
          await client.query(sql);
        }
      };
      const result = await callback(tx);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch (rbErr) {
        // ignore rollback error
      }
      throw error;
    } finally {
      client.release();
    }
  },

  save() {
    // PostgreSQL transactions are durable; save is a no-op kept for backwards compatibility
  }
};

const DB_FILE = 'managed-postgresql';

module.exports = {
  initDB,
  getPool,
  dbHelper,
  _resetForTesting,
  getDbFile,
  DB_FILE,
  isMemoryPostgres: () => isMemoryPostgres
};
