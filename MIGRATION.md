# JS → TypeScript migration (backend first, then command/popover UI)

Backend becomes TypeScript so function signatures and route parsers replace JSDoc. Views stay EJS. Frontend stays JS except one shared Invoker/Popover fallback; converting `public/js` to TS is later and optional.

1:1 behavior. Node and Bun both keep running the app the same way they do now.

Scope: `config/db.js`, `lib/`, `routes/`, `server.js`, `types/`, plus small EJS attribute changes for dialogs/popovers. Do not rewrite `views/`. Do not rewrite frontend clients into TS in this pass.

Current backend conversion set is the bulk of the ~14.5k LOC. Biggest files: `routes/ideas.js` (958), `lib/services/projectService.js` (617), `lib/services/ideasService.js` (548).

---

## Key decisions

1. **Stay CommonJS until the last backend file is `.ts`.** A 1:1 move does not also become ESM. Use `export =` / `import x = require(...)` or `esModuleInterop`. ESM is a later, optional PR.

2. **Rename file-by-file `.js` → `.ts`.** Keep `allowJs` so mixed tree boots. One module per PR when the file is large (`ideas.js`, `projectService.js`); batch leaf helpers.

3. **Compile-time types do not enforce HTTP.** `req.body` is still `any` at runtime. Each mutating route gets a small parse function that returns a typed object or throws/`400`. No Zod unless you ask. Existing `parseInt` / empty-string checks move into those parsers.

4. **JSDoc that only restates types is deleted on conversion.** Keep comments that explain *why* (retry errnos, CSRF, cooldown, circular-require). Drop `@fileoverview`, `@param`, `@returns`, `@typedef`, `@module`. After conversion, `tools/add_jsdoc.js` and friends are dead.

5. **EJS stays.** Templates are not rewritten. The only view edits are `command` / `commandfor` / `popover` / `popovertarget` on existing dialogs and popovers, and turning the chat overlay into a `<dialog>` so the same pattern applies.

6. **Frontend JS stays JS.** One file, `public/js/invoker-fallback.js`, is the only new client code for open/close. Per-page `showModal()` click handlers go away. Fetch/HTMX/SSE stay where they are. Frontend TypeScript is out of scope.

7. **Do not rewrite services while converting.** Circular `require()` (e.g. `ideasService` lazy-loading `ideasFilesService`) stays. Fixing cycles is a later cleanup PR.

---

## Complexity that can go (behavior unchanged)

| Cut | Why it is safe | When |
|---|---|---|
| `lib/types.js` (exports `{}`) | Becomes `types/domain.ts` | PR1 |
| Duplicate `isHtmx` in `lib/http.js` **and** `lib/htmxDetector.js` | Routes already use `htmxDetector.middleware`; `http.js` copy is unused by most routes | PR1 |
| Nine scripts in `tools/` (`add_jsdoc.js`, `ensure_all_jsdoc.js`, …) | They exist to generate the comments TS replaces | After backend is `.ts` |
| `jsdoc.config.json` + `npm run doc:gen` + generated `dokumentation/` | Types and source are the docs | After backend |
| Shotgun patches in `types/frontend.d.ts` | Only if/when frontend JS is converted later | Out of scope |
| Dual session role fields (`role` / `roleName` / `role_name` / `roleId` / `role_id`) | `roleHelpers` already normalizes; write one shape at login | PR2 (types) + authService |
| Dual body keys `conversationId` **and** `conversation_id` | Pick one name in the parse layer; accept both on input once | dms/groups routes |
| Emoji popover portal + `position:fixed` math in `public/js/ideas/comments.js` | Native `popover` uses the top layer; overflow on cards no longer clips | Frontend PR |
| Chat overlay `display:flex` in `footer.ejs` + `chatClient.js` | Same UI as `<dialog>` + `show-modal` | Frontend PR |
| `onclick="closeIdeaEditModal()"` in `ideas.ejs` | `command="close" commandfor="idea-edit-modal"` | Frontend PR |
| Click listeners whose only job is `showModal()` (`#openCreateModal` in ideas + projects, index.js copy) | Invoker on the button | Frontend PR |
| `trash/ideasSearchService.js` | Already discarded | Anytime |
| `public/js/indexScroll.js` (0 bytes) | Empty | Anytime |

