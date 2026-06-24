/**
 * @fileoverview Routen für Ideen: Listing, Suche, CRUD, Datei-Downloads und SSE-Updates.
 * Dieses Modul kapselt die HTTP-Handler und nutzt die `ideasService`-Logik für die schwere Arbeit.
 * Alle JSDoc-Kommentare sind in Deutsch verfasst.
 * @module routes/ideas
 */

const express = require('express');
const path = require('path');
const fs = require('fs');

const liveUpdates = require('../lib/liveUpdates');
const asyncHandler = require('../lib/asyncHandler');
const { firstQueryValue } = require('../lib/dbHelpers');
const { userRender } = require('../lib/viewHelpers');
const { sendErrorPage } = require('../lib/http');
const { isAdmin: hasAdminRole } = require('../lib/roleHelpers');

// Logik in `ideasService` ausgelagert: `enrichIdeasBatch`, `normalizeAuthor` wurden aus den Route-Imports entfernt

const {
  loadSingleCommentWithReactions
} = require('../lib/services/ideasCommentsService');

const {
  getIdeaFile,
  ideasUpload,
  streamDecryptIdeaToResponse,
  saveIdeaFile,
  deleteIdeaFile,
  deriveKeyForIdeas
} = require('../lib/services/ideasFilesService');

const {
  SORT_WHITELIST,
  normalizeSort
} = require('../lib/services/ideasSearchService');

const { getWeeklyRemaining } = require('../lib/services/ideasStatsService');
const categoriesService = require('../lib/services/categoriesService');

const {
  renderIdeaCard,
  fetchIdeas,
  createIdea,
  deleteIdea,
  updateIdea,
  addIdeaTags,
  removeIdeaTag,
  checkDuplicateIdea,
  updateIdeaStatus,
  uploadIdeaFile
} = require('../lib/services/ideasService');

const reactionsService = require('../lib/services/reactionsService');
const { isLoggedIn } = require('./middleware');
const htmxDetector = require('../lib/htmxDetector');

const ALLOWED_STATUSES = ['neu', 'in Prüfung', 'in prüfung', 'akzeptiert', 'abgelehnt'];
const router = express.Router();

router.use(isLoggedIn);
router.use(htmxDetector.middleware);

// Kommentare und Reaktionen als verschachtelte Routen
router.use('/:id/comments', require('./comments'));
router.use('/eigen', require('./comments-likes'));

/**
 * GET /ideas
 * Haupt-Route zum Auflisten von Ideen mit Filtern, Suche und Pagination.
 * Unterstützt HTMX-Teil-Updates für Infinite Scroll.
 * @name GET /
 * @function
 * @inner
 */
router.get('/', asyncHandler(async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { 
      ideas, 
      categories, 
      user, 
      pagination, 
      search,
      filters 
    } = await fetchIdeas(userId, req.query);

    // Debug-JSON-Ausgabe unterstützen
    if (firstQueryValue(req.query.debug_search, '') === '1') {
      const cachedExactIdeaId = ideas.length > 0 && String(ideas[0].title).toLowerCase() === search.q.toLowerCase() ? ideas[0].idea_id : null;
      return res.json({ debug: true, q: search.q, engine: search?.engine || null, search });
    }

    const { page, hasNextPage } = pagination;
    const nextPage = hasNextPage ? (page + 1) : null;

    const templateData = {
      ideas,
      categories,
      q: filters.q,
      category_id: filters.category_id,
      owned_only: filters.owned_only,
      sort: filters.sort,
      // das komplette Session-User-Objekt (Rolle/Benutzername) liefern, verbleibende Zähler aus dem Fetch-Ergebnis übernehmen
      user: userRender(req.session.user, user),
      // Variablen, die von den Views erwartet werden
      q: filters.q,
      category_id: filters.category_id,
      tags: filters.tags,
      sort: filters.sort,
      search_scope: firstQueryValue(req.query.search_scope, ''),
      currentPage: page,
      nextPage,
      hasNextPage,
      // numerische Live-Update-Version für Partials verfügbar halten
      liveVersion: liveUpdates.getCurrentVersion(),
      isGlobal: firstQueryValue(req.query.global, '') === 'on'
    };

    if (req.isHtmx && page > 1) {
      // ältere Versionen referenzierten `_list-items`, das nicht existiert; das Listen-Partial rendern
      return res.render('ideas/_list', templateData);
    }
    if (req.isHtmx && page === 1) {
      // For HTMX partial swaps we must NOT include the external load-more button
      // in the response body, otherwise repeated swaps will append another
      // button to the page. Tell the partial not to render the button.
      templateData.renderLoadMoreButton = false;
      return res.render('ideas/_content', templateData);
    }

    res.render('ideas/ideas', {
      ...templateData,
      activePage: 'ideas'
    });
  } catch (err) {
    console.error('Error in GET /ideas:', err);
    res.status(500).send(req.isHtmx ? 'Interner Serverfehler beim Laden der Ideen' : errorHtml('Interner Serverfehler beim Laden der Ideen'));
  }
}));
// Ende des Haupt-GET-/handlers


