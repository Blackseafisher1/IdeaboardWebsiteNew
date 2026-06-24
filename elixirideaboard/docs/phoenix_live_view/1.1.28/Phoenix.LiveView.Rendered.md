# `Phoenix.LiveView.Rendered`
[🔗](https://github.com/phoenixframework/phoenix_live_view/blob/v1.1.28/lib/phoenix_live_view/engine.ex#L100)

The struct returned by .heex templates.

See a description about its fields and use cases
in `Phoenix.LiveView.Engine` docs.

# `dyn`

```elixir
@type dyn() ::
  nil
  | iodata()
  | t()
  | Phoenix.LiveView.Comprehension.t()
  | Phoenix.LiveView.Component.t()
```

# `t`

```elixir
@type t() :: %Phoenix.LiveView.Rendered{
  caller:
    :not_available
    | {module(), function :: {atom(), non_neg_integer()}, file :: String.t(),
       line :: pos_integer()},
  dynamic: (boolean() -&gt; [dyn()]),
  fingerprint: integer(),
  root: nil | true | false,
  static: [String.t()]
}
```

---

*Consult [api-reference.md](api-reference.md) for complete listing*
