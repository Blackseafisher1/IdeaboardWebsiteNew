# `Phoenix.LiveView.Comprehension`
[🔗](https://github.com/phoenixframework/phoenix_live_view/blob/v1.1.28/lib/phoenix_live_view/engine.ex#L54)

The struct returned by for-comprehensions in .heex templates.

# `key`

```elixir
@type key() :: term()
```

# `keyed_render_fun`

```elixir
@type keyed_render_fun() :: (map(), boolean() -&gt; [Phoenix.LiveView.Rendered.dyn()])
```

# `t`

```elixir
@type t() :: %Phoenix.LiveView.Comprehension{
  entries: [{key(), map(), keyed_render_fun()}],
  fingerprint: term(),
  has_key?: boolean(),
  static: [String.t()] | non_neg_integer(),
  stream: list() | nil
}
```

---

*Consult [api-reference.md](api-reference.md) for complete listing*
