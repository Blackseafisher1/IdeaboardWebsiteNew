# `AyeSQL.AST`
[🔗](https://github.com/alexdesousa/ayesql/blob/v1.1.4/lib/ayesql/ast.ex#L1)

This module defines function for expanding the AST.

# `expand_function`

```elixir
@type expand_function() :: (AyeSQL.AST.Context.t(), AyeSQL.Core.parameters() -&gt;
                        AyeSQL.AST.Context.t())
```

Function to be applied with some parameters and context.

---

*Consult [api-reference.md](api-reference.md) for complete listing*
