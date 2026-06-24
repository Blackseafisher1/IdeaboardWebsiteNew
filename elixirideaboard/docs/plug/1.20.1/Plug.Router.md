# `Plug.Router`
[🔗](https://github.com/elixir-plug/plug/blob/v1.20.1/lib/plug/router.ex#L1)

A DSL to define a routing algorithm that works with Plug.

It provides a set of macros to generate routes. For example:

    defmodule AppRouter do
      use Plug.Router

      plug :match
      plug :dispatch

      get "/hello" do
        send_resp(conn, 200, "world")
      end

      match _ do
        send_resp(conn, 404, "oops")
      end
    end

Each route receives a `conn` variable containing a `Plug.Conn`
struct and it needs to return a connection, as per the Plug spec.
A catch-all `match` is recommended to be defined as in the example
above, otherwise routing fails with a function clause error.

The router is itself a plug, which means it can be invoked as:

    AppRouter.call(conn, AppRouter.init([]))

Each `Plug.Router` has a plug pipeline, defined by `Plug.Builder`,
and by default it requires two plugs: `:match` and `:dispatch`.
`:match` is responsible for finding a matching route which is
then forwarded to `:dispatch`. This means users can easily hook
into the router mechanism and add behaviour before match, before
dispatch, or after both. See the `Plug.Builder` module for more
information.

## Routes

    get "/hello" do
      send_resp(conn, 200, "world")
    end

In the example above, a request will only match if it is a `GET`
request and the route is "/hello". The supported HTTP methods are
`get`, `post`, `put`, `patch`, `delete` and `options`.

A route can also specify parameters which will then be available
in the function body:

    get "/hello/:name" do
      send_resp(conn, 200, "hello #{name}")
    end

This means the name can also be used in guards:

    get "/hello/:name" when name in ~w(foo bar) do
      send_resp(conn, 200, "hello #{name}")
    end

The `:name` parameter will also be available in the function body as
`conn.params["name"]` and `conn.path_params["name"]`.

The identifier always starts with `:` and must be followed by letters,
numbers, and underscores, like any Elixir variable. It is possible for
identifiers to be either prefixed or suffixed by other words. For example,
you can include a suffix such as a dot delimited file extension:

    get "/hello/:name.json" do
      send_resp(conn, 200, "hello #{name}")
    end

The above will match `/hello/foo.json` but not `/hello/foo`.
Other delimiters such as `-`, `@` may be used to denote suffixes.

Identifier matching can be escaped using the `\` character:

    get "/hello/\\:greet" do
      send_resp(conn, 200, "hello")
    end

The above will only match `/hello/:greet`.

Routes allow for globbing which will match the remaining parts
of a route. A glob match is done with the `*` character followed
by the variable name. Typically you prefix the variable name with
underscore to discard it:

    get "/hello/*_rest" do
      send_resp(conn, 200, "matches all routes starting with /hello")
    end

But you can also assign the glob to any variable. The contents will
always be a list:

    get "/hello/*glob" do
      send_resp(conn, 200, "route after /hello: #{inspect glob}")
    end

Similarly to `:identifiers`, globs are also escaped using the
`\` character:

    get "/hello/\\*glob" do
      send_resp(conn, 200, "this is not a glob route")
    end

The above will only match `/hello/*glob`.

Opposite to `:identifiers`, globs do not allow prefix nor suffix
matches.

Finally, a general `match` function is also supported:

    match "/hello" do
      send_resp(conn, 200, "world")
    end

A `match` will match any route regardless of the HTTP method.
Check `match/3` for more information on how route compilation
works and a list of supported options.

## Parameter Parsing

Handling request data can be done through the
[`Plug.Parsers`](https://hexdocs.pm/plug/Plug.Parsers.html#content) plug. It
provides support for parsing URL-encoded, form-data, and JSON data as well as
providing a behaviour that other parsers can adopt.

Here is an example of how `Plug.Parsers` can be used in a `Plug.Router` router to
parse the JSON-encoded body of a POST request:

    defmodule AppRouter do
      use Plug.Router

      plug :match

      plug Plug.Parsers,
           parsers: [:json],
           pass:  ["application/json"],
           json_decoder: Jason

      plug :dispatch

      post "/hello" do
        IO.inspect conn.body_params # Prints JSON POST body
        send_resp(conn, 200, "Success!")
      end
    end

It is important that `Plug.Parsers` is placed before the `:dispatch` plug in
the pipeline, otherwise the matched clause route will not receive the parsed
body in its `Plug.Conn` argument when dispatched.

`Plug.Parsers` can also be plugged between `:match` and `:dispatch` (like in
the example above): this means that `Plug.Parsers` will run only if there is a
matching route. This can be useful to perform actions such as authentication
*before* parsing the body, which should only be parsed if a route matches
afterwards.

## Error handling

In case something goes wrong in a request, the router by default
will crash, without returning any response to the client. This
behaviour can be configured in two ways, by using two different
modules:

* `Plug.ErrorHandler` - allows the developer to customize exactly
  which page is sent to the client via the `handle_errors/2` function;

* `Plug.Debugger` - automatically shows debugging and request information
  about the failure. This module is recommended to be used only in a
  development environment.

Here is an example of how both modules could be used in an application:

    defmodule AppRouter do
      use Plug.Router

      if Mix.env == :dev do
        use Plug.Debugger
      end

      use Plug.ErrorHandler

      plug :match
      plug :dispatch

      get "/hello" do
        send_resp(conn, 200, "world")
      end

      defp handle_errors(conn, %{kind: _kind, reason: _reason, stack: _stack}) do
        send_resp(conn, conn.status, "Something went wrong")
      end
    end

## Passing data between routes and plugs

It is also possible to assign data to the `Plug.Conn` that will
be available to any plug invoked after the `:match` plug.
This is very useful if you want a matched route to customize how
later plugs will behave.

You can use `:assigns` (which contains user data) or `:private`
(which contains library/framework data) for this. For example:

    get "/hello", assigns: %{an_option: :a_value} do
      send_resp(conn, 200, "world")
    end

In the example above, `conn.assigns[:an_option]` will be available
to all plugs invoked after `:match`. Such plugs can read from
`conn.assigns` (or `conn.private`) to configure their behaviour
based on the matched route.

## `use` options

All of the options given to `use Plug.Router` are forwarded to
`Plug.Builder`. See the `Plug.Builder` module for more information.

## Telemetry

The router emits the following telemetry events:

  * `[:plug, :router_dispatch, :start]` - dispatched before dispatching to a matched route
    * Measurement: `%{system_time: System.system_time}`
    * Metadata: `%{telemetry_span_context: term(), conn: Plug.Conn.t, route: binary, router: module}`

  * `[:plug, :router_dispatch, :exception]` - dispatched after exceptions on dispatching a route
    * Measurement: `%{duration: native_time}`
    * Metadata: `%{telemetry_span_context: term(), conn: Plug.Conn.t, route: binary, router: module, kind: :throw | :error | :exit, reason: term(), stacktrace: list()}`

  * `[:plug, :router_dispatch, :stop]` - dispatched after successfully dispatching a matched route
    * Measurement: `%{duration: native_time}`
    * Metadata: `%{telemetry_span_context: term(), conn: Plug.Conn.t, route: binary, router: module}`

# `delete`
*macro* 

Dispatches to the path only if the request is a DELETE request.
See `match/3` for more examples.

# `forward`
*macro* 

Forwards requests to another Plug. The `path_info` of the forwarded
connection will exclude the portion of the path specified in the
call to `forward`. If the path contains any parameters, those will
be available in the target Plug in `conn.params` and `conn.path_params`.

## Options

`forward` accepts the following options:

  * `:to` - a Plug the requests will be forwarded to.
  * `:init_opts` - the options for the target Plug. It is the preferred
    mechanism for passing options to the target Plug.
  * `:host` - a string representing the host or subdomain, exactly like in
    `match/3`.
  * `:private` - values for `conn.private`, exactly like in `match/3`.
  * `:assigns` - values for `conn.assigns`, exactly like in `match/3`.

If `:init_opts` is undefined, then all remaining options are passed
to the target plug.

## Examples

    forward "/users", to: UserRouter

Assuming the above code, a request to `/users/sign_in` will be forwarded to
the `UserRouter` plug, which will receive what it will see as a request to
`/sign_in`.

    forward "/foo/:bar/qux", to: FooPlug

Here, a request to `/foo/BAZ/qux` will be forwarded to the `FooPlug`
plug, which will receive what it will see as a request to `/`,
and `conn.params["bar"]` will be set to `"BAZ"`.

Some other examples:

    forward "/foo/bar", to: :foo_bar_plug, host: "foobar."
    forward "/baz", to: BazPlug, init_opts: [plug_specific_option: true]

# `get`
*macro* 

Dispatches to the path only if the request is a GET request.
See `match/3` for more examples.

# `head`
*macro* 

Dispatches to the path only if the request is a HEAD request.
See `match/3` for more examples.

# `match`
*macro* 

Main API to define routes.

It accepts an expression representing the path and many options
allowing the match to be configured.

The route can dispatch either to a function body or a Plug module.

## Examples

    match "/foo/bar", via: :get do
      send_resp(conn, 200, "hello world")
    end

    match "/baz", to: MyPlug, init_opts: [an_option: :a_value]

## Options

`match/3` and the other route macros accept the following options:

  * `:host` - the host which the route should match. Defaults to `nil`,
    meaning no host match, but can be a string like "example.com" or a
    string ending with ".", like "subdomain." for a subdomain match.

  * `:private` - assigns values to `conn.private` for use in the match

  * `:assigns` - assigns values to `conn.assigns` for use in the match

  * `:via` - matches the route against some specific HTTP method(s) specified
    as an atom, like `:get` or `:put`, or a list, like `[:get, :post]`.

  * `:do` - contains the implementation to be invoked in case
    the route matches.

  * `:to` - a Plug that will be called in case the route matches.

  * `:init_opts` - the options for the target Plug given by `:to`.

A route should specify only one of `:do` or `:to` options.

# `match_path`

```elixir
@spec match_path(Plug.Conn.t()) :: String.t()
```

Returns the path of the route that the request was matched to.

# `options`
*macro* 

Dispatches to the path only if the request is an OPTIONS request.
See `match/3` for more examples.

# `patch`
*macro* 

Dispatches to the path only if the request is a PATCH request.
See `match/3` for more examples.

# `post`
*macro* 

Dispatches to the path only if the request is a POST request.
See `match/3` for more examples.

# `put`
*macro* 

Dispatches to the path only if the request is a PUT request.
See `match/3` for more examples.

---

*Consult [api-reference.md](api-reference.md) for complete listing*
