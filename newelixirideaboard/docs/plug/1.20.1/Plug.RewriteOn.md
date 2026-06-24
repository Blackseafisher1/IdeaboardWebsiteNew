# `Plug.RewriteOn`
[🔗](https://github.com/elixir-plug/plug/blob/v1.20.1/lib/plug/rewrite_on.ex#L1)

A plug to rewrite the request's host/port/protocol from `x-forwarded-*` headers.

If your Plug application is behind a proxy that handles HTTPS, you may
need to tell Plug to parse the proper protocol from the `x-forwarded-*`
header.

    plug Plug.RewriteOn, [:x_forwarded_host, :x_forwarded_port, :x_forwarded_proto]

The supported values are:

  * `:x_forwarded_for` - to override the remote IP based on the "x-forwarded-for" header
  * `:x_forwarded_host` - to override the host based on the "x-forwarded-host" header
  * `:x_forwarded_port` - to override the port based on the "x-forwarded-port" header
  * `:x_forwarded_proto` - to override the protocol based on the "x-forwarded-proto" header

Some HTTPS proxies use nonstandard headers, which can be specified in the list via tuples:

  * `{:remote_ip, header}` - to override the remote IP based on a custom header
  * `{:host, header}` - to override the host based on a custom header
  * `{:port, header}` - to override the port based on a custom header
  * `{:scheme, header}` - to override the protocol based on a custom header

A tuple representing a Module-Function-Args can also be given as argument
instead of a list.

Since rewriting the scheme based on `x-forwarded-*` headers can open up
security vulnerabilities, only use this plug if:

  * your app is behind a proxy
  * your proxy strips the given `x-forwarded-*` headers from all incoming requests
  * your proxy sets the `x-forwarded-*` headers and sends it to Plug

---

*Consult [api-reference.md](api-reference.md) for complete listing*
