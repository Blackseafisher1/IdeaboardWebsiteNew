# `Plug.Conn.Query`
[🔗](https://github.com/elixir-plug/plug/blob/v1.20.1/lib/plug/conn/query.ex#L1)

Conveniences for decoding and encoding URL-encoded queries.

Plug allows developers to build query strings that map to
Elixir structures in order to make manipulation of such structures
easier on the server side. Here are some examples:

    iex> decode("foo=bar")["foo"]
    "bar"

If a value is given more than once, the last value takes precedence:

    iex> decode("foo=bar&foo=baz")["foo"]
    "baz"

Nested structures can be created via `[key]`:

    iex> decode("foo[bar]=baz")["foo"]["bar"]
    "baz"

Lists are created with `[]`:

    iex> decode("foo[]=bar&foo[]=baz")["foo"]
    ["bar", "baz"]

> #### Nesting inside lists {: .error}
>
> Nesting inside lists is ambiguous and unspecified behaviour.
> Therefore, you should not rely on the decoding behaviour of
> `user[][foo]=1&user[][bar]=2`.
>
> As an alternative, you can explicitly specify the keys:
>
>     # If foo and bar belong to the same entry
>     user[0][foo]=1&user[0][bar]=2
>
>     # If foo and bar are different entries
>     user[0][foo]=1&user[1][bar]=2

Keys without values are treated as empty strings,
according to https://url.spec.whatwg.org/#application/x-www-form-urlencoded:

    iex> decode("foo")["foo"]
    ""

Maps can be encoded:

    iex> encode(%{foo: "bar"})
    "foo=bar"

Encoding keyword lists preserves the order of the fields:

    iex> encode([foo: "bar", baz: "bat"])
    "foo=bar&baz=bat"

When encoding keyword lists with duplicate keys, the key that comes first
takes precedence:

    iex> encode([foo: "bar", foo: "bat"])
    "foo=bar"

Encoding named lists:

    iex> encode(%{foo: ["bar", "baz"]})
    "foo[]=bar&foo[]=baz"

Encoding nested structures:

    iex> encode(%{foo: %{bar: "baz"}})
    "foo[bar]=baz"

It is only possible to encode maps inside lists if those maps have exactly one element.
In this case it is possible to encode the parameters using maps instead of lists:

    iex> encode(%{"list" => [%{"a" => 1, "b" => 2}]})
    ** (ArgumentError) cannot encode maps inside lists when the map has 0 or more than 1 element, got: %{"a" => 1, "b" => 2}

    iex> encode(%{"list" => %{0 => %{"a" => 1, "b" => 2}}})
    "list[0][a]=1&list[0][b]=2"

For stateful decoding, see `decode_init/0`, `decode_each/2`, and `decode_done/2`.

# `decoder`
*since 1.16.0* 

```elixir
@opaque decoder()
```

Stateful decoder accumulator.

See `decode_init/0`, `decode_each/2`, and `decode_done/2`.

# `decode`

```elixir
@spec decode(String.t(), keyword(), module(), boolean()) :: %{
  optional(String.t()) =&gt; term()
}
```

Decodes the given `query`.

The `query` is assumed to be encoded in the "x-www-form-urlencoded" format.
The format is decoded at first. Then, if `validate_utf8` is `true`, the decoded
result is validated for proper UTF-8 encoding. `validate_utf8` may also be
an atom with a custom exception to raise.

`initial` is the initial "accumulator" where decoded values will be added.

`invalid_exception` is the exception module for the exception to raise on
errors with decoding.

# `decode_done`

```elixir
@spec decode_done(decoder(), Enumerable.t()) :: %{optional(String.t()) =&gt; term()}
```

Finishes stateful decoding and returns a map with the decoded pairs.

`decoder` is the stateful decoder returned by `decode_init/0` and `decode_each/2`.
`initial` is an enumerable of key-value pairs that functions as the initial
accumulator for the returned map (see examples below).

## Examples

    iex> decoder = Plug.Conn.Query.decode_init()
    iex> decoder = Plug.Conn.Query.decode_each({"foo", "bar"}, decoder)
    iex> Plug.Conn.Query.decode_done(decoder, %{"initial" => true})
    %{"foo" => "bar", "initial" => true}

# `decode_each`

```elixir
@spec decode_each(
  {term(), term()},
  decoder()
) :: decoder()
```

Decodes the given `pair` tuple.

It parses the key and stores the value into the current
accumulator `decoder`. The keys and values are not assumed to be
encoded in `"x-www-form-urlencoded"`.

## Examples

    iex> decoder = Plug.Conn.Query.decode_init()
    iex> decoder = Plug.Conn.Query.decode_each({"foo", "bar"}, decoder)
    iex> decoder = Plug.Conn.Query.decode_each({"baz", "bat"}, decoder)
    iex> Plug.Conn.Query.decode_done(decoder)
    %{"baz" => "bat", "foo" => "bar"}

# `decode_init`

```elixir
@spec decode_init() :: decoder()
```

Starts a stateful decoder.

Use `decode_each/2` and `decode_done/2` to decode and complete.
See `decode_each/2` for examples.

# `decode_pair`

> This function is deprecated. Use decode_init/0, decode_each/2, and decode_done/2 instead.

Decodes the given tuple and stores it in the given accumulator.

It parses the key and stores the value into the current
accumulator. The keys and values are not assumed to be
encoded in "x-www-form-urlencoded".

Parameter lists are added to the accumulator in reverse
order, so be sure to pass the parameters in reverse order.

# `encode`

```elixir
@spec encode(Enumerable.t(), (term() -&gt; binary())) :: binary()
```

Encodes the given map or list of tuples.

---

*Consult [api-reference.md](api-reference.md) for complete listing*
