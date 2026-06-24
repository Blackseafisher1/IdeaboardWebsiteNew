# `MyXQL.GeometryCodec`
[🔗](https://github.com/elixir-ecto/myxql/blob/v0.9.0/lib/myxql/protocol/geometry_codec.ex#L1)

Contract for encoding/decoding geometry types.

See "Geometry Support" section in the README for more information.

# `no_srid`

```elixir
@type no_srid() :: 0
```

# `some_srid`

```elixir
@type some_srid() :: pos_integer()
```

# `decode`

```elixir
@callback decode(srid :: no_srid() | some_srid(), wkb :: binary()) :: struct() | :unknown
```

# `encode`

```elixir
@callback encode(struct()) :: {srid :: integer(), wkb :: binary()} | :unknown
```

---

*Consult [api-reference.md](api-reference.md) for complete listing*
