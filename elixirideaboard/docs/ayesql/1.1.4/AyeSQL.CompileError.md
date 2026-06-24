# `AyeSQL.CompileError`
[🔗](https://github.com/alexdesousa/ayesql/blob/v1.1.4/lib/ayesql/compile_error.ex#L1)

This module defines an AyeSQL compile error exception.

# `t`

```elixir
@type t() :: %AyeSQL.CompileError{
  __exception__: true,
  __metadata__: term(),
  column: column_number :: AyeSQL.Lexer.column(),
  contents: term(),
  context: context :: non_neg_integer(),
  filename: filename :: binary(),
  header: header :: binary(),
  line: line_number :: AyeSQL.Lexer.line()
}
```

A compile error.

# `__struct__`
*struct* 

A compiler error.

---

*Consult [api-reference.md](api-reference.md) for complete listing*
