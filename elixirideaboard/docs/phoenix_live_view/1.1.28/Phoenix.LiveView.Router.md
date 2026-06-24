# `Phoenix.LiveView.Router`
[🔗](https://github.com/phoenixframework/phoenix_live_view/blob/v1.1.28/lib/phoenix_live_view/router.ex#L1)

Provides LiveView routing for Phoenix routers.

# `fetch_live_flash`

Fetches the LiveView and merges with the controller flash.

Replaces the default `:fetch_flash` plug used by `Phoenix.Router`.

## Examples

    defmodule MyAppWeb.Router do
      use LiveGenWeb, :router
      import Phoenix.LiveView.Router

      pipeline :browser do
        ...
        plug :fetch_live_flash
      end
      ...
    end

# `live`
*macro* 

Defines a LiveView route.

A LiveView can be routed to by using the `live` macro with a path and
the name of the LiveView:

    live "/thermostat", ThermostatLive

To navigate to this route within your app, you can use `Phoenix.VerifiedRoutes`:

    push_navigate(socket, to: ~p"/thermostat")
    push_patch(socket, to: ~p"/thermostat?page=#{page}")

> #### HTTP requests {: .info}
>
> The HTTP request method that a route defined by the `live/4` macro
> responds to is `GET`.

## Actions and live navigation

It is common for a LiveView to have multiple states and multiple URLs.
For example, you can have a single LiveView that lists all articles on
your web app. For each article there is an "Edit" button which, when
pressed, opens up a modal on the same page to edit the article. It is a
best practice to use live navigation in those cases, so when you click
edit, the URL changes to "/articles/1/edit", even though you are still
within the same LiveView. Similarly, you may also want to show a "New"
button, which opens up the modal to create new entries, and you want
this to be reflected in the URL as "/articles/new".

In order to make it easier to recognize the current "action" your
LiveView is on, you can pass the action option when defining LiveViews
too:

    live "/articles", ArticleLive.Index, :index
    live "/articles/new", ArticleLive.Index, :new
    live "/articles/:id/edit", ArticleLive.Index, :edit

The current action will always be available inside the LiveView as
the `@live_action` assign, that can be used to render a LiveComponent:

```heex
<.live_component :if={@live_action == :new} module={MyAppWeb.ArticleLive.FormComponent} id="form" />
```

Or can be used to show or hide parts of the template:

```heex
{if @live_action == :edit, do: render("form.html", user: @user)}
```

Note that `@live_action` will be `nil` if no action is given on the route definition.

## Options

  * `:container` - an optional tuple for the HTML tag and DOM attributes to
    be used for the LiveView container. For example: `{:li, style: "color: blue;"}`.
    See `Phoenix.Component.live_render/3` for more information and examples.

  * `:as` - optionally configures the named helper. Defaults to `:live` when
    using a LiveView without actions or defaults to the LiveView name when using
    actions.

  * `:metadata` - a map to optional feed metadata used on telemetry events and route info,
    for example: `%{route_name: :foo, access: :user}`. This data can be retrieved by
    calling `Phoenix.Router.route_info/4` with the `uri` from the `handle_params`
    callback. This can be used to customize a LiveView which may be invoked from
    different routes.

  * `:private` - an optional map of private data to put in the *plug connection*,
    for example: `%{route_name: :foo, access: :user}`. The data will be available
    inside `conn.private` in plug functions.

## Examples

    defmodule MyApp.Router
      use Phoenix.Router
      import Phoenix.LiveView.Router

      scope "/", MyApp do
        pipe_through [:browser]

        live "/thermostat", ThermostatLive
        live "/clock", ClockLive
        live "/dashboard", DashboardLive, container: {:main, class: "row"}
      end
    end

    iex> MyApp.Router.Helpers.live_path(MyApp.Endpoint, MyApp.ThermostatLive)
    "/thermostat"

# `live_session`
*macro* 

Defines a live session for live redirects within a group of live routes.

`live_session/3` allow routes defined with `live/4` to support
`navigate` redirects from the client with navigation purely over the existing
websocket connection. This allows live routes defined in the router to
mount a new root LiveView without additional HTTP requests to the server.
For backwards compatibility reasons, all live routes defined outside
of any live session are considered part of a single unnamed live session.

## Security Considerations

In a regular web application, we perform authentication and authorization
checks on every request. Given LiveViews start as a regular HTTP request,
they share the authentication logic with regular requests through plugs.
Once the user is authenticated, we typically validate the sessions on
the `mount` callback. Authorization rules generally happen on `mount`
(for instance, is the user allowed to see this page?) and also on
`handle_event` (is the user allowed to delete this item?). Performing
authorization on mount is important because `navigate`s *do not go
through the plug pipeline*.

`live_session` can be used to draw boundaries between groups of LiveViews.
Redirecting between `live_session`s will always force a full page reload
and establish a brand new LiveView connection. This is useful when LiveViews
require different authentication strategies or simply when they use different
root layouts (as the root layout is not updated between live redirects).

Please [read our guide on the security model](security-model.md) for a
detailed description and general tips on authentication, authorization,
and more.

> #### `live_session` and `forward` {: .warning}
>
> `live_session` does not currently work with `forward`. LiveView expects
> your `live` routes to always be directly defined within the main router
> of your application.

> #### `live_session` and `scope` {: .warning}
>
> Aliases set with `Phoenix.Router.scope/2` are not expanded in `live_session` arguments.
> You must use the full module name instead.

## Options

  * `:session` - An optional extra session map or MFA tuple to be merged with
    the LiveView session. For example, `%{"admin" => true}` or `{MyMod, :session, []}`.
    For MFA, the function is invoked and the `Plug.Conn` struct is prepended
    to the arguments list.

  * `:root_layout` - An optional root layout tuple for the initial HTTP render to
    override any existing root layout set in the router.

  * `:on_mount` - An optional list of hooks to attach to the mount lifecycle _of
    each LiveView in the session_. See `Phoenix.LiveView.on_mount/1`. Passing a
    single value is also accepted.

  * `:layout` - An optional layout the LiveView will be rendered in. Setting
    this option overrides the layout via `use Phoenix.LiveView`. This option
    may be overridden inside a LiveView by returning `{:ok, socket, layout: ...}`
    from the mount callback

## Examples

    scope "/", MyAppWeb do
      pipe_through :browser

      live_session :default do
        live "/feed", FeedLive, :index
        live "/status", StatusLive, :index
        live "/status/:id", StatusLive, :show
      end

      live_session :admin, on_mount: MyAppWeb.AdminLiveAuth do
        live "/admin", AdminDashboardLive, :index
        live "/admin/posts", AdminPostLive, :index
      end
    end

In the example above, we have two live sessions. Live navigation between live views
in the different sessions is not possible and will always require a full page reload.
This is important in the example above because the `:admin` live session has authentication
requirements, defined by `on_mount: MyAppWeb.AdminLiveAuth`, that the other LiveViews
do not have.

If you have both regular HTTP routes (via get, post, etc) and `live` routes, then
you need to perform the same authentication and authorization rules in both.
For example, if you were to add a `get "/admin/health"` route, then you must create
your own plug that performs the same authentication and authorization rules as
`MyAppWeb.AdminLiveAuth`, and then pipe through it:

    scope "/" do
      # Regular routes
      pipe_through [MyAppWeb.AdminPlugAuth]
      get "/admin/health", AdminHealthController, :index

      # Live routes
      live_session :admin, on_mount: MyAppWeb.AdminLiveAuth do
        live "/admin", AdminDashboardLive, :index
        live "/admin/posts", AdminPostLive, :index
      end
    end

---

*Consult [api-reference.md](api-reference.md) for complete listing*