/**
 * GET /ideas/chunk
 * Liefert Ideen-Daten als JSON oder HTMX-Fragment für dynamisches Nachladen.
 * @name GET /chunk
 * @function
 * @inner
 */
router.get('/chunk', async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { 
      ideas, 
      pagination, 
      search,
      filters
    } = await fetchIdeas(userId, req.query);

    const hasNextPage = pagination.hasNextPage;
    const totalCount = pagination.totalCount;
    const page = pagination.page;
    const qNorm = search ? search.q : '';
    const category_id = filters.category_id;
    const owned_only = filters.owned_only;
    const tagsRaw = filters.tags;
    const sort = filters.sort;

    if (req.query.partial_json === '1') {
      const { remainingLikes, remainingDislikes } = await getWeeklyRemaining(userId);
      const categories = await categoriesService.getAll();
      
      const html = await new Promise((resolve, reject) => {
        res.render('ideas/_list', {
          ideas,
          categories,
          user: userRender(req.session.user, { remainingLikes, remainingDislikes }),
          q: qNorm,
          category_id,
          owned_only,
          tags: tagsRaw,
          sort,
          search_scope: firstQueryValue(req.query.search_scope, ''),
          nextPage: hasNextPage ? page + 1 : null
        }, (err, html) => err ? reject(err) : resolve(html));
      });

      const extra = (search && search.fuzzyPage !== undefined) ? {
        fuzzy_page_current: search.fuzzyPage,
        fuzzy_page_next: search.fuzzyPage + 1,
        candidate_page_size: search.candidatePageSize,
        candidate_total: search.total
      } : {};

      return res.json(Object.assign({
        html,
        nextPage: hasNextPage ? page + 1 : null,
        total: totalCount
      }, extra));
    }

    const extra = (search && search.fuzzyPage !== undefined) ? {
      fuzzy_page_current: search.fuzzyPage,
      fuzzy_page_next: search.fuzzyPage + 1,
      candidate_page_size: search.candidatePageSize,
      candidate_total: search.total
    } : {};

    res.json(Object.assign({
      ideas,
      nextPage: hasNextPage ? page + 1 : null,
      total: totalCount
    }, extra));
  } catch (err) {
    console.error('Error in GET /ideas/chunk:', err);
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

/**
 * Test-Hilfsfunktion für Suchlogik.
 * Führt dieselbe Suchlogik wie die Haupt-`/`-Route aus, akzeptiert jedoch ein `opts`-Objekt.
 * @async
 * @param {Object} opts - Suchoptionen.
 * @returns {Promise<Object>} Suchergebnis oder Fehler.
 */
router.testSearch = async function(opts = {}) {
  try {
    const __routeStart = Date.now();
    const userId = opts.userId || 0;
    const { 
      ideas: enriched, 
      pagination, 
      search 
    } = await fetchIdeas(userId, opts);

    const duration = Date.now() - __routeStart;
    return { 
      enriched, 
      total: pagination.totalCount, 
      duration, 
      candidateTotal: search ? search.total : undefined, 
      fuzzyPage: search && search.fuzzyPage !== undefined ? search.fuzzyPage : 0 
    };
  } catch (err) {
    return { error: err && err.message ? err.message : String(err) };
  }
};

/**
 * GET /ideas/updates
 * SSE-Endpoint für Echtzeit-Updates von Ideen.
 * @name GET /updates
 * @function
 * @inner
 */
router.get('/updates', async (req, res) => {
  try {
    const sinceParam = parseInt(req.query.since, 10);
    let since = Number.isFinite(sinceParam) ? sinceParam : 0;

    // SSE-Unterstützung
    if (req.headers.accept === 'text/event-stream') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      });
      res.write('\n');

      const sendUpdate = (payload) => {
        if (payload.changes && payload.changes.length > 0) {
          // BigInt-sicher serialisieren und als SSE-Event senden
          const json = JSON.stringify(payload, (_k, v) => (typeof v === 'bigint' ? v.toString() : v));
          res.write(`id: ${payload.version}\ndata: ${json}\n\n`);
        }
      };

      const waiter = liveUpdates.registerSSEWaiter(since, sendUpdate);

      // Heartbeat: hält die SSE-Verbindung offen (alle 15s)
      const heartbeat = setInterval(() => {
        res.write(': heartbeat\n\n');
      }, 15000);

      // Verbindung geschlossen: Heartbeat stoppen und Waiter aufräumen
      req.on('close', () => {
        clearInterval(heartbeat);
        waiter.cleanup();
      });

      // Bei Bedarf initiale Änderungen nachliefern
      const currentVersion = liveUpdates.getCurrentVersion();
      if (currentVersion > since) {
        const changes = liveUpdates.getChangesSince(since);
        if (changes.length > 0) {
          sendUpdate({ version: currentVersion, changes });
        }
      }
      return;
    }

    // Long-Polling wird nicht mehr unterstützt
    res.status(406).json({ error: 'SSE erforderlich. Long-Polling wird nicht mehr unterstützt.' });
  } catch (err) {
    console.error('Updates endpoint error:', err);
    if (!res.headersSent) {
      res.status(500).json({ version: liveUpdates.getCurrentVersion(), changes: [] });
    }
  }
});

