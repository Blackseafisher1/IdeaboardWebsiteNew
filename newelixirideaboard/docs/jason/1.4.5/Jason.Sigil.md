# `Jason.Sigil`
[🔗](https://github.com/michalmuskala/jason/blob/v1.4.5/lib/sigil.ex#L1)

# `sigil_J`
*macro* 

Handles the sigil `~J` for raw JSON strings.

Decodes a raw string ignoring Elixir interpolations and
escape characters at compile-time.

## Examples

    iex> ~J'"#{string}"'
    "\#{string}"

    iex> ~J'"\u0078\\y"'
    "x\\y"

    iex> ~J'{"#{key}": "#{}"}'a
    %{"\#{key}": "\#{}"}

# `sigil_j`
*macro* 

Handles the sigil `~j` for JSON strings.

Calls `Jason.decode!/2` with modifiers mapped to options.

Given a string literal without interpolations, decodes the
string at compile-time.

## Modifiers

See `Jason.decode/2` for detailed descriptions.

  * `a` - equivalent to `{:keys, :atoms}` option
  * `A` - equivalent to `{:keys, :atoms!}` option
  * `r` - equivalent to `{:strings, :reference}` option
  * `c` - equivalent to `{:strings, :copy}` option

## Examples

    iex> ~j"0"
    0

    iex> ~j"[1, 2, 3]"
    [1, 2, 3]

    iex> ~j'"string"'r
    "string"

    iex> ~j"{}"
    %{}

    iex> ~j'{"atom": "value"}'a
    %{atom: "value"}

    iex> ~j'{"#{:j}": #{~c'"j"'}}'A
    %{j: "j"}

---

*Consult [api-reference.md](api-reference.md) for complete listing*
