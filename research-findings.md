# Research Findings — IdeaboardWebsite

## 1. Project Overview

Stack: Node.js/Express + MariaDB + Redis + HTMX + EJS  
Runtime: Supports both Node and Bun  
DB Driver: `mariadb` (official)  
Package dep: `fuse.js` for fuzzy search (projects & surveys only)

---

## 2. Live Update Mechanism (SSE on Ideas Page)

### Flow

```
Client (ideasLive.js)                    Server (routes/ideas.js)               lib/liveUpdates.js           Redis
      |                                        |                                      |                         |
      |-- EventSource(/ideas/updates?since=N) -|                                      |                         |
      |                                        |-- registerSSEWaiter(since, cb) -------|                         |
      |                                        |                                      |                         |
      |                                   [User creates idea via POST /ideas]          |                         |
      |                                        |-- recordChange(id, 'new_idea') -------|                         |
      |                                        |                                      |-- redis.publish --------|
      |                                        |                                      |                         |
      |                                        |                              [other processes]                  |
      |                                        |                                      |<-- redisSub.on --------|
      |                                        |                                      |-- applyChange()         |
      |                                        |                                      |-- notifyWaiters()      |
      |                                        |<-- sendUpdate({version, changes}) ----|                         |
      |<-- SSE onmessage ----------------------|                                      |                         |
      |-- handleSmartUpdate()                   |                                      |                         |
      |   - new_idea: fetchNewIdeaAndPrepend     |                                      |                         |
      |   - idea_deleted: handleIdeaDeletion     |                                      |                         |
      |   - idea_edited: updateSingleCard        |                                      |                         |
      |   - idea_liked: HTMX stats refresh       |                                      |                         |
      |   - comment_added: updateSingleComment   |                                      |                         |
```

### Key files
- `public/js/ideasLive.js` — SSE client, smart DOM updates
- `routes/ideas.js:266` — SSE endpoint `/ideas/updates`
- `lib/liveUpdates.js` — in-memory change log + Redis sync
- `lib/redis.js` — Redis clients, pub/sub helpers

### Cooldown system
`window.localActionCooldowns` (Set of idea IDs) prevents race conditions between local HTMX responses and incoming SSE events during the same user action.

---

## 3. Current Search Implementation

### Idea search
- **Engine:** MariaDB FULLTEXT (BOOLEAN MODE) on `ideas_search` view
- **Table:** `ideas_search` (materialized via migrations/triggers)
- **Title/author search:** `MATCH(s.title) AGAINST(? IN BOOLEAN MODE) OR s.title = ? OR s.title LIKE CONCAT(?, '%') OR s.author LIKE CONCAT(?, '%')`
- **Description search:** `MATCH(s.description) AGAINST(? IN BOOLEAN MODE) OR s.tags LIKE CONCAT('%', ?, '%')`
- **Fulltext indexes:** `idx_ideas_title`, `idx_ideas_description`, `idx_ft_author`, `idx_ft_tags`
- **Late-row lookup pattern:** subquery gets IDs first, then joins full rows after LIMIT
- **Implementation:** `lib/services/ideasSearchService.js`

### Project & Survey search
- `fuse.js` (client-side, in-memory) — used only for projects and surveys
- Projects: `lib/services/projectService.js:148` — fuzzy search on name + contact person
- Surveys: `lib/services/surveyService.js:61` — fuzzy search on title
- Both load ALL records into memory, then filter with Fuse threshold 0.7

### Key observation
Fuse.js is **not** used for ideas search, only for projects/surveys. The idea search uses SQL FULLTEXT exclusively.

---

## 4. Areas for Improvement

### 4.1 German Comments & Strings → English

Nearly all JSDoc blocks are in German across the entire codebase. Files affected:

| File | Issue |
|------|-------|
| `lib/liveUpdates.js:1-4` | Module description in German |
| `lib/redis.js:1-4` | Module description in German |
| `lib/dbHelpers.js:1-4` | Module description in German |
| `lib/htmxDetector.js:1-9` | Module description in German |
| `lib/viewHelpers.js:1-4` | Module description in German |
| `lib/mariadb-session-store.js:1-4` | Module description in German |
| `lib/http.js:1-4` | Module description in German |
| `lib/cacheHelper.js:1-4` | Module description in German |
| `lib/timing.js:1-4` | Module description in German |
| `lib/upload_quarantine.js:1-4` | Module description in German |
| `lib/sqlFragmentBuilder.js:1-4` | Module description in German |
| `lib/keyManager.js:1-4` | Module description in German |
| `lib/roleHelpers.js:1-4` | Module description in German |
| `lib/services/*.js` (all 15+ files) | All JSDoc in German |
| `routes/*.js` (all route files) | All JSDoc in German |
| `public/js/ideasLive.js` | JSDoc + some inline comments in German |
| `public/js/index.js` | JSDoc + many inline comments in German |
| `public/js/dmLive.js` | JSDoc + some inline comments in German |
| `public/js/groupLive.js` | JSDoc in German |
| `public/js/ideasClient.js` | JSDoc in German |
| `config/db.js:40` | Orphaned inline CSS code (`statusEl.classList...`) |
| `server.js:62,324,332,373-376` | Console.log messages in German |
| `server.js:96,192,193,219,301,311,319` | German string literals |

