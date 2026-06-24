# `Plug.Parsers.MULTIPART`
[🔗](https://github.com/elixir-plug/plug/blob/v1.20.1/lib/plug/parsers/multipart.ex#L1)

Parses multipart request body.

## Options

All options supported by `Plug.Conn.read_body/2` are also supported here.
They are repeated here for convenience:

  * `:length` - sets the maximum number of bytes to read from the request,
    defaults to 8_000_000 bytes

  * `:read_length` - sets the amount of bytes to read at one time from the
    underlying socket to fill the chunk, defaults to 1_000_000 bytes

  * `:read_timeout` - sets the timeout for each socket read, defaults to
    15_000ms

So by default, `Plug.Parsers` will read 1_000_000 bytes at a time from the
socket with an overall limit of 8_000_000 bytes.

Besides the options supported by `Plug.Conn.read_body/2`, the multipart parser
also checks for:

  * `:validate_utf8` - specifies whether multipart body parts should be validated
    as utf8 binaries. It is either a boolean or a custom exception to raise

  * `:multipart_to_params` - a MFA that receives the multipart headers and the
    connection and it must return a tuple of `{:ok, params, conn}`

## Multipart to params

Once all multiparts are collected, they must be converted to params and this
can be customized with an MFA. The default implementation of this function
is equivalent to:

    def multipart_to_params(parts, conn) do
      acc =
        for {name, _headers, body} <- Enum.reverse(parts),
            name != nil,
            reduce: Plug.Conn.Query.decode_init() do
          acc -> Plug.Conn.Query.decode_each({name, body}, acc)
        end

      {:ok, Plug.Conn.Query.decode_done(acc), conn}
    end

As you can notice, it discards all multiparts without a name. If you want
to keep the unnamed parts, you can store all of them under a known prefix,
such as:

    def multipart_to_params(parts, conn) do
      acc =
        for {name, _headers, body} <- Enum.reverse(parts),
            name != nil,
            reduce: Plug.Conn.Query.decode_init() do
          acc -> Plug.Conn.Query.decode_each({name || "_parts[]", body}, acc)
        end

      {:ok, Plug.Conn.Query.decode_done(acc), conn}
    end

## Dynamic configuration

If you need to dynamically configure how `Plug.Parsers.MULTIPART` behaves,
for example, based on the connection or another system parameter, one option
is to create your own parser that wraps it:

    defmodule MyMultipart do
      @multipart Plug.Parsers.MULTIPART

      def init(opts) do
        opts
      end

      def parse(conn, "multipart", subtype, headers, opts) do
        length = System.fetch_env!("UPLOAD_LIMIT") |> String.to_integer
        opts = @multipart.init([length: length] ++ opts)
        @multipart.parse(conn, "multipart", subtype, headers, opts)
      end

      def parse(conn, _type, _subtype, _headers, _opts) do
        {:next, conn}
      end
    end

---

*Consult [api-reference.md](api-reference.md) for complete listing*
