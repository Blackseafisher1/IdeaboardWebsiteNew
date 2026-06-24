# `Bandit.PhoenixAdapter`
[🔗](https://github.com/mtrudel/bandit/blob/main/lib/bandit/phoenix_adapter.ex#L1)

A Bandit adapter for Phoenix.

This adapter provides out-of-the-box support for all aspects of Phoenix 1.7 and later. Earlier
versions of Phoenix will work with this adapter, but without support for WebSockets.

To use this adapter, your project will need to include Bandit as a dependency:

```elixir
{:bandit, "~> 1.0"}
```

Once Bandit is included as a dependency of your Phoenix project, add the following `adapter:`
line to your endpoint configuration in `config/config.exs`, as in the following example:

```
# config/config.exs

config :your_app, YourAppWeb.Endpoint,
  adapter: Bandit.PhoenixAdapter, # <---- ADD THIS LINE
  url: [host: "localhost"],
  render_errors: ...
```

That's it! **After restarting Phoenix you should see the startup message indicate that it is being
served by Bandit**, and everything should 'just work'. Note that if you have set any exotic
configuration options within your endpoint, you may need to update that configuration to work
with Bandit; see below for details.

## Endpoint configuration

This adapter supports the standard Phoenix structure for endpoint configuration. Top-level keys for
`:http` and `:https` are supported, and configuration values within each of those are interpreted
as raw Bandit configuration as specified by `t:Bandit.options/0`. Bandit's configuration supports
all values used in a standard out-of-the-box Phoenix application, so if you haven't made any
substantial changes to your endpoint configuration things should 'just work' for you.

In the event that you *have* made advanced changes to your endpoint configuration, you may need
to update this config to work with Bandit. Consult Bandit's documentation at
`t:Bandit.options/0` for details.

It can be difficult to know exactly *where* to put the options that you may need to set from the
ones available at `t:Bandit.options/0`. The general idea is that anything inside the `http:` or
`https:` keyword lists in your configuration are passed directly to `Bandit.start_link/1`, so an
example may look like so:

```elixir
# config/{dev,prod,etc}.exs

config :your_app, YourAppWeb.Endpoint,
  http: [
    ip: {127, 0, 0, 1},
    port: 4000,
    thousand_island_options: [num_acceptors: 123],
    http_options: [log_protocol_errors: false],
    http_1_options: [max_requests: 1],
    websocket_options: [compress: false]
  ],
```

Note that, unlike the `adapter: Bandit.PhoenixAdapter` configuration change outlined previously,
configuration of specific `http:` and `https:` values is done on a per-environment basis in
Phoenix, so these changes will typically be in your `config/dev.exs`, `config/prod.exs` and
similar files.

# `bandit_pid`

Returns the Bandit server process for the provided scheme within the given Phoenix Endpoint

# `server_info`

Returns the bound address and port of the Bandit server process for the provided
scheme within the given Phoenix Endpoint

---

*Consult [api-reference.md](api-reference.md) for complete listing*
