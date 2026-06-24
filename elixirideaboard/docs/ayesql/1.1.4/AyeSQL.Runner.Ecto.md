# `AyeSQL.Runner.Ecto`
[🔗](https://github.com/alexdesousa/ayesql/blob/v1.1.4/lib/ayesql/runner/ecto.ex#L36)

This module defines `Ecto` default adapter.

Can be used as follows:

```elixir
defmodule MyQueries do
  use AyeSQL, repo: MyRepo

  defqueries("query/my_queries.sql")
end
```

---

*Consult [api-reference.md](api-reference.md) for complete listing*
