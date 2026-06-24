# `Plug.Session.Store`
[🔗](https://github.com/elixir-plug/plug/blob/v1.20.1/lib/plug/session/store.ex#L1)

Specification for session stores.

# `cookie`

```elixir
@type cookie() :: binary()
```

The cookie value that will be sent in cookie headers. This value should be
base64 encoded to avoid security issues.

# `session`

```elixir
@type session() :: map()
```

The session contents, the final data to be stored after it has been built
with `Plug.Conn.put_session/3` and the other session manipulating functions.

# `sid`

```elixir
@type sid() :: term() | nil
```

The internal reference to the session in the store.

# `delete`

```elixir
@callback delete(conn :: Plug.Conn.t(), sid(), opts :: Plug.opts()) :: :ok
```

Removes the session associated with given session id from the store.

# `get`

```elixir
@callback get(conn :: Plug.Conn.t(), cookie(), opts :: Plug.opts()) :: {sid(), session()}
```

Parses the given cookie.

Returns a session id and the session contents. The session id is any
value that can be used to identify the session by the store.

The session id may be nil in case the cookie does not identify any
value in the store. The session contents must be a map.

# `init`

```elixir
@callback init(opts :: Plug.opts()) :: Plug.opts()
```

Initializes the store.

The options returned from this function will be given
to `c:get/3`, `c:put/4` and `c:delete/3`.

# `put`

```elixir
@callback put(conn :: Plug.Conn.t(), sid(), any(), opts :: Plug.opts()) :: cookie()
```

Stores the session associated with given session id.

If `nil` is given as id, a new session id should be
generated and returned.

# `get`

Gets the store name from an atom or a module.

    iex> Plug.Session.Store.get(CustomStore)
    CustomStore

    iex> Plug.Session.Store.get(:cookie)
    Plug.Session.COOKIE

---

*Consult [api-reference.md](api-reference.md) for complete listing*
