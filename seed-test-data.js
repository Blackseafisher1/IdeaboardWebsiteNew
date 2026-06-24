// seed-test-data.js
// Generiert 200k+ realistische Testdaten mit faker.js


if (process.versions && process.versions.bun) {
  const { spawnSync } = require('child_process');
  console.log('Bun-Laufzeit erkannt — starte neu mit Node für Kompatibilität.');
  const result = spawnSync('node', [__filename], { stdio: 'inherit' });
  process.exit(result.status || 0);
}

const pool = require('./config/db');
let faker;
// `@faker-js/faker` is an ESM-only package; load it dynamically inside the
// async seeding function to remain compatible with CommonJS runtime.

// Use Argon2 for hashing in seed script (lighter params for speed). This
// dynamic import keeps compatibility with CommonJS and Bun detection above.
let seedArgon2;
const SEED_ARGON_TIME = process.env.SEED_ARGON_TIME ? parseInt(process.env.SEED_ARGON_TIME) : 1;
const SEED_ARGON_MEMORY = process.env.SEED_ARGON_MEMORY ? parseInt(process.env.SEED_ARGON_MEMORY) : 16384; // 16MB
async function argonHash(password) {
  if (!seedArgon2) seedArgon2 = await import('argon2');
  return await seedArgon2.hash(password, { type: seedArgon2.argon2id, timeCost: SEED_ARGON_TIME, memoryCost: SEED_ARGON_MEMORY });
}
const os = require('os');

// Optional user seeding
const USER_COUNT = process.env.USER_COUNT ? parseInt(process.env.USER_COUNT) : 100;
// legacy BCRYPT_ROUNDS removed; use Argon2 seed params above
const BCRYPT_ROUNDS = null;
const HASH_CONCURRENCY = process.env.HASH_CONCURRENCY ? parseInt(process.env.HASH_CONCURRENCY) : (os.cpus() ? Math.max(2, os.cpus().length) : 4);

const IDEA_COUNT = process.env.IDEA_COUNT ? parseInt(process.env.IDEA_COUNT) : 10000;
const PROJECT_COUNT = 100;
const SURVEY_COUNT = 100;

