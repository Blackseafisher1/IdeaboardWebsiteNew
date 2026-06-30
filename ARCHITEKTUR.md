# Architektur – Ideenboard

## Überblick

```
Browser (EJS+HTMX) ←→ Express (server.js) ←→ MariaDB
                        ↕
                     Redis (Pub/Sub für SSE-Live-Updates)
```

- **Backend:** Node.js (Express 5) od. Bun
- **Frontend:** Serverseitig gerendertes EJS + HTMX für dynamische Partials
- **Datenbank:** MariaDB mit `mariadb`-Treiber
- **Cache/Live:** Redis für Sessionspeicher + Pub/Sub (SSE)
- **Build:** kein Build-Step für JS (nur Minify via esbuild)

## Verzeichnisstruktur

```
/
├── server.js              # Express-App, Middleware, Routes mounten
├── config/db.js           # MariaDB-Pool + normalizeQueryResult
├── routes/                # Express-Router (HTTP-Logik)
│   ├── ideas.js           #   Ideen CRUD + SSE-Updates
│   ├── projects.js        #   Projekte
│   ├── surveys.js         #   Umfragen
│   ├── users.js           #   Auth, Account, Admin-Setup
│   ├── dashboard.js       #   Dashboard-Metriken
│   ├── dms.js             #   Direktnachrichten + SSE
│   ├── groups.js          #   Gruppen-Chat + SSE
│   ├── comments.js        #   Kommentare zu Ideen
│   ├── comments-likes.js  #   Like/Reaktion auf Kommentare
│   ├── adminPage.js       #   Admin-Bereich
│   ├── middleware.js       #   isLoggedIn, isAdmin
│   └── load_test.js       #   Lasttest-Endpunkte
├── lib/
│   ├── services/          # Geschäftslogik (pro Bereich)
│   ├── queries/           # SQL-Queries (Abstraktion)
│   ├── redis.js           # Redis-Clients + Pub/Sub
│   ├── liveUpdates.js     # SSE-Versionsverwaltung
│   ├── dbHelpers.js       # executeWithRetry, firstQueryValue
│   └── ...                # keyManager, roleHelpers, cacheHelper, etc.
├── views/                 # EJS-Templates
│   ├── ideas/             #   Ideen-Liste, Cards, Modals
│   ├── projects/          #   Projekt-Liste, Cards
│   ├── surveys/           #   Umfragen
│   ├── partials/          #   header, footer, head
│   └── ...
├── public/js/             # Client-JS
│   ├── ideasLive.js       #   SSE-Client für Ideen
│   ├── ideasClient.js     #   Interaktionen (Expand, Create, Delete)
│   ├── dmLive.js          #   SSE-Client für DMs
│   ├── groupLive.js       #   SSE-Client für Gruppen
│   └── dist/              #   Minified (via esbuild)
├── public/css/            # Stylesheets
├── migrations/            # SQL-Migrationen (werden der Reihe nach angewendet)
├── test/                  # Vitest + Supertest (E2E)
└── config/                # DB-Config, Caddyfile
```

## Routing

Jeder Bereich hat einen eigenen Express-Router in `routes/`. Die Router werden in `server.js` gemountet:

```js
app.use('/ideas', timing('ideas'), require('./routes/ideas'));
app.use('/projects', pageCache(15), require('./routes/projects'));
```

### Middleware-Reihenfolge pro Request

1. Request-Logger (server.js)
2. Body-Parser (urlencoded + json)
3. Session (MariaDB Session Store)
4. `res.locals.user` setzen (roleHelpers.normalizeUser)
5. Gate-Middleware (optionaler Zugangscode)
6. Routen-spezifische Middleware (isLoggedIn → routes/middleware.js)
7. HTMX-Detector (setzt `req.isHtmx`)
8. Route-Handler (asyncHandler wrappt try/catch)
9. 404-Fallback

## Datenbank-Zugriff (`config/db.js`)

Der MariaDB-Pool wird einmal beim Start erstellt und stellt drei Methoden bereit:

### `db.query(sql, params)` — SELECT, INSERT, UPDATE, DELETE

```js
const db = require('../config/db');

// Alle Spalten, eine Zeile
const rows = await db.query('SELECT * FROM ideas WHERE idea_id = ?', [1]);
// → rows = [{ idea_id: 1, title: '...', description: '...', ... }]

// Bestimmte Spalten
const rows = await db.query('SELECT title, like_count FROM ideas');
// → rows = [{ title: '...', like_count: 5 }, { title: '...', like_count: 3 }]

// Erste Zeile (oder null)
const idea = rows[0]; // undefined wenn keine Zeile

// Bestimmte Spalte der ersten Zeile
const title = rows[0]?.title; // "Meine Idee"
const likes = rows[0]?.like_count; // 5

// COUNT / Aggregat
const [{ total }] = await db.query('SELECT COUNT(*) AS total FROM ideas');
// → total = 42

// INSERT + insertId
const result = await db.query('INSERT INTO ideas (title) VALUES (?)', ['Neu']);
const newId = result.insertId; // z.B. 123

// UPDATE / DELETE — affectedRows
const result = await db.query('UPDATE ideas SET title = ? WHERE idea_id = ?', ['Neu', 1]);
// result.affectedRows → 1

// Mit mehreren Parametern
const rows = await db.query(
  'SELECT * FROM ideas WHERE category_id = ? AND like_count > ? ORDER BY created_at DESC LIMIT ?',
  [catId, minLikes, limit]
);
```

