
## Key Decisions

- MariaDB stays — same schema, same tables
- **No Ecto, no ORM.** AyeSQL with raw `.sql` files
- No Redis — Erlang distribution replaces pub/sub
- No EJS — HEEx templates
- No SSE management code — LiveView sockets
- No `pageCache` middleware — ETS + process state
- No presence services — `Phoenix.Presence`
- File encryption ported as-is
- Fuse.js removed, existing MariaDB FULLTEXT + LIKE stays

## Architecture Overview

```
┌─────────────────────────────────────────────┐
│  Caddy (reverse proxy, TLS, static files)   │
│  ┌──────────────────────────────────────┐   │
│  │     Phoenix + LiveView (Bandit)      │   │
│  │  ┌──────────────────────────────┐    │   │
│  │  │  LiveView Modules (7)        │    │   │
│  │  │  ├ IdeasLive                 │    │   │
│  │  │  ├ ChatLive (DMs + Groups)   │    │   │
│  │  │  ├ DashboardLive             │    │   │
│  │  │  ├ SurveyLive                │    │   │
│  │  │  ├ ProjectLive               │    │   │
│  │  │  ├ AdminLive                 │    │   │
│  │  │  └ AuthLive                  │    │   │
│  │  └──────────────────────────────┘    │   │
│  │  ┌──────────────────────────────┐    │   │
│  │  │  AyeSQL .sql files (~20)     │    │   │
│  │  │  SQL query modules           │    │   │
│  │  └──────────────────────────────┘    │   │
│  │  ┌──────────────────────────────┐    │   │
│  │  │  Phoenix.Presence            │    │   │
│  │  │  ETS page cache              │    │   │
│  │  │  KeyManager (encryption)     │    │   │
│  │  ├──────────────────────────────┤    │   │
│  │  │  DBConnection (myxql/mariadb)│    │   │
│  │  └──────────────────────────────┘    │   │
│  └──────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
              ↕
         MariaDB (unchanged schema)
```

## What Gets Deleted (Red Lines)

### Infrastructure: 1,224 LOC → 0 LOC
| Current File | Replaced By |
|---|---|
| `lib/redis.js` (123 LOC) | Erlang distribution — nodes talk directly. No external message broker needed. Each LiveView socket IS the pub/sub endpoint. |
| `lib/cacheHelper.js` (109 LOC) | ETS table per node. Invalidation via Phoenix.PubSub broadcast. No TTL tricks, no `res.send` monkey-patching. |
| `lib/liveUpdates.js` (199 LOC) | Phoenix.PubSub topics. A change is `broadcast("ideas:#{id}", :updated)`. No version numbers, no change log, no waiter sets. |
| `lib/mariadb-session-store.js` (173 LOC) | Cookie sessions with Plug Session + signed cookies. MariaDB sessions table becomes dead data (keep for old sessions, stop writing to it). |
| `lib/services/dmPresenceService.js` (129 LOC) | `Phoenix.Presence.track/3` — built-in, distributed, battle-tested. |
| `lib/services/groupPresenceService.js` (128 LOC) | Same — `Phoenix.Presence.track/3`. |
| `lib/htmxDetector.js` (50 LOC) | Gone. No HTMX request detection needed — LiveView knows it's LiveView. |
| `lib/viewHelpers.js` (29 LOC) | Gone. LiveView assigns handle user data injection. |
| `lib/http.js` (129 LOC) | Gone. Phoenix handles 404/error pages, redirects, response formatting. |
| `lib/asyncHandler.js` (28 LOC) | Gone. Elixir processes crash cleanly on errors, supervisors restart them. No try/catch wrapping needed. |
| `lib/sqlFragmentBuilder.js` (73 LOC) | Gone. SQL is in `.sql` files, parameterized by AyeSQL. No dynamic WHERE builder. |
| `lib/timing.js` (26 LOC) | Gone. Phoenix ships with Telemetry. Built-in request timing. |
| `routes/middleware.js` (28 LOC) | Gone. Phoenix plugs handle auth, CSRF, session. |

### SSE Management in Routes: ~350 LOC → 0 LOC
All `writeHead(200, 'text/event-stream')`, heartbeat intervals, waiter registration, `req.on('close')` cleanup, `res.write('\n')` flushes — all gone. LiveView is a persistent WebSocket. You just assign data, the framework diffs and sends HTML patches.

