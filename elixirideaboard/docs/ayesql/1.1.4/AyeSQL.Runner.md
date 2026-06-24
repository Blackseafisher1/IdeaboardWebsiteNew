# `AyeSQL.Runner`
[🔗](https://github.com/alexdesousa/ayesql/blob/v1.1.4/lib/ayesql/runner.ex#L1)

This module defines an `AyeSQL.Runner`.

# `run`

```elixir
@callback run(query :: AyeSQL.Query.t(), options :: keyword()) ::
  {:ok, term()} | {:error, term()}
```

Callback to initialize the runner.

# `__using__`
*macro* 

Uses the `AyeSQL.Runner` behaviour.

---

*Consult [api-reference.md](api-reference.md) for complete listing*
