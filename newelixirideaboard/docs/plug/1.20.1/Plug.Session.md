# `Plug.Session`
[🔗](https://github.com/elixir-plug/plug/blob/v1.20.1/lib/plug/session.ex#L1)

A plug to handle session cookies and session stores.

The session is accessed via functions on `Plug.Conn`. Cookies and
session have to be fetched with `Plug.Conn.fetch_session/1` before the
session can be accessed.

The session is also lazy. Once configured, a cookie header with the
session will only be sent to the client if something is written to the
session in the first place.

When using `Plug.Session`, also consider using `Plug.CSRFProtection`
to avoid Cross Site Request Forgery attacks.

## Session stores

See `Plug.Session.Store` for the specification session stores are required to
implement.

Plug ships with the following session stores:

  * `Plug.Session.ETS`
  * `Plug.Session.COOKIE`

## Options

  * `:store` - session store module (required);
  * `:key` - session cookie key (required);
  * `:domain` - see `Plug.Conn.put_resp_cookie/4`;
  * `:max_age` - see `Plug.Conn.put_resp_cookie/4`;
  * `:path` - see `Plug.Conn.put_resp_cookie/4`;
  * `:secure` - see `Plug.Conn.put_resp_cookie/4`;
  * `:http_only` - see `Plug.Conn.put_resp_cookie/4`;
  * `:same_site` - see `Plug.Conn.put_resp_cookie/4`;
  * `:extra` - see `Plug.Conn.put_resp_cookie/4`;

Additional options can be given to the session store, see the store's
documentation for the options it accepts.

## Examples

    plug Plug.Session, store: :ets, key: "_my_app_session", table: :session

---

*Consult [api-reference.md](api-reference.md) for complete listing*
