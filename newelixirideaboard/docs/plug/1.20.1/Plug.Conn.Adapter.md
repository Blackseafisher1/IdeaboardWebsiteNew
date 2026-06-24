# `Plug.Conn.Adapter`
[🔗](https://github.com/elixir-plug/plug/blob/v1.20.1/lib/plug/conn/adapter.ex#L1)

Specification of the connection adapter API implemented by webservers.

## Implementation recommendations

The `owner` field of `Plug.Conn` is deprecated and no longer needs to
be set by adapters. If you don't set the `owner` field, it is the
responsibility of the adapters to track the owner and send the
`already_sent/0` message below on any of the `send_*` callbacks.

# `http_protocol`

```elixir
@type http_protocol() :: :&quot;HTTP/1&quot; | :&quot;HTTP/1.1&quot; | :&quot;HTTP/2&quot; | atom()
```

# `payload`

```elixir
@type payload() :: term()
```

# `peer_data`

```elixir
@type peer_data() :: %{
  address: :inet.ip_address(),
  port: :inet.port_number(),
  ssl_cert: binary() | nil
}
```

# `sock_data`

```elixir
@type sock_data() :: %{address: :inet.ip_address(), port: :inet.port_number()}
```

# `ssl_data`

```elixir
@type ssl_data() :: :ssl.connection_info() | nil
```

# `chunk`

```elixir
@callback chunk(payload(), body :: Plug.Conn.body()) ::
  :ok | {:ok, sent_body :: binary() | nil, payload()} | {:error, term()}
```

Sends a chunk in the chunked response.

If the request has method `"HEAD"`, the adapter should
not send the response to the client.

Webservers are advised to return `nil` as the sent_body,
since the complete sent body depends on the sum of all
calls to this function. However, the test implementation
tracks the overall body and payload so it can be used
during testing.

# `get_http_protocol`

```elixir
@callback get_http_protocol(payload()) :: http_protocol()
```

Returns the HTTP protocol and its version.

# `get_peer_data`

```elixir
@callback get_peer_data(payload()) :: peer_data()
```

Returns peer information such as the address, port and ssl cert.

# `get_sock_data`
*optional* 

```elixir
@callback get_sock_data(payload()) :: sock_data()
```

Returns sock (local-side) information such as the address and port.

# `get_ssl_data`
*optional* 

```elixir
@callback get_ssl_data(payload()) :: ssl_data()
```

Returns details of the negotiated SSL connection, if present. If the connection is not SSL,
returns nil

# `inform`

```elixir
@callback inform(payload(), status :: Plug.Conn.status(), headers :: Keyword.t()) ::
  :ok | {:ok, payload()} | {:error, term()}
```

Send an informational response to the client.

If the adapter does not support inform, then `{:error, :not_supported}`
should be returned.

# `push`
*optional* 

```elixir
@callback push(payload(), path :: String.t(), headers :: Keyword.t()) ::
  :ok | {:error, term()}
```

Push a resource to the client.

If the adapter does not support server push then `{:error, :not_supported}`
should be returned.

This callback no longer needs to be implemented, as browsers no longer support server push.

# `read_req_body`

```elixir
@callback read_req_body(payload(), options :: Keyword.t()) ::
  {:ok, data :: binary(), payload()}
  | {:more, data :: binary(), payload()}
  | {:error, term()}
```

Reads the request body.

Read the docs in `Plug.Conn.read_body/2` for the supported
options and expected behaviour.

# `send_chunked`

```elixir
@callback send_chunked(
  payload(),
  status :: Plug.Conn.status(),
  headers :: Plug.Conn.headers()
) ::
  {:ok, sent_body :: binary() | nil, payload()}
```

Sends the given status, headers as the beginning of
a chunked response to the client. If the connection uses a
protocol (such as HTTP/2) which does not support chunked encoding,
the response should be sent in a streaming manner using the
protocol's framing method. Likewise if the passed headers include
a `content-length` header, the response should be streamed using
content length framing.

Webservers are advised to return `nil` as the sent_body,
since this function does not actually produce a body.
However, the test implementation returns an empty binary
as the body in order to be consistent with the built-up
body returned by subsequent calls to the test implementation's
`chunk/2` function

Webservers must send a `{:plug_conn, :sent}` message to the
process that called `Plug.Conn.Adapter.conn/5`.

# `send_file`

```elixir
@callback send_file(
  payload(),
  status :: Plug.Conn.status(),
  headers :: Plug.Conn.headers(),
  file :: binary(),
  offset :: integer(),
  length :: integer() | :all
) :: {:ok, sent_body :: binary() | nil, payload()}
```

Sends the given status, headers and file as a response
back to the client.

If the request has method `"HEAD"`, the adapter should
not send the response to the client.

Webservers are advised to return `nil` as the sent_body,
as the body can no longer be manipulated. However, the
test implementation returns the actual body so it can
be used during testing.

Webservers must send a `{:plug_conn, :sent}` message to the
process that called `Plug.Conn.Adapter.conn/5`.

# `send_resp`

```elixir
@callback send_resp(
  payload(),
  status :: Plug.Conn.status(),
  headers :: Plug.Conn.headers(),
  body :: Plug.Conn.body()
) :: {:ok, sent_body :: binary() | nil, payload()}
```

Sends the given status, headers and body as a response
back to the client.

If the request has method `"HEAD"`, the adapter should
not send the response to the client.

Webservers are advised to return `nil` as the sent_body,
as the body can no longer be manipulated. However, the
test implementation returns the actual body so it can
be used during testing.

Webservers must send a `{:plug_conn, :sent}` message to the
process that called `Plug.Conn.Adapter.conn/5`.

# `upgrade`

```elixir
@callback upgrade(payload(), protocol :: atom(), opts :: term()) ::
  {:ok, payload()} | {:error, term()}
```

Attempt to upgrade the connection with the client.

If the adapter does not support the indicated upgrade, then `{:error, :not_supported}` should
be returned.

If the adapter supports the indicated upgrade but is unable to proceed with it (due to
a negotiation error, invalid opts being passed to this function, or some other reason), then an
arbitrary error may be returned. Note that an adapter does not need to process the actual
upgrade within this function; it is a wholly supported failure mode for an adapter to attempt
the upgrade process later in the connection lifecycle and fail at that point.

# `already_sent`

The message to send to the request process on send callbacks.

# `conn`

Function used by adapters to create a new connection.

---

*Consult [api-reference.md](api-reference.md) for complete listing*
