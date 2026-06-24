# `Plug.HTML`
[🔗](https://github.com/elixir-plug/plug/blob/v1.20.1/lib/plug/html.ex#L1)

Conveniences for generating HTML.

# `html_escape`

```elixir
@spec html_escape(String.t()) :: String.t()
```

Escapes the given HTML to string.

    iex> Plug.HTML.html_escape("foo")
    "foo"

    iex> Plug.HTML.html_escape("<foo>")
    "&lt;foo&gt;"

    iex> Plug.HTML.html_escape("quotes: \" & \'")
    "quotes: &quot; &amp; &#39;"

# `html_escape_to_iodata`

```elixir
@spec html_escape_to_iodata(String.t()) :: iodata()
```

Escapes the given HTML to iodata.

    iex> Plug.HTML.html_escape_to_iodata("foo")
    "foo"

    iex> Plug.HTML.html_escape_to_iodata("<foo>")
    [[[] | "&lt;"], "foo" | "&gt;"]

    iex> Plug.HTML.html_escape_to_iodata("quotes: \" & \'")
    [[[[], "quotes: " | "&quot;"], " " | "&amp;"], " " | "&#39;"]

---

*Consult [api-reference.md](api-reference.md) for complete listing*
