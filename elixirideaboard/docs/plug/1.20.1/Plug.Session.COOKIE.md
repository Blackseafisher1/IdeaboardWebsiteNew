# `Plug.Session.COOKIE`
[🔗](https://github.com/elixir-plug/plug/blob/v1.20.1/lib/plug/session/cookie.ex#L1)

Stores the session in a cookie.

This cookie store is based on `Plug.Crypto.MessageVerifier`
and `Plug.Crypto.MessageEncryptor` which encrypts and signs
each cookie to ensure they can't be read nor tampered with.

Since this store uses crypto features, it requires you to
set the `:secret_key_base` field in your connection. This
can be easily achieved with a plug:

    plug :put_secret_key_base

    def put_secret_key_base(conn, _) do
      put_in conn.secret_key_base, "-- LONG STRING WITH AT LEAST 64 BYTES --"
    end

## Options

  * `:secret_key_base` - the secret key base to build the cookie
    signing/encryption on top of. If one is given on initialization,
    the cookie store can precompute all relevant values at compilation
    time. Otherwise, the value is taken from `conn.secret_key_base`
    and cached.

  * `:encryption_salt` - a salt used with `conn.secret_key_base` to generate
    a key for encrypting/decrypting a cookie, can be either a binary or
    an MFA returning a binary;

  * `:signing_salt` - a salt used with `conn.secret_key_base` to generate a
    key for signing/verifying a cookie, can be either a binary or
    an MFA returning a binary;

  * `:key_iterations` - option passed to `Plug.Crypto.KeyGenerator`
    when generating the encryption and signing keys. Defaults to 1000;

  * `:key_length` - option passed to `Plug.Crypto.KeyGenerator`
    when generating the encryption and signing keys. Defaults to 32;

  * `:key_digest` - option passed to `Plug.Crypto.KeyGenerator`
    when generating the encryption and signing keys. Defaults to `:sha256`;

  * `:serializer` - cookie serializer module that defines `encode/1` and
    `decode/1` returning an `{:ok, value}` tuple. Defaults to
    `:external_term_format`.

  * `:log` - Log level to use when the cookie cannot be decoded.
    Defaults to `:debug`, can be set to false to disable it.

  * `:rotating_options` - additional list of options to use when decrypting and
    verifying the cookie. These options are used only when the cookie could not
    be decoded using primary options and are fetched on init so they cannot be
    changed in runtime. Defaults to `[]`.

## Examples

    plug Plug.Session, store: :cookie,
                       key: "_my_app_session",
                       encryption_salt: "cookie store encryption salt",
                       signing_salt: "cookie store signing salt",
                       log: :debug

---

*Consult [api-reference.md](api-reference.md) for complete listing*