**Do not cut (looks like complexity, is load-bearing):**

- `normalizeQueryResult` / bigint + date coercion in `config/db.js`
- `getConnection()` wrapping `query`/`execute` (callers depend on it)
- `executeWithRetry` (deadlock 1213 / lock wait)
- Runtime role checks in middleware (session is untrusted)
- HTMX vs full-page response branching
- SSE/live update versioning
- Upload quarantine + multer
- `asyncHandler` until Express 5 wrap is proven everywhere (`ideas.js` still uses raw `async` + try/catch in several places)

---

## Phase 0 — Tooling (one small PR)

Add `typescript`. Replace `jsconfig.json` with `tsconfig.json`:

- `"module": "commonjs"`, `"target": "ES2022"`, `"strict": true`
- `"allowJs": true` so mixed `.js` / `.ts` boots during the rename
- `"outDir": "dist-server"`, `"rootDir": "."`
- include `lib`, `routes`, `config`, `server.ts`, `types`, `tests`
- exclude `public/js`, `views`, `dokumentation`, `node_modules`, `data`, `logs`

**Node and Bun both stay.** No extra runner (`tsx` or similar). Today both execute the same `server.js`. After conversion `tsc` emits CommonJS to `dist-server/`, and both execute that same `dist-server/server.js` (`nodemon`, `bun --watch`, pm2 with or without `interpreter: "bun"`). TypeScript is the source you edit; JavaScript is what both runtimes run, like now.

`package.json`: add `"typecheck": "tsc --noEmit"`. `test` stays vitest. `types/express.d.ts` stays; tighten `SessionUser` in Phase 1.

---

## Phase 1 — Shared types + db (backend foundation)

Order matters. Convert leaves first so every later `require` gets types.

1. **`types/domain.ts`** from `lib/types.js` (`User`, `Idea`, `Message`, `Conversation`) plus real fields the code already uses (`category_id`, `status`, `file_count`, `role_id`, session flags). Delete `lib/types.js`.

2. **Canonical `SessionUser`:** `{ id, username, email?, role: 'Admin' \| 'Projektleiter' \| 'Mitarbeiter', roleId: 1\|2\|3, isAdmin, isProjectLead, usesDefaultPassword? }`. `authService` writes this once. `roleHelpers.getRoleName` remains for leftover DB rows.

3. **`config/db.ts`:** type the pool. `query<T = Record<string, unknown>>(sql, params?): Promise<T[]>` and `execute` for writes (`insertId`, `affectedRows`). Keep bigint/date normalization. Type `getConnection()` so wrapped `query`/`execute`/`release`/`beginTransaction` are explicit. MariaDB result unions are the annoying part; one `DbRow` helper beats repeating `as any`.

4. **Leaf lib:** `asyncHandler.ts`, `timing.ts`, `dbHelpers.ts`, `redis.ts`, `cacheHelper.ts`, `sqlFragmentBuilder.ts`, `upload_quarantine.ts`, `viewHelpers.ts`.

5. **Merge HTMX:** keep `htmxDetector.middleware`, delete `isHtmx` from `http.js`, type `Request.isHtmx` (already in `express.d.ts`). `http.ts` keeps `errorHtml` / `sendErrorPage` / `wantsJson`.

Gate: `tsc --noEmit` clean on these files. App still boots (CJS interop).

---

## Phase 2 — Services (1:1, typed signatures)

Convert `lib/services/*.js` in dependency order. Do not merge files.

**Batch A (almost no inbound deps):** `categoriesService`, `pointsService`, `ideasStatsService`, `ideasTagsService`, `userService`, `reactionsService`.

