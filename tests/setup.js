require('dotenv').config();
const db = require('../config/db');

beforeAll(async () => {
  try {
    await db.query('SELECT 1');
  } catch (e) {
    throw new Error('DB not reachable: ' + e.message);
  }
}, 10000);

afterAll(async () => {
  // Pool cleanup happens on process exit
});