// HINWEIS: `/ideas/latest-card` entfernt. Nutze `/ideas/:id/card` für deterministische Karten.

/**
 * GET /ideas/:id/card
 * Liefert das HTML-Fragment für eine einzelne Ideen-Karte.
 * @name GET /:id/card
 * @function
 * @inner
 */
router.get('/:id/card', async (req, res) => {
  try {
    const userId = req.session.user.id;
    const categoriesRows = await categoriesService.getAll();

    const data = await renderIdeaCard(req.params.id, userId, categoriesRows);
      if (!data || !data.idea) return res.status(404).send(req.isHtmx ? 'Idee nicht gefunden' : errorHtml('Idee nicht gefunden'));

    // Das "zusammengeklappte" Verhalten beibehalten
    const collapsedIdea = { ...data.idea };

    // User stats (for header)
    const { remainingLikes, remainingDislikes } = await getWeeklyRemaining(userId);

    res.render('ideas/_list', {
      ideas: [collapsedIdea],
      categories: data.categories,
      user: userRender(req.session.user, data.user),
      q: '',
      category_id: '',
      tags: '',
      currentPage: 1,
      nextPage: null
    });
  } catch (error) {
    console.error('Error in single card route:', error);
    res.status(500).send(req.isHtmx ? 'Error loading card' : errorHtml('Error loading card'));
  }
});


/**
 * GET /ideas/partial
 * Liefert eine bereinigte Liste von Ideen-Karten (HTMX).
 * @name GET /partial
 * @function
 * @inner
 */
router.get('/partial', async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { enriched, total, hasNextPage, sort, q, category_id, tags } = await fetchIdeas(userId, req.query);

    if (!enriched) {
      return res.status(500).send(req.isHtmx ? 'Search failed' : errorHtml('Search failed'));
    }

    const { remainingLikes, remainingDislikes } = await getWeeklyRemaining(userId);

    return res.render('ideas/_list', {
      ideas: enriched,
      categories: await categoriesService.getAll(), // Kategorien werden für das Listen-Partial benötigt
      q: q || '',
      category_id: category_id || '',
      tags: tags || '',
      sort,
      nextPage: hasNextPage ? (parseInt(firstQueryValue(req.query.page, '1'), 10) || 1) + 1 : null,
      search_scope: firstQueryValue(req.query.search_scope, ''),
      user: userRender(req.session.user, { remainingLikes, remainingDislikes })
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Serverfehler');
  }
});


