# AyeSQL v1.1.4 - API Reference

## Modules

- AyeSQL
  - [AyeSQL](AyeSQL.md): _AyeSQL_ is a library for using raw SQL.

- AyeSQL Interpreter
  - [AyeSQL.Core](AyeSQL.Core.md): This module defines the core functionality for AyeSQL.

  - [AyeSQL.Error](AyeSQL.Error.md): This module defines an AyeSQL error.

  - [AyeSQL.Query](AyeSQL.Query.md): This module defines an AyeSQL query.

- AyeSQL Compiler
  - [AyeSQL.AST](AyeSQL.AST.md): This module defines function for expanding the AST.

  - [AyeSQL.AST.Context](AyeSQL.AST.Context.md): This module defines an AST context.

  - [AyeSQL.Compiler](AyeSQL.Compiler.md): This module defines functions to compile `AyeSQL` language strings.

  - [AyeSQL.Lexer](AyeSQL.Lexer.md): This module defines the lexer for the `AyeSQL` language.

- AyeSQL runners
  - [AyeSQL.Runner](AyeSQL.Runner.md): This module defines an `AyeSQL.Runner`.

  - [AyeSQL.Runner.Duckdbex](AyeSQL.Runner.Duckdbex.md): This module defines `Duckdbex` default adapter.
  - [AyeSQL.Runner.Ecto](AyeSQL.Runner.Ecto.md): This module defines `Ecto` default adapter.
  - [AyeSQL.Runner.Postgrex](AyeSQL.Runner.Postgrex.md): This module defines `Postgrex` default adapter.

- Exceptions
  - [AyeSQL.CompileError](AyeSQL.CompileError.md): This module defines an AyeSQL compile error exception.

