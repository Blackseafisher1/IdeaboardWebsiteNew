# `Plug.Conn.Cookies`
[🔗](https://github.com/elixir-plug/plug/blob/v1.20.1/lib/plug/conn/cookies.ex#L1)

Conveniences for encoding and decoding cookies.

# `decode`

Decodes the given cookies as given in either a request or response header.

If a cookie is invalid, it is automatically discarded from the result.

## Examples

    iex> decode("key1=value1;key2=value2")
    %{"key1" => "value1", "key2" => "value2"}

# `encode`

Encodes the given cookies as expected in a response header.

## Examples

    iex> encode("key1", %{value: "value1"})
    "key1=value1; path=/; HttpOnly"

    iex> encode("key1", %{value: "value1", secure: true, path: "/example", http_only: false})
    "key1=value1; path=/example; secure"

---

*Consult [api-reference.md](api-reference.md) for complete listing*
