# `ThousandIsland.Transports.SSL`
[🔗](https://github.com/mtrudel/thousand_island/blob/main/lib/thousand_island/transports/ssl.ex#L1)

Defines a `ThousandIsland.Transport` implementation based on TCP SSL sockets
as provided by Erlang's `:ssl` module. For the most part, users of Thousand
Island will only ever need to deal with this module via `transport_options`
passed to `ThousandIsland` at startup time. A complete list of such options
is defined via the `t::ssl.tls_server_option/0` type. This list can be somewhat
difficult to decipher; by far the most common values to pass to this transport
are the following:

* `keyfile`: The path to a PEM encoded key to use for SSL
* `certfile`: The path to a PEM encoded cert to use for SSL
* `ip`:  The IP to listen on. Can be specified as:
  * `{1, 2, 3, 4}` for IPv4 addresses
  * `{1, 2, 3, 4, 5, 6, 7, 8}` for IPv6 addresses
  * `:loopback` for local loopback
  * `:any` for all interfaces (ie: `0.0.0.0`)
  * `{:local, "/path/to/socket"}` for a Unix domain socket. If this option is used, the `port`
    option *must* be set to `0`.

Unless overridden, this module uses the following default options:

```elixir
backlog: 1024,
nodelay: true,
send_timeout: 30_000,
send_timeout_close: true,
reuseaddr: true
```

The following options are required for the proper operation of Thousand Island
and cannot be overridden:

```elixir
mode: :binary,
active: false
```

# `listener_socket`

```elixir
@type listener_socket() :: :ssl.sslsocket()
```

# `options`

```elixir
@type options() :: [:ssl.tls_server_option()]
```

# `socket`

```elixir
@type socket() :: :ssl.sslsocket()
```

---

*Consult [api-reference.md](api-reference.md) for complete listing*