### Page Cache Middleware Monkey-Patching: 80 LOC → 0 LOC
The `pageCache()` monstrosity in `server.js` that overwrites `res.send` and `res.render` — gone. Cached page HTML goes into an ETS table with a GenServer managing TTL.

### Fuse.js: Gone
`fuse.js` dependency and its server-side usage — removed. Existing MariaDB FULLTEXT indexes on `ideas_search.title` and `ideas_search.description` + LIKE queries handle everything. Add a `levenshtein()` UDF to MariaDB for username search if needed later.

## What Gets Ported (Green Lines)

### 1. Project Structure

```
new_ideaboard/
├── mix.exs                          # deps: phoenix, phoenix_live_view, myxql, ayesql, argon2_elixir
├── config/
│   ├── config.exs
│   ├── dev.exs
│   ├── prod.exs
│   └── runtime.exs
├── lib/
│   ├── ideaboard/
│   │   ├── application.ex          # Supervisor tree
│   │   ├── repo.ex                 # DBConnection pool (no Ecto)
│   │   ├── key_manager.ex          # Port of lib/keyManager.js
│   │   ├── upload_quarantine.ex    # Port of lib/upload_quarantine.js
│   │   ├── role_helpers.ex         # Port of lib/roleHelpers.js
│   │   │
│   │   ├── queries/                # AyeSQL .sql files
│   │   │   ├── ideas.sql
│   │   │   ├── ideas_comments.sql
│   │   │   ├── ideas_files.sql
│   │   │   ├── ideas_reactions.sql
│   │   │   ├── ideas_tags.sql
│   │   │   ├── ideas_stats.sql
│   │   │   ├── projects.sql
│   │   │   ├── dms.sql
│   │   │   ├── groups.sql
│   │   │   ├── surveys.sql
│   │   │   ├── users.sql
│   │   │   ├── auth.sql
│   │   │   ├── admin.sql
│   │   │   ├── dashboard.sql
│   │   │   ├── categories.sql
│   │   │   └── points.sql
│   │   │
│   │   ├── services/               # Business logic modules
│   │   │   ├── ideas_service.ex
│   │   │   ├── ideas_search_service.ex
│   │   │   ├── ideas_comments_service.ex
│   │   │   ├── ideas_files_service.ex
│   │   │   ├── ideas_enrichment_service.ex
│   │   │   ├── ideas_stats_service.ex
│   │   │   ├── ideas_tags_service.ex
│   │   │   ├── reactions_service.ex
│   │   │   ├── project_service.ex
│   │   │   ├── dm_messaging_service.ex
│   │   │   ├── dm_files_service.ex
│   │   │   ├── group_service.ex
│   │   │   ├── survey_service.ex
│   │   │   ├── user_service.ex
│   │   │   ├── auth_service.ex
│   │   │   ├── admin_service.ex
│   │   │   ├── dashboard_service.ex
│   │   │   ├── categories_service.ex
│   │   │   └── points_service.ex
│   │   │
│   │   ├── live/                   # LiveView modules
│   │   │   ├── ideas_live.ex
│   │   │   ├── ideas_live/
│   │   │   │   ├── card_component.ex
│   │   │   │   ├── list_component.ex
│   │   │   │   ├── modal_component.ex
│   │   │   │   ├── filter_component.ex
│   │   │   │   └── create_form_component.ex
│   │   │   ├── chat_live.ex        # DMs + Groups share this
│   │   │   ├── chat_live/
│   │   │   │   ├── message_component.ex
│   │   │   │   ├── message_list_component.ex
│   │   │   │   ├── user_search_component.ex
│   │   │   │   └── conversation_list_component.ex
│   │   │   ├── dashboard_live.ex
│   │   │   ├── dashboard_live/
│   │   │   │   ├── metrics_component.ex
│   │   │   │   ├── charts_component.ex
│   │   │   │   └── top_ideas_component.ex
│   │   │   ├── survey_live.ex
│   │   │   ├── project_live.ex
│   │   │   ├── admin_live.ex
│   │   │   └── auth_live.ex
│   │   │
│   │   └── helpers/                # View helpers
│   │       └── time_helper.ex
│   │
│   ├── ideaboard_web.ex            # Router config (replaces express app.use chains)
│   └── ideaboard_web/
│       └── components/             # Shared HEEx components
│           ├── layouts/
│           │   └── root.html.heex
│           ├── header.html.heex
│           ├── footer.html.heex
│           └── error.html.heex
│
├── priv/
│   └── static/                     # public/ assets
│       ├── css/
│       ├── js/
│       └── assets/
│
├── data/uploads/ideas/             # Copy from old app
├── data/uploads/chat/              # Copy from old app
├── logs/
└── test/
```

