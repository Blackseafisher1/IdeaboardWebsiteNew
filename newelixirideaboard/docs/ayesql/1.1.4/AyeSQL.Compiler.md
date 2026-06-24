# `AyeSQL.Compiler`
[🔗](https://github.com/alexdesousa/ayesql/blob/v1.1.4/lib/ayesql/compiler.ex#L1)

This module defines functions to compile `AyeSQL` language strings.

# `docs`

```elixir
@type docs() :: nil | binary()
```

Query documentation.

# `fragment`

```elixir
@type fragment() :: binary()
```

Query fragment.

# `fragments`

```elixir
@type fragments() :: [fragment() | param()]
```

Query fragments.

# `name`

```elixir
@type name() :: nil | atom()
```

Query name.

# `param`

```elixir
@type param() :: atom()
```

Query parameter.

# `queries`

```elixir
@type queries() :: [query()]
```

Queries.

# `query`

```elixir
@type query() :: {name(), docs(), fragments()}
```

Query.

# `compile_queries`

```elixir
@spec compile_queries(binary(), AyeSQL.Lexer.options()) :: [Macro.t()] | no_return()
```

Compiles the `contents` of a file or string into valid AyeSQL queries.

# `compile_query`

```elixir
@spec compile_query(binary(), AyeSQL.Lexer.options()) :: Macro.t() | no_return()
```

Compiles a single query from the `contents` of a string.

# `eval_query`

```elixir
@spec eval_query(binary(), AyeSQL.Lexer.options()) ::
  (AyeSQL.Core.parameters(), AyeSQL.Core.options() -&gt;
     {:ok, AyeSQL.Query.t() | term()} | {:error, AyeSQL.Error.t() | term()})
  | no_return()
```

Evaluates the `contents` of a string to an anonymous function with a query
that receives parameters and options.

---

*Consult [api-reference.md](api-reference.md) for complete listing*