async function seedTestData() {
  // Dynamic import for ESM faker
  if (!faker) {
    const mod = await import('@faker-js/faker');
    // Support different export shapes (named `faker` or default export)
    faker = mod.faker || (mod.default && mod.default.faker) || mod.default;
  }
  let conn;
  try {
    conn = await pool.getConnection();
    // Ensure server/session uses UTC to avoid DST-related invalid TIMESTAMPs
    // (some DST transitions produce non-existent local times causing
    //  Incorrect datetime value errors when inserting TIMESTAMP columns)
    await conn.query("SET time_zone = '+00:00'");
    await conn.beginTransaction();

    console.log('🌱 Starte realistische Testdaten-Generierung...');

    // Ensure roles exist (always)
    await conn.query(`
      INSERT IGNORE INTO roles (role_id, name, description) VALUES
      (1, 'Admin', 'Administrator'),
      (2, 'Projektleiter', 'Projektleiter'),
      (3, 'Mitarbeiter', 'Mitarbeiter')
    `);

    // If no users exist at all, create a default admin so the rest of the
    // seeding can proceed. This makes the script idempotent when the users
    // table has been cleared.
    async function createDefaultAdminIfMissing() {
      const existingUsers = await conn.query('SELECT user_id FROM users LIMIT 1');
      if (!existingUsers || existingUsers.length === 0) {
        console.log('No users found — creating default admin user...');
        const DEFAULT_ADMIN_USERNAME = process.env.DEFAULT_ADMIN_USERNAME || 'admin';
        const DEFAULT_ADMIN_EMAIL = process.env.DEFAULT_ADMIN_EMAIL || 'admin@example.test';
        const DEFAULT_ADMIN_PASSWORD = process.env.DEFAULT_ADMIN_PASSWORD || 'changeme';
        const hash = await argonHash(DEFAULT_ADMIN_PASSWORD);
        const insertRes = await conn.query('INSERT INTO users (username, email, password_hash, role_id, created_at) VALUES (?, ?, ?, ?, UTC_TIMESTAMP())', [DEFAULT_ADMIN_USERNAME, DEFAULT_ADMIN_EMAIL, hash, 1]);
        const newUserId = (insertRes && insertRes.insertId)
          ? insertRes.insertId
          : (await conn.query('SELECT LAST_INSERT_ID() as user_id'))[0]?.user_id || null;
        if (newUserId) {
          await conn.query('INSERT INTO user_points (user_id, current_points, pending_delta) VALUES (?, 0, 0)', [newUserId]);
          console.log(`Created default admin '${DEFAULT_ADMIN_USERNAME}' (user_id=${newUserId})`);
        } else {
          console.warn('Could not determine new admin user id after insert');
        }
      }
    }

    await createDefaultAdminIfMissing();

    // Optional: create test users if requested
    if (USER_COUNT > 0) {
      console.log(`👥 Erstelle ${USER_COUNT} Test-User (bcrypt rounds=${BCRYPT_ROUNDS}, concurrency=${HASH_CONCURRENCY})...`);

      // Ensure roles exist (minimal)
      await conn.query(`
        INSERT IGNORE INTO roles (role_id, name, description) VALUES
        (1, 'Admin', 'Administrator'),
        (2, 'Projektleiter', 'Projektleiter'),
        (3, 'Mitarbeiter', 'Mitarbeiter')
      `);

      let created = 0;
      while (created < USER_COUNT) {
        const batchSize = Math.min(HASH_CONCURRENCY, USER_COUNT - created);
        const usersBatch = [];
        for (let i = 0; i < batchSize; i++) {
          // Use internet.userName when available; fallback to person-based name for compatibility across faker versions
          const rawBase = (faker.internet && typeof faker.internet.userName === 'function')
            ? faker.internet.userName()
            : `${faker.person.firstName()}`;
          // Shorten username: use rawBase (truncated) + index to stay unique and short
          const shortBase = rawBase.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 8);
          const uname = `${shortBase}${created + i}`;
          const email = `${uname}@example.test`;
          usersBatch.push({ username: uname, email });
        }

        // Hash passwords in parallel for this batch
        const hashPromises = usersBatch.map(() => argonHash('password'));
        const hashes = await Promise.all(hashPromises);

        // Insert users and create user_points row
        for (let i = 0; i < usersBatch.length; i++) {
          const u = usersBatch[i];
          const hash = hashes[i];
            const insertRes = await conn.query('INSERT INTO users (username, email, password_hash, role_id, created_at) VALUES (?, ?, ?, ?, UTC_TIMESTAMP())', [u.username, u.email, hash, 3]);
          // Prefer insertId from the driver (works reliably on the same connection); fallback to LAST_INSERT_ID() only if needed
          const newUserId = (insertRes && insertRes.insertId)
            ? insertRes.insertId
            : (await conn.query('SELECT LAST_INSERT_ID() as user_id'))[0]?.user_id || null;
          if (newUserId) {
            await conn.query('INSERT INTO user_points (user_id, current_points, pending_delta) VALUES (?, 0, 0)', [newUserId]);
          }
          created++;
        }

        if (created % 1000 === 0) {
          console.log(`   → ${created} users created...`);
          await conn.commit();
          await conn.beginTransaction();
        }
      }

      console.log(`✓ ${USER_COUNT} Test-User eingefügt (Passwort: 'password').`);
    }
    // OPTIONAL: Clear existing ideas to avoid massive duplicates if run multiple times
    // console.log('🗑️ Lösche alte Ideen...');
    // await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    // await conn.query('TRUNCATE TABLE ideas');
    // await conn.query('TRUNCATE TABLE idea_likes');
    // await conn.query('TRUNCATE TABLE comments');
    // await conn.query('SET FOREIGN_KEY_CHECKS = 1');

    // 1) Load users
    const users = await conn.query('SELECT user_id AS id, username AS name FROM users ORDER BY user_id');
    console.log(`✓ ${users.length} User gefunden`);
    if (!users || users.length === 0) throw new Error('Keine User in DB gefunden!');

    // 2) Load ALLE categories (korrekt!)
    const categories = await conn.query('SELECT category_id AS id, name FROM categories ORDER BY category_id');
    console.log(`✓ ${categories.length} Kategorien gefunden`);
    if (!categories || categories.length === 0) throw new Error('Keine Kategorien in DB gefunden!');

    // 3) Insert REALISTISCHE Ideen mit FAKER 🎯
    console.log(`📝 Erstelle ${IDEA_COUNT.toLocaleString()} realistische Ideen...`);
    
    for (let i = 1; i <= IDEA_COUNT; i++) {
      const user = users[(i - 1) % users.length];
      const category = categories[(i - 1) % categories.length];
      const daysAgo = Math.floor(Math.random() * 365); // 0-1 Jahr alt

      // 🎯 REALISTISCHE TITEL (hohe Entropie!)
      const titleTemplates = [
        `${faker.commerce.productName()} - ${category.name} #${i}`,
        `🚀 ${faker.commerce.productAdjective()} ${faker.commerce.productMaterial()} Innovation [${faker.string.alphanumeric(4).toUpperCase()}]`,
        `💡 ${faker.lorem.words(3).toUpperCase()} für ${category.name} (${i})`,
        `${faker.person.jobDescriptor()} ${faker.hacker.verb()} ${faker.hacker.noun()} System`,
        `📱 ${faker.commerce.product()} ${faker.commerce.productAdjective()} Konzept #${faker.number.int({min:100, max:999})}`,
        `⚙️ ${faker.hacker.adjective()} ${faker.hacker.noun()} Optimierung v${faker.system.semver()}`,
        `🌟 ${faker.company.catchPhrase()} Plattform`,
        `🔥 ${faker.person.jobTitle()} Automation Tool [${i}]`
      ];
      
      let title = faker.helpers.arrayElement(titleTemplates);
      // Ensure title fits DB column (VARCHAR(70)).
      const MAX_TITLE_CHARS = 70;
      const MAX_TITLE_BYTES = MAX_TITLE_CHARS * 4; // conservative upper bound for utf8mb4
      // Remove problematic control characters
      title = String(title).replace(/[\u0000-\u001f\u007f]/g, ' ');
      // First, truncate to MAX_TITLE_CHARS Unicode code points (handles emoji correctly)
      const titleRunes = Array.from(title);
      if (titleRunes.length > MAX_TITLE_CHARS) title = titleRunes.slice(0, MAX_TITLE_CHARS).join('');
      // Then ensure byte-length is within safe bounds; trim one code point at a time if necessary
      while (Buffer.byteLength(title, 'utf8') > MAX_TITLE_BYTES) {
        const arr = Array.from(title);
        arr.pop();
        title = arr.join('');
      }

      // 🎯 REALISTISCHE BESCHREIBUNGEN (200-500 Zeichen)
      // paragraphs API differs between faker versions; pick a random count and generate
      const paraCount = (faker.number && faker.number.int) ? faker.number.int({ min: 2, max: 4 }) : (Math.floor(Math.random() * 3) + 2);
      const description = faker.lorem.paragraphs(paraCount)
        .split('\n').join(' ')
        .substring(0, 500);

      // 🎯 REALISTISCHE COUNTER + STATUS
      const like_count = Math.floor(Math.random() * 150);
      const dislike_count = Math.floor(Math.random() * 50);
      const comment_count = Math.floor(Math.random() * 30);
      const status = faker.helpers.arrayElement(['neu', 'in Prüfung', 'akzeptiert', 'abgelehnt']);

      const secondsAgo = Math.floor(Math.random() * 86400);
      const totalSecondsAgo = (daysAgo * 86400) + secondsAgo;

      await conn.query(
        `INSERT INTO ideas (
          user_id, category_id, title, description,
          created_at, updated_at, like_count, dislike_count, comment_count, status
        ) VALUES (?, ?, ?, ?, DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? SECOND), UTC_TIMESTAMP(), ?, ?, ?, ?)`,
        [user.id, category.id, title, description, totalSecondsAgo, like_count, dislike_count, comment_count, status]
      );

      // 🏎️ Progress für große Mengen
      if (i % 10000 === 0) {
        console.log(`   → ${i.toLocaleString()} Ideen generiert...`);
        await conn.commit();
        await conn.beginTransaction();
      }
    }
    console.log(`✓ ${IDEA_COUNT.toLocaleString()} Ideen eingefügt! 🚀`);

    // 4) Rest unverändert (Projekte, Surveys)...
    const adminsAndPLs = await conn.query(
      `SELECT u.user_id AS id, u.username AS name, r.name AS role_name
       FROM users u JOIN roles r ON r.role_id = u.role_id
       WHERE r.name IN ('Admin', 'Projektleiter') ORDER BY u.user_id`
    );

    if (adminsAndPLs && adminsAndPLs.length > 0) {
      // Projects (mit faker)
      console.log(`📊 Erstelle ${PROJECT_COUNT} Projekte...`);
      const statuses = ['Konzeption', 'Umsetzung', 'Abgeschlossen'];
      for (let i = 1; i <= PROJECT_COUNT; i++) {
        const contact = adminsAndPLs[(i - 1) % adminsAndPLs.length];
        const statusIdx = i % 3;
        const projectName = faker.company.catchPhrase();
        
        const projRes = await conn.query(
          `INSERT INTO projects (name, description, status, progress, contact_person_id, created_at)
           VALUES (?, ?, ?, ?, ?, DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? DAY))`,
          [projectName, faker.lorem.sentence(), statuses[statusIdx], [25, 60, 100][statusIdx], contact.id, i * 2]
        );
        const projectId = (projRes && projRes.insertId) ? projRes.insertId : null;

        if (projectId) {
          // Create Group Chat for Project
          const groupRes = await conn.query(
            `INSERT INTO group_chats (name, owner_user_id, project_id, is_private, created_at)
             VALUES (?, ?, ?, 1, DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? DAY))`,
            [`Projekt: ${projectName}`, contact.id, projectId, i * 1.5]
          );
          const groupId = (groupRes && groupRes.insertId) ? groupRes.insertId : null;
          
          if (groupId) {
            // Add owner as member
            await conn.query(
              `INSERT INTO group_members (group_id, user_id, role, joined_at)
               VALUES (?, ?, 'owner', DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? DAY))`,
              [groupId, contact.id, i * 1.5]
            );

            // Add some random members (3-7 users)
            const numMembers = Math.floor(Math.random() * 5) + 3;
            const shuffledUsers = [...users].sort(() => 0.5 - Math.random());
            const membersToAdd = shuffledUsers.slice(0, numMembers).filter(u => u.id !== contact.id);

            for (const member of membersToAdd) {
              await conn.query(
                `INSERT IGNORE INTO group_members (group_id, user_id, role, joined_at)
                 VALUES (?, ?, 'member', DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? DAY))`,
                [groupId, member.id, i * 1.4]
              );
              
              // Add a random message from this member
              await conn.query(
                `INSERT INTO group_messages (group_id, sender_user_id, message, created_at)
                 VALUES (?, ?, ?, DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? SECOND))`,
                [groupId, member.id, faker.lorem.sentence(), Math.floor(Math.random() * 3600)]
              );
            }
          }
        }
      }
      console.log(`✓ ${PROJECT_COUNT} Projekte eingefügt`);

      // Surveys (vereinfacht)
      console.log(`📋 Erstelle ${SURVEY_COUNT} Surveys mit Fragen und Antworten...`);
      for (let i = 1; i <= SURVEY_COUNT; i++) {
        const creator = adminsAndPLs[(i - 1) % adminsAndPLs.length];
        const isPrivate = creator.role_name === 'Projektleiter' ? 1 : 0;
        const accessCode = isPrivate ? `CODE_${creator.id}_${i}` : null;
        const daysAgo = i % 14;

        const surveyRes = await conn.query(
          `INSERT INTO surveys (title, description, is_private, access_code, created_at, user_id)
           VALUES (?, ?, ?, ?, DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? DAY), ?)`,
          [faker.lorem.sentence(), faker.lorem.paragraph(), isPrivate, accessCode, daysAgo, creator.id]
        );
        const surveyId = (surveyRes && surveyRes.insertId) ? surveyRes.insertId : null;

        if (surveyId) {
          // Erstelle 2-4 Fragen pro Umfrage
          const numQuestions = Math.floor(Math.random() * 3) + 2;
          for (let q = 1; q <= numQuestions; q++) {
            const questionRes = await conn.query(
              `INSERT INTO survey_questions (survey_id, question_text) VALUES (?, ?)`,
              [surveyId, faker.lorem.sentence().replace('?', '') + '?']
            );
            const questionId = (questionRes && questionRes.insertId) ? questionRes.insertId : null;

            if (questionId) {
              // Erstelle 3-5 Antwortmöglichkeiten (Optionen)
              const options = [];
              const numOptions = Math.floor(Math.random() * 3) + 3;
              for (let o = 1; o <= numOptions; o++) {
                const optText = faker.lorem.words(3);
                const optRes = await conn.query(
                  `INSERT INTO survey_options (question_id, option_text) VALUES (?, ?)`,
                  [questionId, optText]
                );
                options.push((optRes && optRes.insertId) ? optRes.insertId : null);
              }

              // Generiere zufällige Antworten von Usern (Simulation von 5-20 Teilnehmern)
              const numParticipants = Math.floor(Math.random() * 16) + 5;
              const participants = [...users].sort(() => 0.5 - Math.random()).slice(0, numParticipants);
              
              for (const participant of participants) {
                const chosenOptionId = options[Math.floor(Math.random() * options.length)];
                if (chosenOptionId) {
                  await conn.query(
                    `INSERT INTO survey_responses (survey_id, question_id, option_id, user_id, created_at)
                     VALUES (?, ?, ?, ?, DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? MINUTE))`,
                    [surveyId, questionId, chosenOptionId, participant.id, Math.floor(Math.random() * 1440)]
                  );
                }
              }
            }
          }
        }
      }
      console.log(`✓ ${SURVEY_COUNT} Surveys mit Fragen & Antworten eingefügt`);
    }

    await conn.commit();
    console.log('✅ Testdaten erfolgreich generiert! ');
  
  } catch (err) {
    if (conn) await conn.rollback();
    console.error('❌ Fehler:', err.message || err);
    process.exit(1);
  } finally {
    if (conn) conn.release();
  }
}

seedTestData();