### 2. Router → Phoenix Router

**Now (server.js):**
```js
app.use('/ideas', timing('ideas'), require('./routes/ideas'));
app.use('/projects', pageCache(15), timing('projects'), require('./routes/projects'));
app.use('/dms', timing('dms'), require('./routes/dms'));
// ... etc
```

**New (router.ex):**
```elixir
scope "/", IdeaBoardWeb do
  pipe_through [:browser, :require_auth]
  
  live "/ideas", IdeasLive, :index
  live "/projects", ProjectLive, :index
  live "/dms", ChatLive, :inbox
  live "/dms/chat/:user_id", ChatLive, :direct
  live "/groups/chat/:id", ChatLive, :group
  live "/dashboard", DashboardLive, :index
  live "/surveys", SurveyLive, :index
  live "/surveys/new", SurveyLive, :new
  live "/surveys/:id", SurveyLive, :show
  live "/admin", AdminLive, :index
end
```

No timing middleware needed (Telemetry). No cache middleware needed (process state). No `isLoggedIn` middleware needed (plug in pipeline).

### 3. AyeSQL Query Pattern

**Now (ideasService.js — raw SQL inline):**
```js
const rows = await db.query(`
  SELECT i.*, u.username AS author_username
  FROM ideas i JOIN users u ON u.user_id = i.user_id
  WHERE i.category_id = ? ORDER BY i.created_at DESC LIMIT ? OFFSET ?
`, [categoryId, limit, offset]);
```

**New (queries/ideas.sql):**
```sql
-- name: list-ideas
-- List ideas with optional category filter, paginated
SELECT i.*, u.username AS author_username
FROM ideas i
JOIN users u ON u.user_id = i.user_id
WHERE (:category_id IS NULL OR i.category_id = :category_id)
ORDER BY i.created_at DESC
LIMIT :limit OFFSET :offset;

-- name: search-by-title
-- Fulltext search on title
SELECT i.*, u.username AS author_username,
  MATCH(s.title) AGAINST(:query IN BOOLEAN MODE) AS relevance
FROM ideas_search s
JOIN ideas i ON i.idea_id = s.idea_id
JOIN users u ON u.user_id = i.user_id
WHERE MATCH(s.title) AGAINST(:query IN BOOLEAN MODE)
ORDER BY relevance DESC
LIMIT :limit OFFSET :offset;

-- name: search-by-description
-- Fulltext search on description
SELECT i.*, u.username AS author_username
FROM ideas_search s
JOIN ideas i ON i.idea_id = s.idea_id
JOIN users u ON u.user_id = i.user_id
WHERE MATCH(s.description) AGAINST(:query IN BOOLEAN MODE)
OR s.tags LIKE CONCAT('%', :query, '%')
ORDER BY i.created_at DESC
LIMIT :limit OFFSET :offset;
```

**New (ideas_service.ex):**
```elixir
defmodule IdeaBoard.IdeasService do
  use AyeSQL, repo: IdeaBoard.Repo
  
  defqueries("queries/ideas.sql")
  
  def list_ideas(category_id, page, per_page) do
    offset = (page - 1) * per_page
    {:ok, rows} = list_ideas(category_id: category_id, limit: per_page, offset: offset)
    rows
  end
end
```

### 4. LiveView Pattern: Ideas Page

**Now (ideas/ideas.ejs + routes/ideas.js):**
- Full page render on GET with EJS
- HTMX attributes on every filter input for partial swaps
- Separate `/chunk` endpoint for JSON + HTML hybrid
- Manual `req.isHtmx` detection to choose partial vs full render
- Manual SSE endpoint at `/updates` with version tracking
- Manual card re-render after every POST (edit, delete, like, tag)

