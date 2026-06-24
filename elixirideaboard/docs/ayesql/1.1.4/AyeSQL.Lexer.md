# `AyeSQL.Lexer`
[🔗](https://github.com/alexdesousa/ayesql/blob/v1.1.4/lib/ayesql/lexer.ex#L1)

This module defines the lexer for the `AyeSQL` language.

# `column`

```elixir
@type column() :: pos_integer()
```

Column number.

# `line`

```elixir
@type line() :: pos_integer()
```

Line number.

# `location`

```elixir
@type location() :: {line(), column()}
```

Location.

# `option`

```elixir
@type option() :: {:error_context, pos_integer()} | {:filename, Path.t()}
```

Lexer option.

# `options`

```elixir
@type options() :: [option()]
```

Lexer options.

# `original`

```elixir
@type original() :: binary()
```

Original match from the string.

# `token`

```elixir
@type token() :: {token_name(), line(), {value(), original(), location()}}
```

Token.

# `token_name`

```elixir
@type token_name() :: :&quot;$name&quot; | :&quot;$docs&quot; | :&quot;$fragment&quot; | :&quot;$named_param&quot;
```

Token name.

# `tokens`

```elixir
@type tokens() :: [token()]
```

Tokens.

# `value`

```elixir
@type value() :: binary()
```

Token value.

# `tokenize`

```elixir
@spec tokenize(binary(), options()) :: tokens() | no_return()
```

Gets tokens from the `contents` of a string.

---

*Consult [api-reference.md](api-reference.md) for complete listing*
