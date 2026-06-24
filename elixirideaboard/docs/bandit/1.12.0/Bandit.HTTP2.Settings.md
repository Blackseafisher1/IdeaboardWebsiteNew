# `Bandit.HTTP2.Settings`
[🔗](https://github.com/mtrudel/bandit/blob/main/lib/bandit/http2/settings.ex#L1)

Settings as defined in RFC9113§6.5.2

# `t`

```elixir
@type t() :: %Bandit.HTTP2.Settings{
  header_table_size: non_neg_integer(),
  initial_window_size: non_neg_integer(),
  max_concurrent_streams: non_neg_integer() | :infinity,
  max_frame_size: non_neg_integer(),
  max_header_list_size: non_neg_integer() | :infinity
}
```

A collection of settings as defined in RFC9113§6.5

---

*Consult [api-reference.md](api-reference.md) for complete listing*