**New (ideas_live.ex):**

```elixir
defmodule IdeaBoardWeb.IdeasLive do
  use IdeaBoardWeb, :live_view
  alias IdeaBoard.{IdeasService, CategoriesService, IdeasStatsService}

  @impl true
  def mount(_params, _session, socket) do
    if connected?(socket) do
      Phoenix.PubSub.subscribe(IdeaBoard.PubSub, "ideas")
    end
    
    {:ok, assign(socket,
      ideas: [],
      categories: CategoriesService.all(),
      filters: %{q: "", category_id: nil, sort: "latest", owned_only: false, tags: ""},
      page: 1,
      has_next: false,
      user_stats: nil
    )}
  end

  @impl true
  def handle_params(params, _url, socket) do
    {:noreply, apply_filters(socket, params)}
  end

  @impl true
  def handle_event("filter", %{"q" => q, "category_id" => cat, "sort" => sort}, socket) do
    params = %{"q" => q, "category_id" => cat, "sort" => sort, "page" => "1"}
    {:noreply, push_patch(socket, to: ~p"/ideas?#{params}")}
  end

  @impl true
  def handle_event("load-more", _, socket) do
    next = socket.assigns.page + 1
    %{ideas: more} = fetch_ideas(socket.assigns.user.id, socket.assigns.filters, next)
    {:noreply, socket |> assign(ideas: socket.assigns.ideas ++ more, page: next)}
  end

  @impl true
  def handle_event("create", %{"idea" => params}, socket) ->
    user = socket.assigns.user
    {:ok, idea} = IdeasService.create(user.id, params)
    Phoenix.PubSub.broadcast(IdeaBoard.PubSub, "ideas", {:new_idea, idea})
    {:noreply, socket |> assign(ideas: [render_card(idea)] ++ socket.assigns.ideas)}
  end

  # Real-time: when another user creates/edits, this fires
  @impl true
  def handle_info({:idea_updated, idea_id}, socket) do
    # Re-fetch just the changed card
    idx = Enum.find_index(socket.assigns.ideas, &(&1.idea_id == idea_id))
    if idx do
      updated = IdeasService.render_card(idea_id)
      {:noreply, update(socket, :ideas, fn ideas -> List.replace_at(ideas, idx, updated) end)}
    else
      {:noreply, socket}
    end
  end

  defp fetch_ideas(user_id, filters, page) do
    %{ideas: IdeasService.list(user_id, filters, page), has_next: ...}
  end
end
```

Key differences:
- `handle_event("filter", ...)` replaces 6 HTMX `hx-get` attributes on filter inputs
- `handle_info({:idea_updated, ...})` replaces the entire SSE + `liveUpdates.js` architecture
- `streams` + `:infinity` scroll replaces the `_content`/`_list` partial juggling
- No `req.isHtmx` branching — the template is one HEEx file that LiveView diff-patches

### 5. HEEx Template Example (ideas_live.html.heex)

```heex
<div id="ideas-page" phx-mounted={load_initial_data()}>
  <.header user={@user} />

  <section class="ideas-filters">
    <form phx-change="filter" phx-debounce="500">
      <input type="text" name="q" value={@filters.q} placeholder="Suche..." />
      <select name="category_id" value={@filters.category_id}>
        <option value="">Alle Kategorien</option>
        <%= for cat <- @categories do %>
          <option value={cat.category_id}><%= cat.name %></option>
        <% end %>
      </select>
      <select name="sort" value={@filters.sort}>
        <option value="latest">Neueste zuerst</option>
        <option value="oldest">Älteste zuerst</option>
        <option value="likes">Meiste Likes</option>
        <option value="score">Nur Score</option>
      </select>
      <select name="owned_only">
        <option value="false">Alle Ideen</option>
        <option value="true">Meine Ideen</option>
      </select>
      <input type="text" name="tags" value={@filters.tags} placeholder="Tags" />
    </form>
  </section>

  <div id="ideas-list" phx-update="stream">
    <div class="ideas-grid" id="ideas-stream" phx-viewport-bottom="load-more">
      <%= for {dom_id, idea} <- @streams.ideas do %>
        <.live_component module={IdeaCardComponent} id={dom_id} idea={idea} user={@user} />
      <% end %>
    </div>
    <%= if @has_next do %>
      <div phx-trigger-action={@load_more}>Lade mehr...</div>
    <% end %>
  </div>

  <.live_component module={CreateIdeaModalComponent} id="create-modal" categories={@categories} user={@user} />
</div>
```

