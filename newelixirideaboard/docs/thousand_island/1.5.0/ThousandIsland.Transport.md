# `ThousandIsland.Transport`
[🔗](https://github.com/mtrudel/thousand_island/blob/main/lib/thousand_island/transport.ex#L1)

This module describes the behaviour required for Thousand Island to interact
with low-level sockets. It is largely internal to Thousand Island, however users
are free to implement their own versions of this behaviour backed by whatever
underlying transport they choose. Such a module can be used in Thousand Island
by passing its name as the `transport_module` option when starting up a server,
as described in `ThousandIsland`.

# `address`

```elixir
@type address() ::
  :inet.ip_address()
  | :inet.local_address()
  | {:local, binary()}
  | :unspec
  | {:undefined, any()}
```

A socket address

# `listen_options`

```elixir
@type listen_options() ::
  [:inet.inet_backend() | :gen_tcp.listen_option()] | [:ssl.tls_server_option()]
```

A listener socket options

# `listener_socket`

```elixir
@type listener_socket() :: :inet.socket() | :ssl.sslsocket()
```

A listener socket used to wait for connections

# `on_accept`

```elixir
@type on_accept() ::
  {:ok, socket()} | {:error, on_accept_tcp_error() | on_accept_ssl_error()}
```

The return value from an accept/1 call

# `on_accept_ssl_error`

```elixir
@type on_accept_ssl_error() :: :closed | :timeout | :ssl.error_alert()
```

# `on_accept_tcp_error`

```elixir
@type on_accept_tcp_error() :: :closed | :system_limit | :inet.posix()
```

# `on_close`

```elixir
@type on_close() :: :ok | {:error, any()}
```

The return value from a close/1 call

# `on_connection_information`

```elixir
@type on_connection_information() ::
  {:ok, :ssl.connection_info()} | {:error, reason :: any()}
```

The return value from a connection_information/1 call

# `on_controlling_process`

```elixir
@type on_controlling_process() ::
  :ok | {:error, :closed | :not_owner | :badarg | :inet.posix()}
```

The return value from a controlling_process/2 call

# `on_getopts`

```elixir
@type on_getopts() :: {:ok, [:inet.socket_optval()]} | {:error, :inet.posix()}
```

The return value from a getopts/2 call

# `on_handshake`

```elixir
@type on_handshake() :: {:ok, socket()} | {:error, on_handshake_ssl_error()}
```

The return value from a handshake/1 call

# `on_handshake_ssl_error`

```elixir
@type on_handshake_ssl_error() :: :closed | :timeout | :ssl.error_alert()
```

# `on_listen`

```elixir
@type on_listen() ::
  {:ok, listener_socket()} | {:error, :system_limit} | {:error, :inet.posix()}
```

The return value from a listen/2 call

# `on_negotiated_protocol`

```elixir
@type on_negotiated_protocol() ::
  {:ok, binary()} | {:error, :protocol_not_negotiated | :closed}
```

The return value from a negotiated_protocol/1 call

# `on_peercert`

```elixir
@type on_peercert() :: {:ok, :public_key.der_encoded()} | {:error, reason :: any()}
```

The return value from a peercert/1 call

# `on_peername`

```elixir
@type on_peername() :: {:ok, socket_info()} | {:error, :inet.posix()}
```

The return value from a peername/1 call

# `on_recv`

```elixir
@type on_recv() :: {:ok, binary()} | {:error, :closed | :timeout | :inet.posix()}
```

The return value from a recv/3 call

# `on_send`

```elixir
@type on_send() ::
  :ok | {:error, :closed | {:timeout, rest_data :: binary()} | :inet.posix()}
```

The return value from a send/2 call

# `on_sendfile`

```elixir
@type on_sendfile() ::
  {:ok, non_neg_integer()}
  | {:error, :inet.posix() | :closed | :badarg | :not_owner | :eof}
```

The return value from a sendfile/4 call

# `on_setopts`

```elixir
@type on_setopts() :: :ok | {:error, :inet.posix()}
```

The return value from a setopts/2 call

# `on_shutdown`

```elixir
@type on_shutdown() :: :ok | {:error, :inet.posix()}
```

The return value from a shutdown/2 call

# `on_sockname`

```elixir
@type on_sockname() :: {:ok, socket_info()} | {:error, :inet.posix()}
```

The return value from a sockname/1 call

# `on_upgrade`

```elixir
@type on_upgrade() :: {:ok, socket()} | {:error, term()}
```

The return value from a upgrade/2 call

# `socket`

```elixir
@type socket() :: :inet.socket() | :ssl.sslsocket()
```

A socket representing a client connection

# `socket_get_options`

```elixir
@type socket_get_options() :: [:inet.socket_getopt()]
```

Options which can be set on a socket via setopts/2 (or returned from getopts/1)

# `socket_info`

```elixir
@type socket_info() ::
  {:inet.ip_address(), :inet.port_number()} | :inet.returned_non_ip_address()
```

Information about an endpoint, either remote ('peer') or local

# `socket_set_options`

```elixir
@type socket_set_options() :: [:inet.socket_setopt()]
```

Options which can be set on a socket via setopts/2 (or returned from getopts/1)

# `socket_stats`

```elixir
@type socket_stats() ::
  {:ok, [{:inet.stat_option(), integer()}]} | {:error, :inet.posix()}
```

Connection statistics for a given socket

# `way`

```elixir
@type way() :: :read | :write | :read_write
```

The direction in which to shutdown a connection in advance of closing it

# `accept`

```elixir
@callback accept(listener_socket()) :: on_accept()
```

Wait for a client connection on the given listener socket. This call blocks until
such a connection arrives, or an error occurs (such as the listener socket being
closed).

# `close`

```elixir
@callback close(socket() | listener_socket()) :: on_close()
```

Closes the given socket.

# `connection_information`

```elixir
@callback connection_information(socket()) :: on_connection_information()
```

Returns the SSL connection_info for the given socket. If the socket is not secure,
`{:error, :not_secure}` is returned.

# `controlling_process`

```elixir
@callback controlling_process(socket(), pid()) :: on_controlling_process()
```

Transfers ownership of the given socket to the given process. This will always
be called by the process which currently owns the socket.

# `getopts`

```elixir
@callback getopts(socket(), socket_get_options()) :: on_getopts()
```

Gets the given options on the socket.

# `getstat`

```elixir
@callback getstat(socket()) :: socket_stats()
```

Returns stats about the connection on the socket.

# `handshake`

```elixir
@callback handshake(socket()) :: on_handshake()
```

Performs an initial handshake on a new client connection (such as that done
when negotiating an SSL connection). Transports which do not have such a
handshake can simply pass the socket through unchanged.

# `listen`

```elixir
@callback listen(:inet.port_number(), listen_options()) ::
  {:ok, listener_socket()} | {:error, any()}
```

Create and return a listener socket bound to the given port and configured per
the provided options.

# `negotiated_protocol`

```elixir
@callback negotiated_protocol(socket()) :: on_negotiated_protocol()
```

Returns the protocol negotiated as part of handshaking. Most typically this is via TLS'
ALPN or NPN extensions. If the underlying transport does not support protocol negotiation
(or if one was not negotiated), `{:error, :protocol_not_negotiated}` is returned

# `peercert`

```elixir
@callback peercert(socket()) :: on_peercert()
```

Returns the peer certificate for the given socket in the form of `t:public_key.der_encoded()`.
If the socket is not secure, `{:error, :not_secure}` is returned.

# `peername`

```elixir
@callback peername(socket()) :: on_peername()
```

Returns information in the form of `t:socket_info()` about the remote end of the socket.

# `recv`

```elixir
@callback recv(socket(), num_bytes :: non_neg_integer(), timeout :: timeout()) ::
  on_recv()
```

Returns available bytes on the given socket. Up to `num_bytes` bytes will be
returned (0 can be passed in to get the next 'available' bytes, typically the
next packet). If insufficient bytes are available, the function can wait `timeout`
milliseconds for data to arrive.

# `secure?`

```elixir
@callback secure?() :: boolean()
```

Returns whether or not this protocol is secure.

# `send`

```elixir
@callback send(socket(), data :: iodata()) :: on_send()
```

Sends the given data (specified as a binary or an IO list) on the given socket.

# `sendfile`

```elixir
@callback sendfile(
  socket(),
  filename :: String.t(),
  offset :: non_neg_integer(),
  length :: non_neg_integer()
) :: on_sendfile()
```

Sends the contents of the given file based on the provided offset & length

# `setopts`

```elixir
@callback setopts(socket(), socket_set_options()) :: on_setopts()
```

Sets the given options on the socket. Should disallow setting of options which
are not compatible with Thousand Island

# `shutdown`

```elixir
@callback shutdown(socket(), way()) :: on_shutdown()
```

Shuts down the socket in the given direction.

# `sockname`

```elixir
@callback sockname(socket() | listener_socket()) :: on_sockname()
```

Returns information in the form of `t:socket_info()` about the local end of the socket.

# `upgrade`

```elixir
@callback upgrade(socket(), term()) :: on_upgrade()
```

Performs an upgrade of an existing client connection (for example upgrading
an already-established connection to SSL). Transports which do not support upgrading can return
`{:error, :unsupported_upgrade}`.

---

*Consult [api-reference.md](api-reference.md) for complete listing*
