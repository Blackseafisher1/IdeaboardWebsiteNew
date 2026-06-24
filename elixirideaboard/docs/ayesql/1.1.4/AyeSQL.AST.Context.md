# `AyeSQL.AST.Context`
[🔗](https://github.com/alexdesousa/ayesql/blob/v1.1.4/lib/ayesql/ast/context.ex#L1)

This module defines an AST context.

# `arguments`

```elixir
@type arguments() :: [term()]
```

Argument list.

# `error`

```elixir
@type error() :: {AyeSQL.Core.parameter_name(), error_type()}
```

Error.

# `error_type`

```elixir
@type error_type() :: :not_found
```

Error type.

# `index`

```elixir
@type index() :: non_neg_integer()
```

Current context index.

# `statement`

```elixir
@type statement() :: [binary()]
```

Accumulated statement.

# `t`

```elixir
@type t() :: %AyeSQL.AST.Context{
  arguments: arguments :: arguments(),
  errors: errors :: [error()],
  index: index :: index(),
  statement: statement :: statement()
}
```

AST context.

# `__struct__`
*struct* 

AST context struct.

# `add_index`

```elixir
@spec add_index(t(), non_neg_integer()) :: t()
```

Adds a `value` to the `context` index.

# `id`

```elixir
@spec id(t()) :: t()
```

Context id function.

# `merge`

```elixir
@spec merge(t(), t()) :: t()
```

Merges two contexts.

# `merge_error`

```elixir
@spec merge_error(t(), AyeSQL.Error.t()) :: t()
```

Merges a `context` with an `error`

# `merge_query`

```elixir
@spec merge_query(t(), AyeSQL.Query.t()) :: t()
```

Merges a `context` with a `query`.

# `new`

```elixir
@spec new(keyword()) :: t() | no_return()
```

Creates a new context given some `options`.

# `not_found`

```elixir
@spec not_found(t(), AyeSQL.Core.parameter_name()) :: t()
```

Updates `context` with the error not found for a `key`.

# `put_argument`

```elixir
@spec put_argument(t(), term()) :: t()
```

Adds arguments in a `context` given a new `value`.

# `put_statement`

```elixir
@spec put_statement(t(), nil | binary()) :: t()
```

Adds statement in a `context` given a new `value`.

# `put_variable`

```elixir
@spec put_variable(t(), term()) :: t()
```

Puts a new variable `value` in the `context`.

# `put_variables`

```elixir
@spec put_variables(t(), [term()]) :: t()
```

Puts several variable `value` in the `context` as an SQL list.

# `to_query`

```elixir
@spec to_query(t()) :: {:ok, AyeSQL.Query.t()} | {:error, AyeSQL.Error.t()}
```

Transforms a context to a query.

---

*Consult [api-reference.md](api-reference.md) for complete listing*
