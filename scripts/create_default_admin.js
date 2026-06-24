require('dotenv').config();
const db = require('../config/db');
let nodeArgon2;
async function argonHash(password) {
  if (!nodeArgon2) nodeArgon2 = await import('argon2');
  return await nodeArgon2.hash(password, { type: nodeArgon2.argon2id, timeCost: 3, memoryCost: 65536 });
}
const crypto = require('crypto');

// using Argon2 for hashing

(async () => {
  try {
    const DEFAULT_ADMIN_USERNAME = process.env.DEFAULT_ADMIN_USERNAME || 'admin';
    const DEFAULT_ADMIN_EMAIL = process.env.DEFAULT_ADMIN_EMAIL || 'admin@ideenboard.de';
    let DEFAULT_ADMIN_PASSWORD = process.env.DEFAULT_ADMIN_PASSWORD;

    // Check if any users exist
    const any = await db.normalizeQueryResult(await db.query('SELECT user_id FROM users LIMIT 1'));
    if (any && any.length > 0) {
      console.log(JSON.stringify({ result: 'no_action', reason: 'users_exist', user_count_sample: any.length }));
      process.exit(0);
    }

    // No users exist -> create default admin
    let generated = false;
    if (!DEFAULT_ADMIN_PASSWORD) {
      // generate 8 hex chars
      DEFAULT_ADMIN_PASSWORD = crypto.randomBytes(6).toString('hex').slice(0,8);
      generated = true;
    }

    const hash = await argonHash(DEFAULT_ADMIN_PASSWORD);
    const insertRes = await db.query('INSERT INTO users (username, email, password_hash, role_id, created_at) VALUES (?, ?, ?, ?, UTC_TIMESTAMP())', [DEFAULT_ADMIN_USERNAME, DEFAULT_ADMIN_EMAIL, hash, 1]);
    const newUserId = insertRes && insertRes.insertId ? insertRes.insertId : (db.normalizeQueryResult(await db.query('SELECT LAST_INSERT_ID() as user_id'))[0]?.user_id || null);
    if (newUserId) {
      await db.query('INSERT INTO user_points (user_id, current_points, pending_delta) VALUES (?, 0, 0)', [newUserId]);
      console.log(JSON.stringify({ result: 'created', user_id: newUserId, username: DEFAULT_ADMIN_USERNAME, email: DEFAULT_ADMIN_EMAIL, password_printed: generated ? DEFAULT_ADMIN_PASSWORD : '(from env, not shown)' }));
      process.exit(0);
    }

    console.error('Konnte Admin-Benutzer nicht erstellen');
    process.exit(2);
  } catch (err) {
    console.error('FEHLER', err && err.message ? err.message : err);
    process.exit(3);
  }
})();
