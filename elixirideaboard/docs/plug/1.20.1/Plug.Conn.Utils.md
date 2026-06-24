# `Plug.Conn.Utils`
[🔗](https://github.com/elixir-plug/plug/blob/v1.20.1/lib/plug/conn/utils.ex#L1)

Utilities for working with connection data

# `params`

```elixir
@type params() :: %{optional(binary()) =&gt; binary()}
```

# `content_type`

```elixir
@spec content_type(binary()) ::
  {:ok, type :: binary(), subtype :: binary(), params()} | :error
```

Parses content type (without wildcards).

It is similar to `media_type/1` except wildcards are
not accepted in the type nor in the subtype.

## Examples

    iex> content_type "x-sample/json; charset=utf-8"
    {:ok, "x-sample", "json", %{"charset" => "utf-8"}}

    iex> content_type "x-sample/json  ; charset=utf-8  ; foo=bar"
    {:ok, "x-sample", "json", %{"charset" => "utf-8", "foo" => "bar"}}

    iex> content_type "\r\n text/plain;\r\n charset=utf-8\r\n"
    {:ok, "text", "plain", %{"charset" => "utf-8"}}

    iex> content_type "text/plain"
    {:ok, "text", "plain", %{}}

    iex> content_type "x/*"
    :error

    iex> content_type "*/*"
    :error

    iex> content_type "something"
    :error

# `list`

```elixir
@spec list(binary()) :: [binary()]
```

Parses a comma-separated list of header values.

## Examples

    iex> list("foo, bar")
    ["foo", "bar"]

    iex> list("foobar")
    ["foobar"]

    iex> list("")
    []

    iex> list("empties, , are,, filtered")
    ["empties", "are", "filtered"]

    iex> list("whitespace , , ,,   is   ,definitely,optional")
    ["whitespace", "is", "definitely", "optional"]

# `media_type`

```elixir
@spec media_type(binary()) ::
  {:ok, type :: binary(), subtype :: binary(), params()} | :error
```

Parses media types (with wildcards).

Type and subtype are case insensitive while the
sensitiveness of params depends on their keys and
therefore are not handled by this parser.

Returns:

  * `{:ok, type, subtype, map_of_params}` if everything goes fine
  * `:error` if the media type isn't valid

## Examples

    iex> media_type "text/plain"
    {:ok, "text", "plain", %{}}

    iex> media_type "APPLICATION/vnd.ms-data+XML"
    {:ok, "application", "vnd.ms-data+xml", %{}}

    iex> media_type "application/media_control+xml"
    {:ok, "application", "media_control+xml", %{}}

    iex> media_type "text/*; q=1.0"
    {:ok, "text", "*", %{"q" => "1.0"}}

    iex> media_type "*/*; q=1.0"
    {:ok, "*", "*", %{"q" => "1.0"}}

    iex> media_type "x y"
    :error

    iex> media_type "*/html"
    :error

    iex> media_type "/"
    :error

    iex> media_type "x/y z"
    :error

# `params`

```elixir
@spec params(binary()) :: params()
```

Parses headers parameters.

Keys are case insensitive and downcased,
invalid key-value pairs are discarded.

## Examples

    iex> params("foo=bar")
    %{"foo" => "bar"}

    iex> params("  foo=bar  ")
    %{"foo" => "bar"}

    iex> params("FOO=bar")
    %{"foo" => "bar"}

    iex> params("Foo=bar; baz=BOING")
    %{"foo" => "bar", "baz" => "BOING"}

    iex> params("foo=BAR ; wat")
    %{"foo" => "BAR"}

    iex> params("foo=\"bar\"; baz=\"boing\"")
    %{"foo" => "bar", "baz" => "boing"}

    iex> params("foo=\"bar;\"; baz=\"boing\"")
    %{"foo" => "bar;", "baz" => "boing"}

    iex> params("=")
    %{}

    iex> params(";")
    %{}

    iex> params("foo=")
    %{}

# `token`

```elixir
@spec token(binary()) :: binary() | false
```

Parses a value as defined in [RFC-1341](http://www.w3.org/Protocols/rfc1341/4_Content-Type.html).

For convenience, trims whitespace at the end of the token.
Returns `false` if the token is invalid.

## Examples

    iex> token("foo")
    "foo"

    iex> token("foo-bar")
    "foo-bar"

    iex> token("<foo>")
    false

    iex> token(~s["<foo>"])
    "<foo>"

    iex> token(~S["<f\oo>\"<b\ar>"])
    "<foo>\"<bar>"

    iex> token(~s["])
    false

    iex> token("foo  ")
    "foo"

    iex> token("foo bar")
    false

    iex> token("")
    false

    iex> token(" ")
    ""

# `validate_utf8!`

```elixir
@spec validate_utf8!(binary(), module(), binary()) :: :ok | no_return()
```

Validates the given binary is valid UTF-8.

---

*Consult [api-reference.md](api-reference.md) for complete listing*
