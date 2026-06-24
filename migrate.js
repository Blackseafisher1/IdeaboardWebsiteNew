const fs = require('fs');
const path = require('path');
// load environment variables from .env for CLI scripts
require('dotenv').config();
const db = require('./config/db.js');

const migrationsDir = path.join(__dirname, 'migrations');

async function ensureMigrationsTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

function loadMigrationFiles() {
  if (!fs.existsSync(migrationsDir)) {
    return [];
  }
  return fs
    .readdirSync(migrationsDir)
    .filter((f) => f.toLowerCase().endsWith('.sql'))
    .sort();
}

function splitStatements(sql) {
  // DELIMITER-aware splitter: supports migrations that set a custom delimiter
  // (required for CREATE TRIGGER / stored routines). It parses the SQL
  // and splits on the active delimiter while ignoring delimiters inside
  // single/double quotes. DELIMITER directives are honored.
  const statements = [];
  let current = '';
  let delim = ';';
  let inSingle = false;
  let inDouble = false;
  const len = sql.length;

  for (let i = 0; i < len; i++) {
    const ch = sql[i];
    const rest = sql.slice(i);

    // Detect DELIMITER directive at start of a line (allow leading whitespace)
    if ((i === 0 || sql[i - 1] === '\n') && /^\s*DELIMITER\s+/i.test(rest)) {
      const m = rest.match(/^\s*DELIMITER\s+(\S+)/i);
      if (m) {
        // flush current buffer
        if (current.trim()) {
          statements.push(current.trim());
        }
        current = '';
        delim = m[1];
        // advance i to end of the line
        const nl = rest.indexOf('\n');
        if (nl === -1) {
          i = len; // done
        } else {
          i += nl;
        }
        continue;
      }
    }

    // Toggle quote flags
    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
      current += ch;
      continue;
    }
    if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
      current += ch;
      continue;
    }

    // If not inside quotes, check for delimiter
    if (!inSingle && !inDouble && delim && rest.startsWith(delim)) {
      if (current.trim()) statements.push(current.trim());
      current = '';
      i += delim.length - 1; // skip delimiter
      continue;
    }

    current += ch;
  }

  if (current.trim()) statements.push(current.trim());
  // Remove any accidental DELIMITER lines from results
  return statements.filter(s => !/^\s*DELIMITER\b/i.test(s));
}

async function applyMigration(conn, name, sql) {
  const statements = splitStatements(sql);
  if (!statements.length) return;

  await conn.beginTransaction();
  try {
    for (const stmt of statements) {
      await conn.query(stmt);
    }
      await conn.query('INSERT INTO schema_migrations (name) VALUES (?)', [name]);
      await conn.commit();
      console.log(`✔ Migriert: ${name}`);
  } catch (err) {
    await conn.rollback();
    throw new Error(`Migration failed (${name}): ${err.message}`);
  }
}

async function run() {
  const pool = await db.getConnection(); // grab connection for table creation
  try {
    await ensureMigrationsTable(pool);
  } finally {
    pool.release();
  }

  const appliedRows = await db.query('SELECT name FROM schema_migrations');
  const applied = new Set(Array.isArray(appliedRows) ? appliedRows.map((r) => r.name) : []);

  const files = loadMigrationFiles();
  if (!files.length) {
      console.log('Keine Migrationen gefunden.');
    return;
  }

  for (const file of files) {
    if (applied.has(file)) {
        console.log(`↷ Übersprungen (bereits angewendet): ${file}`);
      continue;
    }
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    const conn = await db.getConnection();
    try {
      await applyMigration(conn, file, sql);
    } finally {
      conn.release();
    }
  }

    console.log('Alle Migrationen angewendet.');
}

run().then(() => {
  // Ensure a clean, non-interactive exit with success code so CI/remote
  // shells and `docker exec -T` calls don't hang or return a non-zero
  // status despite successful migrations.
    console.log('Migrationen erfolgreich abgeschlossen. Beende Prozess.');
  process.exit(0);
}).catch((err) => {
    console.error('Migration Fehlgeschlagen:', err && err.message ? err.message : err);
  process.exit(1);
});
