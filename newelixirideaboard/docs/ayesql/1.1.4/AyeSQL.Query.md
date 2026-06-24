# `AyeSQL.Query`
[🔗](https://github.com/alexdesousa/ayesql/blob/v1.1.4/lib/ayesql/query.ex#L1)

This module defines an AyeSQL query.

# `arguments`

```elixir
@type arguments() :: [term()]
```

Query arguments.

# `statement`

```elixir
@type statement() :: binary()
```

Query statement.

# `t`

```elixir
@type t() :: %AyeSQL.Query{
  arguments: arguments :: arguments(),
  statement: statement :: statement()
}
```

A query type.

# `__struct__`
*struct* 

A query struct.

# `new`

```elixir
@spec new(keyword()) :: t() | no_return()
```

Creates a new query given some `options`.

---

*Consult [api-reference.md](api-reference.md) for complete listing*
