# `Jason`
[🔗](https://github.com/michalmuskala/jason/blob/v1.4.5/lib/jason.ex#L1)

A blazing fast JSON parser and generator in pure Elixir.

# `decode_opt`

```elixir
@type decode_opt() ::
  {:keys, keys()}
  | {:strings, strings()}
  | {:floats, floats()}
  | {:objects, objects()}
```

# `encode_opt`

```elixir
@type encode_opt() ::
  {:escape, escape()}
  | {:maps, maps()}
  | {:pretty, boolean() | Jason.Formatter.opts()}
```

# `escape`

```elixir
@type escape() :: :json | :unicode_safe | :html_safe | :javascript_safe
```

# `floats`

```elixir
@type floats() :: :native | :decimals
```

# `keys`

```elixir
@type keys() :: :atoms | :atoms! | :strings | :copy | (String.t() -&gt; term())
```

# `maps`

```elixir
@type maps() :: :naive | :strict
```

# `objects`

```elixir
@type objects() :: :maps | :ordered_objects
```

# `strings`

```elixir
@type strings() :: :reference | :copy
```

# `decode`

```elixir
@spec decode(iodata(), [decode_opt()]) ::
  {:ok, term()} | {:error, Jason.DecodeError.t()}
```

Parses a JSON value from `input` iodata.

## Options

  * `:keys` - controls how keys in objects are decoded. Possible values are:

    * `:strings` (default) - decodes keys as binary strings,
    * `:atoms` - keys are converted to atoms using `String.to_atom/1`,
    * `:atoms!` - keys are converted to atoms using `String.to_existing_atom/1`,
    * custom decoder - additionally a function accepting a string and returning a key
      is accepted.

  * `:strings` - controls how strings (including keys) are decoded. Possible values are:

    * `:reference` (default) - when possible tries to create a sub-binary into the original
    * `:copy` - always copies the strings. This option is especially useful when parts of the
      decoded data will be stored for a long time (in ets or some process) to avoid keeping
      the reference to the original data.

  * `:floats` - controls how floats are decoded. Possible values are:

    * `:native` (default) - Native conversion from binary to float using `:erlang.binary_to_float/1`,
    * `:decimals` - uses `Decimal.new/1` to parse the binary into a Decimal struct with arbitrary precision.

  * `:objects` - controls how objects are decoded. Possible values are:

    * `:maps` (default) - objects are decoded as maps
    * `:ordered_objects` - objects are decoded as `Jason.OrderedObject` structs

## Decoding keys to atoms

The `:atoms` option uses the `String.to_atom/1` call that can create atoms at runtime.
Since the atoms are not garbage collected, this can pose a DoS attack vector when used
on user-controlled data.

## Examples

    iex> Jason.decode("{}")
    {:ok, %{}}

    iex> Jason.decode("invalid")
    {:error, %Jason.DecodeError{data: "invalid", position: 0, token: nil}}

# `decode!`

```elixir
@spec decode!(iodata(), [decode_opt()]) :: term() | no_return()
```

Parses a JSON value from `input` iodata.

Similar to `decode/2` except it will unwrap the error tuple and raise
in case of errors.

## Examples

    iex> Jason.decode!("{}")
    %{}

    iex> Jason.decode!("invalid")
    ** (Jason.DecodeError) unexpected byte at position 0: 0x69 ("i")

# `encode`

```elixir
@spec encode(term(), [encode_opt()]) ::
  {:ok, String.t()} | {:error, Jason.EncodeError.t() | Exception.t()}
```

Generates JSON corresponding to `input`.

The generation is controlled by the `Jason.Encoder` protocol,
please refer to the module to read more on how to define the protocol
for custom data types.

## Options

  * `:escape` - controls how strings are encoded. Possible values are:

    * `:json` (default) - the regular JSON escaping as defined by RFC 7159.
    * `:javascript_safe` - additionally escapes the LINE SEPARATOR (U+2028)
      and PARAGRAPH SEPARATOR (U+2029) characters to make the produced JSON
      valid JavaScript.
    * `:html_safe` - similar to `:javascript_safe`, but also escapes the `/`
      character to prevent XSS.
    * `:unicode_safe` - escapes all non-ascii characters.

  * `:maps` - controls how maps are encoded. Possible values are:

    * `:strict` - checks the encoded map for duplicate keys and raises
      if they appear. For example `%{:foo => 1, "foo" => 2}` would be
      rejected, since both keys would be encoded to the string `"foo"`.
    * `:naive` (default) - does not perform the check.

  * `:pretty` - controls pretty printing of the output. Possible values are:

    * `true` to pretty print with default configuration
    * a keyword of options as specified by `Jason.Formatter.pretty_print/2`.

## Examples

    iex> Jason.encode(%{a: 1})
    {:ok, ~S|{"a":1}|}

    iex> Jason.encode("\xFF")
    {:error, %Jason.EncodeError{message: "invalid byte 0xFF in <<255>>"}}

# `encode!`

```elixir
@spec encode!(term(), [encode_opt()]) :: String.t() | no_return()
```

Generates JSON corresponding to `input`.

Similar to `encode/1` except it will unwrap the error tuple and raise
in case of errors.

## Examples

    iex> Jason.encode!(%{a: 1})
    ~S|{"a":1}|

    iex> Jason.encode!("\xFF")
    ** (Jason.EncodeError) invalid byte 0xFF in <<255>>

# `encode_to_iodata`

```elixir
@spec encode_to_iodata(term(), [encode_opt()]) ::
  {:ok, iodata()} | {:error, Jason.EncodeError.t() | Exception.t()}
```

Generates JSON corresponding to `input` and returns iodata.

This function should be preferred to `encode/2`, if the generated
JSON will be handed over to one of the IO functions or sent
over the socket. The Erlang runtime is able to leverage vectorised
writes and avoid allocating a continuous buffer for the whole
resulting string, lowering memory use and increasing performance.

## Examples

    iex> {:ok, iodata} = Jason.encode_to_iodata(%{a: 1})
    iex> IO.iodata_to_binary(iodata)
    ~S|{"a":1}|

    iex> Jason.encode_to_iodata("\xFF")
    {:error, %Jason.EncodeError{message: "invalid byte 0xFF in <<255>>"}}

# `encode_to_iodata!`

```elixir
@spec encode_to_iodata!(term(), [encode_opt()]) :: iodata() | no_return()
```

Generates JSON corresponding to `input` and returns iodata.

Similar to `encode_to_iodata/1` except it will unwrap the error tuple
and raise in case of errors.

## Examples

    iex> iodata = Jason.encode_to_iodata!(%{a: 1})
    iex> IO.iodata_to_binary(iodata)
    ~S|{"a":1}|

    iex> Jason.encode_to_iodata!("\xFF")
    ** (Jason.EncodeError) invalid byte 0xFF in <<255>>

---

*Consult [api-reference.md](api-reference.md) for complete listing*