No `hx-get`, `hx-target`, `hx-swap`, `hx-include`, `hx-vals`, `hx-push-url`, `hx-indicator`. No `data-` attribute hacks. No inline `JSON.stringify` escapes. No `<script>` version tracking. Just clean HTML with `phx-*` bindings.

### 6. Chat (DMs + Groups): One Module

Current: Two separate route files (`dms.js` 523 LOC, `groups.js` 466 LOC), two presence services, two SSE endpoint implementations.

New: Single `ChatLive` with `handle_params` for `:inbox`, `:direct`, `:group` modes.

```elixir
defmodule IdeaBoardWeb.ChatLive do
  use IdeaBoardWeb, :live_view
  alias Phoenix.Presence

  @impl true
  def mount(_params, session, socket) do
    user = session["user"]
    if connected?(socket) do
      Presence.track(self(), topic(user.id), user.id, %{online_at: System.system_time(:second)})
    end
    {:ok, assign(socket, conversations: DmService.conversations(user.id))}
  end

  def handle_params(%{"user_id" => other_id}, _uri, socket) do
    conv = DmService.get_or_create_conversation(socket.assigns.user.id, other_id)
    Presence.subscribe("dm:#{conv.conversation_id}")
    messages = DmService.latest_messages(conv.conversation_id, 20)
    {:noreply, assign(socket, conversation: conv, messages: messages, online: [])}
  end

  # Incoming message from PubSub (other user sent)
  @impl true
  def handle_info(%{event: "presence_diff", payload: diff}, socket) do
    online = Presence.list("dm:#{socket.assigns.conversation.conversation_id}")
    {:noreply, assign(socket, online: Map.keys(online))}
  end

  @impl true
  def handle_info({:new_message, message}, socket) do
    {:noreply, update(socket, :messages, &(&1 ++ [message]))}
  end

  @impl true
  def handle_event("send", %{"message" => text}, socket) do
    msg = DmService.send_message(socket.assigns.conversation.id, socket.assigns.user.id, text)
    Phoenix.PubSub.broadcast(IdeaBoard.PubSub, "dm:#{conv.id}", {:new_message, msg})
    {:noreply, update(socket, :messages, &(&1 ++ [msg]))}
  end

  @impl true
  def handle_event("load-history", %{"before_id" => before_id}, socket) do
    older = DmService.messages_before(socket.assigns.conversation.id, before_id, 20)
    {:noreply, update(socket, :messages, &(older ++ &1))}
  end
end
```

Six handle_* callbacks replace 523+466=989 LOC of route handlers with SSE, presence tracking, history pagination, file uploads, edit/delete with waiter notification.

### 7. Sessions: Cookie-based

**Drop the MariaDB sessions table.** Use Phoenix's built-in cookie sessions:

```elixir
# endpoint.ex
plug Plug.Session,
  store: :cookie,
  key: "_ideaboard_session",
  signing_salt: System.fetch_env!("SESSION_SALT"),
  encrypt: true,
  max_age: 86400
```

User data stored in signed+encrypted cookie. No DB query on every request. No session cleanup timer. No `MariaDBStore` class. If user needs invalidation, add a simple `valid_since` timestamp to `users` table and check it on mount.

### 8. File Encryption: Port KeyManager

Port `lib/keyManager.js` (210 LOC) to `lib/ideaboard/key_manager.ex`. Keep same encryption scheme, same wrapped master key file, same AES-256-GCM. No behavior change.

File uploads: Use Phoenix's `Plug.Upload` instead of multer. Same validation, same quarantine logic, same `/data/uploads/ideas/` and `/data/uploads/chat/` directories. Run the quarantine scanner as a GenServer that periodically scans.

### 9. Deployment

Before:
```
Caddy → Express (PM2 cluster, 2-4 workers) + Redis + MariaDB
```
- Redis needed for inter-process pub/sub
- Caddy special SSE flush config
- PM2 for clustering