**Batch B:** `ideasFilesService`, `ideasCommentsService`, `ideasEnrichmentService`, `ideasSearchService`, `dmFilesService`, `dmPresenceService`, `groupPresenceService`.

**Batch C:** `authService`, `adminService`, `dashboardService`, `surveyService`, `dmMessagingService`, `groupService`.

**Batch D (largest):** `ideasService` (548), `projectService` (617).

Rules per file:

- Replace JSDoc with argument/return types.
- `db.query<IdeaRow>(...)` instead of untyped rows.
- Keep lazy `require()` for cycles; annotate with `typeof import('./ideasFilesService')`.
- Public `module.exports` shape stays identical (tests and routes require named functions; `projectService` is a class).

`lib/queries/ideaQueries.js`, `lib/liveUpdates.js`, `lib/mariadb-session-store.js`, `lib/keyManager.js` convert with the services that use them.

Gate: existing `tests/api.test.js` still passes (it mounts JS/TS routes against a live DB). Add `typecheck` to CI/local habit.

---

## Phase 3 — Routes: typed HTTP boundary

This is where “enforce API endpoints” actually happens.

Pattern for every mutating handler:

```ts
function parseCreateIdea(body: unknown): { title: string; description: string; tags: string; category_id: number | null } {
  // move the existing title/description/category_id checks here
}
```

Then `const input = parseCreateIdea(req.body)`. Handler bodies stay the same HTMX/redirect branches.

Also type:

- `req.params.id` via a `parseId(raw: string): number` (comments.js already has `parseRouteId`; lift it to `lib/http.ts` or `lib/parse.ts` and reuse).
- `req.session.user` as `SessionUser` (middleware `isLoggedIn` narrows it).
- `req.file` for multer routes.

**Route conversion order (small → large, tests stay green):**

1. `routes/middleware.ts` (`isLoggedIn` / `isAdmin` as type predicates)
2. `comments-likes.ts`, `comments.ts`, `dashboard.ts`
3. `adminPage.ts`, `projects.ts`, `surveys.ts`, `users.ts`
4. `groups.ts`, `dms.ts`
5. `ideas.ts` (958 lines, many raw `async` handlers; wrap with `asyncHandler` only where it is a no-behavior change)
6. `load_test.ts` last or leave JS; it is not product UI

**Unify dual keys in parsers, not in services:** `req.body.conversationId ?? req.body.conversation_id`. Services keep one name.

`server.js` → `server.ts` after all routers export. Update `package.json` `main` and start scripts.

Do not convert `migrate.js` / `seed-test-data.js` in the same PRs. They are Node scripts, not the request path.

---

## Phase 4 — Frontend: one Invoker/Popover pattern, EJS kept

No TypeScript on `public/js` in this pass. No new frontend framework. Views stay EJS; only attributes (and the chat overlay → `<dialog>`) change.

Do not mix this with the `ideas.ts` route conversion. It can run after Phase 0 in parallel with backend work.

### 4a. Native open/close (one fallback file)

Markup change (ideas already have `<dialog id="createIdeaModal">`):

```html
<button class="btn accent" command="show-modal" commandfor="createIdeaModal">
<dialog id="createIdeaModal">
  <form method="dialog"><button command="close" commandfor="createIdeaModal">Schließen</button></form>
```

Same for `createProjectModal`, `editProjectModal`, `teamModal`, `idea-edit-modal`.

Chat edit overlay in `views/partials/footer.ejs` becomes `<dialog id="chatEditModal">`. Save still needs JS (PUT/POST). Open still needs JS to copy message text into the textarea, then `showModal()`. Close/cancel become commands.

**Fallback** (`public/js/invoker-fallback.js`, one file, loaded in `head`/`footer`):

- If `'command' in HTMLButtonElement.prototype`, no-op.
- Else click capture: `command=show-modal` → `commandfor.showModal()`, `close` → `.close()`, `toggle-popover` → `.togglePopover()` or class toggle.

