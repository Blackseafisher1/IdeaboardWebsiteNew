# `MyXQL.Error`
[🔗](https://github.com/elixir-ecto/myxql/blob/v0.9.0/lib/myxql/error.ex#L1)

# `t`

```elixir
@type t() :: %MyXQL.Error{
  __exception__: true,
  connection_id: non_neg_integer() | nil,
  message: String.t(),
  mysql: %{code: integer(), name: atom() | nil} | nil,
  statement: iodata() | nil
}
```

---

*Consult [api-reference.md](api-reference.md) for complete listing*
