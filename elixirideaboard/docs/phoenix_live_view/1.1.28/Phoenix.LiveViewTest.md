# `Phoenix.LiveViewTest`
[🔗](https://github.com/phoenixframework/phoenix_live_view/blob/v1.1.28/lib/phoenix_live_view/test/live_view_test.ex#L1)

Conveniences for testing function components as well as
LiveViews and LiveComponents.

## Testing function components

There are two mechanisms for testing function components. Imagine the
following component:

    def greet(assigns) do
      ~H"""
      <div>Hello, {@name}!</div>
      """
    end

You can test it by using `render_component/3`, passing the function
reference to the component as first argument:

    import Phoenix.LiveViewTest

    test "greets" do
      assert render_component(&MyComponents.greet/1, name: "Mary") ==
               "<div>Hello, Mary!</div>"
    end

However, for complex components, often the simplest way to test them
is by using the `~H` sigil itself:

    import Phoenix.Component
    import Phoenix.LiveViewTest

    test "greets" do
      assigns = %{}
      assert rendered_to_string(~H"""
             <MyComponents.greet name="Mary" />
             """) ==
               "<div>Hello, Mary!</div>"
    end

The difference is that we use `rendered_to_string/1` to convert the rendered
template to a string for testing.

## Testing LiveViews and LiveComponents

In LiveComponents and LiveView tests, we interact with views
via process communication in substitution of a browser.
Like a browser, our test process receives messages about the
rendered updates from the view which can be asserted against
to test the life-cycle and behavior of LiveViews and their
children.

### Testing LiveViews

The life-cycle of a LiveView as outlined in the `Phoenix.LiveView`
docs details how a view starts as a stateless HTML render in a disconnected
socket state. Once the browser receives the HTML, it connects to the
server and a new LiveView process is started, remounted in a connected
socket state, and the view continues statefully. The LiveView test functions
support testing both disconnected and connected mounts separately, for example:

    import Plug.Conn
    import Phoenix.ConnTest
    import Phoenix.LiveViewTest
    @endpoint MyEndpoint

    test "disconnected and connected mount", %{conn: conn} do
      conn = get(conn, "/my-path")
      assert html_response(conn, 200) =~ "<h1>My Disconnected View</h1>"

      {:ok, view, html} = live(conn)
    end

    test "redirected mount", %{conn: conn} do
      assert {:error, {:redirect, %{to: "/somewhere"}}} = live(conn, "my-path")
    end

Here, we start by using the familiar `Phoenix.ConnTest` function, `get/2` to
test the regular HTTP GET request which invokes mount with a disconnected socket.
Next, `live/1` is called with our sent connection to mount the view in a connected
state, which starts our stateful LiveView process.

In general, it's often more convenient to test the mounting of a view
in a single step, provided you don't need the result of the stateless HTTP
render. This is done with a single call to `live/2`, which performs the
`get` step for us:

    test "connected mount", %{conn: conn} do
      {:ok, _view, html} = live(conn, "/my-path")
      assert html =~ "<h1>My Connected View</h1>"
    end

### Testing Events

The browser can send a variety of events to a LiveView via `phx-` bindings,
which are sent to the `handle_event/3` callback. To test events sent by the
browser and assert on the rendered side effect of the event, use the
`render_*` functions:

  * `render_click/1` - sends a phx-click event and value, returning
    the rendered result of the `handle_event/3` callback.

  * `render_focus/2` - sends a phx-focus event and value, returning
    the rendered result of the `handle_event/3` callback.

  * `render_blur/1` - sends a phx-blur event and value, returning
    the rendered result of the `handle_event/3` callback.

  * `render_submit/1` - sends a form phx-submit event and value, returning
    the rendered result of the `handle_event/3` callback.

  * `render_change/1` - sends a form phx-change event and value, returning
    the rendered result of the `handle_event/3` callback.

  * `render_keydown/1` - sends a form phx-keydown event and value, returning
    the rendered result of the `handle_event/3` callback.

  * `render_keyup/1` - sends a form phx-keyup event and value, returning
    the rendered result of the `handle_event/3` callback.

  * `render_hook/3` - sends a hook event and value, returning
    the rendered result of the `handle_event/3` callback.

For example:

    {:ok, view, _html} = live(conn, "/thermo")

    assert view
           |> element("button#inc")
           |> render_click() =~ "The temperature is: 31℉"

In the example above, we are looking for a particular element on the page
and triggering its phx-click event. LiveView takes care of making sure the
element has a phx-click and automatically sends its values to the server.

You can also bypass the element lookup and directly trigger the LiveView
event in most functions:

    assert render_click(view, :inc, %{}) =~ "The temperature is: 31℉"

The `element` style is preferred as much as possible, as it helps LiveView
perform validations and ensure the events in the HTML actually matches the
event names on the server.

### Testing regular messages

LiveViews are `GenServer`'s under the hood, and can send and receive messages
just like any other server. To test the side effects of sending or receiving
messages, simply message the view and use the `render` function to test the
result:

    send(view.pid, {:set_temp, 50})
    assert render(view) =~ "The temperature is: 50℉"

### Testing LiveComponents

LiveComponents can be tested in two ways. One way is to use the same
`render_component/2` function as function components. This will mount
the LiveComponent and render it once, without testing any of its events:

    assert render_component(MyComponent, id: 123, user: %User{}) =~
             "some markup in component"

However, if you want to test how components are mounted by a LiveView
and interact with DOM events, you must use the regular `live/2` macro
to build the LiveView with the component and then scope events by
passing the view and a **DOM selector** in a list:

    {:ok, view, html} = live(conn, "/users")
    html = view |> element("#user-13 a", "Delete") |> render_click()
    refute html =~ "user-13"
    refute view |> element("#user-13") |> has_element?()

In the example above, LiveView will lookup for an element with
ID=user-13 and retrieve its `phx-target`. If `phx-target` points
to a component, that will be the component used, otherwise it will
fallback to the view.

# `assert_patch`

Asserts a live patch will happen within `timeout` milliseconds.
The default `timeout` is [ExUnit](https://hexdocs.pm/ex_unit/ExUnit.html#configure/1)'s
`assert_receive_timeout` (100 ms).

It returns the new path.

To assert on the flash message, you can assert on the result of the
rendered LiveView.

## Examples

    render_click(view, :event_that_triggers_patch)
    assert_patch view

    render_click(view, :event_that_triggers_patch)
    assert_patch view, 30

    render_click(view, :event_that_triggers_patch)
    path = assert_patch view
    assert path =~ ~r/path/+/

# `assert_patch`

Asserts a live patch will happen to a given path within `timeout`
milliseconds.

The default `timeout` is [ExUnit](https://hexdocs.pm/ex_unit/ExUnit.html#configure/1)'s
`assert_receive_timeout` (100 ms).

It returns the new path.

To assert on the flash message, you can assert on the result of the
rendered LiveView.

## Examples
    render_click(view, :event_that_triggers_patch)
    assert_patch view, "/path"

    render_click(view, :event_that_triggers_patch)
    assert_patch view, "/path", 30

# `assert_patched`

Asserts a live patch was performed, and returns the new path.

To assert on the flash message, you can assert on the result of
the rendered LiveView.

## Examples

    render_click(view, :event_that_triggers_redirect)
    assert_patched view, "/path"

# `assert_push_event`
*macro* 

Asserts an event will be pushed within `timeout`.
The default `timeout` is [ExUnit](https://hexdocs.pm/ex_unit/ExUnit.html#configure/1)'s
`assert_receive_timeout` (100 ms).

## Examples

    assert_push_event view, "scores", %{points: 100, user: "josé"}

# `assert_redirect`

Asserts a redirect will happen within `timeout` milliseconds.
The default `timeout` is [ExUnit](https://hexdocs.pm/ex_unit/ExUnit.html#configure/1)'s
`assert_receive_timeout` (100 ms).

It returns a tuple containing the new path and the flash messages from said
redirect, if any. Note the flash will contain string keys.

## Examples

    render_click(view, :event_that_triggers_redirect)
    {path, flash} = assert_redirect view
    assert flash["info"] == "Welcome"
    assert path =~ ~r/path\/\d+/

    render_click(view, :event_that_triggers_redirect)
    assert_redirect view, 30

# `assert_redirect`

Asserts a redirect will happen to a given path within `timeout` milliseconds.

The default `timeout` is [ExUnit](https://hexdocs.pm/ex_unit/ExUnit.html#configure/1)'s
`assert_receive_timeout` (100 ms).

It returns the flash messages from said redirect, if any.
Note the flash will contain string keys.

## Examples

    render_click(view, :event_that_triggers_redirect)
    flash = assert_redirect view, "/path"
    assert flash["info"] == "Welcome"

    render_click(view, :event_that_triggers_redirect)
    assert_redirect view, "/path", 30

# `assert_redirected`

Asserts a redirect was performed.

It returns the flash messages from said redirect, if any. Note the
flash will contain string keys.

## Examples

    render_click(view, :event_that_triggers_redirect)
    flash = assert_redirected view, "/path"
    assert flash["info"] == "Welcome"

# `assert_reply`
*macro* 

Asserts a hook reply was returned from a `handle_event` callback.

The default `timeout` is [ExUnit](https://hexdocs.pm/ex_unit/ExUnit.html#configure/1)'s
`assert_receive_timeout` (100 ms).

## Examples

    assert_reply view, %{result: "ok", transaction_id: _}

# `element`

Returns an element to scope a function to.

It expects the current LiveView, a query selector, and a text filter.

An optional text filter may be given to filter the results by the query
selector. If the text filter is a string or a regex, it will match any
element that contains the string (including as a substring) or matches the
regex.

So a link containing the text "unopened" will match `element("a", "opened")`.
To prevent this, a regex could specify that "opened" appear without the prefix "un".
For example, `element("a", ~r{(?<!un)opened})`.
But it may be clearer to add an HTML attribute to make the element easier to
select.

After the text filter is applied, only one element must remain, otherwise an
error is raised.

If no text filter is given, then the query selector itself must return
a single element.

    assert view
          |> element("#term > :first-child", "Increment")
          |> render() =~ "Increment</a>"

Attribute selectors are also supported, and may be used on special cases
like ids which contain periods:

    assert view
           |> element(~s{[href="/foo"][id="foo.bar.baz"]})
           |> render() =~ "Increment</a>"

# `file_input`
*macro* 

Builds a file input for testing uploads within a form.

Given the form DOM selector, the upload name, and a list of maps of client metadata
for the upload, the returned file input can be passed to `render_upload/2`.

Client metadata takes the following form:

  * `:last_modified` - the last modified timestamp
  * `:name` - the name of the file
  * `:content` - the binary content of the file
  * `:size` - the byte size of the content
  * `:type` - the MIME type of the file
  * `:relative_path` - for simulating webkitdirectory metadata
  * `:meta` - optional metadata sent by the client

## Examples

    avatar = file_input(lv, "#my-form-id", :avatar, [%{
      last_modified: 1_594_171_879_000,
      name: "myfile.jpeg",
      content: File.read!("myfile.jpg"),
      size: 1_396_009,
      type: "image/jpeg"
    }])

    assert render_upload(avatar, "myfile.jpeg") =~ "100%"

# `find_live_child`

Gets the nested LiveView child by `child_id` from the `parent` LiveView.

## Examples

    {:ok, view, _html} = live(conn, "/thermo")
    assert clock_view = find_live_child(view, "clock")
    assert render_click(clock_view, :snooze) =~ "snoozing"

# `follow_redirect`
*macro* 

Follows the redirect from a `render_*` action or an `{:error, redirect}`
tuple.

Imagine you have a LiveView that redirects on a `render_click`
event. You can make sure it immediately redirects after the
`render_click` action by calling `follow_redirect/3`:

    live_view
    |> render_click("redirect")
    |> follow_redirect(conn)

Or in the case of an error tuple:

    assert {:error, {:redirect, %{to: "/somewhere"}}} = result = live(conn, "my-path")
    {:ok, view, html} = follow_redirect(result, conn)

`follow_redirect/3` expects a connection as second argument.
This is the connection that will be used to perform the underlying
request.

If the LiveView redirects with a live redirect, this macro returns
`{:ok, live_view, disconnected_html}` with the content of the new
LiveView, the same as the `live/3` macro. If the LiveView redirects
with a regular redirect, this macro returns `{:ok, conn}` with the
rendered redirected page. In any other case, this macro raises.

Finally, note that you can optionally assert on the path you are
being redirected to by passing a third argument:

    live_view
    |> render_click("redirect")
    |> follow_redirect(conn, "/redirected/page")

# `follow_trigger_action`
*macro* 

Receives a `form_element` and asserts that `phx-trigger-action` has been
set to true, following up on that request.

Imagine you have a LiveView that sends an HTTP form submission. Say that it
sets the `phx-trigger-action` to true, as a response to a submit event.
You can follow the trigger action like this:

    form = form(live_view, selector, %{"form" => "data"})

    # First we submit the form. Optionally verify that phx-trigger-action
    # is now part of the form.
    assert render_submit(form) =~ ~r/phx-trigger-action/

    # Now follow the request made by the form
    conn = follow_trigger_action(form, conn)
    assert conn.method == "POST"
    assert conn.params == %{"form" => "data"}

# `form`

Returns a form element to scope a function to.

It expects the current LiveView, a query selector, and the form data.
The query selector must return a single element.

The form data will be validated directly against the form markup and
make sure the data you are changing/submitting actually exists, failing
otherwise.

## Examples

    assert view
          |> form("#term", user: %{name: "hello"})
          |> render_submit() =~ "Name updated"

This function is meant to mimic what the user can actually do, so you cannot
 set hidden input values. However, hidden values can be given when calling
 `render_submit/2` or `render_change/2`, see their docs for examples.

# `has_element?`

Checks if the given element exists on the page.

## Examples

    assert view |> element("#some-element") |> has_element?()

# `has_element?`

Checks if the given `selector` with `text_filter` is on `view`.

See `element/3` for more information.

## Examples

    assert has_element?(view, "#some-element")

# `live`
*macro* 

Spawns a connected LiveView process.

If a `path` is given, then a regular `get(conn, path)`
is done and the page is upgraded to a LiveView. If
no path is given, it assumes a previously rendered
`%Plug.Conn{}` is given, which will be converted to
a LiveView immediately.

## Options

  * `:on_error` - Can be either `:raise` or `:warn` to control whether
     detected errors like duplicate IDs or live components fail the test or just log
     a warning. Defaults to `:raise`.

## Examples

    {:ok, view, html} = live(conn, "/path")
    assert view.module == MyLive
    assert html =~ "the count is 3"

    assert {:error, {:redirect, %{to: "/somewhere"}}} = live(conn, "/path")

# `live_children`

Returns the current list of LiveView children for the `parent` LiveView.

Children are returned in the order they appear in the rendered HTML.

## Examples

    {:ok, view, _html} = live(conn, "/thermo")
    assert [clock_view] = live_children(view)
    assert render_click(clock_view, :snooze) =~ "snoozing"

# `live_isolated`
*macro* 

Spawns a connected LiveView process mounted in isolation as the sole rendered element.

Useful for testing LiveViews that are not directly routable, such as those
built as small components to be re-used in multiple parents. Testing routable
LiveViews is still recommended whenever possible since features such as
live navigation require routable LiveViews.

## Options

  * `:session` - the session to be given to the LiveView
  * `:on_error` - Can be either `:raise` or `:warn` to control whether
     detected errors like duplicate IDs or live components fail the test or just log
     a warning. Defaults to `:raise`.

All other options are forwarded to the LiveView for rendering. Refer to
`Phoenix.Component.live_render/3` for a list of supported render
options.

## Examples

    {:ok, view, html} =
      live_isolated(conn, MyAppWeb.ClockLive, session: %{"tz" => "EST"})

Use `put_connect_params/2` to put connect params for a call to
`Phoenix.LiveView.get_connect_params/1` in `c:Phoenix.LiveView.mount/3`:

    {:ok, view, html} =
      conn
      |> put_connect_params(%{"param" => "value"})
      |> live_isolated(AppWeb.ClockLive, session: %{"tz" => "EST"})

# `live_redirect`

Performs a live redirect from one LiveView to another.

When redirecting between two LiveViews of the same `live_session`,
mounts the new LiveView and shutsdown the previous one, which
mimics general browser live navigation behaviour.

When attempting to navigate from a LiveView of a different
`live_session`, an error redirect condition is returned indicating
a failed `push_navigate` from the client.

## Examples

    assert {:ok, page_live, _html} = live(conn, "/page/1")
    assert {:ok, page2_live, _html} = live(conn, "/page/2")

    assert {:error, {:redirect, _}} = live_redirect(page2_live, to: "/admin")

# `open_browser`

Open the default browser to display current HTML of `view_or_element`.

## Examples

    view
    |> element("#term > :first-child", "Increment")
    |> open_browser()

    assert view
           |> form("#term", user: %{name: "hello"})
           |> open_browser()
           |> render_submit() =~ "Name updated"

# `page_title`

Returns the most recent title that was updated via a `page_title` assign.

## Examples

    render_click(view, :event_that_triggers_page_title_update)
    assert page_title(view) =~ "my title"

# `preflight_upload`

Performs a preflight upload request.

Useful for testing external uploaders to retrieve the `:external` entry metadata.

## Examples

    avatar = file_input(lv, "#my-form-id", :avatar, [%{name: ..., ...}, ...])
    assert {:ok, %{ref: _ref, config: %{chunk_size: _}}} = preflight_upload(avatar)

# `put_connect_params`

Puts connect params to be used on LiveView connections.

See `Phoenix.LiveView.get_connect_params/1`.

# `put_submitter`

Puts the submitter `element_or_selector` on the given `form` element.

A submitter is an element that initiates the form's submit event on the client. When a submitter
is put on an element created with `form/3` and then the form is submitted via `render_submit/2`,
the name/value pair of the submitter will be included in the submit event payload.

The given element or selector must exist within the form and match one of the following:

- A `button` or `input` element with `type="submit"`.

- A `button` element without a `type` attribute.

## Examples

    form = view |> form("#my-form")

    assert form
           |> put_submitter("button[name=example]")
           |> render_submit() =~ "Submitted example"

# `refute_push_event`
*macro* 

Refutes an event will be pushed within timeout.

The default `timeout` is [ExUnit](https://hexdocs.pm/ex_unit/ExUnit.html#configure/1)'s
`refute_receive_timeout` (100 ms).

## Examples

    refute_push_event view, "scores", %{points: _, user: "josé"}

# `refute_redirected`

Refutes a redirect to a given path was performed.

It returns :ok if the specified redirect isn't already in the mailbox.

If no path is specified, refutes any redirection on the given view.

## Examples

    render_click(view, :event_that_triggers_redirect_to_path)
    :ok = refute_redirected view, "/wrong_path"

# `refute_redirected`

# `render`

Returns the HTML string of the rendered view or element.

If a view is provided, the entire LiveView is rendered.
If a view after calling `with_target/2` or an element
are given, only that particular context is returned.

## Examples

    {:ok, view, _html} = live(conn, "/thermo")
    assert render(view) =~ ~s|<button id="alarm">Snooze</div>|

    assert view
           |> element("#alarm")
           |> render() == "Snooze"

# `render_async`

Awaits all current `assign_async`, `stream_async` and `start_async` tasks
for a given LiveView or element.

It renders the LiveView or Element once complete and returns the result.
The default `timeout` is [ExUnit](https://hexdocs.pm/ex_unit/ExUnit.html#configure/1)'s
`assert_receive_timeout` (100 ms).

## Examples

    {:ok, lv, html} = live(conn, "/path")
    assert html =~ "loading data..."
    assert render_async(lv) =~ "data loaded!"

# `render_blur`

Sends a blur event given by `element` and returns the rendered result.

The `element` is created with `element/3` and must point to a single
element on the page with a `phx-blur` attribute in it. The event name
given set on `phx-blur` is then sent to the appropriate LiveView
(or component if `phx-target` is set accordingly). All `phx-value-*`
entries in the element are sent as values. Extra values can be given
with the `value` argument.

It returns the contents of the whole LiveView or an `{:error, redirect}`
tuple.

## Examples

    {:ok, view, html} = live(conn, "/thermo")

    assert view
           |> element("#inactive")
           |> render_blur() =~ "Tap to wake"

# `render_blur`

Sends a blur event to the view and returns the rendered result.

It returns the contents of the whole LiveView or an `{:error, redirect}`
tuple.

## Examples

    {:ok, view, html} = live(conn, "/thermo")
    assert html =~ "The temp is: 30℉"
    assert render_blur(view, :inactive) =~ "Tap to wake"

# `render_change`

Sends a form change event given by `element` and returns the rendered result.

The `element` is created with `element/3` and must point to a single
element on the page with a `phx-change` attribute in it. The event name
given set on `phx-change` is then sent to the appropriate LiveView
(or component if `phx-target` is set accordingly). All `phx-value-*`
entries in the element are sent as values.

If you need to pass any extra values or metadata, such as the "_target"
parameter, you can do so by giving a map under the `value` argument.

It returns the contents of the whole LiveView or an `{:error, redirect}`
tuple.

## Examples

    {:ok, view, html} = live(conn, "/thermo")

    assert view
           |> element("form")
           |> render_change(%{deg: 123}) =~ "123 exceeds limits"

    # Passing metadata
    {:ok, view, html} = live(conn, "/thermo")

    assert view
           |> element("form")
           |> render_change(%{_target: ["deg"], deg: 123}) =~ "123 exceeds limits"

As with `render_submit/2`, hidden input field values can be provided like so:

    refute view
          |> form("#term", user: %{name: "hello"})
          |> render_change(%{user: %{"hidden_field" => "example"}}) =~ "can't be blank"

# `render_change`

Sends a form change event to the view and returns the rendered result.

It returns the contents of the whole LiveView or an `{:error, redirect}`
tuple.

## Examples

    {:ok, view, html} = live(conn, "/thermo")
    assert html =~ "The temp is: 30℉"
    assert render_change(view, :validate, %{deg: 123}) =~ "123 exceeds limits"

# `render_click`

Sends a click event given by `element` and returns the rendered result.

The `element` is created with `element/3` and must point to a single
element on the page with a `phx-click` attribute in it. The event name
given set on `phx-click` is then sent to the appropriate LiveView
(or component if `phx-target` is set accordingly). All `phx-value-*`
entries in the element are sent as values. Extra values can be given
with the `value` argument.

If the element does not have a `phx-click` attribute but it is
a link (the `<a>` tag), the link will be followed accordingly:

  * if the link is a `patch`, the current view will be patched
  * if the link is a `navigate`, this function will return
    `{:error, {:live_redirect, %{to: url}}}`, which can be followed
    with `follow_redirect/2`
  * if the link is a regular link, this function will return
    `{:error, {:redirect, %{to: url}}}`, which can be followed
    with `follow_redirect/2`

It returns the contents of the whole LiveView or an `{:error, redirect}`
tuple.

## Examples

    {:ok, view, html} = live(conn, "/thermo")

    assert view
           |> element("button", "Increment")
           |> render_click() =~ "The temperature is: 30℉"

# `render_click`

Sends a click `event` to the `view` with `value` and returns the rendered result.

It returns the contents of the whole LiveView or an `{:error, redirect}`
tuple.

## Examples

    {:ok, view, html} = live(conn, "/thermo")
    assert html =~ "The temperature is: 30℉"
    assert render_click(view, :inc) =~ "The temperature is: 31℉"

# `render_component`
*macro* 

Renders a component.

The first argument may either be a function component, as an
anonymous function:

    assert render_component(&Weather.city/1, name: "Kraków") =~
             "some markup in component"

Or a stateful component as a module. In this case, this function
will mount, update, and render the component. The `:id` option is
a required argument:

    assert render_component(MyComponent, id: 123, user: %User{}) =~
             "some markup in component"

If your component is using the router, you can pass it as argument:

    assert render_component(MyComponent, %{id: 123, user: %User{}}, router: SomeRouter) =~
             "some markup in component"

# `render_focus`

Sends a focus event given by `element` and returns the rendered result.

The `element` is created with `element/3` and must point to a single
element on the page with a `phx-focus` attribute in it. The event name
given set on `phx-focus` is then sent to the appropriate LiveView
(or component if `phx-target` is set accordingly). All `phx-value-*`
entries in the element are sent as values. Extra values can be given
with the `value` argument.

It returns the contents of the whole LiveView or an `{:error, redirect}`
tuple.

## Examples

    {:ok, view, html} = live(conn, "/thermo")

    assert view
           |> element("#inactive")
           |> render_focus() =~ "Tap to wake"

# `render_focus`

Sends a focus event to the view and returns the rendered result.

It returns the contents of the whole LiveView or an `{:error, redirect}`
tuple.

## Examples

    {:ok, view, html} = live(conn, "/thermo")
    assert html =~ "The temp is: 30℉"
    assert render_focus(view, :inactive) =~ "Tap to wake"

# `render_hook`

Sends a hook event to the view or an element and returns the rendered result.

It returns the contents of the whole LiveView or an `{:error, redirect}`
tuple.

## Examples

    {:ok, view, html} = live(conn, "/thermo")
    assert html =~ "The temp is: 30℉"
    assert render_hook(view, :refresh, %{deg: 32}) =~ "The temp is: 32℉"

If you are pushing events from a hook to a component, then you must pass
an `element`, created with `element/3`, as first argument and it must point
to a single element on the page with a `phx-target` attribute in it:

    {:ok, view, _html} = live(conn, "/thermo")
    assert view
           |> element("#thermo-component")
           |> render_hook(:refresh, %{deg: 32}) =~ "The temp is: 32℉"

# `render_keydown`

Sends a keydown event given by `element` and returns the rendered result.

The `element` is created with `element/3` and must point to a single element
on the page with a `phx-keydown` or `phx-window-keydown` attribute in it.
The event name given set on `phx-keydown` is then sent to the appropriate
LiveView (or component if `phx-target` is set accordingly). All `phx-value-*`
entries in the element are sent as values. Extra values can be given with
the `value` argument.

It returns the contents of the whole LiveView or an `{:error, redirect}`
tuple.

## Examples

    {:ok, view, html} = live(conn, "/thermo")
    assert html =~ "The temp is: 30℉"
    assert view |> element("#inc") |> render_keydown() =~ "The temp is: 31℉"

# `render_keydown`

Sends a keydown event to the view and returns the rendered result.

It returns the contents of the whole LiveView or an `{:error, redirect}`
tuple.

## Examples

    {:ok, view, html} = live(conn, "/thermo")
    assert html =~ "The temp is: 30℉"
    assert render_keydown(view, :inc) =~ "The temp is: 31℉"

# `render_keyup`

Sends a keyup event given by `element` and returns the rendered result.

The `element` is created with `element/3` and must point to a single
element on the page with a `phx-keyup` or `phx-window-keyup` attribute
in it. The event name given set on `phx-keyup` is then sent to the
appropriate LiveView (or component if `phx-target` is set accordingly).
All `phx-value-*` entries in the element are sent as values. Extra values
can be given with the `value` argument.

It returns the contents of the whole LiveView or an `{:error, redirect}`
tuple.

## Examples

    {:ok, view, html} = live(conn, "/thermo")
    assert html =~ "The temp is: 30℉"
    assert view |> element("#inc") |> render_keyup() =~ "The temp is: 31℉"

# `render_keyup`

Sends a keyup event to the view and returns the rendered result.

It returns the contents of the whole LiveView or an `{:error, redirect}`
tuple.

## Examples

    {:ok, view, html} = live(conn, "/thermo")
    assert html =~ "The temp is: 30℉"
    assert render_keyup(view, :inc) =~ "The temp is: 31℉"

# `render_patch`

Simulates a `push_patch` to the given `path` and returns the rendered result.

# `render_submit`

Sends a form submit event given by `element` and returns the rendered result.

The `element` is created with `element/3` and must point to a single
element on the page with a `phx-submit` attribute in it. The event name
given set on `phx-submit` is then sent to the appropriate LiveView
(or component if `phx-target` is set accordingly). All `phx-value-*`
entries in the element are sent as values. Extra values, including hidden
input fields, can be given with the `value` argument.

It returns the contents of the whole LiveView or an `{:error, redirect}`
tuple.

## Examples

    {:ok, view, html} = live(conn, "/thermo")

    assert view
           |> element("form")
           |> render_submit(%{deg: 123, avatar: upload}) =~ "123 exceeds limits"

To submit a form along with some hidden input values:

    assert view
           |> form("#term", user: %{name: "hello"})
           |> render_submit(%{user: %{"hidden_field" => "example"}}) =~ "Name updated"

To submit a form by a specific submit element via `put_submitter/2`:

    assert view
           |> form("#term", user: %{name: "hello"})
           |> put_submitter("button[name=example_action]")
           |> render_submit() =~ "Action taken"

> #### Anti-pattern: bypassing LiveViewTest's form validation unnecessarily {: .warning}
>
> **DO NOT** use the value parameter to pass data that you expect to be filled
> by regular input fields in the form. Values given directly to `render_submit`
> are not checked against the inputs rendered as part of the form.
>
> Imagine you have this code:
>
> ```elixir
> def render(assigns) do
>   ~H"""
>   <form phx-submit="save">
>     <input name="name" value="" />
>     <button type="submit">Submit</button>
>   </form>
>   """
> end
>
> def handle_event("save", %{"name" => name}, socket) do
>   ...
> end
> ```
>
> And you test it with:
>
> ```elixir
> view |> form("form") |> render_submit(%{name: "hello"})
> ```
>
> Because the values given to `render_submit` are not checked against the
> form, if you later change the input name to something, the test will not fail.
> Instead, you should always pass values that are part of visible input fields
> as part of the `form/3` call:
>
> ```elixir
> view |> form("form", %{name: "hello"}) |> render_submit()
> ```
>
> This way, if you run the tests and your input field is called `<input name="other_name">`,
> you will get an error:
>
> ```text
> ** (ArgumentError) could not find non-disabled input, select or textarea with name "name" within:
>
> <input name="other_name" value=""/>
> ```
>
> Only use the `value` parameter to pass values for hidden input fields or submit events from a hook
> that cannot be passed to `form/3`. The same applies to `render_change/2`.

# `render_submit`

Sends a form submit event to the view and returns the rendered result.

It returns the contents of the whole LiveView or an `{:error, redirect}`
tuple.

## Examples

    {:ok, view, html} = live(conn, "/thermo")
    assert html =~ "The temp is: 30℉"
    assert render_submit(view, :refresh, %{deg: 32}) =~ "The temp is: 32℉"

# `render_upload`

Performs an upload of a file input and renders the result.

See `file_input/4` for details on building a file input.

## Examples

Given the following LiveView template:

```heex
<%= for entry <- @uploads.avatar.entries do %>
  {entry.name}: {entry.progress}%
<% end %>
```

Your test case can assert the uploaded content:

    avatar = file_input(lv, "#my-form-id", :avatar, [
      %{
        last_modified: 1_594_171_879_000,
        name: "myfile.jpeg",
        content: File.read!("myfile.jpg"),
        size: 1_396_009,
        type: "image/jpeg"
      }
    ])

    assert render_upload(avatar, "myfile.jpeg") =~ "100%"

By default, the entire file is chunked to the server, but an optional
percentage to chunk can be passed to test chunk-by-chunk uploads:

    assert render_upload(avatar, "myfile.jpeg", 49) =~ "49%"
    assert render_upload(avatar, "myfile.jpeg", 51) =~ "100%"

Before making assertions about the how the upload is consumed server-side,
you will need to call `render_submit/1`.

In the case where an upload progress callback issues a navigate, patch, or
redirect, the following will be returned:

  * for a patch, the current view will be patched
  * for a navigate, this function will return
    `{:error, {:live_redirect, %{to: url}}}`, which can be followed
    with `follow_redirect/2`
  * for a regular redirect, this function will return
    `{:error, {:redirect, %{to: url}}}`, which can be followed
    with `follow_redirect/2`

# `rendered_to_string`

Converts a rendered template to a string.

## Examples

    import Phoenix.Component
    import Phoenix.LiveViewTest

    test "greets" do
      assigns = %{}
      assert rendered_to_string(~H"""
             <MyComponents.greet name="Mary" />
             """) ==
               "<div>Hello, Mary!</div>"
    end

# `submit_form`
*macro* 

Receives a form element and submits the HTTP request through the plug pipeline.

Imagine you have a LiveView that validates form data, but submits the form to
a controller via the normal form `action` attribute. This is especially useful
in scenarios where the result of a form submit needs to write to the plug session.

You can follow submit the form with the `%Plug.Conn{}`, like this:

    form = form(live_view, selector, %{"form" => "data"})

    # Now submit the LiveView form to the plug pipeline
    conn = submit_form(form, conn)
    assert conn.method == "POST"
    assert conn.params == %{"form" => "data"}

# `with_target`

Sets the target of the view for events.

This emulates `phx-target` directly in tests, without
having to dispatch the event to a specific element.
This can be useful for invoking events to one or
multiple components at the same time:

    view
    |> with_target("#user-1,#user-2")
    |> render_click("Hide", %{})

---

*Consult [api-reference.md](api-reference.md) for complete listing*
