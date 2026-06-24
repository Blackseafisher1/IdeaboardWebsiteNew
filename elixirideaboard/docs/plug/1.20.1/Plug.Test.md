# `Plug.Test`
[🔗](https://github.com/elixir-plug/plug/blob/v1.20.1/lib/plug/test.ex#L1)

Conveniences for testing plugs.

This module can be used in your test cases, like this:

    use ExUnit.Case, async: true
    import Plug.Test
    import Plug.Conn

Using this module will:

  * import all the functions from this module
  * import all the functions from the `Plug.Conn` module

By default, Plug tests check for invalid header keys, e.g. header keys which
include uppercase letters, and raises a `Plug.Conn.InvalidHeaderError` when
it finds one. To disable it, set `:validate_header_keys_during_test` to
false on the app config.

    config :plug, :validate_header_keys_during_test, false

# `conn`

```elixir
@spec conn(String.Chars.t(), binary(), params()) :: Plug.Conn.t()
```

Creates a test connection.

The request `method` and `path` are required arguments. `method` may be any
value that implements `to_string/1` and it will be properly converted and
normalized (e.g., `:get` or `"post"`).

The `path` is commonly the request path with optional query string but it may
also be a complete URI. When a URI is given, the host and schema will be used
as part of the request too.

The `params_or_body` field must be one of:

* `nil` - meaning there is no body;
* a binary - containing a request body. For such cases, `:headers`
  must be given as option with a content-type;
* a map or list - containing the parameters which will automatically
  set the content-type to multipart. The map or list may contain
  other lists or maps and all entries will be normalized to string
  keys;

## Examples

    conn(:get, "/foo?bar=10")
    conn(:get, "/foo", %{bar: 10})
    conn(:post, "/")
    conn("patch", "/", "") |> put_req_header("content-type", "application/json")

# `delete_req_cookie`

```elixir
@spec delete_req_cookie(Plug.Conn.t(), binary()) :: Plug.Conn.t()
```

Deletes a request cookie.

# `init_test_session`

```elixir
@spec init_test_session(
  Plug.Conn.t(),
  %{optional(String.t() | atom()) =&gt; any()} | keyword()
) ::
  Plug.Conn.t()
```

Initializes the session with the given contents.

If the session has already been initialized, the new contents will be merged
with the previous ones.

# `put_http_protocol`

Puts the HTTP protocol.

# `put_peer_data`

Puts the peer data.

# `put_req_cookie`

```elixir
@spec put_req_cookie(Plug.Conn.t(), binary(), any(), keyword()) :: Plug.Conn.t()
```

Puts a request cookie.

## Options

  * `:max_age` - the cookie max-age, in seconds. Unset by default.
  * `:sign` - when true, signs the cookie.
  * `:encrypt` - when true, encrypts the cookie.

# `put_sock_data`

Puts the sock data.

# `put_ssl_data`

Puts the ssl data.

# `recycle_cookies`

```elixir
@spec recycle_cookies(Plug.Conn.t(), Plug.Conn.t()) :: Plug.Conn.t()
```

Moves cookies from a connection into a new connection for subsequent requests.

This function copies the cookie information in `old_conn` into `new_conn`,
emulating multiple requests done by clients where cookies are always passed
forward, and returns the new version of `new_conn`.

# `sent_informs`

Returns the informational requests that have been sent.

This function depends on gathering the messages sent by the test adapter when
informational messages, such as an early hint, are sent. Calling this
function will clear the informational request messages from the inbox for the
process.  To assert on multiple informs, the result of the function should be
stored in a variable.

## Examples

    conn = conn(:get, "/foo", "bar=10")
    informs = Plug.Test.sent_informs(conn)
    assert {"/static/application.css", [{"accept", "text/css"}]} in informs
    assert {"/static/application.js", [{"accept", "application/javascript"}]} in informs

# `sent_pushes`

> This function is deprecated. Most browsers and clients have removed push support.

Returns the assets that have been pushed.

This function depends on gathering the messages sent by the test adapter
when assets are pushed. Calling this function will clear the pushed message
from the inbox for the process. To assert on multiple pushes, the result
of the function should be stored in a variable.

## Examples

    conn = conn(:get, "/foo?bar=10")
    pushes = Plug.Test.sent_pushes(conn)
    assert {"/static/application.css", [{"accept", "text/css"}]} in pushes
    assert {"/static/application.js", [{"accept", "application/javascript"}]} in pushes

# `sent_resp`

Returns the sent response.

This function is useful when the code being invoked crashes and
there is a need to verify a particular response was sent, even with
the crash. It returns a tuple with `{status, headers, body}`.

# `sent_upgrades`

Returns the upgrade requests that have been sent.

This function depends on gathering the messages sent by the test adapter when
upgrade requests are sent. Calling this function will clear the upgrade request messages from the inbox for the
process.

## Examples

    conn = conn(:get, "/foo", "bar=10")
    upgrades = Plug.Test.sent_upgrades(conn)
    assert {:websocket, [opt: :value]} in upgrades

---

*Consult [api-reference.md](api-reference.md) for complete listing*
