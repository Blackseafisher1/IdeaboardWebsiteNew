// config/db.js - simple treiber basierte prepared stmnt und normalisierung der datenbank resultate
const driver = require('mariadb');

const dbName = process.env.DB_NAME || 'ideaboard';
const baseConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: dbName,
  connectionLimit: 10,
  useServerPrepStmts: true,
  prepareCacheSize: 100,
  compress: true
};

let pool;
let initialized = false;

async function getPool() {
  if (pool && initialized) return pool;
  pool = await driver.createPool(baseConfig);

  // Basic version check (best-effort)
  try {
    const verRows = await pool.query('SELECT VERSION() AS v');
    const verStr = (Array.isArray(verRows) && verRows[0] && verRows[0].v) ? verRows[0].v : (verRows && verRows.v) || '';
    if (verStr && /mariadb/i.test(verStr)) {
      const m = verStr.match(/(\d+)\.(\d+)\.(\d+)/);
      if (m) {
        const major = Number(m[1]);
        const minor = Number(m[2]);
        if (major < 10) {
          console.warn(`Warn: MariaDB ${major}.${minor} detected. Consider upgrading.`);
        }
      }
    }
  } catch (e) {
    console.warn('DB version check failed:', e && e.message ? e.message : e);
  }

  initialized = true;
  return pool;
}

// Interner Normalisierungs-Helfer (nur intern verwenden)
function normalizeQueryResult(result) {
  const convert = (val) => {
    if (typeof val === 'bigint') return Number(val);
    if (Array.isArray(val)) return val.map(convert);
    if (val && typeof val === 'object' && !(val instanceof Date)) {
      const out = {};
      for (const k of Object.keys(val)) out[k] = convert(val[k]);
      return out;
    }
    if (typeof val === 'string') {
      if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}/.test(val) || /^\d{4}-\d{2}-\d{2}$/.test(val)) {
        try { return new Date(val.replace(' ', 'T')); } catch (e) { return val; }
      }
    }
    return val;
  };
  if (Array.isArray(result)) return result.map(convert);
  return convert(result);
}

async function query(sql, params) {
  const p = await getPool();
  const result = await p.query(sql, params);
  return normalizeQueryResult(result);
}

async function execute(sql, params) {
  const p = await getPool();
  // prefer pool.execute when available (prepared statements path)
  if (typeof p.execute === 'function') {
    const result = await p.execute(sql, params);
    return normalizeQueryResult(result);
  }
  // fallback to query
  const result = await p.query(sql, params);
  return normalizeQueryResult(result);
}

async function getConnection() {
  const p = await getPool();
  const conn = await p.getConnection();
  // Wrap conn.query to return normalized results
  const originalQuery = conn.query.bind(conn);
  conn.query = async (sql, params) => {
    const result = await originalQuery(sql, params);
    return normalizeQueryResult(result);
  };
  // Wrap execute if present
  if (typeof conn.execute === 'function') {
    const originalExecute = conn.execute.bind(conn);
    conn.execute = async (sql, params) => {
      const result = await originalExecute(sql, params);
      return normalizeQueryResult(result);
    };
  }
  return conn;
}



module.exports = {
  query,
  execute,
  getConnection
};