Keep the existing `style.display = 'block'` try/catch only inside that fallback.

Delete:

- `#openCreateModal` listeners in `ideas/interactions.js`, `projectsClient.js`, `index.js`
- `onclick="closeIdeaEditModal()"`
- overlay click-to-close that only duplicates `dialog` backdrop (dialog already does this)

Keep JS for: fetch-fill of `#idea-edit-modal-content`, form intercept/create-idea fetch, long-press tag delete, HTMX hooks, SSE.

### 4b. Emoji popover

Today `comments.js` portals the node to `document.body` and computes `position:fixed` because cards clip overflow.

Replace:

```html
<button type="button" popovertarget="emoji-<%= id %>" command="toggle-popover" commandfor="emoji-<%= id %>">
<div id="emoji-<%= id %>" popover class="emoji-popover">
```

Native popover is top-layer. Delete portal, `PORTAL_ATTR`, `getBoundingClientRect` math, `.open` class, outside-click closer (light dismiss is built in). Keep the HTMX form inside.

CSS: drop `#emoji-popover-parking` / `.emoji-popover.open` positioning; use `popover` UA + existing button styles.

Fallback: the same `invoker-fallback.js`. No extra popover polyfill if the floor is browsers that already run this app's `<dialog>`s.

Context menu (`chatContextMenu`): `popover="manual"` + JS only to set position from the `contextmenu` event. Stop using `display:none`.

---

## Phase 5 — Delete the JSDoc machine

After `lib/` + `routes/` are TypeScript:

- Delete `tools/add_jsdoc.js`, `add_arrow_jsdoc.js`, `add_route_jsdoc.js`, `cleanup_jsdoc.js`, `ensure_all_jsdoc.js`, `expand_jsdoc_texts.js`, `fill_jsdoc_placeholders.js`, `refine_jsdoc.js`, `replace_anonymous_frontend.js`
- Drop `jsdoc` dep and `doc:gen` unless you still want HTML docs from TS (typedoc is a separate choice, not required)
- Stop treating `dokumentation/` as source of truth

---

## Suggested PR slices

| PR | What | Depends |
|---|---|---|
| 0 | `typescript`, `tsconfig`, `typecheck` script, leave JS running | — |
| 1 | `types/domain.ts`, tighter `SessionUser`, `config/db.ts`, leaf `lib/*`, merge `isHtmx` | 0 |
| 2a–2d | Services in the four batches above | 1 |
| 3a | `middleware` + small routers + `parseId` / parse helpers | 2 |
| 3b | `users`, `surveys`, `projects`, `adminPage` | 3a |
| 3c | `dms`, `groups` | 3a |
| 3d | `ideas` + `server.ts` | 3b, 3c |
| 4a | Invoker attributes on existing EJS dialogs + `invoker-fallback.js`; delete showModal-only click handlers | can parallel after 0 |
| 4b | Emoji popover + chat `<dialog>` on the same fallback | 4a |
| 5 | Remove JSDoc tooling | 3d |

PRs 4a/4b only touch markup attributes and the one fallback file. They do not convert `public/js` to TypeScript.

---

## Verification (each PR)

- `npx tsc --noEmit`
- `npm test` (vitest + supertest against real MariaDB; several tests already allow 404/500)
- Boot `bun --watch` / `nodemon` and hit: login, create idea (dialog), comment reaction (popover), project create, DM edit, group chat
- After 4a: open/close create-idea and create-project **with JS disabled** in a browser that supports Invoker Commands; with JS enabled on a browser that does not
- After 4b: emoji popover not clipped by `.idea-card` overflow; click outside dismisses

No new features. No service merges. No ESM. No extra validation library.

---

## Out of scope (later, not this migration)

- Frontend TypeScript (`public/js` stays JS)
- Rewriting EJS views or replacing EJS
- Breaking circular requires
- Splitting `routes/ideas.js`
- Replacing HTMX
- Typedoc
- Strict DOM typings for `window.*` globals
