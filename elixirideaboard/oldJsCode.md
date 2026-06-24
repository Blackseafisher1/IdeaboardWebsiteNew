
## Complete Project Analysis: `/home/ege/Projekte/IdeaboardWebsite`

---

### 1. EXPRESS ROUTES STRUCTURE

#### `server.js` (376 lines)
**Path:** `/home/ege/Projekte/IdeaboardWebsite/server.js`

**Full contents shown above.** Key architectural points:

- **Runtime:** Supports both Bun and Node.js, using MariaDB as the database
- **Session store:** Custom `MariaDBStore` (via `lib/mariadb-session-store`) with express-session
- **Redis:** Required (`lib/redis`) for pub/sub
- **View engine:** EJS at `views/`
- **Static files:** `public/` directory
- **Timing middleware** used on all major route groups
- **HTMX-centric** design -- most routes detect `req.isHtmx` for partial rendering

**Route Mounting (from server.js):**

| Prefix | File | Middleware |
|---|---|---|
| `/` | inline | `pageCache(30)` (index page) |
| `/ideas` | `routes/ideas.js` | `timing('ideas')` |
| `/projects` | `routes/projects.js` | `pageCache(15)`, `timing('projects')` |
| `/users` | `routes/users.js` | `timing('users')` |
| `/dashboard` | `routes/dashboard.js` | `pageCache(15)`, `timing('dashboard')` |
| `/adminPage` | `routes/adminPage.js` | `timing('adminPage')` |
| `/dms` | `routes/dms.js` | `timing('dms')` |
| `/surveys` | `routes/surveys.js` | `pageCache(15)`, `timing('surveys')` |
| `/groups` | `routes/groups.js` | `timing('groups')` |
| `/load-test` | `routes/load_test.js` | (no auth, no timing) |
| `/search-debug` | inline | public debug endpoint |
| Static pages | inline | `pageCache(3600)` for impressum, datenschutz, agb, kontakt, dokumentation, doku |
| `/gate` | inline | public gate middleware (one-time password) |
| `/healthz` | inline | readiness/liveness check |
| `/message` | inline | generic message display |
| 404 | inline | renders `404.ejs` |

---

#### `/home/ege/Projekte/IdeaboardWebsite/routes/` -- All 12 Route Files

##### `adminPage.js` (181 lines)
**Path:** `/home/ege/Projekte/IdeaboardWebsite/routes/adminPage.js`

Admin routes -- protected by `isLoggedIn` + `isAdmin` middleware.

| Method | Path | Description |
|---|---|---|
| GET | `/` | User management (list users + roles) |
| GET | `/logs` | Audit logs (200 latest) |
| POST | `/change-role` | Change user role (with `FORBIDDEN`/`BAD_REQUEST` error handling) |
| POST | `/delete-user` | Delete user (blocks admins and primary admin) |
| POST | `/manual-points` | Assign manual points (-50 to +50) |
| POST | `/reset-password` | Generate and set a random 8-char password |

---

##### `comments-likes.js` (113 lines)
**Path:** `/home/ege/Projekte/IdeaboardWebsite/routes/comments-likes.js`

Comment reaction routes -- protected by `isLoggedIn`.

| Method | Path | Description |
|---|---|---|
| POST | `/:commentId/react` | Emoji reaction on comment (whitelisted: `['❤️','😂','😮','😢','😡','🎉','🙏','👀','🤔']`) |
| POST | `/:id/like` | Toggle binary comment like |

All endpoints are HTMX-aware, rendering `_comment-item.ejs` partial.

---

##### `comments.js` (113 lines)
**Path:** `/home/ege/Projekte/IdeaboardWebsite/routes/comments.js`

Comment CRUD -- mounted at `/ideas/:id/comments` with `mergeParams:true`.

| Method | Path | Description |
|---|---|---|
| POST | `/` | Create comment (max 200 chars) |
| GET | `/:commentId` | Single comment fragment |
| GET | `/` | All comments for an idea |

---

##### `dashboard.js` (160 lines)
**Path:** `/home/ege/Projekte/IdeaboardWebsite/routes/dashboard.js`

