# `Phoenix.LiveView`
[🔗](https://github.com/phoenixframework/phoenix_live_view/blob/v1.1.28/lib/phoenix_live_view.ex#L1)

A LiveView is a process that receives events, updates
its state, and renders updates to a page as diffs.

To get started, see [the Welcome guide](welcome.md).
This module provides advanced documentation and features
about using LiveView.

## Life-cycle

A LiveView begins as a regular HTTP request and HTML response,
and then upgrades to a stateful view on client connect,
guaranteeing a regular HTML page even if JavaScript is disabled.
Any time a stateful view changes or updates its socket assigns, it is
automatically re-rendered and the updates are pushed to the client.

Socket assigns are stateful values kept on the server side in
`Phoenix.LiveView.Socket`. This is different from the common stateless
HTTP pattern of sending the connection state to the client in the form
of a token or cookie and rebuilding the state on the server to service
every request.

You begin by rendering a LiveView typically from your router.
When LiveView is first rendered, the `c:mount/3` callback is invoked
with the current params, the current session and the LiveView socket.
As in a regular request, `params` contains public data that can be
modified by the user. The `session` always contains private data set
by the application itself. The `c:mount/3` callback wires up socket
assigns necessary for rendering the view. After mounting, `c:handle_params/3`
is invoked so uri and query params are handled. Finally, `c:render/1`
is invoked and the HTML is sent as a regular HTML response to the
client.

After rendering the static page, LiveView connects from the client
to the server where stateful views are spawned to push rendered updates
to the browser, and receive client events via `phx-` bindings. Just like
the first rendering, `c:mount/3`, is invoked  with params, session,
and socket state. However in the connected client case, a LiveView process
is spawned on the server, runs `c:handle_params/3` again and then pushes
the result of `c:render/1` to the client and continues on for the duration
of the connection. If at any point during the stateful life-cycle a crash
is encountered, or the client connection drops, the client gracefully
reconnects to the server, calling `c:mount/3` and `c:handle_params/3` again.

LiveView also allows attaching hooks to specific life-cycle stages with
`attach_hook/4`.

## Template collocation

There are two possible ways of rendering content in a LiveView. The first
one is by explicitly defining a render function, which receives `assigns`
and returns a `HEEx` template defined with [the `~H` sigil](`Phoenix.Component.sigil_H/2`).

    defmodule MyAppWeb.DemoLive do
      # In a typical Phoenix app, the following line would usually be `use MyAppWeb, :live_view`
      use Phoenix.LiveView

      def render(assigns) do
        ~H"""
        Hello world!
        """
      end
    end

For larger templates, you can place them in a file in the same directory
and same name as the LiveView. For example, if the file above is placed
at `lib/my_app_web/live/demo_live.ex`, you can also remove the
`render/1` function altogether and put the template code at
`lib/my_app_web/live/demo_live.html.heex`.

## Async Operations

Performing asynchronous work is common in LiveViews and LiveComponents.
It allows the user to get a working UI quickly while the system fetches some
data in the background or talks to an external service, without blocking the
render or event handling. For async work, you also typically need to handle
the different states of the async operation, such as loading, error, and the
successful result. You also want to catch any errors or exits and translate it
to a meaningful update in the UI rather than crashing the user experience.

### Async assigns

The `assign_async/3` function takes the socket, a key or list of keys which will be assigned
asynchronously, and a function. This function will be wrapped in a `task` by
`assign_async`, making it easy for you to return the result. This function must
return an `{:ok, assigns}` or `{:error, reason}` tuple, where `assigns` is a map
of the keys passed to `assign_async`.
If the function returns anything else, an error is raised.

The task is only started when the socket is connected.

For example, let's say we want to async fetch a user's organization from the database,
as well as their profile and rank:

    def mount(%{"slug" => slug}, _, socket) do
      {:ok,
       socket
       |> assign(:foo, "bar")
       |> assign_async(:org, fn -> {:ok, %{org: fetch_org!(slug)}} end)
       |> assign_async([:profile, :rank], fn -> {:ok, %{profile: ..., rank: ...}} end)}
    end

> ### Warning {: .warning}
>
> When using async operations it is important to not pass the socket into the function
> as it will copy the whole socket struct to the Task process, which can be very expensive.
>
> Instead of:
>
> ```elixir
> assign_async(:org, fn -> {:ok, %{org: fetch_org(socket.assigns.slug)}} end)
> ```
>
> We should do:
>
> ```elixir
> slug = socket.assigns.slug
> assign_async(:org, fn -> {:ok, %{org: fetch_org(slug)}} end)
> ```
>
> See: https://hexdocs.pm/elixir/process-anti-patterns.html#sending-unnecessary-data

The state of the async operation is stored as a `Phoenix.LiveView.AsyncResult`
in the socket assigns. It carries the loading and failed states, as
well as the result. For example, if we wanted to show the loading states in
the UI for the `:org`, our template could conditionally render the states:

```heex
<div :if={@org.loading}>Loading organization...</div>
<div :if={org = @org.ok? && @org.result}>{org.name} loaded!</div>
```

The `Phoenix.Component.async_result/1` function component can also be used to
declaratively render the different states using slots:

```heex
<.async_result :let={org} assign={@org}>
  <:loading>Loading organization...</:loading>
  <:failed :let={_failure}>there was an error loading the organization</:failed>
  {org.name}
</.async_result>
```

### Arbitrary async operations

Sometimes you need lower level control of asynchronous operations, while
still receiving process isolation and error handling. For this, you can use
`start_async/3` and the `Phoenix.LiveView.AsyncResult` module directly:

    def mount(%{"id" => id}, _, socket) do
      {:ok,
       socket
       |> assign(:org, AsyncResult.loading())
       |> start_async(:my_task, fn -> fetch_org!(id) end)}
    end

    def handle_async(:my_task, {:ok, fetched_org}, socket) do
      %{org: org} = socket.assigns
      {:noreply, assign(socket, :org, AsyncResult.ok(org, fetched_org))}
    end

    def handle_async(:my_task, {:exit, reason}, socket) do
      %{org: org} = socket.assigns
      {:noreply, assign(socket, :org, AsyncResult.failed(org, {:exit, reason}))}
    end

`start_async/3` is used to fetch the organization asynchronously. The
`c:handle_async/3` callback is called when the task completes or exits,
with the results wrapped in either `{:ok, result}` or `{:exit, reason}`.
The `AsyncResult` module provides functions to update the state of the
async operation, but you can also assign any value directly to the socket
if you want to handle the state yourself.

## Endpoint configuration

LiveView accepts the following configuration in your endpoint under
the `:live_view` key:

  * `:signing_salt` (required) - the salt used to sign data sent
    to the client

  * `:hibernate_after` (optional) - the idle time in milliseconds allowed in
  the LiveView before compressing its own memory and state.
  Defaults to 15000ms (15 seconds)

# `unsigned_params`

```elixir
@type unsigned_params() :: map()
```

# `handle_async`
*optional* 

```elixir
@callback handle_async(
  name :: term(),
  async_fun_result :: {:ok, term()} | {:exit, term()},
  socket :: Phoenix.LiveView.Socket.t()
) :: {:noreply, Phoenix.LiveView.Socket.t()}
```

Invoked when the result of an `start_async/3` operation is available.

For a deeper understanding of using this callback,
refer to the ["Arbitrary async operations"](#module-arbitrary-async-operations) section.

# `handle_call`
*optional* 

```elixir
@callback handle_call(
  msg :: term(),
  {pid(), reference()},
  socket :: Phoenix.LiveView.Socket.t()
) ::
  {:noreply, Phoenix.LiveView.Socket.t()}
  | {:reply, term(), Phoenix.LiveView.Socket.t()}
```

Invoked to handle calls from other Elixir processes.

See `GenServer.call/3` and `c:GenServer.handle_call/3`
for more information.

# `handle_cast`
*optional* 

```elixir
@callback handle_cast(msg :: term(), socket :: Phoenix.LiveView.Socket.t()) ::
  {:noreply, Phoenix.LiveView.Socket.t()}
```

Invoked to handle casts from other Elixir processes.

See `GenServer.cast/2` and `c:GenServer.handle_cast/2`
for more information. It must always return `{:noreply, socket}`,
where `:noreply` means no additional information is sent
to the process which cast the message.

# `handle_event`
*optional* 

```elixir
@callback handle_event(
  event :: binary(),
  unsigned_params(),
  socket :: Phoenix.LiveView.Socket.t()
) ::
  {:noreply, Phoenix.LiveView.Socket.t()}
  | {:reply, map(), Phoenix.LiveView.Socket.t()}
```

Invoked to handle events sent by the client.

It receives the `event` name, the event payload as a map,
and the socket.

It must return `{:noreply, socket}`, where `:noreply` means
no additional information is sent to the client, or
`{:reply, map(), socket}`, where the given `map()` is encoded
and sent as a reply to the client.

# `handle_info`
*optional* 

```elixir
@callback handle_info(msg :: term(), socket :: Phoenix.LiveView.Socket.t()) ::
  {:noreply, Phoenix.LiveView.Socket.t()}
```

Invoked to handle messages from other Elixir processes.

See `Kernel.send/2` and `c:GenServer.handle_info/2`
for more information. It must always return `{:noreply, socket}`,
where `:noreply` means no additional information is sent
to the process which sent the message.

# `handle_params`
*optional* 

```elixir
@callback handle_params(
  unsigned_params(),
  uri :: String.t(),
  socket :: Phoenix.LiveView.Socket.t()
) ::
  {:noreply, Phoenix.LiveView.Socket.t()}
```

Invoked after mount and whenever there is a live patch event.

It receives the current `params`, including parameters from
the router, the current `uri` from the client and the `socket`.
It is invoked after mount or whenever there is a live navigation
event caused by `push_patch/2` or `<.link patch={...}>`.

It must always return `{:noreply, socket}`, where `:noreply`
means no additional information is sent to the client.

> #### Note {: .warning}
>
> `handle_params` is only allowed on LiveViews mounted at the router,
> as it takes the current url of the page as the second parameter.

# `mount`
*optional* 

```elixir
@callback mount(
  params :: unsigned_params() | :not_mounted_at_router,
  session :: map(),
  socket :: Phoenix.LiveView.Socket.t()
) ::
  {:ok, Phoenix.LiveView.Socket.t()}
  | {:ok, Phoenix.LiveView.Socket.t(), keyword()}
```

The LiveView entry-point.

For each LiveView in the root of a template, `c:mount/3` is invoked twice:
once to do the initial page load and again to establish the live socket.

It expects three arguments:

  * `params` - a map of string keys which contain public information that
    can be set by the user. The map contains the query params as well as any
    router path parameter. If the LiveView was not mounted at the router,
    this argument is the atom `:not_mounted_at_router`
  * `session` - the connection session
  * `socket` - the LiveView socket

It must return either `{:ok, socket}` or `{:ok, socket, options}`, where
`options` is one of:

  * `:temporary_assigns` - a keyword list of assigns that are temporary
    and must be reset to their value after every render. Note that once
    the value is reset, it won't be re-rendered again until it is explicitly
    assigned

  * `:layout` - the optional layout to be used by the LiveView. Setting
    this option will override any layout previously set via
    `Phoenix.LiveView.Router.live_session/2` or on `use Phoenix.LiveView`

# `render`
*optional* 

```elixir
@callback render(assigns :: Phoenix.LiveView.Socket.assigns()) ::
  Phoenix.LiveView.Rendered.t()
```

Renders a template.

This callback is invoked whenever LiveView detects
new content must be rendered and sent to the client.

If you define this function, it must return a template
defined via the `Phoenix.Component.sigil_H/2`.

If you don't define this function, LiveView will attempt
to render a template in the same directory as your LiveView.
For example, if you have a LiveView named `MyApp.MyCustomView`
inside `lib/my_app/live_views/my_custom_view.ex`, Phoenix
will look for a template at `lib/my_app/live_views/my_custom_view.html.heex`.

# `terminate`
*optional* 

```elixir
@callback terminate(reason, socket :: Phoenix.LiveView.Socket.t()) :: term()
when reason: :normal | :shutdown | {:shutdown, :left | :closed | term()}
```

Invoked when the LiveView is terminating.

In case of errors, this callback is only invoked if the LiveView
is trapping exits. See `c:GenServer.terminate/2` for more info.

# `__live__`

Defines metadata for a LiveView.

This must be returned from the `__live__` callback.

It accepts:

  * `:container` - an optional tuple for the HTML tag and DOM attributes to
    be used for the LiveView container. For example: `{:li, style: "color: blue;"}`.

  * `:layout` - configures the layout the LiveView will be rendered in.
    This layout can be overridden by on `c:mount/3` or via the `:layout`
    option in `Phoenix.LiveView.Router.live_session/2`

  * `:log` - configures the log level for the LiveView, either `false`
    or a log level

  * `:on_mount` - a list of tuples with module names and argument to be invoked
    as `on_mount` hooks

# `__using__`
*macro* 

Uses LiveView in the current module to mark it a LiveView.

    use Phoenix.LiveView,
      container: {:tr, class: "colorized"},
      layout: {MyAppWeb.Layouts, :app},
      log: :info

## Options

  * `:container` - an optional tuple for the HTML tag and DOM attributes to
    be used for the LiveView container. For example: `{:li, style: "color: blue;"}`.
    See `Phoenix.Component.live_render/3` for more information and examples.

  * `:global_prefixes` - the global prefixes to use for components. See
    `Global Attributes` in `Phoenix.Component` for more information.

  * `:layout` - configures the layout the LiveView will be rendered in.
    This layout can be overridden by on `c:mount/3` or via the `:layout`
    option in `Phoenix.LiveView.Router.live_session/2`

  * `:log` - configures the log level for the LiveView, either `false`
    or a log level

# `allow_upload`

Allows an upload for the provided name.

## Options

  * `:accept` - Required. A list of unique file extensions (such as ".jpeg") or
    mime type (such as "image/jpeg" or "image/*"). You may also pass the atom
    `:any` instead of a list to support to allow any kind of file.
    For example, `[".jpeg"]`, `:any`, etc.

  * `:max_entries` - The maximum number of selected files to allow per
    file input. Defaults to 1.

  * `:max_file_size` - The maximum file size in bytes to allow to be uploaded.
    Defaults 8MB. For example, `12_000_000`.

  * `:chunk_size` - The chunk size in bytes to send when uploading.
    Defaults `64_000`.

  * `:chunk_timeout` - The time in milliseconds to wait before closing the
    upload channel when a new chunk has not been received. Defaults to `10_000`.

  * `:external` - A 2-arity function for generating metadata for external
    client uploaders. This function must return either `{:ok, meta, socket}`
    or `{:error, meta, socket}` where meta is a map. See the Uploads section
    for example usage.

  * `:progress` - An optional 3-arity function for receiving progress events.

  * `:auto_upload` - Instructs the client to upload the file automatically
    on file selection instead of waiting for form submits. Defaults to `false`.

  * `:writer` - A 3-arity anonymous function that returns a tuple with a module
    implementing the `Phoenix.LiveView.UploadWriter` behaviour and its options to use for
    writing the uploaded chunks. Defaults to writing to a temporary file for consumption.
    See the `Phoenix.LiveView.UploadWriter` docs for custom usage.

Raises when a previously allowed upload under the same name is still active.

## Examples

    allow_upload(socket, :avatar, accept: ~w(.jpg .jpeg), max_entries: 2)
    allow_upload(socket, :avatar, accept: :any)

For consuming files automatically as they are uploaded, you can pair `auto_upload: true` with
a custom progress function to consume the entries as they are completed. For example:

    allow_upload(socket, :avatar, accept: :any, progress: &handle_progress/3, auto_upload: true)

    defp handle_progress(:avatar, entry, socket) do
      if entry.done? do
        uploaded_file =
          consume_uploaded_entry(socket, entry, fn %{} = meta ->
            {:ok, ...}
          end)

        {:noreply, put_flash(socket, :info, "file #{uploaded_file.name} uploaded")}
      else
        {:noreply, socket}
      end
    end

# `assign_async`
*macro* 

Assigns keys asynchronously.

Wraps your function in a task linked to the caller, errors are wrapped.
Each key passed to `assign_async/3` will be assigned to
an `Phoenix.LiveView.AsyncResult` struct holding the status of the operation
and the result when the function completes.

The function must return either a map or a keyword list with the assigns
to merge into the socket.

The task is only started when the socket is connected.

## Options

  * `:supervisor` - allows you to specify a `Task.Supervisor` to supervise the task.
  * `:reset` - remove previous results during async operation when true. Possible values are
    `true`, `false`, or a list of keys to reset. Defaults to `false`.

## Examples

```elixir
def mount(%{"slug" => slug}, _, socket) do
  {:ok,
    socket
    |> assign(:foo, "bar")
    |> assign_async(:org, fn -> {:ok, %{org: fetch_org!(slug)}} end)
    |> assign_async([:profile, :rank], fn -> {:ok, %{profile: ..., rank: ...}} end)}
end
```

See [Async Operations](#module-async-operations) for more information.

## `assign_async/3` and `send_update/3`

Since the code inside `assign_async/3` runs in a separate process,
`send_update(Component, data)` does not work inside `assign_async/3`,
since `send_update/2` assumes it is running inside the LiveView process.
The solution is to explicitly send the update to the LiveView:

```elixir
parent = self()
assign_async(socket, :org, fn ->
  # ...
  send_update(parent, Component, data)
end)
```

## Testing async operations

When testing LiveViews and LiveComponents with async assigns, use
`Phoenix.LiveViewTest.render_async/2` to ensure the test waits until the async operations
are complete before proceeding with assertions or before ending the test. For example:

```elixir
{:ok, view, _html} = live(conn, "/my_live_view")
html = render_async(view)
assert html =~ "My assertion"
```

Not calling `render_async/2` to ensure all async assigns have finished might result in errors in
cases where your process has side effects:

```
[error] MyXQL.Connection (#PID<0.308.0>) disconnected: ** (DBConnection.ConnectionError) client #PID<0.794.0>
```

# `attach_hook`

Attaches the given `fun` by `name` for the lifecycle `stage` into `socket`.

> Note: This function is for server-side lifecycle callbacks.
> For client-side hooks, see the
> [JS Interop guide](js-interop.html#client-hooks-via-phx-hook).

Hooks provide a mechanism to tap into key stages of the LiveView
lifecycle in order to bind/update assigns, intercept events,
patches, and regular messages when necessary, and to inject
common functionality. Use `attach_hook/4` on any of the following
lifecycle stages: `:handle_params`, `:handle_event`, `:handle_info`, `:handle_async`, and
`:after_render`. To attach a hook to the `:mount` stage, use `on_mount/1`.

> Note: only `:after_render`, `:handle_event` and `:handle_async` hooks are currently supported in
> LiveComponents.

## Return Values

Lifecycle hooks take place immediately before a given lifecycle
callback is invoked on the LiveView. With the exception of `:after_render`,
a hook may return `{:halt, socket}` to halt the reduction, otherwise
it must return `{:cont, socket}` so the operation may continue until
all hooks have been invoked for the current stage.

For `:after_render` hooks, the `socket` itself must be returned.
Any updates to the socket assigns *will not* trigger a new render
or diff calculation to the client.

## Halting the lifecycle

Note that halting from a hook _will halt the entire lifecycle stage_.
This means that when a hook returns `{:halt, socket}` then the
LiveView callback will **not** be invoked. This has some
implications.

### Implications for plugin authors

When defining a plugin that matches on specific callbacks, you **must**
define a catch-all clause, as your hook will be invoked even for events
you may not be interested in.

### Implications for end-users

Allowing a hook to halt the invocation of the callback means that you can
attach hooks to intercept specific events before detaching themselves,
while allowing other events to continue normally.

## Replying to events

Hooks attached to the `:handle_event` stage are able to reply to client events
by returning `{:halt, reply, socket}`. This is useful especially for [JavaScript
interoperability](js-interop.html#client-hooks-via-phx-hook) because a client hook
can push an event and receive a reply.

## Sharing event handling logic

Lifecycle hooks are an excellent way to extract related events out of the parent LiveView and
into separate modules without resorting unnecessarily to LiveComponents for organization.

    defmodule DemoLive do
      use Phoenix.LiveView

      def render(assigns) do
        ~H"""
        <div>
          <div>
            Counter: {@counter}
            <button phx-click="inc">+</button>
          </div>

          <MySortComponent.display lists={[first_list: @first_list, second_list: @second_list]} />
        </div>
        """
      end

      def mount(_params, _session, socket) do
        first_list = for(i <- 1..9, do: "First List #{i}") |> Enum.shuffle()
        second_list = for(i <- 1..9, do: "Second List #{i}") |> Enum.shuffle()

        socket =
          socket
          |> assign(:counter, 0)
          |> assign(first_list: first_list)
          |> assign(second_list: second_list)
          |> attach_hook(:sort, :handle_event, &MySortComponent.hooked_event/3)  # 2) Delegated events
        {:ok, socket}
      end

      # 1) Normal event
      def handle_event("inc", _params, socket) do
        {:noreply, update(socket, :counter, &(&1 + 1))}
      end
    end

    defmodule MySortComponent do
      use Phoenix.Component

      def display(assigns) do
        ~H"""
        <div :for={{key, list} <- @lists}>
          <ul><li :for={item <- list}>{item}</li></ul>
          <button phx-click="shuffle" phx-value-list={key}>Shuffle</button>
          <button phx-click="sort" phx-value-list={key}>Sort</button>
        </div>
        """
      end

      def hooked_event("shuffle", %{"list" => key}, socket) do
        key = String.to_existing_atom(key)
        shuffled = Enum.shuffle(socket.assigns[key])

        {:halt, assign(socket, key, shuffled)}
      end

      def hooked_event("sort", %{"list" => key}, socket) do
        key = String.to_existing_atom(key)
        sorted = Enum.sort(socket.assigns[key])

        {:halt, assign(socket, key, sorted)}
      end

      def hooked_event(_event, _params, socket), do: {:cont, socket}
    end

## Other examples

Attaching and detaching a hook:

    def mount(_params, _session, socket) do
      socket =
        attach_hook(socket, :my_hook, :handle_event, fn
          "very-special-event", _params, socket ->
            # Handle the very special event and then detach the hook
            {:halt, detach_hook(socket, :my_hook, :handle_event)}

          _event, _params, socket ->
            {:cont, socket}
        end)

      {:ok, socket}
    end

Replying to a client event:

```javascript
/**
 * @type {import("phoenix_live_view").HooksOption}
 */
let Hooks = {}
Hooks.ClientHook = {
  mounted() {
    this.pushEvent("ClientHook:mounted", {hello: "world"}, (reply) => {
      console.log("received reply:", reply)
    })
  }
}
let liveSocket = new LiveSocket("/live", Socket, {hooks: Hooks, ...})
```

    def render(assigns) do
      ~H"""
      <div id="my-client-hook" phx-hook="ClientHook"></div>
      """
    end

    def mount(_params, _session, socket) do
      socket =
        attach_hook(socket, :reply_on_client_hook_mounted, :handle_event, fn
          "ClientHook:mounted", params, socket ->
            {:halt, params, socket}

          _, _, socket ->
            {:cont, socket}
        end)

      {:ok, socket}
    end

# `cancel_async`

Cancels an async operation if one exists.

Accepts either the `%AsyncResult{}` when using `assign_async/3` or
the key passed to `start_async/3`.

The underlying process will be killed with the provided reason, or
with `{:shutdown, :cancel}` if no reason is passed. For `assign_async/3`
operations, the `:failed` field will be set to `{:exit, reason}`.
For `start_async/3`, the `c:handle_async/3` callback will receive
`{:exit, reason}` as the result.

Returns the `%Phoenix.LiveView.Socket{}`.

## Examples

    cancel_async(socket, :preview)
    cancel_async(socket, :preview, :my_reason)
    cancel_async(socket, socket.assigns.preview)

# `cancel_upload`

Cancels an upload for the given entry.

## Examples

```heex
<%= for entry <- @uploads.avatar.entries do %>
  ...
  <button phx-click="cancel-upload" phx-value-ref={entry.ref}>cancel</button>
<% end %>
```

    def handle_event("cancel-upload", %{"ref" => ref}, socket) do
      {:noreply, cancel_upload(socket, :avatar, ref)}
    end

# `clear_flash`

Clears the flash.

## Examples

    iex> clear_flash(socket)

Clearing the flash can also be triggered on the client and natively handled by LiveView using the `lv:clear-flash` event.

For example:

```heex
<p class="alert" phx-click="lv:clear-flash">
  {Phoenix.Flash.get(@flash, :info)}
</p>
```

# `clear_flash`

Clears a key from the flash.

## Examples

    iex> clear_flash(socket, :info)

Clearing the flash can also be triggered on the client and natively handled by LiveView using the `lv:clear-flash` event.

For example:

```heex
<p class="alert" phx-click="lv:clear-flash" phx-value-key="info">
  {Phoenix.Flash.get(@flash, :info)}
</p>
```

# `connected?`

Returns true if the socket is connected.

Useful for checking the connectivity status when mounting the view.
For example, on initial page render, the view is mounted statically,
rendered, and the HTML is sent to the client. Once the client
connects to the server, a LiveView is then spawned and mounted
statefully within a process. Use `connected?/1` to conditionally
perform stateful work, such as subscribing to pubsub topics,
sending messages, etc.

## Examples

    defmodule DemoWeb.ClockLive do
      use Phoenix.LiveView
      ...
      def mount(_params, _session, socket) do
        if connected?(socket), do: :timer.send_interval(1000, self(), :tick)

        {:ok, assign(socket, date: :calendar.local_time())}
      end

      def handle_info(:tick, socket) do
        {:noreply, assign(socket, date: :calendar.local_time())}
      end
    end

# `consume_uploaded_entries`

Consumes the uploaded entries.

Raises when there are still entries in progress.
Typically called when submitting a form to handle the
uploaded entries alongside the form data. For form submissions,
it is guaranteed that all entries have completed before the submit event
is invoked. Once entries are consumed, they are removed from the upload.

The function passed to consume may return a tagged tuple of the form
`{:ok, my_result}` to collect results about the consumed entries, or
`{:postpone, my_result}` to collect results, but postpone the file
consumption to be performed later.

A list of all `my_result` values produced by the passed function is
returned, regardless of whether they were consumed or postponed.

## Examples

    def handle_event("save", _params, socket) do
      uploaded_files =
        consume_uploaded_entries(socket, :avatar, fn %{path: path}, _entry ->
          dest = Path.join("priv/static/uploads", Path.basename(path))
          File.cp!(path, dest)
          {:ok, ~p"/uploads/#{Path.basename(dest)}"}
        end)
      {:noreply, update(socket, :uploaded_files, &(&1 ++ uploaded_files))}
    end

# `consume_uploaded_entry`

Consumes an individual uploaded entry.

Raises when the entry is still in progress.
Typically called when submitting a form to handle the
uploaded entries alongside the form data. Once entries are consumed,
they are removed from the upload.

This is a lower-level feature than `consume_uploaded_entries/3` and useful
for scenarios where you want to consume entries as they are individually completed.

Like `consume_uploaded_entries/3`, the function passed to consume may return
a tagged tuple of the form `{:ok, my_result}` to collect results about the
consumed entries, or `{:postpone, my_result}` to collect results,
but postpone the file consumption to be performed later.

## Examples

    def handle_event("save", _params, socket) do
      case uploaded_entries(socket, :avatar) do
        {[_|_] = entries, []} ->
          uploaded_files = for entry <- entries do
            consume_uploaded_entry(socket, entry, fn %{path: path} ->
              dest = Path.join("priv/static/uploads", Path.basename(path))
              File.cp!(path, dest)
              {:ok, ~p"/uploads/#{Path.basename(dest)}"}
            end)
          end
          {:noreply, update(socket, :uploaded_files, &(&1 ++ uploaded_files))}

        _ ->
          {:noreply, socket}
      end
    end

# `detach_hook`

Detaches a hook with the given `name` from the lifecycle `stage`.

> Note: This function is for server-side lifecycle callbacks.
> For client-side hooks, see the
> [JS Interop guide](js-interop.html#client-hooks-via-phx-hook).

If no hook is found, this function is a no-op.

## Examples

    def handle_event(_, socket) do
      {:noreply, detach_hook(socket, :hook_that_was_attached, :handle_event)}
    end

# `disallow_upload`

Revokes a previously allowed upload from `allow_upload/3`.

## Examples

    disallow_upload(socket, :avatar)

# `get_connect_info`

Accesses a given connect info key from the socket.

The following keys are supported: `:peer_data`, `:trace_context_headers`,
`:x_headers`, `:uri`, and `:user_agent`.

The connect information is available only during mount. During disconnected
render, all keys are available. On connected render, only the keys explicitly
declared in your socket are available. See `Phoenix.Endpoint.socket/3` for
a complete description of the keys.

## Examples

The first step is to declare the `connect_info` you want to receive.
Typically, it includes at least the session, but you must include all
other keys you want to access on connected mount, such as `:peer_data`:

    socket "/live", Phoenix.LiveView.Socket,
      websocket: [connect_info: [:peer_data, session: @session_options]]

Those values can now be accessed on the connected mount as
`get_connect_info/2`:

    def mount(_params, _session, socket) do
      peer_data = get_connect_info(socket, :peer_data)
      {:ok, assign(socket, ip: peer_data.address)}
    end

If the key is not available, usually because it was not specified
in `connect_info`, it returns nil.

# `get_connect_params`

Accesses the connect params sent by the client for use on connected mount.

Connect params are sent from the client on every connection and reconnection.
The parameters in the client can be computed dynamically, allowing you to pass
client state to the server. For example, you could use it to compute and pass
the user time zone from a JavaScript client:

```javascript
let liveSocket = new LiveSocket("/live", Socket, {
  longPollFallbackMs: 2500,
  params: (_liveViewName) => {
    return {
      _csrf_token: csrfToken,
      time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone
    }
  }
})
```

By computing the parameters with a function, reconnections will reevalute
the code, allowing you to fetch the latest data.

On the LiveView, you will use `get_connect_params/1` to read the data,
which only remains available during mount. `nil` is returned when called
in a disconnected state and a `RuntimeError` is raised if called after
mount.

## Reserved params

The following params have special meaning in LiveView:

  * `"_csrf_token"` - the CSRF Token which must be explicitly set by the user
    when connecting
  * `"_mounts"` - the number of times the current LiveView is mounted.
    It is 0 on first mount, then increases on each reconnect. It resets
    when navigating away from the current LiveView or on errors
  * `"_track_static"` - set automatically with a list of all href/src from
    tags with the `phx-track-static` annotation in them. If there are no
    such tags, nothing is sent
  * `"_live_referer"` - sent by the client as the referer URL when a
    live navigation has occurred from `push_navigate` or client link navigate.

## Examples

    def mount(_params, _session, socket) do
      {:ok, assign(socket, width: get_connect_params(socket)["width"] || @width)}
    end

# `on_mount`
*macro* 

Declares a module callback to be invoked on the LiveView's mount.

The function within the given module, which must be named `on_mount`,
will be invoked before both disconnected and connected mounts. The hook
has the option to either halt or continue the mounting process as usual.
If you wish to redirect the LiveView, you **must** halt, otherwise an error
will be raised.

Tip: if you need to define multiple `on_mount` callbacks, avoid defining
multiple modules. Instead, pass a tuple and use pattern matching to handle
different cases:

    def on_mount(:admin, _params, _session, socket) do
      {:cont, socket}
    end

    def on_mount(:user, _params, _session, socket) do
      {:cont, socket}
    end

And then invoke it as:

    on_mount {MyAppWeb.SomeHook, :admin}
    on_mount {MyAppWeb.SomeHook, :user}

Registering `on_mount` hooks can be useful to perform authentication
as well as add custom behaviour to other callbacks via `attach_hook/4`.

The `on_mount` callback can return a keyword list of options as a third
element in the return tuple. These options are identical to what can
optionally be returned in `c:mount/3`.

## Examples

The following is an example of attaching a hook via
`Phoenix.LiveView.Router.live_session/3`:

    # lib/my_app_web/live/init_assigns.ex
    defmodule MyAppWeb.InitAssigns do
      @moduledoc """
      Ensures common `assigns` are applied to all LiveViews attaching this hook.
      """
      import Phoenix.LiveView
      import Phoenix.Component

      def on_mount(:default, _params, _session, socket) do
        {:cont, assign(socket, :page_title, "DemoWeb")}
      end

      def on_mount(:user, params, session, socket) do
        # code
      end

      def on_mount(:admin, _params, _session, socket) do
        {:cont, socket, layout: {DemoWeb.Layouts, :admin}}
      end
    end

    # lib/my_app_web/router.ex
    defmodule MyAppWeb.Router do
      use MyAppWeb, :router

      # pipelines, plugs, etc.

      live_session :default, on_mount: MyAppWeb.InitAssigns do
        scope "/", MyAppWeb do
          pipe_through :browser
          live "/", PageLive, :index
        end
      end

      live_session :authenticated, on_mount: {MyAppWeb.InitAssigns, :user} do
        scope "/", MyAppWeb do
          pipe_through [:browser, :require_user]
          live "/profile", UserLive.Profile, :index
        end
      end

      live_session :admins, on_mount: {MyAppWeb.InitAssigns, :admin} do
        scope "/admin", MyAppWeb.Admin do
          pipe_through [:browser, :require_user, :require_admin]
          live "/", AdminLive.Index, :index
        end
      end
    end

# `push_event`

Pushes an event to the client.

Events can be handled in two ways:

  1. They can be handled on `window` via `addEventListener`.
     A "phx:" prefix will be added to the event name.

  2. They can be handled inside a hook via `handleEvent`.

Events are dispatched to all active hooks on the client who are
handling the given `event`. If you need to scope events, then
this must be done by namespacing them.

Events pushed during `push_navigate` are currently discarded,
as the LiveView is immediately dismounted.

## Hook example

If you push a "scores" event from your LiveView:

    {:noreply, push_event(socket, "scores", %{points: 100, user: "josé"})}

A hook declared via `phx-hook` can handle it via `handleEvent`:

```javascript
this.handleEvent("scores", data => ...)
```

## `window` example

All events are also dispatched on the `window`. This means you can handle
them by adding listeners. For example, if you want to remove an element
from the page, you can do this:

    {:noreply, push_event(socket, "remove-el", %{id: "foo-bar"})}

And now in your app.js you can register and handle it:

```javascript
window.addEventListener(
  "phx:remove-el",
  e => document.getElementById(e.detail.id).remove()
)
```

## Specifying the dispatch phase

By default, events pushed with `push_event/3` are only dispatched after
the LiveView is patched. In some cases, handling an event before the LiveView
is patched can be useful though. To do this, the `dispatch` option can be passed
as fourth argument:

    {:noreply, push_event(socket, "scores", %{points: 100, user: "josé"}, dispatch: :before)}

# `push_navigate`

Annotates the socket for navigation to another LiveView in the same `live_session`.

The current LiveView will be shutdown and a new one will be mounted
in its place, without reloading the whole page. This can
also be used to remount the same LiveView, in case you want to start
fresh. If you want to navigate to the same LiveView without remounting
it, use `push_patch/2` instead.

## Options

  * `:to` - the required path to link to. It must always be a local path
  * `:replace` - the flag to replace the current history or push a new state.
    Defaults `false`.

## Examples

    {:noreply, push_navigate(socket, to: "/")}
    {:noreply, push_navigate(socket, to: "/", replace: true)}

# `push_patch`

Annotates the socket for navigation within the current LiveView.

When navigating to the current LiveView, `c:handle_params/3` is
immediately invoked to handle the change of params and URL state.
Then the new state is pushed to the client, without reloading the
whole page while also maintaining the current scroll position.
For live navigation to another LiveView in the same `live_session`,
use `push_navigate/2`. Otherwise, use `redirect/2`.

## Options

  * `:to` - the required path to link to. It must always be a local path
  * `:replace` - the flag to replace the current history or push a new state.
    Defaults `false`.

## Examples

    {:noreply, push_patch(socket, to: "/")}
    {:noreply, push_patch(socket, to: "/", replace: true)}

# `put_flash`

Adds a flash message to the socket to be displayed.

The flash message will stick around until it is read.
If you perform a redirect or a navigation event, the message will be
signed and temporarily stored in the client. Therefore it is important
to use flash messages only for user-facing notifications. Do not store
sensitive information in flash messages.

In a typical LiveView application, the message will be rendered by the
CoreComponents’ `flash/1` component. It is up to this function to determine
what kind of messages it supports. By default, the `:info` and `:error`
kinds are handled.

*Note*: You must also place the `Phoenix.LiveView.Router.fetch_live_flash/2`
plug in your browser's pipeline in place of `fetch_flash` for LiveView flash
messages be supported, for example:

    import Phoenix.LiveView.Router

    pipeline :browser do
      ...
      plug :fetch_live_flash
    end

## Examples

    iex> put_flash(socket, :info, "It worked!")
    iex> put_flash(socket, :error, "You can't access that page")

## Inside components

You can use `put_flash/3` inside a `Phoenix.LiveComponent` and
components have their own `@flash` assigns. The `@flash` assign
in a component is only copied to its parent LiveView if the component
calls `push_navigate/2` or `push_patch/2`.

# `put_private`

Puts a new private key and value in the socket.

Privates are *not change tracked*. This storage is meant to be used by
users and libraries to hold state that doesn't require
change tracking. The keys should be prefixed with the app/library name.

## Examples

Key values can be placed in private:

    put_private(socket, :myapp_meta, %{foo: "bar"})

And then retrieved:

    socket.private[:myapp_meta]

# `redirect`

Annotates the socket for redirect to a destination path.

*Note*: LiveView redirects rely on instructing client
to perform a `window.location` update on the provided
redirect location. The whole page will be reloaded and
all state will be discarded.

Calling redirect shuts down the LiveView channel. If you need
to programatically open an external link without causing the
LiveView to shut down, for example because of `mailto:` or `tel:`
URL schemes, consider using `push_event/3` with a custom client-side
handler instead.

## Options

  * `:to` - the path to redirect to. It must always be a local path
  * `:status` - the HTTP status code to use for the redirect. Defaults to 302.
  * `:external` - an external path to redirect to. Either a string
    or `{scheme, url}` to redirect to a custom scheme

## Examples

    {:noreply, redirect(socket, to: "/")}
    {:noreply, redirect(socket, to: "/", status: 301)}
    {:noreply, redirect(socket, external: "https://example.com")}

# `render_with`

Configures which function to use to render a LiveView/LiveComponent.

By default, LiveView invokes the `render/1` function in the same module
the LiveView/LiveComponent is defined, passing `assigns` as its sole
argument. This function allows you to set a different rendering function.

One possible use case for this function is to set a different template
on disconnected render. When the user first accesses a LiveView, we will
perform a disconnected render to send to the browser. This is useful for
several reasons, such as reducing the time to first paint and for search
engine indexing.

However, when LiveView is gated behind an authentication page, it may be
useful to render a placeholder on disconnected render and perform the
full render once the WebSocket connects. This can be achieved with
`render_with/2` and is particularly useful on complex pages (such as
dashboards and reports).

To do so, you must simply invoke `render_with(socket, &some_function_component/1)`,
configuring your socket with a new rendering function.

## Examples

    @impl true
    def mount(_params, _session, socket) do
      if connected?(socket) do
        {:ok,
         socket
         |> assign(:foos, Context.list_foos())
         |> assign(:bars, Context.list_bars())}
      else
        {:ok, render_with(socket, &loading/1)}
      end
    end

    defp loading(assigns) do
      ~H"""
      <div class="...">
        Loading...
      </div>
      """
    end

# `send_update`

Asynchronously updates a `Phoenix.LiveComponent` with new assigns.

The `pid` argument is optional and it defaults to the current process,
which means the update instruction will be sent to a component running
on the same LiveView. If the current process is not a LiveView or you
want to send updates to a live component running on another LiveView,
you should explicitly pass the LiveView's pid instead.

The second argument can be either the value of the `@myself` or the module of
the live component. If you pass the module, then the `:id` that identifies
the component must be passed as part of the assigns.

When the component receives the update,
[`update_many/1`](`c:Phoenix.LiveComponent.update_many/1`) will be invoked if
it is defined, otherwise [`update/2`](`c:Phoenix.LiveComponent.update/2`) is
invoked with the new assigns.  If
[`update/2`](`c:Phoenix.LiveComponent.update/2`) is not defined all assigns
are simply merged into the socket. The assigns received as the first argument
of the [`update/2`](`c:Phoenix.LiveComponent.update/2`) callback will only
include the _new_ assigns passed from this function.  Pre-existing assigns may
be found in `socket.assigns`.

While a component may always be updated from the parent by updating some
parent assigns which will re-render the child, thus invoking
[`update/2`](`c:Phoenix.LiveComponent.update/2`) on the child component,
`send_update/3` is useful for updating a component that entirely manages its
own state, as well as messaging between components mounted in the same
LiveView.

## Examples

    def handle_event("cancel-order", _, socket) do
      ...
      send_update(Cart, id: "cart", status: "cancelled")
      {:noreply, socket}
    end

    def handle_event("cancel-order-asynchronously", _, socket) do
      ...
      pid = self()

      Task.Supervisor.start_child(MyTaskSup, fn ->
        # Do something asynchronously
        send_update(pid, Cart, id: "cart", status: "cancelled")
      end)

      {:noreply, socket}
    end

    def render(assigns) do
      ~H"""
      <.some_component on_complete={&send_update(@myself, completed: &1)} />
      """
    end

# `send_update_after`

Similar to `send_update/3` but the update will be delayed according to the given `time_in_milliseconds`.

It returns a reference which can be cancelled with `Process.cancel_timer/1`.

## Examples

    def handle_event("cancel-order", _, socket) do
      ...
      send_update_after(Cart, [id: "cart", status: "cancelled"], 3000)
      {:noreply, socket}
    end

    def handle_event("cancel-order-asynchronously", _, socket) do
      ...
      pid = self()

      Task.start(fn ->
        # Do something asynchronously
        send_update_after(pid, Cart, [id: "cart", status: "cancelled"], 3000)
      end)

      {:noreply, socket}
    end

# `start_async`
*macro* 

Wraps your function in an asynchronous task and invokes a callback `name` to
handle the result.

The task is linked to the caller and errors/exits are wrapped.
The result of the task is sent to the `c:handle_async/3` callback
of the caller LiveView or LiveComponent.

If there is an in-flight task with the same `name`, the later `start_async` wins and the previous task’s result is ignored.
If you wish to replace an existing task, you can use `cancel_async/3` before `start_async/3`.
You are not restricted to just atoms for `name`, it can be any term such as a tuple.

The task is only started when the socket is connected.

## Options

  * `:supervisor` - allows you to specify a `Task.Supervisor` to supervise the task.

## Examples

    def mount(%{"id" => id}, _, socket) do
      {:ok,
       socket
       |> assign(:org, AsyncResult.loading())
       |> start_async(:my_task, fn -> fetch_org!(id) end)}
    end

    def handle_async(:my_task, {:ok, fetched_org}, socket) do
      %{org: org} = socket.assigns
      {:noreply, assign(socket, :org, AsyncResult.ok(org, fetched_org))}
    end

    def handle_async(:my_task, {:exit, reason}, socket) do
      %{org: org} = socket.assigns
      {:noreply, assign(socket, :org, AsyncResult.failed(org, {:exit, reason}))}
    end

See the moduledoc for more information.

# `static_changed?`

Returns true if the socket is connected and the tracked static assets have changed.

This function is useful to detect if the client is running on an outdated
version of the marked static files. It works by comparing the static paths
sent by the client with the one on the server.

**Note:** this functionality requires Phoenix v1.5.2 or later.

To use this functionality, the first step is to annotate which static files
you want to be tracked by LiveView, with the `phx-track-static`. For example:

```heex
<link phx-track-static rel="stylesheet" href={~p"/assets/app.css"} />
<script defer phx-track-static type="text/javascript" src={~p"/assets/app.js"}></script>
```

Now, whenever LiveView connects to the server, it will send a copy `src`
or `href` attributes of all tracked statics and compare those values with
the latest entries computed by `mix phx.digest` in the server.

The tracked statics on the client will match the ones on the server the
huge majority of times. However, if there is a new deployment, those values
may differ. You can use this function to detect those cases and show a
banner to the user, asking them to reload the page. To do so, first set the
assign on mount:

    def mount(params, session, socket) do
      {:ok, assign(socket, static_changed?: static_changed?(socket))}
    end

And then in your views:

```heex
<div :if={@static_changed?} id="reload-static">
  The app has been updated. Click here to <a href="#" onclick="window.location.reload()">reload</a>.
</div>
```

For larger projects, you can extract this into [a hook](https://hexdocs.pm/phoenix_live_view/Phoenix.LiveView.html#on_mount/1):

    # MyAppWeb.CheckStaticChanged
    def on_mount(:default, _params, _session, socket) do
      {:cont, assign(socket, static_changed?: static_changed?(socket))}
    end

And then add it to the existing `live_view` macro in your `my_app_web.ex` file or add it as part
of your `live_session` hooks.
If you prefer, you can also send a JavaScript script that immediately
reloads the page, but this will cause the client-side to lose all work in progress.

**Note:** only set `phx-track-static` on your own assets. For example, do
not set it in external JavaScript files:

```heex
<script defer phx-track-static type="text/javascript" src="https://ajax.googleapis.com/ajax/libs/jquery/3.4.1/jquery.min.js"></script>
```

Because you don't actually serve the file above, LiveView will interpret
the static above as missing, and this function will return true.

# `stream`

```elixir
@spec stream(
  socket :: Phoenix.LiveView.Socket.t(),
  name :: atom() | String.t(),
  items :: Enumerable.t(),
  opts :: Keyword.t()
) :: Phoenix.LiveView.Socket.t()
```

Assigns a new stream to the socket or inserts items into an existing stream.
Returns an updated `socket`.

Streams are a mechanism for managing large collections on the client without
keeping the resources on the server.

  * `name` - A string or atom name of the key to place under the
    `@streams` assign.
  * `items` - An enumerable of items to insert.

The following options are supported:

  * `:at` - The index to insert or update the items in the
    collection on the client. By default `-1` is used, which appends the items
    to the parent DOM container. A value of `0` prepends the items.

    Note that this operation is equal to inserting the items one by one, each at
    the given index. Therefore, when inserting multiple items at an index other than `-1`,
    the UI will display the items in reverse order:

        stream(socket, :songs, [song1, song2, song3], at: 0)

    In this case the UI will prepend `song1`, then `song2` and then `song3`, so it will show
    `song3`, `song2`, `song1` and then any previously inserted items.

    To insert in the order of the list, use `Enum.reverse/1`:

        stream(socket, :songs, Enum.reverse([song1, song2, song3]), at: 0)

  * `:reset` - A boolean to reset the stream on the client or not. Defaults
    to `false`.

  * `:limit` - An optional positive or negative number of results to limit
    on the UI on the client. As new items are streamed, the UI will remove existing
    items to maintain the limit. For example, to limit the stream to the last 10 items
    in the UI while appending new items, pass a negative value:

        stream(socket, :songs, songs, at: -1, limit: -10)

    Likewise, to limit the stream to the first 10 items, while prepending new items,
    pass a positive value:

        stream(socket, :songs, songs, at: 0, limit: 10)

Once a stream is defined, a new `@streams` assign is available containing
the name of the defined streams. For example, in the above definition, the
stream may be referenced as `@streams.songs` in your template. Stream items
are temporary and freed from socket state immediately after the `render/1`
function is invoked (or a template is rendered from disk).

By default, calling `stream/4` on an existing stream will bulk insert the new items
on the client while leaving the existing items in place. Streams may also be reset
when calling `stream/4`, which we discuss below.

## Resetting a stream

To empty a stream container on the client, you can pass `:reset` with an empty list:

    stream(socket, :songs, [], reset: true)

Or you can replace the entire stream on the client with a new collection:

    stream(socket, :songs, new_songs, reset: true)

## Limiting a stream

It is often useful to limit the number of items in the UI while allowing the
server to stream new items in a fire-and-forget fashion. This prevents
the server from overwhelming the client with new results while also opening up
powerful features like virtualized infinite scrolling. See a complete
bidirectional infinite scrolling example with stream limits in the
[scroll events guide](bindings.md#scroll-events-and-infinite-pagination)

When a stream exceeds the limit on the client, the existing items will be pruned
based on the number of items in the stream container and the limit direction. A
positive limit will prune items from the end of the container, while a negative
limit will prune items from the beginning of the container.

Note that the limit is not enforced on the first `c:mount/3` render (when no websocket
connection was established yet), as it means more data than necessary has been
loaded. In such cases, you should only load and pass the desired amount of items
to the stream.

When inserting single items using `stream_insert/4`, the limit needs to be passed
as an option for it to be enforced on the client:

    stream_insert(socket, :songs, song, limit: -10)

## Required DOM attributes

For stream items to be trackable on the client, the following requirements
must be met:

  1. The parent DOM container must include a `phx-update="stream"` attribute,
     along with a unique DOM id.
  2. Each stream item must include its DOM id on the item's element.

> #### Note {: .warning}
>
> Failing to place `phx-update="stream"` on the **immediate parent** for
> **each stream** will result in broken behavior.
>
> Also, do not alter the generated DOM ids, e.g., by prefixing them. Doing so will
> result in broken behavior.

When consuming a stream in a template, the DOM id and item is passed as a tuple,
allowing convenient inclusion of the DOM id for each item. For example:

```heex
<table>
  <tbody id="songs" phx-update="stream">
    <tr
      :for={{dom_id, song} <- @streams.songs}
      id={dom_id}
    >
      <td>{song.title}</td>
      <td>{song.duration}</td>
    </tr>
  </tbody>
</table>
```

We consume the stream in a for comprehension by referencing the
`@streams.songs` assign. We used the computed DOM id to populate
the `<tr>` id, then we render the table row as usual.

Now `stream_insert/3` and `stream_delete/3` may be issued and new rows will
be inserted or deleted from the client.

## Handling the empty case

When rendering a list of items, it is common to show a message for the empty case.
But when using streams, we cannot rely on `Enum.empty?/1` or similar approaches to
check if the list is empty. Instead we can use the CSS `:only-child` selector
and show the message client side:

```heex
<table>
  <tbody id="songs" phx-update="stream">
    <tr id="songs-empty" class="only:table-row hidden">
      <td colspan="2">No songs found</td>
    </tr>
    <tr
      :for={{dom_id, song} <- @streams.songs}
      id={dom_id}
    >
      <td>{song.title}</td>
      <td>{song.duration}</td>
    </tr>
  </tbody>
</table>
```

It is important to set a unique ID on the empty row, otherwise it cannot be tracked
in the stream container and subsequent patches will duplicate the node.

## Non-stream items in stream containers

In the section on handling the empty case, we showed how to render a message when
the stream is empty by rendering a non-stream item inside the stream container.

Note that for non-stream items inside a `phx-update="stream"` container, the following
needs to be considered:

  1. Non-stream items must have a unique DOM id.

  2. Items can be added and updated, but not removed, even if the stream is reset.

     This means that if you try to conditionally render a non-stream item inside a stream container,
     it won't be removed if it was rendered once.

  3. Items are affected by the `:at` option.

     For example, when you render a non-stream item at the beginning of the stream container and then
     prepend items (with `at: 0`) to the stream, the non-stream item will be pushed down.

# `stream_async`
*macro* 

Inserts data into a stream asynchronously.

Wraps your function in a task linked to the caller, errors are wrapped.
The key passed to `stream_async/3` will be used as the stream name. Furthermore,
a regular assign with the same name gets assigned a `Phoenix.LiveView.AsyncResult`
struct holding the status of the operation. The stream is initialized to an empty list
before starting the asynchronous function, so accessing `@streams.name` is always possible.

The function must return `{:ok, Enumerable.t()}` or `{:ok, Enumerable.t(), opts}`
where the opts are the same as in `stream/4`. The enumerable contains the values to be streamed.

If the function returns `{:error, any()}`, the `AsyncResult` is assigned as failed and
the stream is not updated.

The task is only started when the socket is connected.

## Options

  * `:supervisor` - allows you to specify a `Task.Supervisor` to supervise the task.
  * `:reset` - A boolean to control whether to remove previous results during the async operation.
    Defaults to `false`.

## Examples

    def mount(%{"slug" => slug}, _, socket) do
      current_scope = socket.assigns.current_scope

      {:ok,
        socket
        |> assign(:foo, "bar")
        |> assign_async(:org, fn -> {:ok, %{org: fetch_org!(current_scope)}} end)
        |> stream_async(:posts, fn -> {:ok, list_posts!(current_scope), limit: 10} end)
    end

Note the `reset` option controls the async assign, not the stream:

    def mount(_, _, socket) do
      {:ok,
        socket
        # IMPORTANT: reset here does NOT reset the stream, but only the loading state
        |> stream_async(:my_stream, fn -> {:ok, list_items!()} end, reset: true)
        # This resets the stream
        |> stream_async(:my_reset_stream, fn -> {:ok, list_items!(), reset: true} end)
    end

Any stream options need to be returned as optional third argument in the return value
of the asynchronous function.

# `stream_configure`

```elixir
@spec stream_configure(
  socket :: Phoenix.LiveView.Socket.t(),
  name :: atom() | String.t(),
  opts :: Keyword.t()
) :: Phoenix.LiveView.Socket.t()
```

Configures a stream.

The following options are supported:

  * `:dom_id` - An optional function to generate each stream item's DOM id.
    The function accepts each stream item and converts the item to a string id.
    By default, the `:id` field of a map or struct will be used if the item has
    such a field, and will be prefixed by the `name` hyphenated with the id.
    For example, the following examples are equivalent:

        stream(socket, :songs, songs)

        socket
        |> stream_configure(:songs, dom_id: &("songs-#{&1.id}"))
        |> stream(:songs, songs)

A stream must be configured before items are inserted, and once configured,
a stream may not be re-configured. To ensure a stream is only configured a
single time in a LiveComponent, use the `mount/1` callback. For example:

    def mount(socket) do
      {:ok, stream_configure(socket, :songs, dom_id: &("songs-#{&1.id}"))}
    end

    def update(assigns, socket) do
      {:ok, stream(socket, :songs, ...)}
    end

Returns an updated `socket`.

# `stream_delete`

```elixir
@spec stream_delete(
  socket :: Phoenix.LiveView.Socket.t(),
  name :: atom() | String.t(),
  item :: any()
) ::
  Phoenix.LiveView.Socket.t()
```

Deletes an item from the stream.

The item's DOM is computed from the `:dom_id` provided in the `stream/3` definition.
Delete information for this DOM id is sent to the client and the item's element
is removed from the DOM, following the same behavior of element removal, such as
invoking `phx-remove` commands and executing client hook `destroyed()` callbacks.

## Examples

    def handle_event("delete", %{"id" => id}, socket) do
      song = get_song!(id)
      {:noreply, stream_delete(socket, :songs, song)}
    end

See `stream_delete_by_dom_id/3` to remove an item without requiring the
original data structure.

Returns an updated `socket`.

# `stream_delete_by_dom_id`

```elixir
@spec stream_delete_by_dom_id(
  socket :: Phoenix.LiveView.Socket.t(),
  name :: atom() | String.t(),
  id :: String.t()
) :: Phoenix.LiveView.Socket.t()
```

Deletes an item from the stream given its computed DOM id.

Returns an updated `socket`.

Behaves just like `stream_delete/3`, but accept the precomputed DOM id,
which allows deleting from a stream without fetching or building the original
stream data structure.

## Examples

    def render(assigns) do
      ~H"""
      <table>
        <tbody id="songs" phx-update="stream">
          <tr
            :for={{dom_id, song} <- @streams.songs}
            id={dom_id}
          >
            <td>{song.title}</td>
            <td><button phx-click={JS.push("delete", value: %{id: dom_id})}>delete</button></td>
          </tr>
        </tbody>
      </table>
      """
    end

    def handle_event("delete", %{"id" => dom_id}, socket) do
      {:noreply, stream_delete_by_dom_id(socket, :songs, dom_id)}
    end

# `stream_insert`

```elixir
@spec stream_insert(
  socket :: Phoenix.LiveView.Socket.t(),
  name :: atom() | String.t(),
  item :: any(),
  opts :: Keyword.t()
) :: Phoenix.LiveView.Socket.t()
```

Inserts a new item or updates an existing item in the stream.

Returns an updated `socket`.

See `stream/4` for inserting multiple items at once.

The following options are supported:

  * `:at` - The index to insert or update the item in the collection on the client.
    By default, the item is appended to the parent DOM container. This is the same as
    passing a value of `-1`.
    If the item already exists in the parent DOM container then it will be
    updated in place.

  * `:limit` - A limit of items to maintain in the UI. A limit passed to `stream/4` does
    not affect subsequent calls to `stream_insert/4`, therefore the limit must be passed
    here as well in order to be enforced. See `stream/4` for more information on
    limiting streams.

  * `:update_only` - A boolean to only update the item in the stream. If the item does not
    exist on the client, it will not be inserted. Defaults to `false`.

## Examples

Imagine you define a stream on mount with a single item:

    stream(socket, :songs, [%Song{id: 1, title: "Song 1"}])

Then, in a callback such as `handle_info` or `handle_event`, you
can append a new song:

    stream_insert(socket, :songs, %Song{id: 2, title: "Song 2"})

Or prepend a new song with `at: 0`:

    stream_insert(socket, :songs, %Song{id: 2, title: "Song 2"}, at: 0)

Or update an existing song (in this case the `:at` option has no effect):

    stream_insert(socket, :songs, %Song{id: 1, title: "Song 1 updated"}, at: 0)

Or append a new song while limiting the stream to the last 10 items:

    stream_insert(socket, :songs, %Song{id: 2, title: "Song 2"}, limit: -10)

## Updating Items

As shown, an existing item on the client can be updated by issuing a `stream_insert`
for the existing item. When the client updates an existing item, the item will remain
in the same location as it was previously, and will not be moved to the end of the
parent children. To both update an existing item and move it to another position,
issue a `stream_delete`, followed by a `stream_insert`. For example:

    song = get_song!(id)

    socket
    |> stream_delete(:songs, song)
    |> stream_insert(:songs, song, at: -1)

See `stream_delete/3` for more information on deleting items.

# `transport_pid`

Returns the transport pid of the socket.

Raises `ArgumentError` if the socket is not connected.

## Examples

    iex> transport_pid(socket)
    #PID<0.107.0>

# `uploaded_entries`

Returns the completed and in progress entries for the upload.

## Examples

    case uploaded_entries(socket, :photos) do
      {[_ | _] = completed, []} ->
        # all entries are completed

      {[], [_ | _] = in_progress} ->
        # all entries are still in progress
    end

---

*Consult [api-reference.md](api-reference.md) for complete listing*
