# Port Plan: JS Express → Elixir Plug (Bandit)

## Why Not LiveView

The original app is HTMX-centric (~85+ endpoints, partial HTML swaps). LiveView's stateful WebSocket model fights this pattern. Instead: **Bandit + Plug + Controllers + HEEx templates + HTMX over WebSocket (hx-ws)**.

---

## Architecture

```
Caddy (reverse proxy, TLS, static files)
  │
  Bandit (HTTP + WebSocket)
  ├── Plug.Router (routes → controllers)
  ├── Phoenix.Template (HEEx rendering)
  ├── DBConnection + MyXQL (MariaDB pool)
  ├── AyeSQL (.sql files for all queries)
  ├── htmx-ws handler (WebSocket for HTMX requests)
  └── Phoenix.PubSub (real-time broadcasts)
          │
      MariaDB (idea_board schema, FULLTEXT indexes)
```

---

## Dependencies

```elixir
{:bandit, "~> 1.6"}           # HTTP + WebSocket server
{:plug, "~> 1.15"}             # Router, session, CSRF
{:plug_crypto, "~> 2.1"}      # Session signing
{:phoenix_template, "~> 1.0"} # HEEx engine
{:phoenix_html, "~> 4.1"}     # HTML helpers
{:phoenix_pubsub, "~> 2.1"}   # PubSub for real-time
{:myxql, "~> 0.9"}            # MariaDB driver
{:db_connection, "~> 2.10"}   # Connection pool
{:ayesql, github: "alexdesousa/ayesql"} # Named SQL queries
{:argon2_elixir, "~> 4.1"}    # Password hashing
{:jason, "~> 1.4"}            # JSON
{:decimal, "~> 3.0"}          # Required by myxql
```

**No Phoenix, no LiveView, no Ecto, no Presence.**

---

## Project Structure

```
newelixirideaboard/
├── mix.exs
├── config/
│   ├── config.exs
│   ├── dev.exs
│   └── prod.exs
├── lib/
│   ├── ideaboard/
│   │   ├── application.ex          # Supervisor tree
│   │   ├── repo.ex                 # DBConnection pool (MyXQL)
│   │   ├── repo_runner.ex          # AyeSQL runner (MyXQL)
│   │   ├── endpoint.ex             # Plug pipeline
│   │   ├── router.ex               # All routes
│   │   ├── ws_handler.ex           # htmx-ws WebSocket handler
│   │   ├── pubsub.ex               # Phoenix.PubSub init
│   │   ├── key_manager.ex          # File encryption (optional)
│   │   ├── upload_quarantine.ex    # File upload scanner
│   │   ├── role_helpers.ex         # Role/auth helpers
│   │   │
│   │   ├── queries/                # AyeSQL .sql files
│   │   │   ├── ideas.sql
│   │   │   ├── ideas_comments.sql
│   │   │   ├── ideas_files.sql
│   │   │   ├── ideas_reactions.sql
│   │   │   ├── ideas_tags.sql
│   │   │   ├── ideas_stats.sql
│   │   │   ├── ideas_search.sql
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
│   │   ├── services/               # Business logic
│   │   │   ├── auth_service.ex
│   │   │   ├── ideas_service.ex
│   │   │   ├── ideas_search_service.ex
│   │   │   ├── ideas_comments_service.ex
│   │   │   ├── ideas_files_service.ex
│   │   │   ├── ideas_tags_service.ex
│   │   │   ├── ideas_stats_service.ex
│   │   │   ├── ideas_enrichment_service.ex
│   │   │   ├── reactions_service.ex
│   │   │   ├── categories_service.ex
│   │   │   ├── user_service.ex
│   │   │   ├── project_service.ex
│   │   │   ├── dm_messaging_service.ex
│   │   │   ├── dm_files_service.ex
│   │   │   ├── group_service.ex
│   │   │   ├── survey_service.ex
│   │   │   ├── dashboard_service.ex
│   │   │   ├── admin_service.ex
│   │   │   └── points_service.ex
│   │   │
│   │   └── controllers/            # Plug controllers
│   │       ├── page_controller.ex   # Index, gate, legal pages
│   │       ├── auth_controller.ex   # Login, register, logout
│   │       ├── ideas_controller.ex  # Ideas CRUD, search, filters
│   │       ├── comments_controller.ex
│   │       ├── reactions_controller.ex
│   │       ├── projects_controller.ex
│   │       ├── dms_controller.ex
│   │       ├── groups_controller.ex
│   │       ├── surveys_controller.ex
│   │       ├── dashboard_controller.ex
│   │       ├── admin_controller.ex
│   │       ├── file_controller.ex
│   │       └── ws_controller.ex     # WebSocket dispatch (htmx-ws)
│   │
│   └── ideaboard.ex
│
├── priv/
│   ├── static/                     # Copied from JS project
│   │   ├── css/
│   │   ├── js/
│   │   └── assets/
│   ├── templates/                  # HEEx templates (1:1 with original EJS)
│   │   ├── layouts/
│   │   │   └── root.html.heex      # Main layout (was layout.ejs)
│   │   ├── partials/
│   │   │   └── header.html.heex    # Site header (was header.ejs)
│   │   └── ideas/
│   │       ├── ideas.html.heex     # Ideas page
│   │       ├── _content.html.heex
│   │       ├── _list.html.heex
│   │       ├── _idea_card.html.heex
│   │       ├── _idea_stats.html.heex
│   │       ├── _idea_modal.html.heex
│   │       ├── _comments_section.html.heex
│   │       └── _comment_item.html.heex
│   └── sql/                        # AyeSQL queries (symlinked or copied)
│
├── data/uploads/ideas/
├── data/uploads/chat/
└── test/
```

