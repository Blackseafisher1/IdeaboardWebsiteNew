/**
 * @fileoverview Lasttest-Utilities: Endpoints zum synthetischen Durchführen von Suchanfragen
 * gegen die `ideas`-Logik, z.B. zur Messung von Latenz und Durchsatz.
 * Nur für Test-/Entwicklungszwecke gedacht.
 * @module routes/load_test
 */

const express = require('express');
const db = require('../config/db.js');
const ideasRouter = require('./ideas.js');

const router = express.Router();

// Öffentliche Load-Test-Route: `/load-test/search`
// Query-Parameter:
// - `queries`: durch Komma getrennte Liste von Suchbegriffen (default: [''] → Listing)
// - `category_id`: optionaler Kategorie-Filter
// - `global`: wenn 'on' Fulltext-MATCH auf `ideas_search` verwenden, sonst SQL-Listing
// - `rate`: Anfragen pro Sekunde (default 1)
// - `count`: Gesamtanzahl Anfragen (default 10)
// - `limit`: Zeilen pro Anfrage (default 50)

/**
 * firstQueryValue ist ein Express-Route-Handler und verarbeitet Anfragen für diese Route.
 *
 * @returns {*} Beschreibung des Rückgabewerts
 * @function firstQueryValue
 */
function firstQueryValue(v, fallback = '') {
  if (Array.isArray(v)) return v[0] ?? fallback;
  return (v ?? fallback);
}

/**
 * normalizeSort ist ein Express-Route-Handler und verarbeitet Anfragen für diese Route.
 *
 * @returns {*} Beschreibung des Rückgabewerts
 * @function normalizeSort
 */
function normalizeSort(sortKey) {
  // minimal whitelist - mirror of main app, but reduced
  const SORT_WHITELIST = {
    latest: 'i.created_at DESC, i.idea_id DESC',
    oldest: 'i.created_at ASC, i.idea_id ASC',
    likes: 'i.like_count DESC, i.created_at DESC, i.idea_id DESC'
  };
  return SORT_WHITELIST[sortKey] ? sortKey : 'latest';
}

async function runSearchOnce(q, opts) {
  // Call the ideas route's exported `testSearch` helper so we reuse exact logic.
  try {
    const res = await ideasRouter.testSearch({ q, category_id: opts.category_id, tags: opts.tags || '', global: opts.global, sort: opts.sort, limit: opts.limit, offset: opts.offset, page: opts.page });
    if (res && res.error) return { ok: false, error: res.error };
    // Return enriched results in `rows` to match previous shape
    return { ok: true, rows: (res && res.enriched) ? res.enriched : [] };
  } catch (e) {
    return { ok: false, error: e && e.message ? e.message : String(e) };
  }
}

/**
 * GET /search
 * Führt synthetische Suchanfragen durch, um Performance-Metriken (Latenz, Durchsatz) zu sammeln.
 * Unterstützt sequentielle und parallele Ausführung mit einstellbarer Rate.
 * @name GET /search
 * @function
 * @inner
 */