### 4.2 Dead / Orphaned Code

1. **`routes/load_test.js:7-12`** — Duplicate `@fileoverview` JSDoc block
2. **`config/db.js:40`** — Orphaned line `statusEl.classList.remove('status-online','status-offline','status-polling','status-error');` appears in the middle of `getPool()` function — likely accidentally pasted from client code
3. **`lib/liveUpdates.js:78-83`** — Orphaned `sanitizeValue` JSDoc function description block (wrongly placed between the function and its inner `sanitizeValue` definition)
4. **`routes/ideas.js:280-285`** — Orphaned JSDoc block for `sendUpdate` placed mid-function
5. **`routes/ideas.js:175`** — Orphaned JSDoc callback description inside `res.render()` callback in chunk endpoint
6. **`public/js/index.js`** — Comments with German placeholder text (e.g. `// Vorzugsweise das Seitenheader-Element`, `// Sicherstellen, dass`, `// sichtbar machen`)

### 4.3 Code Quality / Simplification

1. **`config/db.js:21-26, 43-67`** — Commented-out CREATE DATABASE + inline table creation/migration code that should not be in `getPool()`. The database creation is commented out but the category seed still runs there. Migrations handle this properly via `migrate.js`.
2. **`lib/liveUpdates.js:64-69`** — Duplicate detection using `changeLog.find(e => JSON.stringify(e).includes(metaStr))` is fragile and inefficient (O(n) scan + JSON.stringify in hot path)
3. **`server.js:331-335`** — `server.reusePort = true` is set as a property assignment after `listen()` which may not work; should use `{ reusePort: true }` in `listen()` options
4. **`lib/services/ideasService.js:39`** — Lazy `require('./ideasFilesService')` inside `createIdea` to avoid circular deps — should restructure deps properly
5. **`lib/services/ideasSearchService.js:53`** — Comment text `// Normalize: trim + lowercase` is English while surrounding JSDoc is German — inconsistent

### 4.4 Search Improvements

1. **Fuse.js for projects/surveys** loads ALL records into memory before filtering — will not scale beyond hundreds of records
2. **No Levenshtein/fuzzy** for ideas search — only MariaDB FULLTEXT with BOOLEAN MODE wildcards (`wort*`)
3. **`buildBooleanQuery()` at `ideasSearchService.js:166-181`** constructs boolean-mode query but does NOT handle special characters that break FULLTEXT boolean mode syntax (e.g., `+`, `-`, `*`, `@`, `<`, `>`, `~`)
4. **No ranking/score** normalization for combined fulltext + LIKE searches — uses arbitrary boost multipliers (1000000, 50000, 1000) at line 254-260

### 4.5 Frontend Improvements

1. **`public/js/ideasLive.js:76`** — `visibilitychange` handler creates new SSE connection immediately; if user briefly switches tabs, the old connection closes and a new one opens, causing unnecessary reconnects
2. **`views/ideas/ideas.ejs:39`** — Inline `onsubmit="event.preventDefault(); return false;"` on filter form should use a proper event listener
3. **Error messages** mix German and English arbitrarily (e.g., `'Card render failed'` vs `'Datei nicht gefunden'`)

---

## 5. Levenshtein UDF Integration

### 5.1 What's Already There

