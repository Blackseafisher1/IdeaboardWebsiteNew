# `Bandit`
[🔗](https://github.com/mtrudel/bandit/blob/main/lib/bandit.ex#L1)

Bandit is an HTTP server for Plug and WebSock apps.

As an HTTP server, Bandit's primary goal is to act as 'glue' between client connections managed
by [Thousand Island](https://github.com/mtrudel/thousand_island) and application code defined
via the [Plug](https://github.com/elixir-plug/plug) and/or
[WebSock](https://github.com/phoenixframework/websock) APIs. As such there really isn't a whole lot of
user-visible surface area to Bandit, and as a consequence the API documentation presented here
is somewhat sparse. This is by design! Bandit is intended to 'just work' in almost all cases;
the only thought users typically have to put into Bandit comes in the choice of which options (if
any) they would like to change when starting a Bandit server. The sparseness of the Bandit API
should not be taken as an indicator of the comprehensiveness or robustness of the project.

## Using Bandit With Phoenix

Bandit fully supports Phoenix. Phoenix applications which use WebSockets for
features such as Channels or LiveView require Phoenix 1.7 or later.

Using Bandit to host your Phoenix application couldn't be simpler:

1. Add Bandit as a dependency in your Phoenix application's `mix.exs`:

    ```elixir
    {:bandit, "~> 1.8"}
    ```
2. Add the following `adapter:` line to your endpoint configuration in `config/config.exs`, as in the following example:

     ```elixir
     # config/config.exs

     config :your_app, YourAppWeb.Endpoint,
       adapter: Bandit.PhoenixAdapter, # <---- ADD THIS LINE
       url: [host: "localhost"],
       render_errors: ...
     ```
3. That's it! **You should now see messages at startup indicating that Phoenix is
   using Bandit to serve your endpoint**, and everything should 'just work'. Note
   that if you have set any exotic configuration options within your endpoint,
   you may need to update that configuration to work with Bandit; see the
   [Bandit.PhoenixAdapter](https://hexdocs.pm/bandit/Bandit.PhoenixAdapter.html)
   documentation for more information.

## Using Bandit With Plug Applications

Using Bandit to host your own Plug is very straightforward. Assuming you have
a Plug module implemented already, you can host it within Bandit by adding
something similar to the following to your application's `Application.start/2`
function:

```elixir
# lib/my_app/application.ex

defmodule MyApp.Application do
  use Application

  def start(_type, _args) do
    children = [
      {Bandit, plug: MyApp.MyPlug}
    ]

    opts = [strategy: :one_for_one, name: MyApp.Supervisor]
    Supervisor.start_link(children, opts)
  end
end
```

For less formal usage, you can also start Bandit using the same configuration
options via the `Bandit.start_link/1` function:

```elixir
# Start an http server on the default port 4000, serving MyApp.MyPlug
Bandit.start_link(plug: MyPlug)
```

## Configuration

A number of options are defined when starting a server. The complete list is
defined by the [`t:Bandit.options/0`](https://hexdocs.pm/bandit/Bandit.html#summary) type.

## Setting up an HTTPS Server

By far the most common stumbling block encountered when setting up an HTTPS
server involves configuring key and certificate data. Bandit is comparatively
easy to set up in this regard, with a working example looking similar to the
following:

```elixir
# lib/my_app/application.ex

defmodule MyApp.Application do
  use Application

  def start(_type, _args) do
    children = [
      {Bandit,
       plug: MyApp.MyPlug,
       scheme: :https,
       certfile: "/absolute/path/to/cert.pem",
       keyfile: "/absolute/path/to/key.pem"}
    ]

    opts = [strategy: :one_for_one, name: MyApp.Supervisor]
    Supervisor.start_link(children, opts)
  end
end
```

## WebSocket Support

If you're using Bandit to run a Phoenix application as suggested above, there is
nothing more for you to do; WebSocket support will 'just work'.

If you wish to interact with WebSockets at a more fundamental level, the
[WebSock](https://hexdocs.pm/websock/WebSock.html) and
[WebSockAdapter](https://hexdocs.pm/websock_adapter/WebSockAdapter.html) libraries
provides a generic abstraction for WebSockets (very similar to how Plug is
a generic abstraction on top of HTTP). Bandit fully supports all aspects of
these libraries.

## Receiving messages in your Plug process: A word of warning

The Plug specification is concerned only with the shape of the `c:Plug.init/1`
and `c:Plug.call/2` functions; it says nothing about the process model that
underlies the call, nor about how the Plug function should respond to any
messages it may receive. Although it is occasionally necessary to receive
messages from within your Plug call, this must be done with caution as Bandit
makes extensive use of messaging internally, especially with HTTP/2 based
requests.

In particular, you must ensure that your code *never* receives messages that
match the patterns `{:bandit, _}` or `{:plug_conn, :sent}`. Any `receive` calls
you make should be appropriately guarded to ensure that these messages remain in
the process' mailbox for Bandit to process them when required.

# `deflate_options`

```elixir
@type deflate_options() :: [
  level: :zlib.zlevel(),
  window_bits: :zlib.zwindowbits(),
  memory_level: :zlib.zmemlevel(),
  strategy: :zlib.zstrategy()
]
```

Options to configure the deflate library used for HTTP and WebSocket compression

# `http_1_options`

```elixir
@type http_1_options() :: [
  enabled: boolean(),
  max_request_line_length: pos_integer(),
  max_header_length: pos_integer(),
  max_header_count: pos_integer(),
  max_requests: pos_integer(),
  clear_process_dict: boolean(),
  gc_every_n_keepalive_requests: pos_integer(),
  log_unknown_messages: boolean()
]
```

Options to configure the HTTP/1 stack in Bandit

* `enabled`: Whether or not to serve HTTP/1 requests. Defaults to true
* `max_request_line_length`: The maximum permitted length of the request line
  (expressed as the number of bytes on the wire) in an HTTP/1.1 request. Defaults to 10_000 bytes
* `max_header_length`: The maximum permitted length of any single header (combined
  key & value, expressed as the number of bytes on the wire) in an HTTP/1.1 request. Defaults to 10_000 bytes
* `max_header_count`: The maximum permitted number of headers in an HTTP/1.1 request.
  Defaults to 50 headers
* `max_requests`: The maximum number of requests to serve in a single
  HTTP/1.1 connection before closing the connection. Defaults to 0 (no limit)
* `clear_process_dict`: Whether to clear the process dictionary of all non-internal entries
  between subsequent keepalive requests. If set, all keys not starting with `$` are removed from
  the process dictionary between requests. Defaults to `true`
* `gc_every_n_keepalive_requests`: How often to run a full garbage collection pass between subsequent
  keepalive requests on the same HTTP/1.1 connection. Defaults to 5 (garbage collect between
  every 5 requests). This option is currently experimental, and may change at any time
* `log_unknown_messages`: Whether or not to log unknown messages sent to the handler process.
  Defaults to `false`

# `http_2_options`

```elixir
@type http_2_options() :: [
  enabled: boolean(),
  max_header_block_size: pos_integer(),
  max_requests: pos_integer(),
  max_reset_stream_rate: {pos_integer(), pos_integer()} | nil,
  sendfile_chunk_size: pos_integer(),
  default_local_settings: keyword()
]
```

Options to configure the HTTP/2 stack in Bandit

* `enabled`: Whether or not to serve HTTP/2 requests. Defaults to true
* `max_header_block_size`: The maximum permitted length of a field block of an HTTP/2 request
  (expressed as the number of compressed bytes). Includes any concatenated block fragments from
  continuation frames. Defaults to 50_000 bytes
* `max_requests`: The maximum number of requests to serve in a single
  HTTP/2 connection before closing the connection. Defaults to 0 (no limit)
* `max_reset_stream_rate`: The maximum rate of stream resets (RST_STREAM frames) allowed.
  Specified as a tuple of `{count, milliseconds}` where `count` is the maximum number of
  RST_STREAM frames allowed within the time window of `milliseconds`. Defaults to `{500, 10_000}`
  (500 resets per 10 seconds). Setting this to `nil` disables rate limiting
* `sendfile_chunk_size`: The maximum number of bytes read per sendfile chunk when streaming
  HTTP/2 responses. Defaults to 1_048_576 (1 MiB)
* `default_local_settings`: Options to override the default values for local HTTP/2
  settings. Values provided here will override the defaults specified in RFC9113§6.5.2

# `http_options`

```elixir
@type http_options() :: [
  compress: boolean(),
  response_encodings: list(),
  deflate_options: deflate_options(),
  zstd_options: zstd_options(),
  log_exceptions_with_status_codes: list() | Range.t(),
  log_protocol_errors: :short | :verbose | false,
  log_client_closures: :short | :verbose | false
]
```

Options to configure shared aspects of the HTTP stack in Bandit

* `compress`: Whether or not to attempt compression of responses via content-encoding
  negotiation as described in
  [RFC9110§8.4](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.4). Defaults to true
* `response_encodings`: A list of compression encodings, expressed in order of preference.
  Defaults to `~w(zstd gzip x-gzip deflate)`, with `zstd` only being present on platforms which
  have the zstd library compiled in
* `deflate_options`: A keyword list of options to set on the deflate library. A complete list can
  be found at `t:deflate_options/0`. Note that these options only affect the behaviour of the
  'deflate' content encoding; 'gzip' does not have any configurable options (this is a
  limitation of the underlying `:zlib` library)
* `zstd_options`: A map of options passed verbatim to :zstd, review the options [here](https://www.erlang.org/doc/apps/stdlib/zstd.html#t:compress_parameters/0)
* `log_exceptions_with_status_codes`: Which exceptions to log. Bandit will log only those
  exceptions whose status codes (as determined by `Plug.Exception.status/1`) match the specified
  list or range. Defaults to `500..599`
* `log_protocol_errors`: How to log protocol errors such as malformed requests. `:short` will
  log a single-line summary, while `:verbose` will log full stack traces. The value of `false`
  will disable protocol error logging entirely. Defaults to `:short`
* `log_client_closures`: How to log cases where the client closes the connection. These happen
  routinely in the real world and so the handling of them is configured separately since they
  can be quite noisy. Takes the same options as `log_protocol_errors`, but defaults to `false`

# `options`

```elixir
@type options() :: [
  {:plug, module() | {module(), Plug.opts()}}
  | {:scheme, :http | :https}
  | {:port, :inet.port_number()}
  | {:ip, :inet.socket_address()}
  | :inet
  | :inet6
  | {:keyfile, binary()}
  | {:certfile, binary()}
  | {:otp_app, Application.app()}
  | {:cipher_suite, :strong | :compatible}
  | {:display_plug, module()}
  | {:startup_log, Logger.level() | false}
  | {:thousand_island_options, ThousandIsland.options()}
  | {:http_options, http_options()}
  | {:http_1_options, http_1_options()}
  | {:http_2_options, http_2_options()}
  | {:websocket_options, websocket_options()}
]
```

Possible top-level options to configure a Bandit server

* `plug`: The Plug to use to handle connections. Can be specified as `MyPlug` or `{MyPlug, plug_opts}`
* `scheme`: One of `:http` or `:https`. If `:https` is specified, you will also need to specify
  valid `certfile` and `keyfile` values (or an equivalent value within
  `thousand_island_options.transport_options`). Defaults to `:http`
* `port`: The TCP port to listen on. This option is offered as a convenience and actually sets
  the option of the same name within `thousand_island_options`. If a string value is passed, it
  will be parsed as an integer. Defaults to 4000 if `scheme` is `:http`, and 4040 if `scheme` is
  `:https`
* `ip`:  The interface(s) to listen on. This option is offered as a convenience and actually sets the
  option of the same name within `thousand_island_options.transport_options`. Can be specified as:
    * `{1, 2, 3, 4}` for IPv4 addresses
    * `{1, 2, 3, 4, 5, 6, 7, 8}` for IPv6 addresses
    * `:loopback` for local loopback (ie: `127.0.0.1`)
    * `:any` for all interfaces (ie: `0.0.0.0`)
    * `{:local, "/path/to/socket"}` for a Unix domain socket. If this option is used, the `port`
      option *must* be set to `0`
* `inet`: Only bind to IPv4 interfaces. This option is offered as a convenience and actually sets the
  option of the same name within `thousand_island_options.transport_options`. Must be specified
  as a bare atom `:inet`
* `inet6`: Only bind to IPv6 interfaces. This option is offered as a convenience and actually sets the
  option of the same name within `thousand_island_options.transport_options`. Must be specified
  as a bare atom `:inet6`
* `keyfile`: The path to a file containing the SSL key to use for this server. This option is
  offered as a convenience and actually sets the option of the same name within
  `thousand_island_options.transport_options`. If a relative path is used here, you will also
  need to set the `otp_app` parameter and ensure that the named file is part of your application
  build
* `certfile`: The path to a file containing the SSL certificate to use for this server. This option is
  offered as a convenience and actually sets the option of the same name within
  `thousand_island_options.transport_options`. If a relative path is used here, you will also
  need to set the `otp_app` parameter and ensure that the named file is part of your application
  build
* `otp_app`: Provided as a convenience when using relative paths for `keyfile` and `certfile`
* `cipher_suite`: Used to define a pre-selected set of ciphers, as described by
  `Plug.SSL.configure/1`. Optional, can be either `:strong` or `:compatible`
* `display_plug`: The plug to use when describing the connection in logs. Useful for situations
  such as Phoenix code reloading where you have a 'wrapper' plug but wish to refer to the
  connection by the endpoint name
* `startup_log`: The log level at which Bandit should log startup info.
  Defaults to `:info` log level, can be set to false to disable it
* `thousand_island_options`: A list of options to pass to Thousand Island. Bandit sets some
  default values in this list based on your top-level configuration; these values will be
  overridden by values appearing here. A complete list can be found at
  `t:ThousandIsland.options/0`
* `http_options`: A list of options to configure the shared aspects of Bandit's HTTP stack. A
  complete list can be found at `t:http_options/0`
* `http_1_options`: A list of options to configure Bandit's HTTP/1 stack. A complete list can
  be found at `t:http_1_options/0`
* `http_2_options`: A list of options to configure Bandit's HTTP/2 stack. A complete list can
  be found at `t:http_2_options/0`
* `websocket_options`: A list of options to configure Bandit's WebSocket stack. A complete list can
  be found at `t:websocket_options/0`

# `websocket_options`

```elixir
@type websocket_options() :: [
  enabled: boolean(),
  max_frame_size: pos_integer(),
  max_fragmented_message_size: pos_integer(),
  validate_text_frames: boolean(),
  compress: boolean(),
  deflate_options: deflate_options(),
  max_inflate_ratio: pos_integer()
]
```

Options to configure the WebSocket stack in Bandit

* `enabled`: Whether or not to serve WebSocket upgrade requests. Defaults to true
* `max_frame_size`: The maximum size of a single WebSocket frame (expressed as
  a number of bytes on the wire). Use a value of 0 for no limit. Defaults to 8_000_000
* `max_fragmented_message_size`: The maximum size of a WebSocket message delivered across
  multiple continuation frames (expressed as a number of bytes on the wire). Does NOT affect the
  handling of single-frame messages. Use a value of 0 for no limit. Defaults to 8_000_000
* `validate_text_frames`: Whether or not to validate text frames as being UTF-8. Strictly
  speaking this is required per RFC6455§5.6, however it can be an expensive operation and one
  that may be safely skipped in some situations. Defaults to true
* `compress`: Whether or not to allow per-message deflate compression globally. Note that
  upgrade requests still need to set the `compress: true` option in `connection_opts` on
  a per-upgrade basis for compression to be negotiated (see 'WebSocket Support' section below
  for details). Defaults to `true`
* `deflate_options`: A keyword list of options to set on the deflate library when using the
  per-message deflate extension. A complete list can be found at `t:deflate_options/0`.
  `window_bits` is currently ignored and left to negotiation.
* `max_inflate_ratio`: The maximum allowable ratio to allow decompression of received WebSocket
  messages. Intended to prevent 'inflate bomb' attacks where a tiny deflated messages inflates to
  a massive one. Defaults to `25` representing a 25:1 allowable inflation ratio.

# `zstd_options`

```elixir
@type zstd_options() :: map()
```

Options to configure the zstd library used for HTTP compression

# `start_link`

```elixir
@spec start_link(options()) :: Supervisor.on_start()
```

Starts a Bandit server using the provided arguments. See `t:options/0` for specific options to
pass to this function.

---

*Consult [api-reference.md](api-reference.md) for complete listing*
