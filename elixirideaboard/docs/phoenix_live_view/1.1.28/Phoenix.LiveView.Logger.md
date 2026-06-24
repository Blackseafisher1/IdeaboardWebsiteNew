# `Phoenix.LiveView.Logger`
[🔗](https://github.com/phoenixframework/phoenix_live_view/blob/v1.1.28/lib/phoenix_live_view/logger.ex#L1)

Instrumenter to handle logging of `Phoenix.LiveView` and `Phoenix.LiveComponent` life-cycle events.

## Installation

The logger is installed automatically when Live View starts.
By default, the log level is set to `:debug`.

## Module configuration

The log level can be overridden for an individual Live View module:

    use Phoenix.LiveView, log: :debug

To disable logging for an individual Live View module:

    use Phoenix.LiveView, log: false

## Telemetry

The following `Phoenix.LiveView` and `Phoenix.LiveComponent` events are logged:

  - `[:phoenix, :live_view, :mount, :start]`
  - `[:phoenix, :live_view, :mount, :stop]`
  - `[:phoenix, :live_view, :handle_params, :start]`
  - `[:phoenix, :live_view, :handle_params, :stop]`
  - `[:phoenix, :live_view, :handle_event, :start]`
  - `[:phoenix, :live_view, :handle_event, :stop]`
  - `[:phoenix, :live_component, :handle_event, :start]`
  - `[:phoenix, :live_component, :handle_event, :stop]`

See the [Telemetry](./guides/server/telemetry.md) guide for more information.

## Parameter filtering

If enabled, `Phoenix.LiveView.Logger` will filter parameters based on the configuration of `Phoenix.Logger`.

---

*Consult [api-reference.md](api-reference.md) for complete listing*
