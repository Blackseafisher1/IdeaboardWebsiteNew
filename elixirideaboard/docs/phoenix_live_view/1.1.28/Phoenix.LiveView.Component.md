# `Phoenix.LiveView.Component`
[🔗](https://github.com/phoenixframework/phoenix_live_view/blob/v1.1.28/lib/phoenix_live_view/engine.ex#L1)

The struct returned by components in .heex templates.

This component is never meant to be output directly
into the template. It should always be handled by
the diffing algorithm.

# `t`

```elixir
@type t() :: %Phoenix.LiveView.Component{
  assigns: map(),
  component: module(),
  id: binary()
}
```

---

*Consult [api-reference.md](api-reference.md) for complete listing*
