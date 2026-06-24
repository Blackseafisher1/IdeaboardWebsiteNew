# Todo: Code Cleanup & Konsistenz

## 1. Übersetzung englischer Kommentare → Deutsch

Vereinzelte englische Inline-Kommentare finden, die inmitten von deutschem Code stehen:

- [ ] `lib/services/ideasSearchService.js:53` — `// Normalize: trim + lowercase` → Deutsch
- [ ] `routes/ideas.js:288` — `// BigInt-sicher serialisieren und als SSE-Event senden` → `// BigInt-sicher serialisieren und als SSE-Event senden` (bereits Deutsch, ok)
- [ ] `lib/services/userService.js:94` — `// Verhindere Kollisionen nur durch Groß-/Kleinschreibung` → `// Verhindere Kollisionen durch Groß-/Kleinschreibung`

## 2. Entfernte Tote Code-Stellen ✓ (erledigt)

- [x] `config/db.js:20-26` — auskommentiertes CREATE DATABASE + Kategorie-Seed entfernt
- [x] `config/db.js:40` — verwaiste Zeile `statusEl.classList.remove(...)` entfernt
- [x] `routes/load_test.js:7-12` — doppelter `@fileoverview`-Block entfernt
- [x] `lib/liveUpdates.js:78-83` — verwaister `sanitizeValue`-JSDoc-Block entfernt
- [x] `routes/ideas.js:280-285` — verwaister `sendUpdate`-JSDoc-Block entfernt
- [x] `routes/ideas.js:175-181` — verwaister JSDoc-Block in `res.render()` entfernt
- [x] `server.js:71` — auskommentiertes `app.use(timing('global'))` entfernt
- [x] `server.js:331-334` — `reusePort` gesäubert

## 3. JSDoc-Konsistenz

JSDoc in Deutsch ist erwünscht. Prüfen, ob alle Dateien konsistent deutschen JSDoc haben:

- [ ] `lib/cacheHelper.js` — hat keinen JSDoc-Modulheader
- [ ] `config/db.js:68` — `// Internal normalization helper (keep internal only)` → Deutsch
- [ ] `lib/keyManager.js:42` — `// Use the established _writeToOutput hook for masking` → Deutsch
- [ ] `lib/dbHelpers.js:28` — `// Kurze Wartezeit (exponentielles Backoff-ähnlich)` → bereits Deutsch ✓
- [ ] `public/js/index.js:87-193` — einige englische Inline-Kommentare → Deutsch
- [ ] `public/js/ideasLive.js:288` — `// BigInt-sicher serialisieren und als SSE-Event senden` → bereits Deutsch ✓

## 4. Datenbank-Migrationen

Die Kategorie-Erstellung + Seed in `config/db.js` wurde entfernt (gehörte nicht in `getPool()`).
Stattdessen in eine Migration auslagern, falls nicht bereits vorhanden:

- [ ] Prüfen, ob `migrations/0000_baseline.sql` die categories-Tabelle anlegt (ja, tut es)
- [ ] Prüfen, ob der Seed (Innovation, Prozess, Produkt, Kultur) in einer Migration vorhanden ist (nein) → Migration `0039_seed_categories.sql` erstellen

## 5. Schnelle Korrekturen

- [ ] `lib/services/ideasService.js:39` — Lazy `require('./ideasFilesService')` dokumentieren oder umgehen
- [ ] `lib/services/ideasSearchService.js:166-181` — `buildBooleanQuery()` vor FULLTEXT-Sonderzeichen schützen