/**
 * POST /ideas
 * Erstellt eine neue Idee, optional mit Datei-Upload.
 * @name POST /
 * @function
 * @inner
 */
router.post('/', ideasUpload.single('file'), async (req, res) => {
  try {
    const user_id = req.session.user.id;
    const { title, description, tags = '' } = req.body;

    const rawCat = req.body.category_id || req.body.category || null;
    const category_id = rawCat ? (Number.isInteger(Number(rawCat)) ? parseInt(rawCat, 10) : null) : null;

    if (!title || !description) return sendErrorPage(res, 'Titel und Beschreibung erforderlich', 400);

    // Anti-duplication cooldown
    const duplicateId = await checkDuplicateIdea(user_id, title);
    if (duplicateId) {
      if (req.isHtmx) {
        const categoriesRows = await categoriesService.getAll();
        const data = await renderIdeaCard(duplicateId, user_id, categoriesRows);
        if (data && data.idea) {
          return res.render('ideas/_idea-card', {
            idea: data.idea,
            categories: data.categories,
            user: userRender(req.session.user, data.user),
            expanded: false
          });
        }
      }
      return res.redirect('/ideas');
    }

    const idea_id = await createIdea(user_id, { title, description, tags, category_id }, req.file);

    liveUpdates.recordChange(idea_id, 'new_idea');

    if (req.isHtmx) {
      const categoriesRows = await categoriesService.getAll();
      const data = await renderIdeaCard(idea_id, user_id, categoriesRows);
      if (!data || !data.idea) return res.status(500).send(req.isHtmx ? 'Card render failed' : errorHtml('Card render failed'));
      return res.render('ideas/_idea-card', {
        idea: data.idea,
        categories: data.categories,
        user: userRender(req.session.user, data.user),
        expanded: false
      });
    }

    res.redirect('/ideas');
  } catch (err) {
    console.error('Create idea error:', err);
    res.status(500).send(req.isHtmx ? 'Serverfehler' : errorHtml('Serverfehler'));
  }
});

/**
 * POST /ideas/:id/delete
 * Löscht eine Idee.
 * @name POST /:id/delete
 * @function
 * @inner
 */
router.post('/:id/delete', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.session.user.id;
    const userRole = req.session.user.role;

    const result = await deleteIdea(id, userId, userRole);
    if (!result.success) {
      return res.status(result.error === 'Nicht berechtigt' ? 403 : 404).send(req.isHtmx ? result.error : errorHtml(result.error));
    }

    liveUpdates.recordChange(id, 'idea_deleted');
    
    if (req.isHtmx) {
      return res.json({ deleted: true, id });
    }

    res.redirect('/ideas');
  } catch (err) {
    console.error('Delete idea error:', err);
    res.status(500).send(req.isHtmx ? 'Serverfehler' : errorHtml('Serverfehler'));
  }
});

/**
 * POST /ideas/:id/files
 * Lädt eine weitere Datei zu einer bestehenden Idee hoch.
 * @name POST /:id/files
 * @function
 * @inner
 */
