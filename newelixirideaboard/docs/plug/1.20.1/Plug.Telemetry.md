# `Plug.Telemetry`
[🔗](https://github.com/elixir-plug/plug/blob/v1.20.1/lib/plug/telemetry.ex#L1)

A plug to instrument the pipeline with `:telemetry` events.

When plugged, the event prefix is a required option:

    plug Plug.Telemetry, event_prefix: [:my, :plug]

In the example above, two events will be emitted:

  * `[:my, :plug, :start]` - emitted when the plug is invoked.
    The event carries the `system_time` as measurement. The metadata
    is the whole `Plug.Conn` under the `:conn` key and any leftover
    options given to the plug under `:options`.

  * `[:my, :plug, :stop]` - emitted right before the response is sent.
    The event carries a single measurement, `:duration`, which is the
    monotonic time difference between the stop and start events.
    It has the same metadata as the start event, except the connection
    has been updated.

Note this plug measures the time between its invocation until a response
is sent. The `:stop` event is not guaranteed to be emitted in all error
cases, so this Plug cannot be used as a Telemetry span.

## Time unit

The `:duration` measurements are presented in the `:native` time unit.
You can read more about it in the docs for `System.convert_time_unit/3`.

## Example

    defmodule InstrumentedPlug do
      use Plug.Router

      plug :match
      plug Plug.Telemetry, event_prefix: [:my, :plug]
      plug Plug.Parsers, parsers: [:urlencoded, :multipart]
      plug :dispatch

      get "/" do
        send_resp(conn, 200, "Hello, world!")
      end
    end

In this example, the stop event's `duration` includes the time
it takes to parse the request, dispatch it to the correct handler,
and execute the handler. The events are not emitted for requests
not matching any handlers, since the plug is placed after the match plug.

---

*Consult [api-reference.md](api-reference.md) for complete listing*