router.get('/search', async (req, res) => {
  try {
    const queriesRaw = firstQueryValue(req.query.queries, '');
    let queries = queriesRaw ? String(queriesRaw).split(',').map(s => s.trim()).filter(Boolean) : [''];
    const sampleFromDb = String(firstQueryValue(req.query.sample_from_db, '')).toLowerCase() === '1' || String(firstQueryValue(req.query.sample_from_db, '')).toLowerCase() === 'true' || String(firstQueryValue(req.query.sample_from_db, '')).toLowerCase() === 'on';
    if (sampleFromDb) {
      const sampleSize = Math.max(1, Number(firstQueryValue(req.query.sample_size, '20')) || 20);
      try {
        const rows = db.normalizeQueryResult(await db.query('SELECT title FROM ideas WHERE title IS NOT NULL ORDER BY RAND() LIMIT ?', [sampleSize]));
        const titles = rows.map(r => r.title).filter(Boolean);
        if (titles.length > 0) queries = titles;
      } catch (e) {
        console.warn('load-test: could not sample titles from DB:', e && e.message ? e.message : e);
      }
    }
    const rate = Math.max(0.1, Number(firstQueryValue(req.query.rate, '1')));
    const count = Math.max(1, Number(firstQueryValue(req.query.count, '10')));
    const limit = Number(firstQueryValue(req.query.limit, '50')) || 50;
    const category_id = firstQueryValue(req.query.category_id, '');
    const global = firstQueryValue(req.query.global, '');
    const sort = firstQueryValue(req.query.sort, 'latest');
    // modes: comma-separated 'fuse'|'sql' (or 'global') to cycle per-request.
    // Example: modes=fuse,sql will alternate between fuzzy and SQL fulltext.
    const modesRaw = firstQueryValue(req.query.modes, '');
    let modes = modesRaw ? String(modesRaw).split(',').map(s => s.trim().toLowerCase()).filter(Boolean) : [];
    if (modes.length === 0) {
      modes = [(String(global) === 'on' ? 'sql' : 'fuse')];
    }

    const intervalMs = Math.round(1000 / rate);

    let completed = 0;
    let success = 0;
    let errors = 0;
    let durations = [];

    const concurrency = Math.max(1, Number(firstQueryValue(req.query.concurrency, '5')));
    const parallel = String(firstQueryValue(req.query.parallel, '')).toLowerCase() === '1' || String(firstQueryValue(req.query.parallel, '')).toLowerCase() === 'true' || String(firstQueryValue(req.query.parallel, '')).toLowerCase() === 'on';

    if (!parallel || concurrency <= 1) {
      // Sequenzielle Ausführung mit einfachem Rate-Limiting
      for (let i = 0; i < count; i++) {
        const q = queries[i % queries.length] || '';
        const mode = modes[i % modes.length] || modes[0];
        const useGlobal = (mode === 'sql' || mode === 'global');
        const start = Date.now();
        const offset = Math.floor(Math.random() * 10) * limit;
        // eslint-disable-next-line no-await-in-loop
        const r = await runSearchOnce(q, { global: useGlobal ? 'on' : '', category_id, sort, limit, offset });
        const dur = Date.now() - start;
        durations.push(dur);
        completed++;
        if (r.ok) success++; else errors++;
        if (i < count - 1) await new Promise(rp => setTimeout(rp, intervalMs));
      }
    } else {
      // Paralleler Worker-Pool. Berechne pro-Worker-Delay so dass die aggregierte
      // Rate ungefähr `rate` entspricht.
      const workerDelayMs = Math.max(0, Math.round(1000 * concurrency / rate));
      let nextIndex = 0;

      async function worker() {
        while (true) {
          const i = nextIndex++;
          if (i >= count) break;
          const q = queries[i % queries.length] || '';
          const mode = modes[i % modes.length] || modes[0];
          const useGlobal = (mode === 'sql' || mode === 'global');
          const start = Date.now();
          const offset = Math.floor(Math.random() * 10) * limit;
          const r = await runSearchOnce(q, { global: useGlobal ? 'on' : '', category_id, sort, limit, offset });
          const dur = Date.now() - start;
          durations.push(dur);
          completed++;
          if (r.ok) success++; else errors++;
          if (i < count - 1 && workerDelayMs > 0) await new Promise(rp => setTimeout(rp, workerDelayMs));
        }
      }

      // Start workers
      const workers = Array.from({ length: concurrency }, () => worker());
      await Promise.all(workers);
    }

    const total = durations.length;
    const avg = total ? Math.round(durations.reduce((a,b)=>a+b,0)/total) : 0;
    const min = total ? Math.min(...durations) : 0;
    const max = total ? Math.max(...durations) : 0;

    const metrics = { requested: count, rate, completed, success, errors, avg_ms: avg, min_ms: min, max_ms: max };
    console.log('[load-test] metrics:', metrics);
    return res.json({ metrics });
  } catch (err) {
    console.error('load-test error', err);
    return res.status(500).json({ error: err && err.message ? err.message : String(err) });
  }
});

module.exports = router;