router.post('/:id/files', ideasUpload.single('file'), async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.session.user.id;

    if (!req.file) return sendErrorPage(res, 'Keine Datei ausgewählt', 400);

    const saved = await uploadIdeaFile(id, userId, req.file);
    if (!saved) {
      // Die Logik im Service übernimmt den DB-Insert; false bedeutet, dass der Insert fehlgeschlagen ist
      // Normalerweise wird jedoch bei ernsten Fehlern eine Exception geworfen.
    }

    const categoriesRows = await categoriesService.getAll();
    const data = await renderIdeaCard(id, userId, categoriesRows);
    if (!data) return sendErrorPage(res, 'Idee nicht gefunden', 404);

    liveUpdates.recordChange(id, 'file_uploaded');

    const hxTarget = req.get('HX-Target');
    const renderModal = req.query.render === 'modal' || hxTarget === 'idea-edit-modal-content' || hxTarget === '#idea-edit-modal-content';

    if (renderModal) {
      return res.render('ideas/_idea-modal', {
        idea: data.idea,
        categories: data.categories,
        user: userRender(req.session.user, data.user),
        csrfToken: (req.csrfToken ? req.csrfToken() : (req.session.csrfToken || ''))
      });
    }

    res.render('ideas/_idea-card', {
      idea: data.idea,
      categories: data.categories,
      user: userRender(req.session.user, data.user),
      expanded: false
    });
  } catch (err) {
    console.error(err);
    res.status(200).send('\n\nDatei hochgeladen, aber Anzeige-Fehler. Bitte Seite laden.');
  }
});


/**
 * POST /ideas/files/:fileId/delete
 * Löscht eine Datei einer Idee.
 * @name POST /files/:fileId/delete
 * @function
 * @inner
 */
router.post('/files/:fileId/delete', async (req, res) => {
  try {
    const fileId = Number(req.params.fileId);
    if (!Number.isInteger(fileId)) return res.status(400).send(req.isHtmx ? 'Ungültige Datei-ID' : errorHtml('Ungültige Datei-ID'));

    const userId = req.session.user.id;
    const userRole = req.session.user.role;

    const result = await deleteIdeaFile(fileId, userId, userRole);
    if (!result.success) {
      if (result.error === 'Nicht berechtigt') return res.status(403).send(req.isHtmx ? result.error : errorHtml(result.error));
      if (result.error === 'Datei nicht gefunden') return res.status(404).send(req.isHtmx ? result.error : errorHtml(result.error));
      return res.status(500).send(req.isHtmx ? result.error : errorHtml(result.error));
    }

    const ideaId = result.ideaId;
    
    // Re-render updated card
    const categoriesRows = await categoriesService.getAll();
    const data = await renderIdeaCard(ideaId, userId, categoriesRows);
    if (!data) return res.status(404).send(req.isHtmx ? 'Idee nicht gefunden' : errorHtml('Idee nicht gefunden'));

    liveUpdates.recordChange(ideaId, 'file_deleted');

    // Falls die Anfrage aus dem Modal kam, Modal-Inhalt neu rendern statt der Karte
    const hxTarget = req.get('HX-Target');
    const renderModal = req.query.render === 'modal' || hxTarget === 'idea-edit-modal-content' || hxTarget === '#idea-edit-modal-content';
    
    if (renderModal) {
      return res.render('ideas/_idea-modal', {
        idea: data.idea,
        categories: data.categories,
        user: userRender(req.session.user, data.user),
        csrfToken: (req.csrfToken ? req.csrfToken() : (req.session.csrfToken || ''))
      });
    }

    return res.render('ideas/_idea-card', {
      idea: data.idea,
      categories: data.categories,
      user: userRender(req.session.user, data.user),
      expanded: false
    });
  } catch (err) {
    console.error('File delete error:', err);
    return res.status(500).send(req.isHtmx ? 'Server Fehler' : errorHtml('Server Fehler'));
  }
});

/**
 * GET /ideas/files/:fileId/download
 * Lädt eine Datei einer Idee herunter, entschlüsselt sie ggf. on-the-fly.
 * @name GET /files/:fileId/download
 * @function
 * @inner
 */
