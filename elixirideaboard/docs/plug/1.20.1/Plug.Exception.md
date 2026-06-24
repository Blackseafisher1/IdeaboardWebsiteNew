# `Plug.Exception`
[🔗](https://github.com/elixir-plug/plug/blob/v1.20.1/lib/plug/exceptions.ex#L4)

A protocol that extends exceptions to be status-code aware.

By default, it looks for an implementation of the protocol,
otherwise checks if the exception has the `:plug_status` field
or simply returns 500.

# `action`

```elixir
@type action() :: %{label: String.t(), handler: {module(), atom(), list()}}
```

# `t`

```elixir
@type t() :: term()
```

All the types that implement this protocol.

# `actions`

```elixir
@spec actions(t()) :: [action()]
```

Receives an exception and returns the possible actions that could be triggered for that error.
Should return a list of actions in the following structure:

    %{
      label: "Text that will be displayed in the button",
      handler: {Module, :function, [args]}
    }

Where:

  * `label` a string/binary that names this action
  * `handler` a MFArgs that will be executed when this action is triggered

It will be rendered in the `Plug.Debugger` generated error page as buttons showing the `label`
that upon pressing executes the MFArgs defined in the `handler`.

## Examples

    defimpl Plug.Exception, for: ActionableExample do
      def actions(_), do: [%{label: "Print HI", handler: {IO, :puts, ["Hi!"]}}]
    end

# `status`

```elixir
@spec status(t()) :: Plug.Conn.status()
```

Receives an exception and returns its HTTP status code.

---

*Consult [api-reference.md](api-reference.md) for complete listing*
