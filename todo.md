# Todo: Code Cleanup & Docs

## 1. Translate German JSDoc → English

- [ ] `lib/liveUpdates.js` — translate all JSDoc + inline comments
- [ ] `lib/redis.js` — translate all JSDoc + inline comments
- [ ] `lib/dbHelpers.js` — translate all JSDoc + inline comments
- [ ] `lib/http.js` — translate all JSDoc
- [ ] `lib/htmxDetector.js` — translate all JSDoc
- [ ] `lib/viewHelpers.js` — translate all JSDoc
- [ ] `lib/cacheHelper.js` — translate all JSDoc
- [ ] `lib/timing.js` — translate all JSDoc
- [ ] `lib/upload_quarantine.js` — translate all JSDoc
- [ ] `lib/sqlFragmentBuilder.js` — translate all JSDoc
- [ ] `lib/keyManager.js` — translate all JSDoc
- [ ] `lib/roleHelpers.js` — translate all JSDoc
- [ ] `lib/mariadb-session-store.js` — translate all JSDoc
- [ ] `lib/asyncHandler.js` — translate all JSDoc
- [ ] `lib/types.js` — translate all JSDoc
- [ ] `lib/services/*.js` — translate all JSDoc in all service files
- [ ] `routes/ideas.js` — translate all JSDoc
- [ ] `routes/comments.js` — translate all JSDoc
- [ ] `routes/comments-likes.js` — translate all JSDoc
- [ ] `routes/dashboard.js` — translate all JSDoc
- [ ] `routes/adminPage.js` — translate all JSDoc
- [ ] `routes/users.js` — translate all JSDoc
- [ ] `routes/surveys.js` — translate all JSDoc
- [ ] `routes/projects.js` — translate all JSDoc
- [ ] `routes/groups.js` — translate all JSDoc
- [ ] `routes/dms.js` — translate all JSDoc
- [ ] `routes/middleware.js` — translate all JSDoc
- [ ] `routes/load_test.js` — translate all JSDoc
- [ ] `public/js/ideasLive.js` — translate all JSDoc + inline comments
- [ ] `public/js/index.js` — translate all JSDoc + inline comments
- [ ] `public/js/dmLive.js` — translate all JSDoc + inline comments
- [ ] `public/js/groupLive.js` — translate all JSDoc + inline comments
- [ ] `public/js/ideasClient.js` — translate all JSDoc + inline comments
- [ ] `public/js/projectsClient.js` — translate all JSDoc
- [ ] `public/js/surveysClient.js` — translate all JSDoc
- [ ] `public/js/chatClient.js` — translate all JSDoc
- [ ] `config/db.js` — translate all JSDoc

## 2. Console Log Messages

- [ ] `server.js:62` — `"🚀 Starte mit"` → English
- [ ] `server.js:96` — `"FATAL: Die Umgebungsvariable..."` → English
- [ ] `server.js:192,193,219` — `"Zugangscode erforderlich"`, `"Falsches Passwort"` → English
- [ ] `server.js:301,311,319` — German error log messages → English
- [ ] `server.js:324` — `"läuft auf"` → English
- [ ] `server.js:332` — `"reusePort aktiviert"` → English
- [ ] `server.js:373-376` — `"Hinweis:"` → English

## 3. Remove Dead / Orphaned Code

- [ ] `config/db.js:40` — delete orphaned line: `statusEl.classList.remove(...)`
- [ ] `config/db.js:21-26` — remove commented-out CREATE DATABASE block
- [ ] `config/db.js:43-67` — remove inline category table creation + seed (belongs in migrations)
- [ ] `routes/load_test.js:7-12` — remove duplicate `@fileoverview` JSDoc block
- [ ] `lib/liveUpdates.js:78-83` — remove orphaned `sanitizeValue` JSDoc block
- [ ] `routes/ideas.js:280-285` — remove orphaned `sendUpdate` JSDoc block
- [ ] `routes/ideas.js:175` — remove orphaned callback JSDoc inside `res.render()`
- [ ] `server.js:71` — remove commented-out `app.use(timing('global'))`

## 4. Normalize Error Messages

Pick one language (recommend: English for code, German for rendered UI as per requirements)

- [ ] `routes/ideas.js` — all error strings inconsistent (e.g., `'Card render failed'` vs `'Datei nicht gefunden'`)
- [ ] `routes/ideas.js:687` — `'Eigene Ideen bitte im Bearbeitungsdialog anpassen'` → either all DE or all EN
- [ ] Check all `routes/*.js` for mixed-language error responses

## 5. Quick Fixes

- [ ] `lib/services/ideasSearchService.js:53` — standalone English comment `// Normalize: trim + lowercase` in otherwise German file
- [ ] `routes/ideas.js:4` — `"Alle JSDoc-Kommentare sind in Deutsch verfasst."` — remove/translate
- [ ] `lib/services/ideasSearchService.js:7` — `"Alle Beschreibungen auf Deutsch."` — remove
- [ ] `lib/services/ideasService.js:4` — `"Alle JSDoc-Kommentare sind auf Deutsch."` — remove
- [ ] `server.js:331` — fix `reusePort` (set in `listen()` options, not as property after)
- [ ] `lib/services/ideasSearchService.js:166-181` — sanitize input for FULLTEXT boolean mode special chars