Dashboard routes -- protected by `isLoggedIn`.

| Method | Path | Description |
|---|---|---|
| GET | `/` | Main dashboard view |
| GET | `/widgets/metrics` | Metrics widget (new ideas, active users) |
| GET | `/widgets/new-ideas-number` | Plain text count of new ideas |
| GET | `/widgets/top-ideas` | Top 3 ideas widget |
| GET | `/widgets/charts` | Chart grid (popular categories, project stats, monthly stats, top users) |
| GET | `/widgets/project-stats` | Project status stats widget |
| GET | `/widgets/monthly-stats` | Monthly stats widget (6 months) |
| GET | `/widgets/top-users` | Top 5 users widget |
| GET | `/:id/card` | Single idea card for dashboard |

---

##### `dms.js` (523 lines)
**Path:** `/home/ege/Projekte/IdeaboardWebsite/routes/dms.js`

Direct messaging routes -- protected by `isLoggedIn`. Uses SSE for real-time.

| Method | Path | Description |
|---|---|---|
| GET | `/` | Inbox -- list conversations |
| GET | `/search` | Search users for new DM |
| GET | `/chat-updates/:conversationId` | SSE endpoint for real-time updates |
| GET | `/chat/:userId` | Chat page with a specific user |
| GET | `/chat/:conversationId/history` | Older messages (pagination via `beforeId`) |
| POST | `/send` | Send message (text + up to 5 files via `dmUpload`) |
| POST | `/edit` | Edit a DM message |
| POST | `/delete` | Delete a DM message |
| GET | `/direct/:userId` | Find or create conversation, redirect to chat |
| POST | `/leave` | Decrement presence in conversation |
| GET | `/file/:conversationId/:filename` | Secure file download with access check |

---

##### `groups.js` (466 lines)
**Path:** `/home/ege/Projekte/IdeaboardWebsite/routes/groups.js`

Group chat routes -- protected by `isLoggedIn`. Uses SSE for real-time.

| Method | Path | Description |
|---|---|---|
| GET | `/` | Redirects to `/projects` |
| GET | `/chat/:id` | Group chat room (auto-syncs project teams to group members) |
| GET | `/chat/:id/history` | Older messages (pagination via `beforeId`) |
| GET | `/updates/:id` | SSE endpoint for real-time updates |
| POST | `/send` | Send message (text + up to 5 files) |
| POST | `/edit` | Edit a group message |
| POST | `/delete` | Delete a group message |
| POST | `/create` | Create a new group |
| POST | `/:id/leave` | Leave group (always returns 403 -- disabled) |
| POST | `/:id/members/add` | Add member (owner/admin only) |
| POST | `/:id/members/remove` | Remove member (owner/admin only) |
| GET | `/file/:groupId/:filename` | Secure file download |

---

##### `ideas.js` (979 lines)
**Path:** `/home/ege/Projekte/IdeaboardWebsite/routes/ideas.js`

Core ideas routes -- protected by `isLoggedIn`. The largest route file.

**Nested routers mounted:**
- `/ideas/:id/comments` -> `routes/comments.js`
- `/ideas/eigen` -> `routes/comments-likes.js`

| Method | Path | Description |
|---|---|---|
| GET | `/` | Main ideas listing with filters, search, pagination |
| GET | `/chunk` | JSON/HTMX chunk for infinite scroll |
| GET | `/updates` | SSE endpoint for real-time idea updates |
| GET | `/:id/card` | Single idea card HTML fragment |
| GET | `/partial` | Clean ideas list (HTMX) |
| POST | `/` | Create idea (with optional file upload) |
| POST | `/:id/delete` | Delete idea (author or admin) |
| POST | `/:id/files` | Upload file to existing idea |
| POST | `/files/:fileId/delete` | Delete file from idea |
| GET | `/files/:fileId/download` | Download idea file (with on-the-fly decryption) |
| GET | `/:id/stats` | Stats partial (likes/dislikes count) |
| POST | `/:id/status` | Update status (admin only) |
| POST | `/:id/edit` | Edit title, description, category |
| POST | `/:id/tags` | Add/update tags |
| POST | `/:id/tags/delete-single` | Remove single tag (modal) |
| POST | `/:id/tags/delete` | Remove tag |
| POST | `/:id/like` | Toggle like |
| POST | `/:id/dislike` | Toggle dislike |
| GET | `/:id/modal` | Edit modal HTML fragment |

