# `Plug.Conn`
[🔗](https://github.com/elixir-plug/plug/blob/v1.20.1/lib/plug/conn.ex#L3)

The Plug connection.

This module defines a struct and the main functions for working with
requests and responses in an HTTP connection.

Note request headers are normalized to lowercase and response
headers are expected to have lowercase keys.

## Request fields

These fields contain request information:

  * `host` - the requested host as a binary, example: `"www.example.com"`
  * `method` - the request method as a binary, example: `"GET"`
  * `path_info` - the path split into segments, example: `["hello", "world"]`
  * `script_name` - the initial portion of the URL's path that corresponds to
    the application routing, as segments, example: `["sub","app"]`
  * `request_path` - the requested path, example: `/trailing/and//double//slashes/`
  * `port` - the requested port as an integer, example: `80`
  * `remote_ip` - the IP of the client, example: `{151, 236, 219, 228}`. This field
    is meant to be overwritten by plugs that understand e.g. the `X-Forwarded-For`
    header or HAProxy's PROXY protocol. It defaults to peer's IP
  * `req_headers` - the request headers as a list, example: `[{"content-type", "text/plain"}]`.
    Note all headers will be downcased
  * `scheme` - the request scheme as an atom, example: `:http`
  * `query_string` - the request query string as a binary, example: `"foo=bar"`

## Fetchable fields

Fetchable fields do not populate with request information until the corresponding
prefixed 'fetch_' function retrieves them, e.g., the `fetch_query_params/2` function
retrieves the `query_params` field.

If you access these fields before fetching them, they will be returned as
`Plug.Conn.Unfetched` structs.

  * `body_params` - the request body params, populated through a `Plug.Parsers` parser
  * `query_params` - the request query params, populated through `fetch_query_params/2`
  * `path_params` - the request path params, populated by routers such as `Plug.Router`
  * `params` - the request params, the result of merging `:body_params` on top of
    `:query_params` alongside any further changes (such as the ones done by `Plug.Router`)

## Session vs Assigns

HTTP is stateless.

This means that a server begins each request cycle with no knowledge about
the client except the request itself. Its response may include one or more
`"Set-Cookie"` headers, asking the client to send that value back in a
`"Cookie"` header on subsequent requests.

This is the basis for stateful interactions with a client, so that the server
can remember the client's name, the contents of their shopping cart, and so on.

In `Plug`, a "session" is a place to store data that persists from one request
to the next. Typically, this data is stored in a cookie using `Plug.Session.COOKIE`.

A minimal approach would be to store only a user's id in the session, then
use that during the request cycle to look up other information (in a database
or elsewhere).

More can be stored in a session cookie, but be careful: this makes requests
and responses heavier, and clients may reject cookies beyond a certain size.
Also, session cookies are not shared between a user's different browsers or devices.
If the session is stored elsewhere, such as a database, the browser only has to
store the session key and therefore more data can be stored in the session.

A typical use case would be for an authentication plug to look up a user by id
and keep the user information stored in `assigns`. Other plugs will then also
have access to it via `assigns`. This is an important point because the assign
data disappears on the next request.

To summarize: `assigns` is for storing data to be accessed during the current
request, and the session is for storing data to be accessed in subsequent
requests.

## Response fields

These fields contain response information:

  * `resp_body` - the response body is an empty string by default. It is set
    to nil after the response is sent, except for test connections. The response
    charset defaults to "utf-8".
  * `resp_headers` - the response headers as a list of tuples, `cache-control`
    is set to `"max-age=0, private, must-revalidate"` by default.
    Note: Use all lowercase for response headers.
  * `status` - the response status

## Connection fields

  * `assigns` - shared user data as a map
  * `halted` - the boolean status on whether the pipeline was halted
  * `secret_key_base` - a secret key used to verify and encrypt cookies.
    These features require manual field setup. Data must be kept in the
    connection and never used directly. Always use `Plug.Crypto.KeyGenerator.generate/3`
    to derive keys from it.
  * `state` - the connection state

The connection state is used to track the connection lifecycle. It starts as
`:unset` but is changed to `:set` (via `resp/3`) or `:set_chunked`
(used only for `before_send` callbacks by `send_chunked/2`) or `:file`
(when invoked via `send_file/3`). Its final result is `:sent`, `:file`, `:chunked`
or `:upgraded` depending on the response model.

## Private fields

These fields are reserved for libraries/framework usage.

  * `adapter` - holds the adapter information in a tuple
  * `private` - shared library data as a map

## Deprecated fields

  * `cookies`- the request cookies with the response cookies.
    Use `get_cookies/1` instead.
  * `owner` - the Elixir process that owns the connection.
  * `req_cookies` - the decoded request cookies (without decrypting or verifying them).
    Use `get_req_header/2` or `get_cookies/1` instead.
  * `resp_cookies`- the request cookies with the response cookies.
    Use `get_resp_cookies/1` instead.

## Custom status codes

`Plug` allows status codes to be overridden or added and allows new codes not directly
specified by `Plug` or its adapters. The `:plug` application's Mix config can add or
override a status code.

For example, the config below overrides the default 404 reason phrase ("Not Found")
and adds a new 998 status code:

    config :plug, :statuses, %{
      404 => "Actually This Was Found",
      998 => "Not An RFC Status Code"
    }

Dependency-specific config changes are not automatically recompiled. Recompile `Plug`
for the changes to take place. The command below recompiles `Plug`:

    mix deps.clean --build plug

A corresponding atom is inflected from each status code reason phrase. In many functions,
these atoms can stand in for the status code. For example, with the above configuration,
the following will work:

    put_status(conn, :not_found)                     # 404
    put_status(conn, :actually_this_was_found)       # 404
    put_status(conn, :not_an_rfc_status_code)        # 998

The `:not_found` atom can still be used to set the 404 status even though the 404 status code
reason phrase was overwritten. The new atom `:actually_this_was_found`, inflected from the
reason phrase "Actually This Was Found", can also be used to set the 404 status code.

## Protocol Upgrades

`Plug.Conn.upgrade_adapter/3` provides basic support for protocol upgrades and facilitates
connection upgrades to protocols such as WebSockets. As the name suggests, this functionality
is adapter-dependent. Protocol upgrade functionality requires explicit coordination between
a `Plug` application and the underlying adapter.

`Plug` upgrade-related functionality only provides the possibility for the `Plug` application
to request protocol upgrades from the underlying adapter. See `upgrade_adapter/3` documentation.

# `adapter`

```elixir
@type adapter() :: {module(), term()}
```

# `assigns`

```elixir
@type assigns() :: %{optional(atom()) =&gt; any()}
```

# `body`

```elixir
@type body() :: iodata()
```

# `cookies`

```elixir
@type cookies() :: %{optional(binary()) =&gt; term()}
```

# `halted`

```elixir
@type halted() :: boolean()
```

# `headers`

```elixir
@type headers() :: [{binary(), binary()}]
```

# `host`

```elixir
@type host() :: binary()
```

# `int_status`

```elixir
@type int_status() :: non_neg_integer() | nil
```

# `method`

```elixir
@type method() :: binary()
```

# `params`

```elixir
@type params() :: %{optional(binary()) =&gt; term()}
```

# `port_number`

```elixir
@type port_number() :: :inet.port_number()
```

# `query_param`

```elixir
@type query_param() ::
  binary() | %{optional(binary()) =&gt; query_param()} | [query_param()]
```

# `query_params`

```elixir
@type query_params() :: %{optional(binary()) =&gt; query_param()}
```

# `query_string`

```elixir
@type query_string() :: String.t()
```

# `req_cookies`

```elixir
@type req_cookies() :: %{optional(binary()) =&gt; binary()}
```

# `resp_cookies`

```elixir
@type resp_cookies() :: %{optional(binary()) =&gt; map()}
```

# `scheme`

```elixir
@type scheme() :: :http | :https
```

# `secret_key_base`

```elixir
@type secret_key_base() :: binary() | nil
```

# `segments`

```elixir
@type segments() :: [binary()]
```

# `state`

```elixir
@type state() ::
  :unset
  | :set
  | :set_chunked
  | :set_file
  | :file
  | :chunked
  | :sent
  | :upgraded
```

# `status`

```elixir
@type status() :: atom() | int_status()
```

# `t`

```elixir
@type t() :: %Plug.Conn{
  adapter: adapter(),
  assigns: assigns(),
  body_params: params() | Plug.Conn.Unfetched.t(),
  cookies: cookies() | Plug.Conn.Unfetched.t(),
  halted: halted(),
  host: host(),
  method: method(),
  owner: pid() | nil,
  params: params() | Plug.Conn.Unfetched.t(),
  path_info: segments(),
  path_params: query_params(),
  port: :inet.port_number(),
  private: assigns(),
  query_params: query_params() | Plug.Conn.Unfetched.t(),
  query_string: query_string(),
  remote_ip: :inet.ip_address(),
  req_cookies: req_cookies() | Plug.Conn.Unfetched.t(),
  req_headers: headers(),
  request_path: binary(),
  resp_body: body() | nil,
  resp_cookies: resp_cookies(),
  resp_headers: headers(),
  scheme: scheme(),
  script_name: segments(),
  secret_key_base: secret_key_base(),
  state: state(),
  status: int_status()
}
```

# `assign`

```elixir
@spec assign(t(), atom(), term()) :: t()
```

Assigns a value to a key in the connection.

The `assigns` storage is meant to be used to store values in the connection
so that other plugs in your plug pipeline can access them. The `assigns` storage
is a map.

## Examples

    iex> conn.assigns[:hello]
    nil
    iex> conn = assign(conn, :hello, :world)
    iex> conn.assigns[:hello]
    :world

# `chunk`

```elixir
@spec chunk(t(), body()) :: {:ok, t()} | {:error, term()} | no_return()
```

Sends a chunk as part of a chunked response.

It expects a connection with state `:chunked` as set by
`send_chunked/2`. It returns `{:ok, conn}` in case of success,
otherwise `{:error, reason}`.

To stream data use `Enum.reduce_while/3` instead of `Enum.reduce/2`.
`Enum.reduce_while/3` allows aborting the execution if `chunk/2` fails to
deliver the chunk of data.

## Example

    Enum.reduce_while(~w(each chunk as a word), conn, fn (chunk, conn) ->
      case Plug.Conn.chunk(conn, chunk) do
        {:ok, conn} ->
          {:cont, conn}
        {:error, :closed} ->
          {:halt, conn}
      end
    end)

# `clear_session`

```elixir
@spec clear_session(t()) :: t()
```

Clears the entire session.

This function removes every key from the session, clearing the session.

Note that, even if `clear_session/1` is used, the session is still sent to the
client. If the session should be effectively *dropped*, `configure_session/2`
should be used with the `:drop` option set to `true`.

# `configure_session`

```elixir
@spec configure_session(t(), Keyword.t()) :: t()
```

Configures the session.

## Options

  * `:renew` - When `true`, generates a new session id for the cookie
  * `:drop` - When `true`, drops the session, a session cookie will not be included in the
    response
  * `:ignore` - When `true`, ignores all changes made to the session in this request cycle

## Examples

    configure_session(conn, renew: true)

# `delete_req_header`

```elixir
@spec delete_req_header(t(), binary()) :: t()
```

Deletes a request header if present.

Raises a `Plug.Conn.AlreadySentError` if the connection has already been
`:sent`, `:chunked` or `:upgraded`.

## Examples

    Plug.Conn.delete_req_header(conn, "content-type")

# `delete_resp_cookie`

```elixir
@spec delete_resp_cookie(t(), binary(), Keyword.t()) :: t()
```

Deletes a response cookie.

Deleting a cookie requires the same options as to when the cookie was put.
Check `put_resp_cookie/4` for more information.

# `delete_resp_header`

```elixir
@spec delete_resp_header(t(), binary()) :: t()
```

Deletes a response header if present.

Raises a `Plug.Conn.AlreadySentError` if the connection has already been
`:sent`, `:chunked` or `:upgraded`.

## Examples

    Plug.Conn.delete_resp_header(conn, "content-type")

# `delete_session`

```elixir
@spec delete_session(t(), String.t() | atom()) :: t()
```

Deletes `key` from session.

The key can be a string or an atom, where atoms are
automatically converted to strings.

# `fetch_cookies`

```elixir
@spec fetch_cookies(t(), Keyword.t()) :: t()
```

Fetches cookies from the request headers.

## Options

  * `:signed` - a list of one or more cookies that are signed and must
    be verified accordingly

  * `:encrypted` - a list of one or more cookies that are encrypted and
    must be decrypted accordingly

See `put_resp_cookie/4` for more information.

# `fetch_query_params`

```elixir
@spec fetch_query_params(t(), Keyword.t()) :: t()
```

Fetches query parameters from the query string.

Params are decoded as `"x-www-form-urlencoded"` in which key/value pairs
are separated by `&` and keys are separated from values by `=`.

This function does not fetch parameters from the body. To fetch
parameters from the body, use the `Plug.Parsers` plug.

## Options

  * `:length` - the maximum query string length. Defaults to `1_000_000` bytes.
    Keep in mind the webserver you are using may have a more strict limit. For
    example, for the Cowboy webserver, [please read](https://hexdocs.pm/plug_cowboy/Plug.Cowboy.html#module-safety-limits).

  * `:validate_utf8` - boolean that tells whether or not to validate the keys and
    values of the decoded query string are UTF-8 encoded. Defaults to `true`.

# `fetch_session`

```elixir
@spec fetch_session(t(), Keyword.t()) :: t()
```

Fetches the session from the session store. Will also fetch cookies.

# `get_cookies`

```elixir
@spec get_cookies(t()) :: %{optional(binary()) =&gt; term()}
```

Returns a map with both request and response cookies.

Raises if cookies have not been fetched.

# `get_http_protocol`

```elixir
@spec get_http_protocol(t()) :: Plug.Conn.Adapter.http_protocol()
```

Returns the HTTP protocol and version.

## Examples

    iex> get_http_protocol(conn)
    :"HTTP/1.1"

# `get_peer_data`

```elixir
@spec get_peer_data(t()) :: Plug.Conn.Adapter.peer_data()
```

Returns the request peer data if one is present.

# `get_req_header`

```elixir
@spec get_req_header(t(), binary()) :: [binary()]
```

Returns the values of the request header specified by `key`.

## Examples

    iex> get_req_header(conn, "accept")
    ["application/json"]

# `get_resp_cookies`

```elixir
@spec get_resp_cookies(t()) :: %{optional(binary()) =&gt; map()}
```

Returns a map with response cookies.

Each response cookie is represented as a map with the
metadata to be sent as part of the response.

# `get_resp_header`

```elixir
@spec get_resp_header(t(), binary()) :: [binary()]
```

Returns the values of the response header specified by `key`.

## Examples

    iex> conn = %{conn | resp_headers: [{"content-type", "text/plain"}]}
    iex> get_resp_header(conn, "content-type")
    ["text/plain"]

# `get_session`

```elixir
@spec get_session(t()) :: %{optional(String.t()) =&gt; any()}
```

Returns the whole session.

Although `get_session/2` and `put_session/3` allow atom keys,
they are always normalized to strings. So this function always
returns a map with string keys.

Raises if the session was not yet fetched.

# `get_session`

```elixir
@spec get_session(t(), String.t() | atom(), any()) :: any()
```

Returns session value for the given `key`.

Returns the `default` value if `key` does not exist.
If `default` is not provided, `nil` is used.

The key can be a string or an atom, where atoms are
automatically converted to strings.

# `get_sock_data`

```elixir
@spec get_sock_data(t()) :: Plug.Conn.Adapter.sock_data()
```

Returns the request sock (local) data.

It raises if the adapter does not provide this metadata.

# `get_ssl_data`

```elixir
@spec get_ssl_data(t()) :: Plug.Conn.Adapter.ssl_data()
```

Returns SSL data for the connection.

If the connection is not SSL, returns nil.

It raises if the adapter does not provide this metadata.

# `halt`

```elixir
@spec halt(t()) :: t()
```

Halts the `Plug` pipeline by preventing further plugs downstream from being
invoked. See the docs for `Plug.Builder` for more information on halting a
`Plug` pipeline.

# `inform`

```elixir
@spec inform(t(), status(), [{atom() | binary(), binary()}]) :: t()
```

Sends an informational response to the client.

An informational response, such as an early hint, must happen prior to a response
being sent. If an informational request is attempted after a response is sent then
a `Plug.Conn.AlreadySentError` will be raised. Only status codes from 100-199 are valid.

To use inform for early hints send one or more informs with a status of 103.

If the adapter does not support informational responses then this is a noop.

Most HTTP/1.1 clients do not properly support informational responses but some
proxies require it to support server push for HTTP/2. You can call
`get_http_protocol/1` to retrieve the protocol and version.

# `inform!`

```elixir
@spec inform!(t(), status(), [{atom() | binary(), binary()}]) :: t()
```

Sends an information response to a client but raises if the adapter does not support inform.

See `inform/3` for more information.

# `merge_assigns`

```elixir
@spec merge_assigns(t(), Enumerable.t()) :: t()
```

Assigns multiple values to keys in the connection.

Equivalent to multiple calls to `assign/3`.

## Examples

    iex> conn.assigns[:hello]
    nil
    iex> conn = merge_assigns(conn, hello: :world)
    iex> conn.assigns[:hello]
    :world

# `merge_private`

```elixir
@spec merge_private(t(), Enumerable.t()) :: t()
```

Assigns multiple **private** keys and values in the connection.

Equivalent to multiple `put_private/3` calls.

## Examples

    iex> conn.private[:my_plug_hello]
    nil
    iex> conn = merge_private(conn, my_plug_hello: :world)
    iex> conn.private[:my_plug_hello]
    :world

# `merge_req_headers`

```elixir
@spec merge_req_headers(t(), Enum.t()) :: t()
```

Merges a series of request headers into the connection.

The "host" header will be overridden by `conn.host` and should not be set
with this method. Instead, do `%Plug.Conn{conn | host: value}`.

Because header keys are case-insensitive in both HTTP/1.1 and HTTP/2,
it is recommended for header keys to be in lowercase, to avoid sending
duplicate keys in a request.
Additionally, requests with mixed-case headers served over HTTP/2 are not
considered valid by common clients, resulting in dropped requests.
As a convenience, when using the `Plug.Adapters.Conn.Test` adapter, any
headers that aren't lowercase will raise a `Plug.Conn.InvalidHeaderError`.

## Example

    Plug.Conn.merge_req_headers(conn, [{"accept", "text/plain"}, {"X-1337", "5P34K"}])

# `merge_resp_headers`

```elixir
@spec merge_resp_headers(t(), Enum.t()) :: t()
```

Merges a series of response headers into the connection.

It is recommended for header keys to be in lowercase, to avoid sending
duplicate keys in a request.
Additionally, responses with mixed-case headers served over HTTP/2 are not
considered valid by common clients, resulting in dropped responses.
As a convenience, when using the `Plug.Adapters.Conn.Test` adapter, any
headers that aren't lowercase will raise a `Plug.Conn.InvalidHeaderError`.

## Example

    Plug.Conn.merge_resp_headers(conn, [{"content-type", "text/plain"}, {"X-1337", "5P34K"}])

# `prepend_req_headers`

```elixir
@spec prepend_req_headers(t(), headers()) :: t()
```

Prepends the list of headers to the connection request headers.

Similar to `put_req_header` this functions adds a new request header
(`key`) but rather than replacing the existing one it prepends another
header with the same `key`.

The "host" header will be overridden by `conn.host` and should not be set
with this method. Instead, do `%Plug.Conn{conn | host: value}`.

Because header keys are case-insensitive in both HTTP/1.1 and HTTP/2,
it is recommended for header keys to be in lowercase, to avoid sending
duplicate keys in a request.
Additionally, requests with mixed-case headers served over HTTP/2 are not
considered valid by common clients, resulting in dropped requests.
As a convenience, when using the `Plug.Adapters.Conn.Test` adapter, any
headers that aren't lowercase will raise a `Plug.Conn.InvalidHeaderError`.

Raises a `Plug.Conn.AlreadySentError` if the connection has already been
`:sent`, `:chunked` or `:upgraded`.

## Examples

    Plug.Conn.prepend_req_headers(conn, [{"accept", "application/json"}])

# `prepend_resp_headers`

```elixir
@spec prepend_resp_headers(t(), headers()) :: t()
```

Prepends the list of headers to the connection response headers.

Similar to `put_resp_header` this functions adds a new response header
(`key`) but rather than replacing the existing one it prepends another header
with the same `key`.

It is recommended for header keys to be in lowercase, to avoid sending
duplicate keys in a request.
Additionally, responses with mixed-case headers served over HTTP/2 are not
considered valid by common clients, resulting in dropped responses.
As a convenience, when using the `Plug.Adapters.Conn.Test` adapter, any
headers that aren't lowercase will raise a `Plug.Conn.InvalidHeaderError`.

Raises a `Plug.Conn.AlreadySentError` if the connection has already been
`:sent`, `:chunked` or `:upgraded`.

Raises a `Plug.Conn.InvalidHeaderError` if the header value contains control
feed (`\r`) or newline (`\n`) characters.

## Examples

    Plug.Conn.prepend_resp_headers(conn, [{"content-type", "application/json"}])

# `push`

> This function is deprecated. Most browsers and clients have removed push support.

```elixir
@spec push(t(), String.t(), Keyword.t()) :: t()
```

Pushes a resource to the client.

Server pushes must happen prior to a response being sent. If a server
push is attempted after a response is sent then a `Plug.Conn.AlreadySentError`
will be raised.

If the adapter does not support server push then this is a noop.

Note that certain browsers (such as Google Chrome) will not accept a pushed
resource if your certificate is not trusted. In the case of Chrome this means
a valid cert with a SAN. See https://www.chromestatus.com/feature/4981025180483584

# `push!`

> This function is deprecated. Most browsers and clients have removed push support.

```elixir
@spec push!(t(), String.t(), Keyword.t()) :: t()
```

Pushes a resource to the client but raises if the adapter
does not support server push.

# `put_private`

```elixir
@spec put_private(t(), atom(), term()) :: t()
```

Assigns a new **private** key and value in the connection.

This storage is meant to be used by libraries and frameworks to avoid writing
to the user storage (the `:assigns` field). It is recommended for
libraries/frameworks to prefix the keys with the library name.

For example, if a plug called `my_plug` needs to store a `:hello`
key, it would store it as `:my_plug_hello`:

    iex> conn.private[:my_plug_hello]
    nil
    iex> conn = put_private(conn, :my_plug_hello, :world)
    iex> conn.private[:my_plug_hello]
    :world

# `put_req_header`

```elixir
@spec put_req_header(t(), binary(), binary()) :: t()
```

Adds a new request header (`key`) if not present, otherwise replaces the
previous value of that header with `value`.

The "host" header will be overridden by `conn.host` and should not be set
with this method. Instead, do `%Plug.Conn{conn | host: value}`.

Because header keys are case-insensitive in both HTTP/1.1 and HTTP/2,
it is recommended for header keys to be in lowercase, to avoid sending
duplicate keys in a request.
Additionally, requests with mixed-case headers served over HTTP/2 are not
considered valid by common clients, resulting in dropped requests.
As a convenience, when using the `Plug.Adapters.Conn.Test` adapter, any
headers that aren't lowercase will raise a `Plug.Conn.InvalidHeaderError`.

Raises a `Plug.Conn.AlreadySentError` if the connection has already been
`:sent`, `:chunked` or `:upgraded`.

## Examples

    Plug.Conn.put_req_header(conn, "accept", "application/json")

# `put_resp_content_type`

```elixir
@spec put_resp_content_type(t(), binary(), binary() | nil) :: t()
```

Sets the value of the `"content-type"` response header taking into account the
`charset`.

If `charset` is `nil`, the value of the `"content-type"` response header won't
specify a charset.

## Examples

    iex> conn = put_resp_content_type(conn, "application/json")
    iex> get_resp_header(conn, "content-type")
    ["application/json; charset=utf-8"]

# `put_resp_cookie`

```elixir
@spec put_resp_cookie(t(), binary(), any(), Keyword.t()) :: t()
```

Puts a response cookie in the connection.

If the `:sign` or `:encrypt` flag are given, then the cookie
value can be any term.

If the cookie is not signed nor encrypted, then the value must be a binary.
Note the value is not automatically escaped. Therefore if you want to store
values with non-alphanumeric characters, you must either sign or encrypt
the cookie or consider explicitly escaping the cookie value by using a
function such as `Base.encode64(value, padding: false)` when writing and
`Base.decode64(encoded, padding: false)` when reading the cookie.
It is important for padding to be disabled since `=` is not a valid
character in cookie values.

## Signing and encrypting cookies

This function allows you to automatically sign and encrypt cookies.
When signing or encryption is enabled, then any Elixir value can be
stored in the cookie (except anonymous functions for security reasons).
Once a value is signed or encrypted, you must also call `fetch_cookies/2`
with the name of the cookies that are either signed or encrypted.

To sign, you would do:

    put_resp_cookie(conn, "my-cookie", %{user_id: user.id}, sign: true)

and then:

    fetch_cookies(conn, signed: ~w(my-cookie))

To encrypt, you would do:

    put_resp_cookie(conn, "my-cookie", %{user_id: user.id}, encrypt: true)

and then:

    fetch_cookies(conn, encrypted: ~w(my-cookie))

By default a signed or encrypted cookie is only valid for a day, unless
a `:max_age` is specified.

The signing and encryption keys are derived from the connection's
`secret_key_base` using a salt that is built by appending "_cookie" to
the cookie name. Care should be taken not to derive other keys using
this value as the salt. Similarly do not use the same cookie name to
store different values with distinct purposes.

## Options

  * `:domain` - the domain the cookie applies to
  * `:max_age` - the cookie max-age, in seconds. Providing a value for this
    option will set both the _max-age_ and _expires_ cookie attributes. Unset
    by default, which means the browser will default to a [session cookie](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies#define_the_lifetime_of_a_cookie).
  * `:path` - the path the cookie applies to
  * `:http_only` - when `false`, the cookie is accessible beyond HTTP. Defaults to `true`
  * `:secure` - if the cookie must be sent only over https. Defaults
    to true when the connection is HTTPS
  * `:extra` - string to append to cookie. Use this to take advantage of
    non-standard cookie attributes.
  * `:sign` - when true, signs the cookie
  * `:encrypt` - when true, encrypts the cookie
  * `:same_site` - set the cookie SameSite attribute to a string value.
    If no string value is set, the attribute is omitted.

# `put_resp_header`

```elixir
@spec put_resp_header(t(), binary(), binary()) :: t()
```

Adds a new response header (`key`) if not present, otherwise replaces the
previous value of that header with `value`.

Because header keys are case-insensitive in both HTTP/1.1 and HTTP/2,
it is recommended for header keys to be in lowercase, to avoid sending
duplicate keys in a request.
Additionally, responses with mixed-case headers served over HTTP/2 are not
considered valid by common clients, resulting in dropped responses.
As a convenience, when using the `Plug.Adapters.Conn.Test` adapter, any
headers that aren't lowercase will raise a `Plug.Conn.InvalidHeaderError`.

Raises a `Plug.Conn.AlreadySentError` if the connection has already been
`:sent`, `:chunked` or `:upgraded`.

Raises a `Plug.Conn.InvalidHeaderError` if the header value contains control
feed (`\r`) or newline (`\n`) characters.

## Examples

    Plug.Conn.put_resp_header(conn, "content-type", "application/json")

# `put_session`

```elixir
@spec put_session(t(), String.t() | atom(), any()) :: t()
```

Puts the specified `value` in the session for the given `key`.

The key can be a string or an atom, where atoms are
automatically converted to strings. Can only be invoked
on unsent `conn`s. Will raise otherwise.

# `put_status`

```elixir
@spec put_status(t(), status()) :: t()
```

Stores the given status code in the connection.

The status code can be `nil`, an integer, or an atom. The list of allowed
atoms is available in `Plug.Conn.Status`.

Raises a `Plug.Conn.AlreadySentError` if the connection has already been
`:sent`, `:chunked` or `:upgraded`.

## Examples

    Plug.Conn.put_status(conn, :not_found)
    Plug.Conn.put_status(conn, 200)

# `read_body`

```elixir
@spec read_body(t(), Keyword.t()) ::
  {:ok, binary(), t()} | {:more, binary(), t()} | {:error, term()}
```

Reads the request body.

This function reads a chunk of the request body up to a given length (specified
by the `:length` option). If there is more data to be read, then
`{:more, partial_body, conn}` is returned. Otherwise `{:ok, body, conn}` is
returned. In case of an error reading the socket, `{:error, reason}` is
returned as per `:gen_tcp.recv/2`.

Like all functions in this module, the `conn` returned by `read_body` must
be passed to the next stage of your pipeline and should not be ignored.

In order to, for instance, support slower clients you can tune the
`:read_length` and `:read_timeout` options. These specify how much time should
be allowed to pass for each read from the underlying socket.

Because the request body can be of any size, reading the body will only
work once, as `Plug` will not cache the result of these operations. If you
need to access the body multiple times, it is your responsibility to store
it. Finally keep in mind some plugs like `Plug.Parsers` may read the body,
so the body may be unavailable after being accessed by such plugs.

This function is able to handle both chunked and identity transfer-encoding
by default.

## Options

  * `:length` - sets the maximum number of bytes to read from the body on
    every call, defaults to `8_000_000` bytes
  * `:read_length` - sets the amount of bytes to read at one time from the
    underlying socket to fill the chunk, defaults to `1_000_000` bytes
  * `:read_timeout` - sets the timeout for each socket read, defaults to
    `15_000` milliseconds

The values above are not meant to be exact. For example, setting the
length to `8_000_000` may end up reading some hundred bytes more from
the socket until we halt.

## Examples

    {:ok, body, conn} = Plug.Conn.read_body(conn, length: 1_000_000)

# `read_part_body`

```elixir
@spec read_part_body(t(), Keyword.t()) ::
  {:ok, binary(), t()} | {:more, binary(), t()} | {:done, t()}
```

Reads the body of a multipart request.

Returns `{:ok, body, conn}` if all body has been read,
`{:more, binary, conn}` otherwise, and `{:done, conn}`
if there is no more body.

It accepts the same options as `read_body/2`.

## Options

  * `:length` - sets the maximum number of bytes to read from the body on
    every call, defaults to `8_000_000` bytes
  * `:read_length` - sets the amount of bytes to read at one time from the
    underlying socket to fill the chunk, defaults to `1_000_000` bytes
  * `:read_timeout` - sets the timeout for each socket read, defaults to
    `15_000` milliseconds

> #### Request length {: .warning}
>
> The `:length` option tracks the maximum length within a single call.
> When doing multiple calls to `read_part_headers/2` and `read_part_body/2`,
> it is your responsibility to track the overall response length.

# `read_part_headers`

```elixir
@spec read_part_headers(t(), Keyword.t()) ::
  {:ok, headers(), t()} | {:error, :too_large, t()} | {:done, t()}
```

Reads the headers of a multipart request.

It returns `{:ok, headers, conn}` with the headers,
`{:error, :too_large, conn}` if the current multipart header block
exceeds the configured `:length`, or `{:done, conn}` if there are
no more parts.

Once `read_part_headers/2` is invoked, you may call
`read_part_body/2` to read the body associated to the headers.
If `read_part_headers/2` is called instead, the body is automatically
skipped until the next part headers.

## Options

  * `:length` - sets the maximum number of bytes to read while parsing the
    current multipart header block, defaults to `64_000` bytes
  * `:read_length` - sets the amount of bytes to read at one time from the
    underlying socket to fill the chunk, defaults to `64_000` bytes
  * `:read_timeout` - sets the timeout for each socket read, defaults to
    `5_000` milliseconds

> #### Request length {: .warning}
>
> The `:length` option tracks the maximum length within a single call.
> When doing multiple calls to `read_part_headers/2` and `read_part_body/2`,
> it is your responsibility to track the overall response length.

# `register_before_send`

```elixir
@spec register_before_send(t(), (t() -&gt; t())) :: t()
```

Registers a callback to be invoked before the response is sent.

Callbacks are invoked in the reverse order they are defined (callbacks
defined first are invoked last).

## Examples

To log the status of response being sent:

    require Logger

    Plug.Conn.register_before_send(conn, fn conn ->
      Logger.info("Sent a #{conn.status} response")
      conn
    end)

# `request_url`

Returns the full request URL.

# `resp`

```elixir
@spec resp(t(), status(), body()) :: t()
```

Sets the response to the given `status` and `body`.

It sets the connection state to `:set` (if not already `:set`)
and raises `Plug.Conn.AlreadySentError` if it was already `:sent`, `:chunked` or `:upgraded`.

If you also want to send the response, use `send_resp/1` after this
or use `send_resp/3`.

The status can be an integer, an atom, or `nil`. See `Plug.Conn.Status`
for more information.

## Examples

    Plug.Conn.resp(conn, 404, "Not found")

# `send_chunked`

```elixir
@spec send_chunked(t(), status()) :: t() | no_return()
```

Sends the response headers as a chunked response.

It expects a connection that has not been `:sent` or `:upgraded` yet and sets its
state to `:chunked` afterwards. Otherwise, raises `Plug.Conn.AlreadySentError`.
After `send_chunked/2` is called, chunks can be sent to the client via
the `chunk/2` function.

HTTP/2 does not support chunking and will instead stream the response without a
transfer encoding. When using HTTP/1.1, the underlying adapter will stream the response
instead of emitting chunks if the `content-length` header has been set before calling
`send_chunked/2`.

# `send_file`

```elixir
@spec send_file(
  t(),
  status(),
  filename :: binary(),
  offset :: integer(),
  length :: integer() | :all
) ::
  t() | no_return()
```

Sends a file as the response body with the given `status`
and optionally starting at the given offset until the given length.

If available, the file is sent directly over the socket using
the operating system `sendfile` operation.

It expects a connection that has not been `:sent`, `:chunked` or `:upgraded` yet and sets its
state to `:file` afterwards. Otherwise raises `Plug.Conn.AlreadySentError`.

## Examples

    Plug.Conn.send_file(conn, 200, "README.md")

# `send_resp`

```elixir
@spec send_resp(t()) :: t() | no_return()
```

Sends a response to the client.

It expects the connection state to be `:set`, otherwise raises an
`ArgumentError` for `:unset` connections or a `Plug.Conn.AlreadySentError` for
already `:sent`, `:chunked` or `:upgraded` connections.

At the end sets the connection state to `:sent`.

Note that this function does not halt the connection, so if
subsequent plugs try to send another response, it will error out.
Use `halt/1` after this function if you want to halt the plug pipeline.

## Examples

    conn
    |> Plug.Conn.resp(404, "Not found")
    |> Plug.Conn.send_resp()

# `send_resp`

```elixir
@spec send_resp(t(), status(), body()) :: t() | no_return()
```

Sends a response with the given status and body.

This is equivalent to setting the status and the body and then
calling `send_resp/1`.

Note that this function does not halt the connection, so if
subsequent plugs try to send another response, it will error out.
Use `halt/1` after this function if you want to halt the plug pipeline.

## Examples

    Plug.Conn.send_resp(conn, 404, "Not found")

# `update_req_header`

```elixir
@spec update_req_header(t(), binary(), binary(), (binary() -&gt; binary())) :: t()
```

Updates a request header if present, otherwise it sets it to an initial
value.

Raises a `Plug.Conn.AlreadySentError` if the connection has already been
`:sent`, `:chunked` or `:upgraded`.

Only the first value of the header `key` is updated if present.

## Examples

    Plug.Conn.update_req_header(
      conn,
      "accept",
      "application/json; charset=utf-8",
      &(&1 <> "; charset=utf-8")
    )

# `update_resp_header`

```elixir
@spec update_resp_header(t(), binary(), binary(), (binary() -&gt; binary())) :: t()
```

Updates a response header if present, otherwise it sets it to an initial
value.

Raises a `Plug.Conn.AlreadySentError` if the connection has already been
`:sent`, `:chunked` or `:upgraded`.

Only the first value of the header `key` is updated if present.

## Examples

    Plug.Conn.update_resp_header(
      conn,
      "content-type",
      "application/json; charset=utf-8",
      &(&1 <> "; charset=utf-8")
    )

# `upgrade_adapter`

```elixir
@spec upgrade_adapter(t(), atom(), term()) :: t()
```

Request a protocol upgrade from the underlying adapter.

The precise semantics of an upgrade are deliberately left unspecified here in order to
support arbitrary upgrades, even to protocols which may not exist today. The primary intent of
this function is solely to allow an application to issue an upgrade request, not to manage how
a given protocol upgrade takes place or what APIs the application must support in order to serve
this updated protocol. For details in this regard, consult the documentation of the underlying
adapter (such a [Plug.Cowboy](https://hexdocs.pm/plug_cowboy) or [Bandit](https://hexdocs.pm/bandit)).

Takes an argument describing the requested upgrade (for example, `:websocket`), and an argument
which contains arbitrary data which the underlying adapter is expected to interpret in the
context of the requested upgrade.

If the upgrade is accepted by the adapter, the returned `Plug.Conn` will have a `state` of
`:upgraded`. This state is considered equivalently to a 'sent' state, and is subject to the same
limitation on subsequent mutating operations. Note that there is no guarantee or expectation
that the actual upgrade process has succeeded, or even that it is undertaken within this
function; it is entirely possible (likely, even) that the server will only do the actual upgrade
later in the connection lifecycle.

If the adapter does not support the requested protocol this function will raise an
`ArgumentError`. The underlying adapter may also signal errors in the provided arguments by
raising; consult the corresponding adapter documentation for details.

---

*Consult [api-reference.md](api-reference.md) for complete listing*
