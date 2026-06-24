const db = require('./config/db');

async function test() {
  console.log('=== Levenshtein UDF Tests ===\n');

  // 1. Basic edit distance
  let r = await db.query("SELECT edit_dist('Hallo', 'Hallo') AS d");
  console.log('edit_dist(Hallo, Hallo) =', r[0].d, '(expected: 0)');

  r = await db.query("SELECT edit_dist('Hallo', 'Hallo Welt') AS d");
  console.log('edit_dist(Hallo, Hallo Welt) =', r[0].d, '(expected: 5)');

  r = await db.query("SELECT edit_dist('Katze', 'Hund') AS d");
  console.log('edit_dist(Katze, Hund) =', r[0].d, '(expected: 5)');

  // 2. Bounded
  r = await db.query("SELECT bounded_edit_dist('Hallo', 'Hallo Welt', 3) AS d");
  console.log('bounded_edit_dist(Hallo, Hallo Welt, 3) =', r[0].d, '(expected: 4 = cutoff+1)');

  r = await db.query("SELECT bounded_edit_dist('Katze', 'Katze', 2) AS d");
  console.log('bounded_edit_dist(Katze, Katze, 2) =', r[0].d, '(expected: 0)');

  // 3. With transpositions (Damerau-Levenshtein)
  r = await db.query("SELECT edit_dist_t('abc', 'acb') AS d");
  console.log('edit_dist_t(abc, acb) =', r[0].d, '(expected: 1, transposition)');

  r = await db.query("SELECT edit_dist('abc', 'acb') AS d");
  console.log('edit_dist(abc, acb) =', r[0].d, '(expected: 2, no transposition)');

  // 4. Similarity
  r = await db.query("SELECT similarity_t('Hallo', 'Hallo', 10) AS s");
  console.log('similarity_t(Hallo, Hallo, 10) =', r[0].s, '(expected: 1.0)');

  r = await db.query("SELECT similarity_t('Hallo', 'Helle', 10) AS s");
  console.log('similarity_t(Hallo, Helle, 10) =', r[0].s, '(expected: ~0.6)');

  // 5. Real-world: fuzzy search ideas
  console.log('\n=== Fuzzy Search in Ideas ===');
  const searchTerm = 'Inovation'; // typo
  r = await db.query(`
    SELECT i.idea_id, i.title, i.description,
           edit_dist(LOWER(i.title), ?) AS dist
    FROM ideas i
    WHERE edit_dist(LOWER(i.title), ?) < 4
       OR edit_dist(LOWER(i.description), ?) < 6
    ORDER BY dist ASC
    LIMIT 10
  `, [searchTerm, searchTerm, searchTerm]);
  console.log(`Search for "${searchTerm}" (typo):`, r.length, 'results');
  for (const row of r) {
    console.log(`  [dist=${row.dist}] ${row.title}`);
  }

  console.log('\n=== All tests done ===');
  process.exit(0);
}

test().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
