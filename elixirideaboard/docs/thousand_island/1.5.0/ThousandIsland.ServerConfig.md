# `ThousandIsland.ServerConfig`
[🔗](https://github.com/mtrudel/thousand_island/blob/main/lib/thousand_island/server_config.ex#L1)

Encapsulates the configuration of a ThousandIsland server instance

This is used internally by `ThousandIsland.Handler`

# `t`

```elixir
@type t() :: %ThousandIsland.ServerConfig{
  genserver_options: GenServer.options(),
  handler_module: module(),
  handler_options: term(),
  max_connections_retry_count: non_neg_integer(),
  max_connections_retry_wait: timeout(),
  num_acceptors: pos_integer(),
  num_connections: non_neg_integer() | :infinity,
  num_listen_sockets: pos_integer(),
  port: :inet.port_number(),
  read_timeout: timeout(),
  shutdown_timeout: timeout(),
  silent_terminate_on_error: boolean(),
  supervisor_options: [Supervisor.option()],
  transport_module: ThousandIsland.transport_module(),
  transport_options: ThousandIsland.transport_options()
}
```

A set of configuration parameters for a ThousandIsland server instance

# `new`

```elixir
@spec new(ThousandIsland.options()) :: t()
```

---

*Consult [api-reference.md](api-reference.md) for complete listing*
