# `Jason.Encode`
[🔗](https://github.com/michalmuskala/jason/blob/v1.4.5/lib/encode.ex#L14)

Utilities for encoding elixir values to JSON.

# `opts`

```elixir
@opaque opts()
```

# `atom`

```elixir
@spec atom(atom(), opts()) :: iodata()
```

# `float`

```elixir
@spec float(float()) :: iodata()
```

# `integer`

```elixir
@spec integer(integer()) :: iodata()
```

# `keyword`

```elixir
@spec keyword(
  keyword(),
  opts()
) :: iodata()
```

# `list`

```elixir
@spec list(list(), opts()) :: iodata()
```

# `map`

```elixir
@spec map(map(), opts()) :: iodata()
```

# `string`

```elixir
@spec string(String.t(), opts()) :: iodata()
```

# `struct`

```elixir
@spec struct(
  struct(),
  opts()
) :: iodata()
```

# `value`

```elixir
@spec value(term(), opts()) :: iodata()
```

Equivalent to calling the `Jason.Encoder.encode/2` protocol function.

Slightly more efficient for built-in types because of the internal dispatching.

---

*Consult [api-reference.md](api-reference.md) for complete listing*
