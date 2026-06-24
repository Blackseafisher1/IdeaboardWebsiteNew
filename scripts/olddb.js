// config/db.js - unified mariadb driver for Bun & Node
const isBun = typeof Bun !== 'undefined' || process.versions?.bun;
const driver = require('mariadb');
console.log(`Verwende MariaDB native Treiber (${isBun ? 'bun' : 'node'})`);

const dbName = process.env.DB_NAME || 'ideaboard';
const baseConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: dbName,
  connectionLimit: 10
};

// Global pool (singleton)
let pool;
let initialized = false;

async function getPool() {
  if (pool && initialized) return pool;
  
  console.log('DB-Verbindung:', baseConfig.host, baseConfig.user);
  
  // Create DB if missing
  const adminConn = await driver.createConnection({ ...baseConfig, database: undefined });
  await adminConn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
  await adminConn.end();
  
  // Main pool
  pool = await driver.createPool(baseConfig);

  // Quick MariaDB version check to enforce minimum supported version
  try {
    const verRows = await pool.query('SELECT VERSION() AS v');
    const verStr = (Array.isArray(verRows) && verRows[0] && verRows[0].v) ? verRows[0].v : (verRows && verRows.v) || '';
    if (verStr && /mariadb/i.test(verStr)) {
      const m = verStr.match(/(\d+)\.(\d+)\.(\d+)/);
      if (m) {
        const major = Number(m[1]);
        const minor = Number(m[2]);
        if (major < 12 || (major === 12 && minor < 1)) {
          throw new Error(`MariaDB ${major}.${minor} detected — MariaDB >= 12.1 is required`);
        }
      }
    } else if (verStr) {
      console.warn('Verbundenes DB-Version:', verStr, '- nicht explizit MariaDB. Einige Funktionen funktionieren möglicherweise nicht.');
    }
  } catch (err) {
    console.error('Datenbank-Versionsprüfung fehlgeschlagen:', err.message || err);
    throw err;
  }
  
  // Categories
  console.log('  Kategorien...');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS categories (
      category_id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL UNIQUE
    )
  `);
  
  const cats = ['Innovation', 'Prozess', 'Produkt', 'Kultur'];
  for (const cat of cats) {
    await pool.query(
      `INSERT INTO categories (name) VALUES (?) ON DUPLICATE KEY UPDATE name=VALUES(name)`,
      [cat]
    );
  }
  console.log('  Kategorien OK!');
  // NOTE: schema migrations should be created
  // via the migrations/ directory. Do not create tables here in runtime.
  
  initialized = true;
  console.log(`Verwende Datenbank ${dbName} (mariadb)`);
  return pool;
}

// SYNCHRONOUS EXPORTS for routes/require()!
module.exports = {
  normalizeQueryResult: (result) => {
    // assume mariadb native driver result shape (rows object/array)
    const rows = result;

    const convert = (val) => {
      if (typeof val === 'bigint') return Number(val);
      if (Array.isArray(val)) return val.map(convert);
      if (val && typeof val === 'object' && !(val instanceof Date)) {
        const out = {};
        for (const k of Object.keys(val)) out[k] = convert(val[k]);
        return out;
      }
      if (typeof val === 'string') {
        // common SQL DATETIME / TIMESTAMP formats: 'YYYY-MM-DD HH:MM:SS' or 'YYYY-MM-DDTHH:MM:SS'
        if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}/.test(val) || /^\d{4}-\d{2}-\d{2}$/.test(val)) {
          // replace space with T to form ISO-like string
          try {
            return new Date(val.replace(' ', 'T'));
          } catch (e) {
            return val;
          }
        }
      }
      if (typeof val === 'number') {
        // likely a unix timestamp (seconds) if 10 digits
        if (val > 1e9 && val < 1e11) return new Date(val * 1000);
      }
      return val;
    };

    if (Array.isArray(rows)) return rows.map(convert);
    return convert(rows);
  },
  query: async (...args) => {
    const p = await getPool();
    return p.query(...args);
  },
  execute: async (...args) => {
    const p = await getPool();
    return p.execute ? p.execute(...args) : p.query(...args);
  },
  getConnection: async () => {
    const p = await getPool();
    return p.getConnection();
  },
  isBun: () => isBun
};
