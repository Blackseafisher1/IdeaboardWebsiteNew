# `Phoenix.LiveView.Socket`
[🔗](https://github.com/phoenixframework/phoenix_live_view/blob/v1.1.28/lib/phoenix_live_view/socket.ex#L14)

The LiveView socket for Phoenix Endpoints.

This is typically mounted directly in your endpoint.

    socket "/live", Phoenix.LiveView.Socket,
      websocket: [connect_info: [session: @session_options]]

To share an underlying transport connection between regular
Phoenix channels and LiveView processes, `use Phoenix.LiveView.Socket`
from your own `MyAppWeb.UserSocket` module.

Next, declare your `channel` definitions and optional `connect/3`, and
`id/1` callbacks to handle your channel specific needs, then mount
your own socket in your endpoint:

    socket "/live", MyAppWeb.UserSocket,
      websocket: [connect_info: [session: @session_options]]

If you require session options to be set at runtime, you can use
an MFA tuple. The function it designates must return a keyword list.

    socket "/live", MyAppWeb.UserSocket,
      websocket: [connect_info: [session: {__MODULE__, :runtime_opts, []}]]

    # ...

    def runtime_opts() do
      Keyword.put(@session_options, :domain, host())
    end

# `assigns`

```elixir
@type assigns() :: map() | assigns_not_in_socket()
```

The data in a LiveView as stored in the socket.

# `assigns_not_in_socket`

```elixir
@opaque assigns_not_in_socket()
```

Struct returned when `assigns` is not in the socket.

# `t`

```elixir
@type t() :: %Phoenix.LiveView.Socket{
  assigns: assigns(),
  endpoint: module(),
  host_uri: URI.t() | :not_mounted_at_router,
  id: binary(),
  parent_pid: nil | pid(),
  private: map(),
  redirected: nil | tuple(),
  root_pid: pid(),
  router: module(),
  sticky?: term(),
  transport_pid: pid() | nil,
  view: module()
}
```

---

*Consult [api-reference.md](api-reference.md) for complete listing*