router.get('/files/:fileId/download', async (req, res) => {
  try {
    const fileId = Number(req.params.fileId);
    if (!Number.isInteger(fileId)) return res.status(400).send(req.isHtmx ? 'Ungültige Datei-ID' : errorHtml('Ungültige Datei-ID'));

    const file = await getIdeaFile(fileId);
    if (!file) return res.status(404).send(req.isHtmx ? 'Datei nicht gefunden' : errorHtml('Datei nicht gefunden'));

    const safeName = path.basename(file.file_path);
    const baseDir = path.join(__dirname, '../data/uploads/ideas');
    const absPath = path.join(baseDir, safeName);
    const downloadName = file.original_name || safeName;

    // If file is stored encrypted (has .enc.meta), decrypt on-the-fly when possible
    const key = deriveKeyForIdeas();
    try {
      if (key && safeName.endsWith('.enc')) {
        const ok = streamDecryptIdeaToResponse(absPath, res, key, downloadName);
        if (ok) return;
      }
    } catch (e) {
      console.error('Decryption stream error:', e);
    }

    // Fallback: serve the raw file (if any plaintext exists)
    // Fallback-Download: sende die Datei als Attachment; logge Fehler falls vorhanden
    res.download(absPath, downloadName, (err) => {
      if (err) {
        console.error('Download error:', err);
        if (!res.headersSent) res.status(500).send(req.isHtmx ? 'Download fehlgeschlagen' : errorHtml('Download fehlgeschlagen'));
      }
    });
  } catch (err) {
    console.error('Download error:', err);
    res.status(500).send(req.isHtmx ? 'Serverfehler' : errorHtml('Serverfehler'));
  }
});

/**
 * GET /ideas/:id/stats
 * Liefert das Statistik-Teilstück (Likes/Dislikes) einer Idee.
 * @name GET /:id/stats
 * @function
 * @inner
 */
router.get('/:id/stats', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.session.user.id;

    const categoriesRows = await categoriesService.getAll();
    const data = await renderIdeaCard(id, userId, categoriesRows);
    if (!data || !data.idea) return res.status(404).send(req.isHtmx ? 'Idee nicht gefunden' : errorHtml('Idee nicht gefunden'));

    res.render('ideas/_idea-stats', { idea: data.idea, user: data.user });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).send(req.isHtmx ? 'Serverfehler' : errorHtml('Serverfehler'));
  }
});

/**
 * POST /ideas/:id/status
 * Aktualisiert den Status einer Idee (Admin).
 * @name POST /:id/status
 * @function
 * @inner
 */
router.post('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.session.user.id;
    const userRole = req.session.user.role;

    if (!ALLOWED_STATUSES.includes(status)) return res.status(400).send(req.isHtmx ? 'Ungültiger Status' : errorHtml('Ungültiger Status'));

    const result = await updateIdeaStatus(id, status, userId, userRole);
    if (!result.success) {
      if (result.error === 'Nur Admins können den Status ändern') return res.status(403).send(req.isHtmx ? result.error : errorHtml(result.error));
      if (result.error === 'Eigene Ideen bitte im Bearbeitungsdialog anpassen') return res.status(403).send(req.isHtmx ? result.error : errorHtml(result.error));
      if (result.error === 'Idee nicht gefunden') return res.status(404).send(req.isHtmx ? result.error : errorHtml(result.error));
      return res.status(500).send(req.isHtmx ? result.error : errorHtml(result.error));
    }

    const categoriesRows = await categoriesService.getAll();
    const data = await renderIdeaCard(id, userId, categoriesRows);
    if (!data || !data.idea) return res.status(404).send(req.isHtmx ? 'Idee nicht gefunden' : errorHtml('Idee nicht gefunden'));

    liveUpdates.recordChange(id, 'status_changed', { status });

    const hxTarget = req.get('HX-Target');
    const renderModal = req.query.render === 'modal' || hxTarget === 'idea-edit-modal-content';
    
    if (renderModal) {
      const categories = await categoriesService.getAll();
      return res.render('ideas/_idea-modal', {
        idea: data.idea,
        categories: categories,
        user: req.session.user,
        csrfToken: (req.csrfToken ? req.csrfToken() : (req.session.csrfToken || ''))
      });
    }

    return res.render('ideas/_idea-card', {
      idea: data.idea,
      categories: data.categories,
      user: req.session.user,
      expanded: false
    });
  } catch (err) {
    console.error('Status update error:', err);
    res.status(500).send('Serverfehler');
  }
});

/**
 * POST /ideas/:id/edit
 * Bearbeitet Titel, Beschreibung und Kategorie einer Idee.
 * @name POST /:id/edit
 * @function
 * @inner
 */