The project already includes the Levenshtein library at `./Levenshtein/` (fork of [rljacobson/Levenshtein](https://github.com/rljacobson/Levenshtein)).

### 5.2 Functions Provided

| Function | Description |
|----------|-------------|
| `edit_dist(s1, s2)` | Levenshtein distance |
| `edit_dist_t(s1, s2)` | Damerau-Levenshtein (with transpositions) |
| `bounded_edit_dist(s1, s2, cutoff)` | Stops if distance > cutoff |
| `bounded_edit_dist_t(s1, s2, cutoff)` | Same with transpositions |
| `min_edit_dist(s1, s2, cutoff)` | Remembers min distance across query |
| `min_edit_dist_t(s1, s2, cutoff)` | Same with transpositions |
| `similarity_t(s1, s2, cutoff)` | Normalized similarity (0.0–1.0) |
| `min_similarity_t(s1, s2, cutoff)` | Same, remembers min across query |

### 5.3 Build Steps

```bash
# Prerequisites: cmake, g++, libmysqlclient-dev, mariadb-devel (or mysql-devel)
# Already installed on this system (MariaDB 10.3.2)

cd Levenshtein
mkdir -p build && cd build
cmake .. -DCMAKE_BUILD_TYPE=Release
make damlev
sudo make install   # copies libdamlev.so to /usr/lib/mysql/plugin/
```

Or via Docker:
```bash
cd Levenshtein
docker compose up --build   # produces build/libdamlev.so
```

### 5.4 Registration

```sql
CREATE FUNCTION edit_dist RETURNS INTEGER SONAME 'libdamlev.so';
CREATE FUNCTION edit_dist_t RETURNS INTEGER SONAME 'libdamlev.so';
CREATE FUNCTION bounded_edit_dist RETURNS INTEGER SONAME 'libdamlev.so';
CREATE FUNCTION bounded_edit_dist_t RETURNS INTEGER SONAME 'libdamlev.so';
CREATE FUNCTION min_edit_dist RETURNS INTEGER SONAME 'libdamlev.so';
CREATE FUNCTION min_edit_dist_t RETURNS INTEGER SONAME 'libdamlev.so';
CREATE FUNCTION similarity_t RETURNS REAL SONAME 'libdamlev.so';
CREATE FUNCTION min_similarity_t RETURNS REAL SONAME 'libdamlev.so';
```

### 5.5 Integration Points

**Option A: Replace FULLTEXT idea search entirely**
```sql
-- In ideasSearchService.js, use:
SELECT s.idea_id, edit_dist(s.title, ?) AS dist
FROM ideas_search s
WHERE edit_dist(s.title, ?) < 5
ORDER BY dist
LIMIT 50
```
Pro: True fuzzy matching, handles typos  
Con: Slower on large datasets (no index support for UDF)

**Option B: Hybrid — FULLTEXT for pre-filter + Levenshtein for ranking**
```sql
SELECT s.idea_id,
       MATCH(s.title) AGAINST(? IN BOOLEAN MODE) AS ft_score,
       (100 - edit_dist(s.title, ?) * 5) AS fuzzy_score
FROM ideas_search s
WHERE MATCH(s.title) AGAINST(? IN BOOLEAN MODE)
   OR edit_dist(s.title, ?) < 4
ORDER BY ft_score * 0.6 + fuzzy_score * 0.4 DESC
LIMIT 50
```

**Option C: Replace Fuse.js for projects/surveys**
Use `bounded_edit_dist(name, ?, 3)` in SQL WHERE clause instead of loading all into memory.

### 5.6 Limitations

- 8-bit char assumption (won't work correctly with multi-byte Unicode)
- Case-sensitive (use `LOWER()` wrapper for case-insensitive)
- Default buffer max 4096 bytes (configurable in CMakeLists.txt)
- No index acceleration — full table scan per query

### 5.7 Migration File Template (for `migrations/`)

```sql
-- migrations/0038_levenshtein_udf.sql
-- Requires: libdamlev.so built and installed to plugin dir

CREATE FUNCTION IF NOT EXISTS edit_dist RETURNS INTEGER SONAME 'libdamlev.so';
CREATE FUNCTION IF NOT EXISTS edit_dist_t RETURNS INTEGER SONAME 'libdamlev.so';
CREATE FUNCTION IF NOT EXISTS bounded_edit_dist RETURNS INTEGER SONAME 'libdamlev.so';
CREATE FUNCTION IF NOT EXISTS bounded_edit_dist_t RETURNS INTEGER SONAME 'libdamlev.so';
CREATE FUNCTION IF NOT EXISTS min_edit_dist RETURNS INTEGER SONAME 'libdamlev.so';
CREATE FUNCTION IF NOT EXISTS min_edit_dist_t RETURNS INTEGER SONAME 'libdamlev.so';
CREATE FUNCTION IF NOT EXISTS similarity_t RETURNS REAL SONAME 'libdamlev.so';
CREATE FUNCTION IF NOT EXISTS min_similarity_t RETURNS REAL SONAME 'libdamlev.so';
```

---

## 6. Summary

### Priority recommendations for code presentation readiness:

1. **Translate all German JSDoc/comments to English** (biggest effort, touches ~40 files)
2. **Remove orphaned/dead code** (db.js:40, load_test.js:7-12, liveUpdates.js:78-83, ideas.js:280-285)
3. **Move inline DB init logic** from `config/db.js` to proper migrations
4. **Normalize error messages** to consistent language (German UI is fine per requirements, but English in code)
5. **Build and register Levenshtein UDF**, then optionally integrate as a search option
6. **Add input sanitization** to `buildBooleanQuery()` for FULLTEXT special characters
7. **Clean up JSDoc** — remove autogenerated boilerplate, fix misplaced blocks

### Architectural findings:

- Live update architecture (SSE + Redis Pub/Sub) is well-designed with anti-race-condition measures
- Fulltext search on `ideas_search` materialized view is performant for title/author
- Levenshtein UDF is a good fit for optional fuzzy search, best used as a hybrid with SQL FULLTEXT
- Fuse.js in-memory search for projects/surveys should be replaced with SQL-based search for scalability
