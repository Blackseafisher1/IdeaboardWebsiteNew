# `ThousandIsland.HandlerConfig`
[🔗](https://github.com/mtrudel/thousand_island/blob/main/lib/thousand_island/handler_config.ex#L1)

A minimal config struct containing only the fields needed by connection handlers.

This is used internally by `ThousandIsland.Handler`

# `t`

```elixir
@type t() :: %ThousandIsland.HandlerConfig{
  handler_module: nil,
  read_timeout: timeout(),
  silent_terminate_on_error: boolean(),
  transport_module: module()
}
```

# `from_server_config`

```elixir
@spec from_server_config(ThousandIsland.ServerConfig.t()) :: t()
```

Creates a HandlerConfig from a ServerConfig, extracting only the fields needed
by connection handlers. This should be called once per acceptor at initialization.

---

*Consult [api-reference.md](api-reference.md) for complete listing*
