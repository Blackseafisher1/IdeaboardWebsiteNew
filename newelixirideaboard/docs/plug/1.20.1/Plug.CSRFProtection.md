# `Plug.CSRFProtection`
[🔗](https://github.com/elixir-plug/plug/blob/v1.20.1/lib/plug/csrf_protection.ex#L1)

Plug to protect from cross-site request forgery.

For this plug to work, it expects a session to have been
previously fetched. It will then compare the token stored
in the session with the one sent by the request to determine
the validity of the request. For an invalid request the action
taken is based on the `:with` option.

The token may be sent by the request either via the params
with key "_csrf_token" or a header with name "x-csrf-token".

GET requests are not protected, as they should not have any
side-effect or change your application state. JavaScript
requests are an exception: by using a script tag, external
websites can embed server-side generated JavaScript, which
can leak information. For this reason, this plug also forbids
any GET JavaScript request that is not XHR (or AJAX).

Note that it is recommended to enable CSRFProtection whenever
a session is used, even for JSON requests. For example, Chrome
had a bug that allowed POST requests to be triggered with
arbitrary content-type, making JSON exploitable. More info:
https://bugs.chromium.org/p/chromium/issues/detail?id=490015

Finally, we recommend developers to invoke `delete_csrf_token/0`
every time after they log a user in, to avoid CSRF fixation
attacks.

## Token generation

This plug won't generate tokens automatically. Instead, tokens
will be generated only when required by calling `get_csrf_token/0`.
In case you are generating the token for certain specific URL,
you should use `get_csrf_token_for/1` as that will avoid tokens
from being leaked to other applications.

Once a token is generated, it is cached in the process dictionary.
The CSRF token is usually generated inside forms which may be
isolated from `Plug.Conn`. Storing them in the process dictionary
allows them to be generated as a side-effect only when necessary,
becoming one of those rare situations where using the process
dictionary is useful.

## Cross-host protection

If you are sending data to a full URI, such as `//subdomain.host.com/path`
or `//external.com/path`, instead of a simple path such as `/path`, you may
want to consider using `get_csrf_token_for/1`, as that will encode the host
in the CSRF token. Once received, Plug will only consider the CSRF token to
be valid if the `host` encoded in the token is the same as the one in
`conn.host`.

Therefore, if you get a warning that the host does not match, it is either
because someone is attempting to steal CSRF tokens or because you have a
misconfigured host configuration.

For example, if you are running your application behind a proxy, the browser
will send a request to the proxy with `www.example.com` but the proxy will
request you using an internal IP. In such cases, it is common for proxies
to attach information such as `"x-forwarded-host"` that contains the original
host.

This may also happen on redirects. If you have a POST request to `foo.example.com`
that redirects to `bar.example.com` with status 307, the token will contain a
different host than the one in the request.

You can pass the `:allow_hosts` option to control any host that you may want
to allow. The values in `:allow_hosts` may either be a full host name or a
host suffix. For example: `["www.example.com", ".subdomain.example.com"]`
will allow the exact host of `"www.example.com"` and any host that ends with
`".subdomain.example.com"`.

## Options

  * `:session_key` - the name of the key in session to store the token under
  * `:allow_hosts` - a list with hosts to allow on cross-host tokens
  * `:with` - should be one of `:exception` or `:clear_session`. Defaults to
  `:exception`.
    * `:exception` -  for invalid requests, this plug will raise
    `Plug.CSRFProtection.InvalidCSRFTokenError`.
    * `:clear_session` -  for invalid requests, this plug will set an empty
    session for only this request. Also any changes to the session during this
    request will be ignored.

## Disabling

You may disable this plug by doing
`Plug.Conn.put_private(conn, :plug_skip_csrf_protection, true)`. This was made
available for disabling `Plug.CSRFProtection` in tests and not for dynamically
skipping `Plug.CSRFProtection` in production code. If you want specific routes to
skip `Plug.CSRFProtection`, then use a different stack of plugs for that route that
does not include `Plug.CSRFProtection`.

## Examples

    plug Plug.Session, ...
    plug :fetch_session
    plug Plug.CSRFProtection

# `delete_csrf_token`

Deletes the CSRF token from the process dictionary.

This will force the token to be deleted once the response is sent.
If you want to refresh the CSRF state, you can call `get_csrf_token/0`
after `delete_csrf_token/0` to ensure a new token is generated.

# `dump_state`

Dump CSRF state from the process dictionary.

This allows it to be loaded in another process.

See `load_state/2` for more information.

# `dump_state_from_session`

Dumps the CSRF state from the session token.

It expects the value of `get_session(conn, "_csrf_token")`
as input. It returns `nil` if the given token is not valid.

# `get_csrf_token`

Gets the CSRF token.

Generates a token and stores it in the process
dictionary if one does not exist.

# `get_csrf_token_for`

Gets the CSRF token for the associated URL (as a string or a URI struct).

If the URL has a host, a CSRF token that is tied to that
host will be generated. If it is a relative path URL, a
simple token emitted with `get_csrf_token/0` will be used.

# `load_state`

Load CSRF state into the process dictionary.

This can be used to load CSRF state into another process.
See `dump_state/0` and `dump_state_from_session/2` for dumping it.

## Examples

To dump the state from the current process and load into another one:

    csrf_state = Plug.CSRFProtection.dump_state()
    secret_key_base = conn.secret_key_base

    Task.async(fn ->
      Plug.CSRFProtection.load_state(secret_key_base, csrf_state)
    end)

If you have a session but the CSRF state was not loaded into the
current process, you can dump the state from the session:

    csrf_state = Plug.CSRFProtection.dump_state_from_session(session["_csrf_token"])

    Task.async(fn ->
      Plug.CSRFProtection.load_state(secret_key_base, csrf_state)
    end)

# `valid_state_and_csrf_token?`

Validates the `csrf_token` against the state.

This is the mechanism used by the Plug itself to match the token
received in the request (via headers or parameters) with the state
(typically stored in the session).

---

*Consult [api-reference.md](api-reference.md) for complete listing*