### `db.execute(sql, params)` — Prepared Statements (bei häufigen Wiederholungen)

```js
await db.execute(
  'INSERT INTO sessions (sid, sess, expires) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE sess = VALUES(sess)',
  [sid, sessJson, expires]
);
```

### `db.getConnection()` — Transaktionen

Für Operationen, die atomar sein müssen (mehrere INSERT/UPDATE zusammen):

```js
const conn = await db.getConnection();
try {
  await conn.beginTransaction();

  const result = await conn.query('INSERT INTO ideas (user_id, title, description) VALUES (?, ?, ?)', [userId, title, desc]);
  const ideaId = result.insertId;

  await conn.query('INSERT INTO idea_tag_links (idea_id, tag_id) VALUES (?, ?)', [ideaId, tagId]);

  await conn.commit(); // alles oder nichts
} catch (err) {
  await conn.rollback();
  throw err;
} finally {
  conn.release(); // ← Connection zurück in den Pool
}
```

### Normalisierung

`db.query` normalisiert automatisch:
- **BigInt** → Number (solange innerhalb von SAFE_INTEGER)
- **ISO-Datumsstrings** → Date-Objekte

```js
const rows = await db.query('SELECT like_count, created_at FROM ideas LIMIT 1');
rows[0].like_count     // → Number (nie BigInt)
rows[0].created_at     // → Date (nie String)
```

### Retry bei Deadlocks

```js
const { executeWithRetry } = require('../lib/dbHelpers');
await executeWithRetry(db, 'UPDATE ideas SET status = ? WHERE idea_id = ?', [status, id]);
// Wiederholt bei Lock-Timeout/Deadlock (errno 1205/1213) bis zu 3× mit Backoff
```

## Live-Updates (SSE)

### Flow

```
Client (ideasLive.js)
  → EventSource(/ideas/updates?since=N)
  → Server registriert SSE-Waiter (lib/liveUpdates.js)
  → Bei Änderung: recordChange(ideaId, action)
  → Redis Pub/Sub (kanal: IDEABOARD_CHANGES)
  → Alle Server-Instanzen erhalten Nachricht
  → applyChange() → notifyWaiters() → SSE-Event an Client
```

### Cooldown

Client-seitig gibt es `window.localActionCooldowns` (Set von Idea-IDs), um Race-Conditions zwischen eigenem POST und eingehendem SSE zu vermeiden.

## Such-Konzepte

| Bereich | Methode | Details |
|---------|---------|---------|
| Ideen | MariaDB FULLTEXT BOOLEAN MODE | `MATCH(title) AGAINST('wort*' IN BOOLEAN MODE)` |
| Projekte | MariaDB FULLTEXT BOOLEAN MODE | `MATCH(name) AGAINST(?)` auf `idx_ft_projects_name` |
| Umfragen | MariaDB FULLTEXT BOOLEAN MODE | `MATCH(title) AGAINST(?)` auf `idx_ft_surveys_title` |
| Nutzer (DM-Suche) | LIKE | `WHERE username LIKE ?` |

## Levenshtein UDF

Eine Levenshtein-Edit-Distance-UDF (`libdamlev.so`) ist registriert für optionale unscharfe Suche:
- `edit_dist(s1, s2)` — einfache Levenshtein-Distanz
- `bounded_edit_dist(s1, s2, cutoff)` — bricht bei Überschreitung ab
- `min_edit_dist(s1, s2, cutoff)` — merkt sich Minimum über Query

In `lib/services/projectService.js` und `surveyService.js` wird FULLTEXT verwendet,
nicht Levenshtein. Levenshtein steht als Fallback zur Verfügung.

## Wichtige Konzepte

- **HTMX:** Die meisten Interaktionen (Filtern, Suchen, Paginieren, Erstellen) nutzen HTMX-Attribute (`hx-get`, `hx-post`, `hx-target`). Kein client-seitiges JS nötig.
- **SSE:** Live-Updates für Ideen, DMs und Gruppen-Chats nutzen Server-Sent Events mit Redis Pub/Sub zur instances-übergreifenden Synchronisation.
- **Page Cache:** Statische Seiten (Impressum, AGB) werden mit `pageCache` zwischengespeichert. Dynamische Seiten (Ideen, Projekte) nur kurz (15-30s).
- **Berechtigungen:** Drei Rollen: Admin, Projektleiter, Mitarbeiter. Prüfung über `roleHelpers.isAdmin()` / `isProjectLead()`.

## Tests

```
npm test            # Vitest (29 E2E-Tests)
npm run smoke-test  # Altes Smoke-Script
```

Tests nutzen `supertest` ohne echten Server — die Express-App wird direkt aufgerufen.