router.post('/:id/edit', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description } = req.body;
    const userId = req.session.user.id;
    const userRole = req.session.user.role;

    const rawCat = req.body.category_id || req.body.category || null;
    const category_id = rawCat ? (Number.isInteger(Number(rawCat)) ? parseInt(rawCat, 10) : null) : null;

    const result = await updateIdea(id, userId, { title, description, category_id }, userRole);
    if (!result.success) return res.status(403).send(req.isHtmx ? result.error : errorHtml(result.error));

    const categoriesRows = await categoriesService.getAll();
    const data = await renderIdeaCard(id, userId, categoriesRows);
    if (!data) return res.status(404).send(req.isHtmx ? 'Idee nicht gefunden' : errorHtml('Idee nicht gefunden'));

    liveUpdates.recordChange(id, 'idea_edited');

    res.render('ideas/_idea-card', {
      idea: data.idea,
      categories: data.categories,
      user: userRender(req.session.user, data.user),
      expanded: false
    });
  } catch (err) {
    console.error('EDIT FALLBACK ERROR:', err);
    res.status(200).send('... Änderung gespeichert, aber Anzeige-Fehler. Bitte Seite neu laden.');
  }
});

/**
 * POST /ideas/:id/tags
 * Aktualisiert oder fügt Tags zu einer Idee hinzu.
 * @name POST /:id/tags
 * @function
 * @inner
 */
router.post('/:id/tags', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.session.user.id;
    const { tags = '' } = req.body;

    const result = await addIdeaTags(id, userId, tags);
    if (!result.success) return res.status(500).send(result.error || 'Serverfehler');

    const categoriesRows = await categoriesService.getAll();
    const data = await renderIdeaCard(id, userId, categoriesRows);
    if (!data) return res.status(404).send('Idee nicht gefunden');

    liveUpdates.recordChange(id, 'tags_updated');

    const hxTarget = req.get('HX-Target');
    const renderModal = req.query.render === 'modal' || hxTarget === 'idea-edit-modal-content' || hxTarget === '#idea-edit-modal-content';

    if (renderModal) {
      return res.render('ideas/_idea-modal', {
        idea: data.idea,
        categories: data.categories,
        user: userRender(req.session.user, data.user),
        layout: false
      });
    }

    res.render('ideas/_idea-card', {
      idea: data.idea,
      categories: data.categories,
      user: userRender(req.session.user, data.user),
      expanded: false
    });
  } catch (err) {
    console.error('TAGS UPDATE FALLBACK ERROR:', err);
    res.status(200).send('\n\nTags gespeichert, aber Anzeige-Fehler. Bitte Seite neu laden.');
  }
});

/**
 * POST /ideas/:id/tags/delete-single
 * Entfernt einen einzelnen Tag aus einer Idee (Modal-Ansicht).
 * @name POST /:id/tags/delete-single
 * @function
 * @inner
 */
router.post('/:id/tags/delete-single', async (req, res) => {
  try {
    const { id } = req.params;
    const { tagName } = req.body;
    const userId = req.session.user.id;
    const userRole = req.session.user.role;

    if (!tagName) return res.status(400).send(req.isHtmx ? 'Tag name required' : errorHtml('Tag name required'));

    const result = await removeIdeaTag(id, userId, userRole, tagName);
    if (!result.success) {
      return res.status(result.error === 'Nicht berechtigt' ? 403 : 404).send(req.isHtmx ? result.error : errorHtml(result.error));
    }

    liveUpdates.recordChange(id, 'tags_updated');

    // Aktualisierten Modal-Inhalt zurückgeben
    const categories = await categoriesService.getAll();
    const ideaData = await renderIdeaCard(id, userId, categories);
    if (!ideaData) return res.status(404).send(req.isHtmx ? 'Idee nicht gefunden' : errorHtml('Idee nicht gefunden'));
    
    // Sicherstellen, dass das User-Objekt Rolle/Benutzername für das Modal enthält
    ideaData.user = userRender(req.session.user, ideaData.user);

    return res.render('ideas/_idea-modal', { ...ideaData });
  } catch (err) {
    console.error(err);
    res.status(500).send('Serverfehler');
  }
});

/**
 * POST /ideas/:id/tags/delete
 * Entfernt einen Tag aus einer Idee.
 * @name POST /:id/tags/delete
 * @function
 * @inner
 */
