# `Plug`
[🔗](https://github.com/elixir-plug/plug/blob/v1.20.1/lib/plug.ex#L1)

The plug specification.

## Types of plugs

There are two kinds of plugs: function plugs and module plugs.

### Function plugs

A function plug is by definition any function that receives a connection
and a set of options and returns a connection. Function plugs must have
the following type signature:

    (Plug.Conn.t, Plug.opts) :: Plug.Conn.t

### Module plugs

A module plug is an extension of the function plug. It is a module that must
export:

  * a `c:call/2` function with the signature defined above
  * an `c:init/1` function which takes a set of options and initializes it.

The result returned by `c:init/1` is passed as second argument to `c:call/2`. Note
that `c:init/1` may be called during compilation and as such it must not return
pids, ports or values that are specific to the runtime.

The API expected by a module plug is defined as a behaviour by the
`Plug` module (this module).

## Examples

Here's an example of a function plug:

    def json_header_plug(conn, _opts) do
      Plug.Conn.put_resp_content_type(conn, "application/json")
    end

Here's an example of a module plug:

    defmodule JSONHeaderPlug do
      @behaviour Plug

      import Plug.Conn

      def init(opts) do
        opts
      end

      def call(conn, _opts) do
        put_resp_content_type(conn, "application/json")
      end
    end

## The Plug pipeline

The `Plug.Builder` module provides conveniences for building plug pipelines.

# `opts`

```elixir
@type opts() ::
  binary()
  | tuple()
  | atom()
  | integer()
  | float()
  | [opts()]
  | %{optional(opts()) =&gt; opts()}
  | MapSet.t()
```

# `call`

```elixir
@callback call(conn :: Plug.Conn.t(), opts()) :: Plug.Conn.t()
```

# `init`

```elixir
@callback init(opts()) :: opts()
```

# `forward`

```elixir
@spec forward(Plug.Conn.t(), [String.t()], atom(), opts()) :: Plug.Conn.t()
```

Forwards requests to another plug while setting the connection to a trailing subpath of the request.

The `path_info` on the forwarded connection will only include the request path trailing segments
supplied to the `forward` function. The `conn.script_name` attribute retains the correct base path,
e.g., url generation.

## Example

    defmodule Router do
      @behaviour Plug

      def init(opts), do: opts

      def call(conn, opts) do
        case conn do
          # Match subdomain
          %{host: "admin." <> _} ->
            AdminRouter.call(conn, opts)

          # Match path on localhost
          %{host: "localhost", path_info: ["admin" | rest]} ->
            Plug.forward(conn, rest, AdminRouter, opts)

          _ ->
            MainRouter.call(conn, opts)
        end
      end
    end

# `run`

```elixir
@spec run(
  Plug.Conn.t(),
  [{module(), opts()} | (Plug.Conn.t() -&gt; Plug.Conn.t())],
  Keyword.t()
) ::
  Plug.Conn.t()
```

Run a series of plugs at runtime.

The plugs given here can be either a tuple, representing a module plug
and its options, or a simple function that receives a connection and
returns a connection.

If any plug halts, the connection won't invoke the remaining plugs. If the
given connection was already halted, none of the plugs are invoked either.

While `Plug.Builder` is designed to operate at compile-time, the `run` function
serves as a straightforward alternative for runtime executions.

## Examples

    Plug.run(conn, [{Plug.Head, []}, &IO.inspect/1])

## Options

  * `:log_on_halt` - a log level to be used if a plug halts

---

*Consult [api-reference.md](api-reference.md) for complete listing*
