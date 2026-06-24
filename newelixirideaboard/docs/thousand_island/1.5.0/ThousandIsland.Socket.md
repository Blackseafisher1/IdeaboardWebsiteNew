# `ThousandIsland.Socket`
[🔗](https://github.com/mtrudel/thousand_island/blob/main/lib/thousand_island/socket.ex#L1)

Encapsulates a client connection's underlying socket, providing a facility to
read, write, and otherwise manipulate a connection from a client.

# `t`

```elixir
@type t() :: %ThousandIsland.Socket{
  read_timeout: timeout(),
  read_timer: reference() | nil,
  silent_terminate_on_error: boolean(),
  socket: ThousandIsland.Transport.socket(),
  span: ThousandIsland.Telemetry.t(),
  transport_module: module()
}
```

A reference to a socket along with metadata describing how to use it

# `close`

```elixir
@spec close(t()) :: ThousandIsland.Transport.on_close()
```

Closes the given socket. Note that a socket is automatically closed when the handler
process which owns it terminates

# `connection_information`

```elixir
@spec connection_information(t()) ::
  ThousandIsland.Transport.on_connection_information()
```

Returns information about the SSL connection info, if transport is SSL.

# `getopts`

```elixir
@spec getopts(t(), ThousandIsland.Transport.socket_get_options()) ::
  ThousandIsland.Transport.on_getopts()
```

Gets the given flags on the socket

Errors are usually from :inet.posix(), however, SSL module defines return type as any()

# `getstat`

```elixir
@spec getstat(t()) :: ThousandIsland.Transport.socket_stats()
```

Returns statistics about the connection.

# `handshake`

```elixir
@spec handshake(t()) :: ThousandIsland.Transport.on_handshake()
```

Handshakes the underlying socket if it is required (as in the case of SSL sockets, for example).

This is normally called internally by `ThousandIsland.Handler` and does not need to be
called by implementations which are based on `ThousandIsland.Handler`

# `negotiated_protocol`

```elixir
@spec negotiated_protocol(t()) :: ThousandIsland.Transport.on_negotiated_protocol()
```

Returns information about the protocol negotiated during transport handshaking (if any).

# `new`

```elixir
@spec new(
  ThousandIsland.Transport.socket(),
  ThousandIsland.HandlerConfig.t(),
  ThousandIsland.Telemetry.t()
) :: t()
```

Creates a new socket struct based on the passed parameters.

This is normally called internally by `ThousandIsland.Handler` and does not need to be
called by implementations which are based on `ThousandIsland.Handler`

# `peercert`

```elixir
@spec peercert(t()) :: ThousandIsland.Transport.on_peercert()
```

Returns information in the form of `t:public_key.der_encoded()` about the peer certificate of the socket.

# `peername`

```elixir
@spec peername(t()) :: ThousandIsland.Transport.on_peername()
```

Returns information in the form of `t:ThousandIsland.Transport.socket_info()` about the remote end of the socket.

# `recv`

```elixir
@spec recv(t(), non_neg_integer(), timeout() | nil) ::
  ThousandIsland.Transport.on_recv()
```

Returns available bytes on the given socket. Up to `length` bytes will be
returned (0 can be passed in to get the next 'available' bytes, typically the
next packet). If insufficient bytes are available, the function can wait `timeout`
milliseconds for data to arrive.

# `secure?`

```elixir
@spec secure?(t()) :: boolean()
```

Returns whether or not this protocol is secure.

# `send`

```elixir
@spec send(t(), iodata()) :: ThousandIsland.Transport.on_send()
```

Sends the given data (specified as a binary or an IO list) on the given socket.

# `sendfile`

```elixir
@spec sendfile(t(), String.t(), non_neg_integer(), non_neg_integer()) ::
  ThousandIsland.Transport.on_sendfile()
```

Sends the contents of the given file based on the provided offset & length

# `setopts`

```elixir
@spec setopts(t(), ThousandIsland.Transport.socket_set_options()) ::
  ThousandIsland.Transport.on_setopts()
```

Sets the given flags on the socket

Errors are usually from :inet.posix(), however, SSL module defines return type as any()

# `shutdown`

```elixir
@spec shutdown(t(), ThousandIsland.Transport.way()) ::
  ThousandIsland.Transport.on_shutdown()
```

Shuts down the socket in the given direction.

# `sockname`

```elixir
@spec sockname(t()) :: ThousandIsland.Transport.on_sockname()
```

Returns information in the form of `t:ThousandIsland.Transport.socket_info()` about the local end of the socket.

# `telemetry_span`

```elixir
@spec telemetry_span(t()) :: ThousandIsland.Telemetry.t()
```

Returns the telemetry span representing the lifetime of this socket

# `upgrade`

```elixir
@spec upgrade(t(), module(), term()) :: ThousandIsland.Transport.on_upgrade()
```

Upgrades the transport of the socket to use the specified transport module, performing any client
handshaking that may be required. The passed options are blindly passed through to the new
transport module.

This is normally called internally by `ThousandIsland.Handler` and does not need to be
called by implementations which are based on `ThousandIsland.Handler`

---

*Consult [api-reference.md](api-reference.md) for complete listing*
