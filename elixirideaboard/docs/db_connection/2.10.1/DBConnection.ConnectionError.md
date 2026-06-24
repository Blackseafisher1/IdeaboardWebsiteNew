# `DBConnection.ConnectionError`
[🔗](https://github.com/elixir-ecto/db_connection/blob/v2.10.1/lib/db_connection/connection_error.ex#L1)

A generic connection error exception.

The raised exception might include the reason which would be useful
to programmatically determine what was causing the error.

# `t`
*since 2.7.0* 

```elixir
@type t() :: %DBConnection.ConnectionError{
  __exception__: term(),
  message: String.t(),
  reason: :error | :queue_timeout,
  severity: Logger.level()
}
```

---

*Consult [api-reference.md](api-reference.md) for complete listing*
