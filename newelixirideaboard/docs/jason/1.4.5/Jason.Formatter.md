# `Jason.Formatter`
[🔗](https://github.com/michalmuskala/jason/blob/v1.4.5/lib/formatter.ex#L1)

Pretty-printing and minimizing functions for JSON-encoded data.

Input is required to be in an 8-bit-wide encoding such as UTF-8 or Latin-1
in `t:iodata/0` format. Input must have valid JSON, invalid JSON may produce
unexpected results or errors.

# `opts`

```elixir
@type opts() :: [
  indent: iodata(),
  line_separator: iodata(),
  record_separator: iodata(),
  after_colon: iodata()
]
```

# `minimize`

```elixir
@spec minimize(iodata(), opts()) :: binary()
```

Minimizes JSON-encoded `input`.

`input` may contain multiple JSON objects or arrays, optionally
separated by whitespace (e.g., one object per line). Minimized
output will contain one object per line. No trailing newline is emitted.

## Options

  * `:record_separator` - controls the string used as newline (default: `"\n"`).

## Examples

    iex> Jason.Formatter.minimize(~s|{ "a" : "b" , "c": \n\n 2}|)
    ~s|{"a":"b","c":2}|

# `minimize_to_iodata`

```elixir
@spec minimize_to_iodata(iodata(), opts()) :: iodata()
```

Minimizes JSON-encoded `input` and returns iodata.

This function should be preferred to `minimize/2`, if the minimized
JSON will be handed over to one of the IO functions or sent
over the socket. The Erlang runtime is able to leverage vectorised
writes and avoid allocating a continuous buffer for the whole
resulting string, lowering memory use and increasing performance.

# `pretty_print`

```elixir
@spec pretty_print(iodata(), opts()) :: binary()
```

Pretty-prints JSON-encoded `input`.

`input` may contain multiple JSON objects or arrays, optionally separated
by whitespace (e.g., one object per line). Objects in output will be
separated by newlines. No trailing newline is emitted.

## Options

  * `:indent` - used for nested objects and arrays (default: two spaces - `"  "`);
  * `:line_separator` - used in nested objects (default: `"\n"`);
  * `:record_separator` - separates root-level objects and arrays
    (default is the value for `:line_separator` option);
  * `:after_colon` - printed after a colon inside objects (default: one space - `" "`).

## Examples

    iex> Jason.Formatter.pretty_print(~s|{"a":{"b": [1, 2]}}|)
    ~s|{
      "a": {
        "b": [
          1,
          2
        ]
      }
    }|

# `pretty_print_to_iodata`

```elixir
@spec pretty_print_to_iodata(iodata(), opts()) :: iodata()
```

Pretty-prints JSON-encoded `input` and returns iodata.

This function should be preferred to `pretty_print/2`, if the pretty-printed
JSON will be handed over to one of the IO functions or sent
over the socket. The Erlang runtime is able to leverage vectorised
writes and avoid allocating a continuous buffer for the whole
resulting string, lowering memory use and increasing performance.

---

*Consult [api-reference.md](api-reference.md) for complete listing*
