# `Plug.Static`
[🔗](https://github.com/elixir-plug/plug/blob/v1.20.1/lib/plug/static.ex#L1)

A plug for serving static assets.

It requires two options:

  * `:at` - the request path to reach for static assets.
    It must be a string.

  * `:from` - the file system path to read static assets from.
    It can be either: a string containing a file system path, an
    atom representing the application name (where assets will
    be served from `priv/static`), a tuple containing the
    application name and the directory to serve assets from (besides
    `priv/static`), or an MFA tuple.

The preferred form is to use `:from` with an atom or tuple, since
it will make your application independent from the starting directory.
For example, if you pass:

    plug Plug.Static, from: "priv/app/path"

Plug.Static will be unable to serve assets if you build releases
or if you change the current directory. Instead do:

    plug Plug.Static, from: {:app_name, "priv/app/path"}

If a static asset cannot be found, `Plug.Static` simply forwards
the connection to the rest of the pipeline.

## Cache mechanisms

`Plug.Static` uses etags for HTTP caching. This means browsers/clients
should cache assets on the first request and validate the cache on
following requests, not downloading the static asset once again if it
has not changed. The cache-control for etags is specified by the
`cache_control_for_etags` option and defaults to `"public"`.

However, `Plug.Static` also supports direct cache control by using
versioned query strings. If the request query string starts with
"?vsn=", `Plug.Static` assumes the application is versioning assets
and does not set the `ETag` header, meaning the cache behaviour will
be specified solely by the `cache_control_for_vsn_requests` config,
which defaults to `"public, max-age=31536000"`.

## Options

  * `:encodings` - list of 2-ary tuples where first value is value of
    the `Accept-Encoding` header and second is extension of the file to
    be served if given encoding is accepted by client. Entries will be tested
    in order in list, so entries higher in list will be preferred. Defaults
    to: `[]`.

    In addition to setting this value directly it supports 2 additional
    options for compatibility reasons:

      + `:brotli` - will append `{"br", ".br"}` to the encodings list.
      + `:gzip` - will append `{"gzip", ".gz"}` to the encodings list.

    Additional options will be added in the above order (Brotli takes
    preference over Gzip) to reflect older behaviour which was set due
    to fact that Brotli in general provides better compression ratio than
    Gzip.

  * `:cache_control_for_etags` - sets the cache header for requests
    that use etags. Defaults to `"public"`.

  * `:etag_generation` - specify a `{module, function, args}` to be used
    to generate an etag. The `path` of the resource will be passed to
    the function, as well as the `args`. If this option is not supplied,
    etags will be generated based off of file size and modification time.
    Note it is [recommended for the etag value to be quoted](https://tools.ietf.org/html/rfc7232#section-2.3),
    which Plug won't do automatically.

  * `:cache_control_for_vsn_requests` - sets the cache header for
    requests starting with "?vsn=" in the query string. Defaults to
    `"public, max-age=31536000"`.

  * `:only` - filters which requests to serve. This is useful to avoid
    file system access on every request when this plug is mounted
    at `"/"`. For example, if `only: ["images", "favicon.ico"]` is
    specified, only files in the "images" directory and the
    "favicon.ico" file will be served by `Plug.Static`.
    Note that `Plug.Static` matches these filters against request
    uri and not against the filesystem. When requesting
    a file with name containing non-ascii or special characters,
    you should use urlencoded form. For example, you should write
    `only: ["file%20name"]` instead of `only: ["file name"]`.
    Defaults to `nil` (no filtering).

  * `:only_matching` - a relaxed version of `:only` that will
    serve any request as long as one of the given values matches the
    given path. For example, `only_matching: ["images", "favicon"]`
    will match any request that starts at "images" or "favicon",
    be it "/images/foo.png", "/images-high/foo.png", "/favicon.ico"
    or "/favicon-high.ico". Such matches are useful when serving
    digested files at the root. Defaults to `nil` (no filtering).

  * `:raise_on_missing_only` - when `true`, raises an exception if a static
    file exists but does not match the `:only` list. This is useful in
    development to catch missing entries, especially for digested files.
    For example, if `favicon.ico` is in `:only` but the actual file is
    `favicon-deadbeef.ico`, this option will raise an error. Defaults to `false`.

  * `:headers` - other headers to be set when serving static assets. Specify either
    an enum of key-value pairs or a `{module, function, args}` to return an enum. The
    `conn` will be passed to the function, as well as the `args`.

  * `:content_types` - controls custom MIME type mapping.
    It can be a map with filename as key and content type as value to override
    the default type for matching filenames. For example:
    `content_types: %{"apple-app-site-association" => "application/json"}`.
    Alternatively, it can be the value `false` to opt out of setting the header at all. The latter
    can be used to set the header based on custom logic before calling this plug.
    Defaults to an empty map `%{}`.

## Examples

This plug can be mounted in a `Plug.Builder` pipeline as follows:

    defmodule MyPlug do
      use Plug.Builder

      plug Plug.Static,
        at: "/public",
        from: :my_app,
        only: ~w(images robots.txt)
      plug :not_found

      def not_found(conn, _) do
        send_resp(conn, 404, "not found")
      end
    end

---

*Consult [api-reference.md](api-reference.md) for complete listing*