After:
```
Caddy → Phoenix (single node, BEAM processes) + MariaDB
```
- No Redis — BEAM nodes can cluster for cross-machine scaling, but single node handles 1000+ LiveView sockets fine
- No SSE flush config — WebSocket is natively streamed
- No PM2 — Elixir release with systemd or Docker

### 10. Migration Order (6 weeks)

| Week | Task | Deliverable |
|---|---|---|
| 1 | Set up Phoenix project, DBConnection pool to MariaDB, port all SQL to AyeSQL `.sql` files, port auth service + session | Login/logout works, DB queries run |
| 2 | Port ideas listing + search + filters + pagination to Lives ideas, rewrite card + list components to HEEx | Idea board renders, search works, filters work |
| 3 | Port idea CRUD (create, edit, delete, status, tags, files), likes/dislikes, comments | All idea interactions work via LiveView |
| 4 | Port DMs + groups chat (unified ChatLive), Presence, file uploads, edit/delete messages | Chat works, online presence works |
| 5 | Port surveys, projects, dashboard, admin page, account page | All pages functional |
| 6 | Polish: Error pages, gate page, legal pages, responsive design, deploy config, load test | Production ready |

### 11. Code Reduction Summary

| Layer | Current | Target | Reduction |
|---|---|---|---|
| Redis + cache + session store | 405 | 0 | **−405** |
| Presence services (DM + Group) | 257 | 0 | **−257** |
| Live updates version system | 199 | 0 | **−199** |
| HTMX + view + HTTP helpers | 208 | 0 | **−208** |
| SQL fragment builder + timing | 99 | 0 | **−99** |
| Middleware | 28 | 0 | **−28** |
| SSE in routes | ~350 | 0 | **−350** |
| Routes (Express handlers) | 3,812 | ~800 (LiveView callbacks + router) | **−3,012** |
| Services | 4,758 | ~3,000 | **−1,758** |
| Templates (EJS → HEEx) | 5,777 | ~3,000 | **−2,777** |
| server.js (Express setup, gate, etc.) | 376 | 0 | **−376** |
| **Total** | **~16,577** | **~6,800** | **−9,777 (−59%)** |

### 12. What You Lose / Gain

| Lose | Gain |
|---|---|
| Redis dependency | No external state broker |
| Fuse.js | Native MariaDB FULLTEXT (already indexed) |
| SSE connection management | Phoenix channels (auto-managed) |
| `pageCache` res.send monkey-patching | ETS cache (transparent, no middleware) |
| `hx-*` attribute soup in templates | `phx-*` bindings (cleaner, fewer) |
| Manual version tracking for live updates | PubSub broadcasts (fire and forget) |
| PM2 cluster + `reusePort` | BEAM process model (single node, no port sharing hacks) |
| Two presence service duplicates | One Phoenix.Presence |
| `req.isHtmx` branching in every handler | One template, diff-patched by framework |
| Express body-parser, multer, csrf setup | Phoenix plugs (one-liners in router) |
| Docker just for Redis | Docker just for MariaDB (or no Docker) |

### 13. Unknowns / Risks

- **AyeSQL parameter syntax**: AyeSQL uses `:param` named parameters. MariaDB uses `?`. The MariaDB driver may need a wrapper for named→positional conversion, or use AyeSQL in raw mode with `$1, $2` positional params.
- **File encryption lib**: Elixir has `:crypto` (Erlang's OpenSSL bindings) — AES-256-GCM is native. Porting the exact key wrapping scheme from Node's `crypto.createDecipheriv` needs testing.
- **Multer multi-file upload**: Phoenix's `Plug.Upload` handles single files natively. Multi-file upload with `array('file', 5)` needs a `:multipart` parser or manual body reading. Not hard but not one-liner.
- **Legacy sessions**: Old MariaDB sessions are orphaned. Users get logged out on migration day. Acceptable since sessions were 24h max anyway.
- **German fulltext search**: MariaDB FULLTEXT with `utf8mb4_general_ci` already handles German well enough. The existing `ideas_search` view works. No change needed.

(8 * 97) + 22 * 8 * (10 / 2000) = 776
