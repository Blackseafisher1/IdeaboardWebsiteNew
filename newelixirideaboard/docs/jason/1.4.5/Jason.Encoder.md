# `Jason.Encoder`
[🔗](https://github.com/michalmuskala/jason/blob/v1.4.5/lib/encoder.ex#L1)

Protocol controlling how a value is encoded to JSON.

## Deriving

The protocol allows leveraging the Elixir's `@derive` feature
to simplify protocol implementation in trivial cases. Accepted
options are:

  * `:only` - encodes only values of specified keys.
  * `:except` - encodes all struct fields except specified keys.

By default all keys except the `:__struct__` key are encoded.

## Example

Let's assume a presence of the following struct:

    defmodule Test do
      defstruct [:foo, :bar, :baz]
    end

If we were to call `@derive Jason.Encoder` just before `defstruct`,
an implementation similar to the following implementation would be generated:

    defimpl Jason.Encoder, for: Test do
      def encode(value, opts) do
        Jason.Encode.map(Map.take(value, [:foo, :bar, :baz]), opts)
      end
    end

If we called `@derive {Jason.Encoder, only: [:foo]}`, an implementation
similar to the following implementation would be generated:

    defimpl Jason.Encoder, for: Test do
      def encode(value, opts) do
        Jason.Encode.map(Map.take(value, [:foo]), opts)
      end
    end

If we called `@derive {Jason.Encoder, except: [:foo]}`, an implementation
similar to the following implementation would be generated:

    defimpl Jason.Encoder, for: Test do
      def encode(value, opts) do
        Jason.Encode.map(Map.take(value, [:bar, :baz]), opts)
      end
    end

The actually generated implementations are more efficient computing some data
during compilation similar to the macros from the `Jason.Helpers` module.

## Explicit implementation

If you wish to implement the protocol fully yourself, it is advised to
use functions from the `Jason.Encode` module to do the actual iodata
generation - they are highly optimized and verified to always produce
valid JSON.

# `opts`

```elixir
@type opts() :: Jason.Encode.opts()
```

# `t`

```elixir
@type t() :: term()
```

# `encode`

```elixir
@spec encode(t(), opts()) :: iodata()
```

Encodes `value` to JSON.

The argument `opts` is opaque - it can be passed to various functions in
`Jason.Encode` (or to the protocol function itself) for encoding values to JSON.

---

*Consult [api-reference.md](api-reference.md) for complete listing*