Also exports `testSearch()` for programmatic use by load tests.

---

##### `load_test.js` (174 lines)
**Path:** `/home/ege/Projekte/IdeaboardWebsite/routes/load_test.js`

Benchmarking routes -- **no auth required**.

| Method | Path | Description |
|---|---|---|
| GET | `/search` | Synthetic search load testing with configurable rate, concurrency, queries |

Supports sampling titles from DB, alternating between Fuse.js and SQL fulltext modes.

---

##### `middleware.js` (28 lines)
**Path:** `/home/ege/Projekte/IdeaboardWebsite/routes/middleware.js`

Exports two middleware functions:
- `isLoggedIn` -- redirects to `/users/auth` if no session.user
- `isAdmin` -- checks `isAdmin(user)` via `roleHelpers`, redirects to `/users/account` if not admin

---

##### `projects.js` (264 lines)
**Path:** `/home/ege/Projekte/IdeaboardWebsite/routes/projects.js`

Project management routes -- protected by `isLoggedIn`.

| Method | Path | Description |
|---|---|---|
| GET | `/` | Main projects page with filters |
| GET | `/fragment` | Project list fragment (HTMX/infinite scroll) |
| GET | `/contact-search` | Search contact candidates (JSON) |
| POST | `/` | Create project (admin only) |
| POST | `/:id/edit` | Update project |
| POST | `/:id/delete` | Delete project |
| GET | `/:id/team` | Get team members (JSON) |
| GET | `/users/search` | Search users for team (JSON) |
| POST | `/:id/team/add` | Add team member |
| POST | `/:id/team/remove/:userId` | Remove team member |

---

##### `surveys.js` (423 lines)
**Path:** `/home/ege/Projekte/IdeaboardWebsite/routes/surveys.js`

Survey routes -- protected by `isLoggedIn`.

| Method | Path | Description |
|---|---|---|
| POST | `/:id/delete-survey` | Delete survey |
| GET | `/` | Main surveys listing |
| GET | `/fragment` | Survey list fragment (HTMX) |
| POST | `/` | Create survey |
| GET | `/new` | Create survey form |
| POST | `/private` | Validate private access code |
| POST | `/:id/vote` | Submit votes |
| GET | `/:id/results` | Survey results |
| GET | `/:id` | Survey detail/voting form |

---

##### `users.js` (416 lines)
**Path:** `/home/ege/Projekte/IdeaboardWebsite/routes/users.js`

