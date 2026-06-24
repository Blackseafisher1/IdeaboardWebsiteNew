# `Plug.Parsers.URLENCODED`
[🔗](https://github.com/elixir-plug/plug/blob/v1.20.1/lib/plug/parsers/urlencoded.ex#L1)

Parses urlencoded request body.

## Options

All options supported by `Plug.Conn.read_body/2` are also supported here.
They are repeated here for convenience:

  * `:length` - sets the maximum number of bytes to read from the request,
    defaults to 1_000_000 bytes
  * `:read_length` - sets the amount of bytes to read at one time from the
    underlying socket to fill the chunk, defaults to 1_000_000 bytes
  * `:read_timeout` - sets the timeout for each socket read, defaults to
    15_000ms

So by default, `Plug.Parsers` will read 1_000_000 bytes at a time from the
socket with an overall limit of 8_000_000 bytes.

---

*Consult [api-reference.md](api-reference.md) for complete listing*
