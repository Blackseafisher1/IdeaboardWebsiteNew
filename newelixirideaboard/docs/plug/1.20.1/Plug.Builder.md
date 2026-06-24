# `Plug.Builder`
[🔗](https://github.com/elixir-plug/plug/blob/v1.20.1/lib/plug/builder.ex#L1)

Conveniences for building plugs.

You can use this module to build a plug pipeline:

    defmodule MyApp do
      use Plug.Builder

      plug Plug.Logger
      plug :hello, upper: true

      # A function from another module can be plugged too, provided it's
      # imported into the current module first.
      import AnotherModule, only: [interesting_plug: 2]
      plug :interesting_plug

      def hello(conn, opts) do
        body = if opts[:upper], do: "WORLD", else: "world"
        send_resp(conn, 200, body)
      end
    end

The `plug/2` macro forms a pipeline by defining multiple plugs. Each plug
in the pipeline is executed from top to bottom. In the example above, the
`Plug.Logger` module plug is called before the `:hello` function plug, so
the function plug will be called on the module plug's resulting connection.

`Plug.Builder` imports the `Plug.Conn` module so functions like `send_resp/3`
are available.

## Options

When used, the following options are accepted by `Plug.Builder`:

  * `:init_mode` - the environment to initialize the plug's options, one of
    `:compile` or `:runtime`. The default value is `:compile`.

  * `:log_on_halt` - accepts the level to log whenever the request is halted

  * `:copy_opts_to_assign` - an `atom` representing an assign. When supplied,
    it will copy the options given to the Plug initialization to the given
    connection assign

## Plug behaviour

`Plug.Builder` defines the `init/1` and `call/2` functions by implementing
the `Plug` behaviour.

By implementing the Plug API, `Plug.Builder` guarantees this module is a plug
and can be handed to a web server or used as part of another pipeline.

## Conditional plugs

Sometimes you may want to conditionally invoke a Plug in a pipeline. For example,
you may want to invoke `Plug.Parsers` only under certain routes. This can be done
by wrapping the module plug in a function plug. Instead of:

    plug Plug.Parsers, parsers: [:urlencoded, :multipart], pass: ["text/*"]

You can write:

    plug :conditional_parser

    defp conditional_parser(%Plug.Conn{path_info: ["noparser" | _]} = conn, _opts) do
      conn
    end

    @parser Plug.Parsers.init(parsers: [:urlencoded, :multipart], pass: ["text/*"])
    defp conditional_parser(conn, _opts) do
      Plug.Parsers.call(conn, @parser)
    end

The above will invoke `Plug.Parsers` on all routes, except the ones under `/noparser`

## Overriding the default Plug API functions

Both the `init/1` and `call/2` functions defined by `Plug.Builder` can be
manually overridden. For example, the `init/1` function provided by
`Plug.Builder` returns the options that it receives as an argument, but its
behaviour can be customized:

    defmodule PlugWithCustomOptions do
      use Plug.Builder
      plug Plug.Logger

      def init(opts) do
        opts
      end
    end

The `call/2` function that `Plug.Builder` provides is used internally to
execute all the plugs listed using the `plug` macro, so overriding the
`call/2` function generally implies using `super` in order to still call the
plug chain:

    defmodule PlugWithCustomCall do
      use Plug.Builder
      plug Plug.Logger
      plug Plug.Head

      def call(conn, opts) do
        conn
        |> super(opts) # calls Plug.Logger and Plug.Head
        |> assign(:called_all_plugs, true)
      end
    end

## Halting a plug pipeline

`Plug.Conn.halt/1` halts a plug pipeline. `Plug.Builder` prevents plugs
downstream from being invoked and returns the current connection.
In the following example, the `Plug.Logger` plug never gets
called:

    defmodule PlugUsingHalt do
      use Plug.Builder

      plug :stopper
      plug Plug.Logger

      def stopper(conn, _opts) do
        halt(conn)
      end
    end

## Debugging a pipeline

During development, you may wish to display the current state of the connection
at a certain point in the pipeline. This can be achieved by plugging the `dbg/2`
macro from Elixir. Since it accepts and returns the connection as first argument,
and takes options as the second, it just works:

    defmodule PlugWithDbg do
      use Plug.Builder

      plug Plug.RewriteOn
      plug :dbg
      plug Plug.MethodOverride
      plug :dbg, charlists: :as_lists
    end

# `plug`

```elixir
@type plug() :: module() | atom()
```

# `builder_opts`
*macro* 

> This macro is deprecated. Pass :copy_opts_to_assign on &quot;use Plug.Builder&quot;.

Using `builder_opts/0` is deprecated.

Instead use `:copy_opts_to_assign` on `use Plug.Builder`.

# `compile`

```elixir
@spec compile(Macro.Env.t(), [{plug(), Plug.opts(), Macro.t()}], Keyword.t()) ::
  {Macro.t(), Macro.t()}
```

Compiles a plug pipeline.

Each element of the plug pipeline (according to the type signature of this
function) has the form:

    {plug_name, options, guards}

Note that this function expects a reversed pipeline (with the last plug that
has to be called coming first in the pipeline).

The function returns a tuple with the first element being a quoted reference
to the connection and the second element being the compiled quoted pipeline.

## Examples

    Plug.Builder.compile(env, [
      {Plug.Logger, [], true}, # no guards, as added by the Plug.Builder.plug/2 macro
      {Plug.Head, [], quote(do: a when is_binary(a))}
    ], [])

# `plug`
*macro* 

A macro that stores a new plug. `opts` will be passed unchanged to the new
plug.

This macro doesn't add any guards when adding the new plug to the pipeline;
for more information about adding plugs with guards see `compile/3`.

## Examples

    plug Plug.Logger               # plug module
    plug :foo, some_options: true  # plug function

---

*Consult [api-reference.md](api-reference.md) for complete listing*
