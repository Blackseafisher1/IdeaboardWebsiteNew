# `Plug.BasicAuth`
[🔗](https://github.com/elixir-plug/plug/blob/v1.20.1/lib/plug/basic_auth.ex#L1)

Functionality for providing Basic HTTP authentication.

It is recommended to only use this module in production
if SSL is enabled and enforced. See `Plug.SSL` for more
information.

## Compile-time usage

If you have a single username and password, you can use
the `basic_auth/2` plug:

    import Plug.BasicAuth
    plug :basic_auth, username: "hello", password: "secret"

Or if you would rather put those in a config file:

    # lib/your_app.ex
    import Plug.BasicAuth
    plug :basic_auth, Application.compile_env(:my_app, :basic_auth)

    # config/config.exs
    config :my_app, :basic_auth, username: "hello", password: "secret"

Once the user first accesses the page, the request will be denied
with reason 401 and the request is halted. The browser will then
prompt the user for username and password. If they match, then the
request succeeds.

Both approaches shown above rely on static configuration. Let's see
alternatives.

## Runtime usage

As any other Plug, we can use the `basic_auth` at runtime by simply
wrapping it in a function:

    plug :auth

    defp auth(conn, _opts) do
      username = System.fetch_env!("AUTH_USERNAME")
      password = System.fetch_env!("AUTH_PASSWORD")
      Plug.BasicAuth.basic_auth(conn, username: username, password: password)
    end

This approach is useful when both username and password are specified
upfront and available at runtime. However, you may also want to compute
a different password for each different user. In those cases, we can use
the low-level API.

## Low-level usage

If you want to provide your own authentication logic on top of Basic HTTP
auth, you can use the low-level functions. As an example, we define `:auth`
plug that extracts username and password from the request headers, compares
them against the database, and either assigns a `:current_user` on success
or responds with an error on failure.

    plug :auth

    defp auth(conn, _opts) do
      with {user, pass} <- Plug.BasicAuth.parse_basic_auth(conn),
           %User{} = user <- MyApp.Accounts.find_by_username_and_password(user, pass) do
        assign(conn, :current_user, user)
      else
        _ -> conn |> Plug.BasicAuth.request_basic_auth() |> halt()
      end
    end

Keep in mind that:

  * The supplied `user` and `pass` may be empty strings;

  * If you are comparing the username and password with existing strings,
    do not use `==/2` or pattern matching. Use `Plug.Crypto.secure_compare/2`
    instead.

# `basic_auth`

```elixir
@spec basic_auth(Plug.Conn.t(), [auth_option]) :: Plug.Conn.t()
when auth_option:
       {:username, String.t()} | {:password, String.t()} | {:realm, String.t()}
```

Higher level usage of Basic HTTP auth.

See the module docs for examples.

## Options

  * `:username` - the expected username
  * `:password` - the expected password
  * `:realm` - the authentication realm. The value is not fully
    sanitized, so do not accept user input as the realm and use
    strings with only alphanumeric characters and space

# `encode_basic_auth`

```elixir
@spec encode_basic_auth(String.t(), String.t()) :: String.t()
```

Encodes a basic authentication header.

This can be used during tests:

    put_req_header(conn, "authorization", encode_basic_auth("hello", "world"))

# `parse_basic_auth`

```elixir
@spec parse_basic_auth(Plug.Conn.t()) ::
  {user :: String.t(), password :: String.t()} | :error
```

Parses the request username and password from Basic HTTP auth.

It returns either `{user, pass}` or `:error`. Note the username
and password may be empty strings. When comparing the username
and password with the expected values, be sure to use
`Plug.Crypto.secure_compare/2`.

See the module docs for examples.

# `request_basic_auth`

```elixir
@spec request_basic_auth(Plug.Conn.t(), [option]) :: Plug.Conn.t()
when option: {:realm, String.t()}
```

Requests basic authentication from the client.

It sets the response to status 401 with "Unauthorized" as body.
The response is not sent though (nor the connection is halted),
allowing developers to further customize it.

## Options

  * `:realm` - the authentication realm. The value is not fully
    sanitized, so do not accept user input as the realm and use
    strings with only alphanumeric characters and space

---

*Consult [api-reference.md](api-reference.md) for complete listing*