router.post('/:id/tags/delete', async (req, res) => {
  try {
    const { id } = req.params;
    const rawTag = firstQueryValue(req.body.tag || req.body.tagName || '', '');
    const tagName = String(rawTag || '').trim().toLowerCase();
    if (!tagName) return res.status(400).send(req.isHtmx ? 'Tag required' : errorHtml('Tag required'));

    const userId = req.session.user.id;
    const userRole = req.session.user.role;

    const result = await removeIdeaTag(id, userId, userRole, tagName);
    if (!result.success) {
      return res.status(result.error === 'Nicht berechtigt' ? 403 : 404).send(result.error);
    }

    liveUpdates.recordChange(id, 'tags_updated');

    // Return refreshed modal content (HTMX target expects innerHTML)
    const categories = await categoriesService.getAll();
    const data = await renderIdeaCard(id, userId, categories);
    if (!data) return res.status(404).send('Idee nicht gefunden');
    return res.render('ideas/_idea-modal', { idea: data.idea, categories: data.categories, user: userRender(req.session.user, data.user) });
  } catch (err) {
    console.error('Tag delete error:', err);
    res.status(500).send('Serverfehler');
  }
});

/**
 * POST /ideas/:id/like
 * Toggelt das Like einer Idee (Statistiken).
 * @name POST /:id/like
 * @function
 * @inner
 */
router.post('/:id/like', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.session.user.id;
    
    const result = await reactionsService.toggleIdeaLike(id, userId);

    const categoriesRows = await categoriesService.getAll();
    const data = await renderIdeaCard(id, userId, categoriesRows);
    if (!data) return res.status(404).send('Idee nicht gefunden');

    res.render('ideas/_idea-stats', { 
      idea: data.idea, 
      user: data.user,
      errorMessage: result.success ? null : 'Keine Likes mehr übrig!'
    });

    if (result.success) {
      liveUpdates.recordChange(id, result.liked ? 'idea_liked' : 'idea_unliked');
    }
  } catch (err) {
    console.error(err);
    res.status(500).send('Serverfehler');
  }
});

/**
 * POST /ideas/:id/dislike
 * Toggelt das Dislike einer Idee (Statistiken mit Limit-Prüfung).
 * @name POST /:id/dislike
 * @function
 * @inner
 */
router.post('/:id/dislike', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.session.user.id;
    
    const result = await reactionsService.toggleIdeaDislike(id, userId);
    
    const categoriesRows = await categoriesService.getAll();
    const data = await renderIdeaCard(id, userId, categoriesRows);
    if (!data) return res.status(404).send('Idee nicht gefunden');

    res.render('ideas/_idea-stats', { 
      idea: data.idea, 
      user: data.user,
      errorMessage: result.success ? null : 'Keine Dislikes mehr übrig!'
    });

    if (result.success) {
      liveUpdates.recordChange(id, result.disliked ? 'idea_disliked' : 'idea_undisliked');
    }
  } catch (err) {
    console.error(err);
    res.status(500).send('Serverfehler');
  }
});


/**
 * GET /ideas/:id/modal
 * Liefert das HTML-Fragment für das Ideen-Modal (Detailansicht/Bearbeitung).
 * @name GET /:id/modal
 * @function
 * @inner
 */
router.get('/:id/modal', async (req, res) => {
  try {
    const userId = req.session.user.id;
    const ideaId = req.params.id;

    const categoriesRows = await categoriesService.getAll();
    const data = await renderIdeaCard(ideaId, userId, categoriesRows);

    if (!data || !data.idea) return res.status(404).send(req.isHtmx ? 'Idee nicht gefunden' : errorHtml('Idee nicht gefunden'));

      if (!data.idea.isOwner && !hasAdminRole(req.session.user)) {
        return res.status(403).send(req.isHtmx ? 'Nicht berechtigt' : errorHtml('Nicht berechtigt'));
      }

    res.render('ideas/_idea-modal', {
      idea: data.idea,
      categories: data.categories,
      user: userRender(req.session.user, data.user)
    });
  } catch (error) {
    console.error('Error loading modal:', error);
    res.status(500).send('Error loading modal');
  }
});

module.exports = router;