Authentication and user profile routes.

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/register` | Public | Register new user |
| POST | `/auth` | Public | Login with rate limiting (3->30min, 10->2h, 15->24h lock) |
| GET | `/auth` | Public | Login page |
| GET | `/session-info` | Public | JSON session status |
| GET | `/admin-setup` | Admin+forcePwChange | Admin initial setup page |
| POST | `/admin-setup` | Admin+forcePwChange | Process admin password change |
| GET | `/account` | LoggedIn | User profile page (cached 10s) |
| GET | `/points` | LoggedIn | Points display (lazy-loaded, with pending delta commit) |
| GET | `/logout` | LoggedIn | Logout (commits pending points, destroys session) |
| POST | `/account/update-username` | LoggedIn | Change username |
| POST | `/account/update-password` | LoggedIn | Change password (validates current) |

Exports `ensureDefaultAdmin` for use by `server.js` on startup.

---

### 2. SERVICE LAYER

#### `authService.js` (308 lines)
**Path:** `/home/ege/Projekte/IdeaboardWebsite/lib/services/authService.js`

Key exports:
- `hashService` -- Argon2id hashing (works on both Bun and Node)
- `ensureRoles()` -- Creates 3 default roles: Admin (1), Projektleiter (2), Mitarbeiter (3)
- `ensureDefaultAdmin()` -- Creates default admin on startup, generates one-time password if needed
- `registerUser(username, email, password)` -- Registration with duplicate checks, awards +10 points
- `authenticateUser(email, password)` -- Login with password verification
- `checkAdminFlag(userId)` -- Checks `admin_password_flags` table
- `setAdminFlag(userId)` -- Marks admin password as set
- `changePassword(userId, currentPassword, newPassword)` -- Validates current pw, updates hash
- `resetPassword(userId, newPassword)` -- Direct password reset (no validation)

---

#### `ideasService.js` (548 lines)
**Path:** `/home/ege/Projekte/IdeaboardWebsite/lib/services/ideasService.js`

The core ideas service. Key exports:
- `createIdea(userId, data, file)` -- Creates idea in transaction, handles tags, files, points
- `deleteIdea(ideaId, userId, userRole)` -- Deletes with permission checks and point revocation
- `updateIdea(ideaId, userId, data, userRole)` -- Updates title/description/category
- `addIdeaTags(ideaId, userId, tagsInput)` -- Adds unique tags, awards 1 point
- `removeIdeaTag(ideaId, userId, userRole, tagName)` -- Removes single tag
- `checkDuplicateIdea(userId, title)` -- 15-second cooldown check
- `updateIdeaStatus(ideaId, status, userId, userRole)` -- Admin-only status change (blocks `umgesetzt` status from manual set)
- `uploadIdeaFile(ideaId, userId, file)` -- File upload with point award
- `renderIdeaCard(ideaId, userId, categories)` -- Full card data with enrichment
- `fetchIdeas(userId, query)` -- Paginated search with fulltext, filtering, sorting

---

#### `roleHelpers.js` (112 lines)
**Path:** `/home/ege/Projekte/IdeaboardWebsite/lib/roleHelpers.js`

Role normalization and authorization helpers:
- `ROLE_NAMES_BY_ID` -- `{1: 'Admin', 2: 'Projektleiter', 3: 'Mitarbeiter'}`
- `ROLE_IDS_BY_NAME` -- reverse mapping
- `normalizeRoleName(value)` -- Canonical role name from various formats
- `getRoleName(source)` -- Extract role name from object or string/number
- `getRoleId(source)` -- Extract role ID from object or string/number
- `hasRole(source, expectedRole)` -- Compare roles
- `isAdmin(source)` -- Check if admin
- `isProjectLead(source)` -- Check if project lead
- `normalizeUser(user)` -- Adds `role`, `roleName`, `role_name`, `roleId`, `role_id`, `isAdmin`, `isProjectLead`

---

#### `userService.js` (109 lines)
**Path:** `/home/ege/Projekte/IdeaboardWebsite/lib/services/userService.js`

- `updateUserPoints(userId)` -- Commits pending_delta to current_points
- `getUserProfile(userId)` -- Full profile with points
- `getUserMinimal(userId)` -- Just user_id + username
- `updateUsername(userId, newUsername)` -- Case-insensitive conflict check
- `queryWithLockRetry(sql, params, maxAttempts)` -- Retry helper for lock errors (errno 1205, 1213)

---

#### `categoriesService.js` (20 lines)
**Path:** `/home/ege/Projekte/IdeaboardWebsite/lib/services/categoriesService.js`

- `getAll()` -- Returns all categories ordered by name

---

#### Additional Service Files (read for completeness)

**`adminService.js` (249 lines)** at `/home/ege/Projekte/IdeaboardWebsite/lib/services/adminService.js`
- `logAdminAction()` -- Insert into admin_actions_log
- `getUsersWithRoles()` -- All users with role names
- `getAvailableRoles()` -- All roles
- `getAdminLogs(limit)` -- Recent audit log entries
- `updateUserRole()` -- With root admin protection and project-owner checks
- `promoteToRole()` -- Auto-promotion (used by projects)
- `deleteUser()` -- CASCADE delete
- `assignManualPoints()` -- Points + audit log
- `resetUserPassword()`
- `getUserForAdmin()` -- Single user with role

**`pointsService.js` (77 lines)** at `/home/ege/Projekte/IdeaboardWebsite/lib/services/pointsService.js`

Point value constants:
| Constant | Value |
|---|---|
| `IDEA_CREATED_BASE` | 5 |
| `IDEA_TAG_BONUS` | 1 (per tag) |
| `IDEA_FILE_BONUS` | 1 |
| `IDEA_LIKED_BONUS` | 5 |
| `IDEA_DISLIKED_PENALTY` | -1 |
| `COMMENT_CREATED` | 1 |
| `COMMENT_LIKED_BONUS` | 1 |
| `SURVEY_CREATED_BASE` | 5 |
| `SURVEY_PARTICIPATION` | 3 |
| `SURVEY_AUTHOR_BONUS` | 2 (per participant) |
| `USER_REGISTRATION` | 10 |

Functions: `addPendingDelta()`, `awardIdeaCreated()`

**`reactionsService.js` (183 lines)** at `/home/ege/Projekte/IdeaboardWebsite/lib/services/reactionsService.js`
- `toggleIdeaLike(ideaId, userId)` -- Toggle like, auto-removes dislike, weekly quota (3/week), awards/revokes points to idea owner
- `toggleIdeaDislike(ideaId, userId)` -- Toggle dislike, auto-removes like, weekly quota, applies penalty to idea owner

---

### 3. TEMPLATES (Ideas Section)

#### `views/ideas/ideas.ejs` (195 lines)
Main ideas page layout. Includes:
- Hero header with "Neue Idee" button and modal trigger
- HTMX-powered filter form (search, category, sort, owner filter, search scope, tags)
- Content area via `_content.ejs` partial
- Create idea modal (dialog) with title, description, category, tags, file fields
- Edit modal container (`#idea-edit-modal`)
- CSS: `/css/ideas.css`, JS: `ideasLive.min.js` + `ideasClient.min.js`

