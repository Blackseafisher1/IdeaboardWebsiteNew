# `Plug.Logger`
[🔗](https://github.com/elixir-plug/plug/blob/v1.20.1/lib/plug/logger.ex#L1)

A plug for logging basic request information in the format:

    GET /index.html
    Sent 200 in 572ms

To use it, just plug it into the desired module.

    plug Plug.Logger, log: :debug

## Options

  * `:log` - The log level at which this plug should log its request info.
    Default is `:info`.
    The [list of supported levels](https://hexdocs.pm/logger/Logger.html#module-levels)
    is available in the `Logger` documentation.

---

*Consult [api-reference.md](api-reference.md) for complete listing*
