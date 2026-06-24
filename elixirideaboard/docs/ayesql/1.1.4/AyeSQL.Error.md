# `AyeSQL.Error`
[🔗](https://github.com/alexdesousa/ayesql/blob/v1.1.4/lib/ayesql/error.ex#L1)

This module defines an AyeSQL error.

# `arguments`

```elixir
@type arguments() :: [term()]
```

Query arguments.

# `errors`

```elixir
@type errors() :: [AyeSQL.AST.Context.error()]
```

Query errors.

# `statement`

```elixir
@type statement() :: binary()
```

Query statement.

# `t`

```elixir
@type t() :: %AyeSQL.Error{
  arguments: arguments :: arguments(),
  errors: errors :: errors(),
  statement: statement :: statement()
}
```

An error type.

# `__struct__`
*struct* 

A query struct.

# `new`

```elixir
@spec new(keyword()) :: t() | no_return()
```

Creates a new error given some `options`.

---

*Consult [api-reference.md](api-reference.md) for complete listing*