#### `views/ideas/_content.ejs` (22 lines)
Wrapper for ideas grid + load more button. Delegates to `_list.ejs` for actual cards. Supports `renderLoadMoreButton` flag.

#### `views/ideas/_list.ejs` (11 lines)
Iterates over `ideas` array, includes `_idea-card.ejs` for each.

#### `views/ideas/_idea-card.ejs` (113 lines)
Single idea card with:
- Rich data attributes (id, title, desc, category, tags, files, ownership, role, status)
- Header: title, category, author, status badge, edit button
- Description text
- Tags (# prefixed)
- Files preview section
- Footer: Comments expand button (lazy-loaded via HTMX), stats (likes/dislikes/comments)
- Expanded section: comments area + comment form

#### `views/ideas/_idea-stats.ejs` (40 lines)
Like/dislike buttons (for non-owners) or read-only display (for owners). Includes:
- `hx-post` to `/ideas/:id/like` and `/ideas/:id/dislike`
- Visual state classes: `liked`, `disliked`
- Error message display for exhausted weekly quota

#### `views/ideas/_idea-modal.ejs` (166 lines)
Full edit modal with:
- Edit form (title, description, category) via `hx-post`
- Tags form with per-tag delete via long-press
- File upload form + existing files with delete
- Admin status change dropdown (blocked if `umgesetzt`)
- "In Projekt umwandeln" button for authorized users
- Delete idea in danger zone

#### `views/ideas/_comment-item.ejs` (62 lines)
Single comment with:
- Author, date
- Emoji reaction button (whitelisted 9 emojis) with popover
- Comment like button
- DM link to comment author
- Reaction bar with chips and total count

#### `views/ideas/_comments-section.ejs` (16 lines)
Comments list wrapper, includes `_comment-item.ejs` for each comment. Merges session-based like states.

---

### 4. DATABASE SCHEMA

The complete schema is defined across 19 migration files in `/home/ege/Projekte/IdeaboardWebsite/migrations/`.

#### Tables (from `0000_baseline.sql` and subsequent migrations):

| Table | Purpose |
|---|---|
| `roles` | Role definitions (Admin/Projektleiter/Mitarbeiter) |
| `users` | User accounts with password_hash, role_id FK |
| `categories` | Idea categories |
| `ideas` | Core ideas table (title, description, status, counts) |
| `idea_tags` | Unique tag names |
| `idea_tag_links` | M:N idea<->tag |
| `idea_files` | Uploaded files per idea (encrypted paths) |
| `likes` | User idea likes (unique per user+idea) |
| `dislikes` | User idea dislikes (unique per user+idea) |
| `comments` | Comments on ideas (max 200 chars) |
| `comment_likes` | Comment likes |
| `comment_reactions` | Emoji reactions on comments (utf8mb4) |
| `projects` | Projects (Konzeption/Umsetzung/Abgeschlossen) |
| `project_teams` | Project team members with roles |
| `surveys` | Surveys with privacy/access_code |
| `survey_questions` | Survey questions |
| `survey_options` | Survey answer options |
| `survey_responses` | User survey answers |
| `survey_access` | Granted access to private surveys |
| `stats_cache` | Cached statistics |
| `dm_conversations` | Direct message conversations |
| `dm_messages` | Direct messages (with is_edited, is_deleted, updated_at) |
| `sessions` | Express session storage (JSON) |
| `admin_actions_log` | Audit log for admin actions |
| `user_points` | Gamification points (current_points, pending_delta) |
| `admin_password_flags` | Tracks if admin has set a custom password |
| `ideas_search` | Denormalized search table with FULLTEXT indexes |
| `group_chats` | Group chat rooms |
| `group_members` | Group membership (member/admin/owner) |
| `group_messages` | Group messages (text/file types) |

#### Key indexes (from migrations):
- `ideas_search` has extensive FULLTEXT indexes on `title`, `description`, and B-tree indexes on `created_at`, `category_id`, `author`, `like_count`, etc.
- `cm_conversations` has unique constraint on `(user1_id, user2_id)` ensuring sorted pairs
- `dm_messages` indexed by `(conversation_id, created_at)` and `sender_id`
- `comment_reactions` has unique constraint `(comment_id, user_id)` (one reaction per user per comment)
- `group_messages` indexed by `(group_id, created_at)`

#### Key schema evolution (notable migrations):
- `0012`: Created `ideas_search` denormalized table with FULLTEXT for hybrid search
- `0017`: Added `admin_password_flags` table + delete trigger
- `0029`: Added `sessions` table for MariaDB session store
- `0032`: Added `is_edited`, `is_deleted`, `updated_at` to `dm_messages`
- `0033`: Added `group_chats`, `group_members`, `group_messages` tables
- `0037`: Added `'umgesetzt'` status to ideas ENUM

---

### Summary of Full API Surface

The application has **~85+ distinct HTTP endpoints** across 12 route files:

- **Ideas (27 endpoints)**: CRUD, search, filtering, pagination, file management, reactions, status, tags, real-time SSE updates
- **Users/Auth (12 endpoints)**: Register, login (with rate limiting), logout, profile, points, password change, admin setup, session info
- **Admin (6 endpoints)**: User management, role changes, audit logs, manual points, password reset, user deletion
- **Dashboard (9 endpoints)**: Metrics, charts, top ideas/users, widgets, monthly stats
- **Projects (11 endpoints)**: CRUD, team management, contact search, user search
- **Direct Messages (10 endpoints)**: Conversations, chat, SSE real-time, history pagination, send/edit/delete, file downloads
- **Groups (11 endpoints)**: Chat rooms, SSE, history, send/edit/delete, membership management, file downloads
- **Surveys (10 endpoints)**: CRUD, voting, results, private access codes
- **Comments (3 endpoints)**: Create, list, single
- **Comment Reactions (2 endpoints)**: Emoji reactions, binary likes
- **Static/Info (8 endpoints)**: Landing page, impressum, privacy, terms, contact, docs, health check, gate, message, load testing

The architecture follows a clear pattern: `routes/` handle HTTP concerns (request parsing, response rendering, HTMX detection), `lib/services/` contain all business logic and database queries, and `views/` contain EJS templates rendered as full pages or HTMX partials.