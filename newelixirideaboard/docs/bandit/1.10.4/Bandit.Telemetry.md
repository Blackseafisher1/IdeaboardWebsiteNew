# `Bandit.Telemetry`
[🔗](https://github.com/mtrudel/bandit/blob/main/lib/bandit/telemetry.ex#L1)

The following telemetry spans are emitted by bandit

## `[:bandit, :request, *]`

Represents Bandit handling a specific client HTTP request

This span is started by the following event:

* `[:bandit, :request, :start]`

    Represents the start of the span

    This event contains the following measurements:

    * `monotonic_time`: The time of this event, in `:native` units

    This event contains the following metadata:

    * `telemetry_span_context`: A unique identifier for this span
    * `connection_telemetry_span_context`: The span context of the Thousand Island `:connection`
      span which contains this request
    * `conn`: The `Plug.Conn` representing this connection. Not present in cases where `error`
      is also set and the nature of error is such that Bandit was unable to successfully build
      the conn
    * `plug`: The Plug which is being used to serve this request. Specified as `{plug_module, plug_opts}`

This span is ended by the following event:

* `[:bandit, :request, :stop]`

    Represents the end of the span

    This event contains the following measurements:

    * `monotonic_time`: The time of this event, in `:native` units
    * `duration`: The span duration, in `:native` units
    * `req_header_end_time`: The time that header reading completed, in `:native` units
    * `req_body_start_time`: The time that request body reading started, in `:native` units.
    * `req_body_end_time`: The time that request body reading completed, in `:native` units
    * `req_body_bytes`: The length of the request body, in octets
    * `resp_start_time`: The time that the response started, in `:native` units
    * `resp_end_time`: The time that the response completed, in `:native` units
    * `resp_body_bytes`: The length of the response body, in octets. If the response is
      compressed, this is the size of the compressed payload as sent on the wire
    * `resp_uncompressed_body_bytes`: The length of the original, uncompressed body. Only
      included for responses which are compressed
    * `resp_compression_method`: The method of compression, as sent in the `Content-Encoding`
      header of the response. Only included for responses which are compressed

    This event contains the following metadata:

    * `telemetry_span_context`: A unique identifier for this span
    * `connection_telemetry_span_context`: The span context of the Thousand Island `:connection`
      span which contains this request
    * `conn`: The `Plug.Conn` representing this connection. Not present in cases where `error`
      is also set and the nature of error is such that Bandit was unable to successfully build
      the conn
    * `plug`: The Plug which is being used to serve this request. Specified as `{plug_module, plug_opts}`
    * `error`: The error that caused the span to end, if it ended in error

The following events may be emitted within this span:

* `[:bandit, :request, :exception]`

    The request for this span ended unexpectedly

    This event contains the following measurements:

    * `monotonic_time`: The time of this event, in `:native` units

    This event contains the following metadata:

    * `telemetry_span_context`: A unique identifier for this span
    * `connection_telemetry_span_context`: The span context of the Thousand Island `:connection`
      span which contains this request
    * `conn`: The `Plug.Conn` representing this connection. Not present in cases where `error`
      is also set and the nature of error is such that Bandit was unable to successfully build
      the conn
    * `plug`: The Plug which is being used to serve this request. Specified as `{plug_module, plug_opts}`
    * `kind`: The kind of unexpected condition, typically `:exit`
    * `exception`: The exception which caused this unexpected termination. May be an exception
      or an arbitrary value when the event was an uncaught throw or an exit
    * `stacktrace`: The stacktrace of the location which caused this unexpected termination

## `[:bandit, :websocket, *]`

Represents Bandit handling a WebSocket connection

This span is started by the following event:

* `[:bandit, :websocket, :start]`

    Represents the start of the span

    This event contains the following measurements:

    * `monotonic_time`: The time of this event, in `:native` units
    * `compress`: Details about the compression configuration for this connection

    This event contains the following metadata:

    * `telemetry_span_context`: A unique identifier for this span
    * `connection_telemetry_span_context`: The span context of the Thousand Island `:connection`
      span which contains this request
    * `websock`: The WebSock which is being used to serve this request. Specified as `websock_module`

This span is ended by the following event:

* `[:bandit, :websocket, :stop]`

    Represents the end of the span

    This event contains the following measurements:

    * `monotonic_time`: The time of this event, in `:native` units
    * `duration`: The span duration, in `:native` units
    * `recv_text_frame_count`: The number of text frames received
    * `recv_text_frame_bytes`: The total number of bytes received in the payload of text frames
    * `recv_binary_frame_count`: The number of binary frames received
    * `recv_binary_frame_bytes`: The total number of bytes received in the payload of binary frames
    * `recv_ping_frame_count`: The number of ping frames received
    * `recv_ping_frame_bytes`: The total number of bytes received in the payload of ping frames
    * `recv_pong_frame_count`: The number of pong frames received
    * `recv_pong_frame_bytes`: The total number of bytes received in the payload of pong frames
    * `recv_connection_close_frame_count`: The number of connection close frames received
    * `recv_connection_close_frame_bytes`: The total number of bytes received in the payload of connection close frames
    * `recv_continuation_frame_count`: The number of continuation frames received
    * `recv_continuation_frame_bytes`: The total number of bytes received in the payload of continuation frames
    * `send_text_frame_count`: The number of text frames sent
    * `send_text_frame_bytes`: The total number of bytes sent in the payload of text frames
    * `send_binary_frame_count`: The number of binary frames sent
    * `send_binary_frame_bytes`: The total number of bytes sent in the payload of binary frames
    * `send_ping_frame_count`: The number of ping frames sent
    * `send_ping_frame_bytes`: The total number of bytes sent in the payload of ping frames
    * `send_pong_frame_count`: The number of pong frames sent
    * `send_pong_frame_bytes`: The total number of bytes sent in the payload of pong frames
    * `send_connection_close_frame_count`: The number of connection close frames sent
    * `send_connection_close_frame_bytes`: The total number of bytes sent in the payload of connection close frames
    * `send_continuation_frame_count`: The number of continuation frames sent
    * `send_continuation_frame_bytes`: The total number of bytes sent in the payload of continuation frames

    This event contains the following metadata:

    * `telemetry_span_context`: A unique identifier for this span
    * `origin_telemetry_span_context`: The span context of the Bandit `:request` span from which
      this connection originated
    * `connection_telemetry_span_context`: The span context of the Thousand Island `:connection`
      span which contains this request
    * `websock`: The WebSock which is being used to serve this request. Specified as `websock_module`
    * `error`: The error that caused the span to end, if it ended in error

# `t`

```elixir
@opaque t()
```

# `monotonic_time`

```elixir
@spec monotonic_time() :: integer()
```

# `span_exception`

```elixir
@spec span_exception(
  t(),
  Exception.kind(),
  Exception.t() | term(),
  Exception.stacktrace()
) :: :ok
```

---

*Consult [api-reference.md](api-reference.md) for complete listing*
