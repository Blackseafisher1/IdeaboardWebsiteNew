# `Plug.SSL`
[🔗](https://github.com/elixir-plug/plug/blob/v1.20.1/lib/plug/ssl.ex#L1)

A plug to force SSL connections and enable HSTS.

If the scheme of a request is `https`, it'll add a `strict-transport-security`
header to enable HTTP Strict Transport Security by default.

Otherwise, the request will be redirected to a corresponding location
with the `https` scheme by setting the `location` header of the response.
The status code will be 301 if the method of `conn` is `GET` or `HEAD`,
or 307 in other situations.

Besides being a Plug, this module also provides conveniences for configuring
SSL. See `configure/1`.

## x-forwarded-*

If your Plug application is behind a proxy that handles HTTPS, you may
need to tell Plug to parse the proper protocol from the `x-forwarded-*`
header. This can be done using the `:rewrite_on` option:

    plug Plug.SSL, rewrite_on: [:x_forwarded_host, :x_forwarded_port, :x_forwarded_proto]

Rewriting happens on all requests, before the SSL options are processed.
For further details, refer to `Plug.RewriteOn`.

## Plug Options

  * `:rewrite_on` - rewrites the given connection information based on the given headers
  * `:hsts` - a boolean on enabling HSTS or not, defaults to `true`
  * `:expires` - seconds to expires for HSTS, defaults to `31_536_000` (1 year)
  * `:preload` - a boolean to request inclusion on the HSTS preload list
    (for full set of required flags, see: [Chromium HSTS submission site](https://hstspreload.org)),
    defaults to `false`
  * `:subdomains` - a boolean on including subdomains or not in HSTS,
    defaults to `false`
  * `:exclude` - exclude certain request from redirecting to the `https` scheme.
    It defaults to `[hosts: ["localhost", "127.0.0.1"]]`. See the
    ["Exclude option"](#module-exclude-option) section below
  * `:host` - a new host to redirect to if the request's scheme is `http`,
    defaults to `conn.host`. It may be set to a binary or a tuple
    `{module, function, args}` that will be invoked on demand
  * `:log` - The log level at which this plug should log its request info.
    Default is `:info`. Can be `false` to disable logging

## Port

It is not possible to directly configure the port in `Plug.SSL` because
HSTS expects the port to be 443 for SSL. If you are not using HSTS and
want to redirect to HTTPS on another port, you can sneak it alongside
the host, for example: `host: "example.com:443"`.

## Exclude option

There are many situations where one may want to avoid `Plug.SSL` from
redirecting, such as requests coming from `localhost` or `127.0.0.1`,
or from health check endpoints.

This can be done via the `:exclude` option, which allows you to specify
conditions to skip the redirect. As long as any of the conditions match,
the route will be excluded, it must be one of:

  * `[hosts: list_of_hosts, ...]` - skips redirection if the request
    matches any of the given hosts

  * `[paths: list_of_paths, ...]` - skips redirection if the request
    matches any of the given paths

  * `[conn: {mod, fun, args}, ...]` - calls the given `mod`, `fun`,
    and `args` with `Plug.Conn` prepended to the list of arguments.
    The plug will be excluded if the call returns `true`

The default value is `[hosts: ["localhost", "127.0.0.1"]]`. If you pass
any additional value, you must explicitly preserve the above if you want
the hosts to remain excluded.

For example, you may define it as:

    plug Plug.SSL,
      exclude: [
        hosts: ["localhost", "127.0.0.1"],
        paths: ["/health"]
      ]

# `configure`

```elixir
@spec configure([:ssl.tls_server_option()]) ::
  {:ok, [:ssl.tls_server_option()]} | {:error, String.t()}
```

Configures and validates the options given to the `:ssl` application.

This function is often called internally by adapters, such as Cowboy,
to validate and set reasonable defaults for SSL handling. Therefore
Plug users are not expected to invoke it directly, rather you pass
the relevant SSL options to your adapter which then invokes this.

## Options

This function accepts all options defined
[in Erlang/OTP `:ssl` documentation](http://erlang.org/doc/man/ssl.html).

Besides the options from `:ssl`, this function adds one extra option:

  * `:cipher_suite` - it may be `:strong` or `:compatible`,
    as outlined in the following section

Furthermore, it sets the following defaults:

  * `secure_renegotiate: true` - to avoid certain types of man-in-the-middle attacks
  * `reuse_sessions: true` - for improved handshake performance of recurring connections

For a complete guide on HTTPS and best practices, see [our Plug HTTPS Guide](https.html).

## Cipher Suites

To simplify configuration of TLS defaults, this function provides two preconfigured
options: `cipher_suite: :strong` and `cipher_suite: :compatible`. The Ciphers
chosen and related configuration come from the [Transport Layer Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Transport_Layer_Security_Cheat_Sheet.html)

The **Strong** cipher suite supports TLSv1.3 as recommended by the Transport
Layer Security Cheat Sheet. General purpose web applications should default to
TLSv1.3 with ALL other protocols disabled.

The **Compatible** cipher suite supports TLSv1.2 and TLSv1.3. This
suite provides strong security while maintaining compatibility with a wide
range of modern clients.

Legacy protocols TLSv1.1 and TLSv1.0 are officially deprecated by
[RFC 8996](https://www.rfc-editor.org/rfc/rfc8996.html) and are
considered insecure.

[Test your ssl configuration](https://ssl-config.mozilla.org/)

**The cipher suites were last updated on 2025-AUG-28.**

---

*Consult [api-reference.md](api-reference.md) for complete listing*
