# `AyeSQL.Runner.Postgrex`
[🔗](https://github.com/alexdesousa/ayesql/blob/v1.1.4/lib/ayesql/runner/postgrex.ex#L31)

This module defines `Postgrex` default adapter.

Can be used as follows:

```elixir
defmodule MyQueries do
  use AyeSQL,
    runner: AyeSQL.Runner.Postgrex

  defqueries("query/my_queries.sql")
end
```

And given a `connection` to the database, then it can be used with the
query options:

```elixir
iex> MyQueries.get_user([id: id], conn: connection)
{:ok, ...}
```

---

*Consult [api-reference.md](api-reference.md) for complete listing*