---

## Auth Flow

| Step | What | Via |
|---|---|---|
| 1 | GET `/users/auth` → render login page | HTTP |
| 2 | POST `/users/auth` → validate, set session cookie | HTTP |
| 3 | POST `/users/register` → create user, set session | HTTP |
| 4 | GET `/auth/logout` → destroy session | HTTP |
| 5 | After login → establish htmx-ws WebSocket | WS |
| 6 | All subsequent HTMX requests → `hx-ws` | WS |

**Session:** Cookie-based via `Plug.Session` with `:cookie` store, signed + encrypted.

**Login rate limiting:** 3 failed → 30min lock, 10→2h, 15→24h. In-memory store (GenServer).

---

## HTMX over WebSocket (hx-ws)

The `hx-ws` extension sends HTMX trigger data as JSON over WebSocket. The server:

1. Receives `{HEADERS, "POST", "/ideas", {body}}`
2. Routes to the matching controller action
3. Controller renders the HEEx partial
4. Sends back `{HEADERS, "POST", "/ideas", "<html>"}`

**Controllers don't need to know if the request came via HTTP or WS.** A simple helper dispatches:

```elixir
def call(conn, action) do
  case conn.assigns[:transport] do
    :ws -> # render partial, send over ws
    :http -> # normal HTTP response
  end
end
```

Only auth routes (login, register, logout, file upload) use HTTP. Everything else uses `hx-ws`.

---

## Real-Time (PubSub)

- **Idea updates:** When an idea is created/edited/deleted/liked, broadcast via `Phoenix.PubSub` to `"ideas:{idea_id}"`. The htmx-ws handler subscribes clients to their relevant topics.
- **Chat:** DMs subscribe to `"dm:{conv_id}"`, groups to `"group:{group_id}"`. Messages pushed over WS.
- **Dashboard metrics:** Polled or pushed on relevant events.

---

## Search

Keep MariaDB FULLTEXT on `ideas_search.title` and `ideas_search.description` (unchanged schema). Add a **Levenshtein UDF** to MariaDB for fuzzy username search:

```sql
CREATE FUNCTION lev RETURNS INTEGER SONAME 'levenshtein.so';
```

The `ideas_search_service.ex` handles the search logic with:
1. FULLTITLE title search (boolean mode, `term*`)
2. FULLTEXT description search
3. LIKE search fallback
4. Levenshtein for usernames (optional)

---

## File Uploads

No encryption initially. `Plug.Upload` handles multipart. Files stored in `data/uploads/ideas/` and `data/uploads/chat/`. Encryption via `KeyManager` can be added later.

---

## Migration Order

| Phase | What | Files |
|---|---|---|
| 1 | Project scaffold, deps, config, DB pool, AyeSQL runner | `mix.exs`, `config/*`, `repo.ex`, `repo_runner.ex` |
| 2 | Copy static assets, create layouts/header HEEx | `priv/static/`, `priv/templates/layouts/`, `partials/` |
| 3 | Auth (login, register, logout, session) | `auth_controller.ex`, `auth_service.ex`, `users.sql`, `auth.sql` |
| 4 | Ideas page (list, search, filter, pagination, infinite scroll) | `ideas_controller.ex`, `ideas_service.ex`, `ideas/` templates |
| 5 | Idea CRUD (create, edit, delete) | Same + `ideas_files_service.ex` |
| 6 | Reactions (like/dislike) | `reactions_service.ex`, `ideas_reactions.sql` |
| 7 | Comments | `comments_controller.ex`, `ideas_comments_service.ex` |
| 8 | Tags | `ideas_tags_service.ex` |
| 9 | htmx-ws WebSocket handler | `ws_handler.ex` |
| 10 | Projects | `projects_controller.ex`, `project_service.ex` |
| 11 | DMs + Groups chat | `dms_controller.ex`, `groups_controller.ex` |
| 12 | Surveys | `surveys_controller.ex`, `survey_service.ex` |
| 13 | Dashboard | `dashboard_controller.ex`, `dashboard_service.ex` |
| 14 | Admin | `admin_controller.ex`, `admin_service.ex` |
| 15 | File download/upload, quarantine | `file_controller.ex`, `upload_quarantine.ex` |
| 16 | Polish, error pages, legal pages | `page_controller.ex` |
| 17 | Load testing, perf optimization | — |

---

## Key Differences from elixirideaboard/

- **No LiveView** — plain Plug controllers + HEEx
- **No Phoenix** — just `phoenix_template` + `phoenix_html` for HEEx
- **Auth works normally** — `put_session`/`clear_session` via `Plug.Conn`
- **HTMX over WS** — `hx-ws` extension instead of LiveView sockets
- **Templates copied 1:1** from original EJS with minimal changes
- **Session via cookie** — same as the original Express approach
- **Clean session management** — no redirect hacks

---

## Questions / Risks

- **`hx-ws` extension dispatch** — The WS handler needs to parse incoming HTMX messages and call the correct controller action, then render and send back HTML. Need a clean dispatch mechanism.
- **CSRF over WebSocket** — Not needed (WebSocket origin check replaces CSRF). Only HTTP POST routes (login, register) need CSRF.
- **HEEx without Phoenix** — `Phoenix.View` + `phoenix_template` works standalone, but template paths need explicit config.
- **FULLTEXT search** — MariaDB FULLTEXT with boolean mode already handles German well. The existing `ideas_search` view works as-is.
- **Levenshtein UDF** — Need to compile the C extension for MariaDB. Can defer to later.
