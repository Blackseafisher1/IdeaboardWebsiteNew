# `Jason.Helpers`
[🔗](https://github.com/michalmuskala/jason/blob/v1.4.5/lib/helpers.ex#L1)

Provides macro facilities for partial compile-time encoding of JSON.

# `json_map`
*macro* 

Encodes a JSON map from a compile-time keyword.

Encodes the keys at compile time and strives to create as flat iodata
structure as possible to achieve maximum efficiency. Does encoding
right at the call site, but returns an `%Jason.Fragment{}` struct
that needs to be passed to one of the "main" encoding functions -
for example `Jason.encode/2` for final encoding into JSON - this
makes it completely transparent for most uses.

Only allows keys that do not require escaping in any of the supported
encoding modes. This means only ASCII characters from the range
0x1F..0x7F excluding '\', '/' and '"' are allowed - this also excludes
all control characters like newlines.

Preserves the order of the keys.

## Example

    iex> fragment = json_map(foo: 1, bar: 2)
    iex> Jason.encode!(fragment)
    "{\"foo\":1,\"bar\":2}"

# `json_map_take`
*macro* 

Encodes a JSON map from a variable containing a map and a compile-time
list of keys.

It is equivalent to calling `Map.take/2` before encoding. Otherwise works
similar to `json_map/2`.

## Example

    iex> map = %{a: 1, b: 2, c: 3}
    iex> fragment = json_map_take(map, [:c, :b])
    iex> Jason.encode!(fragment)
    "{\"c\":3,\"b\":2}"

---

*Consult [api-reference.md](api-reference.md) for complete listing*
