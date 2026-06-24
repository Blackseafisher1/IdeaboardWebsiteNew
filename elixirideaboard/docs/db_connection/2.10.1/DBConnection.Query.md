# `DBConnection.Query`
[🔗](https://github.com/elixir-ecto/db_connection/blob/v2.10.1/lib/db_connection/query.ex#L1)

The `DBConnection.Query` protocol is responsible for preparing and
encoding queries.

All `DBConnection.Query` functions are executed in the caller process which
means it's safe to, for example, raise exceptions or do blocking calls as
they won't affect the connection process.

# `t`

```elixir
@type t() :: term()
```

All the types that implement this protocol.

# `decode`

```elixir
@spec decode(any(), any(), Keyword.t()) :: any()
```

Decode a result using a query.

This function is called to decode a result after it is returned by a
connection callback module.

See `DBConnection.execute/3`.

# `describe`

```elixir
@spec describe(any(), Keyword.t()) :: any()
```

Describe a query.

This function is called to describe a query after it is prepared using a
connection callback module.

See `DBConnection.prepare/3`.

# `encode`

```elixir
@spec encode(any(), any(), Keyword.t()) :: any()
```

Encode parameters using a query.

This function is called to encode a query before it is executed using a
connection callback module.

If this function raises `DBConnection.EncodeError`, then the query is
prepared once again.

See `DBConnection.execute/3`.

# `parse`

```elixir
@spec parse(any(), Keyword.t()) :: any()
```

Parse a query.

This function is called to parse a query term before it is prepared using a
connection callback module.

See `DBConnection.prepare/3`.

---

*Consult [api-reference.md](api-reference.md) for complete listing*
