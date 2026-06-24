# `Plug.MethodOverride`
[🔗](https://github.com/elixir-plug/plug/blob/v1.20.1/lib/plug/method_override.ex#L1)

This plug overrides the request's `POST` method with the method defined in
the `_method` request parameter.

The `POST` method can be overridden only by these HTTP methods:

  * `PUT`
  * `PATCH`
  * `DELETE`

This plug only replaces the request method if the `_method` request
parameter is a string. If the `_method` request parameter is not a string,
the request method is not changed.

> #### Parse Body Parameters First {: .info}
>
> This plug expects the body parameters to be **already fetched and
> parsed**. Those can be fetched with `Plug.Parsers`.

This plug doesn't accept any options.

To recap, here are all the conditions that the request must meet in order
for this plug to replace the `:method` field in the `Plug.Conn`:

  1. The conn's request `:method` must be `POST`.
  1. The conn's `:body_params` must have been fetched already (for example,
     with `Plug.Parsers`).
  1. The conn's `:body_params` must have a `_method` field that is a string
     and whose value is `"PUT"`, `"PATCH"`, or `"DELETE"` (case insensitive).

## Usage

    # You'll need to fetch and parse parameters first, for example:
    # plug Plug.Parsers, parsers: [:urlencoded, :multipart, :json]

    plug Plug.MethodOverride

---

*Consult [api-reference.md](api-reference.md) for complete listing*
