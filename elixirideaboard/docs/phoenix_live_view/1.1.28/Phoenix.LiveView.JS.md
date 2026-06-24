# `Phoenix.LiveView.JS`
[🔗](https://github.com/phoenixframework/phoenix_live_view/blob/v1.1.28/lib/phoenix_live_view/js.ex#L1)

Provides commands for executing JavaScript utility operations on the client.

JS commands support a variety of utility operations for common client-side
needs, such as adding or removing CSS classes, setting or removing tag attributes,
showing or hiding content, and transitioning in and out with animations.
While these operations can be accomplished via client-side hooks,
JS commands are DOM-patch aware, so operations applied
by the JS APIs will stick to elements across patches from the server.

In addition to purely client-side utilities, the JS commands include a
rich `push` API, for extending the default `phx-` binding pushes with
options to customize targets, loading states, and additional payload values.

If you need to trigger these commands via JavaScript, see [JavaScript interoperability](js-interop.md#js-commands).

## Client Utility Commands

The following utilities are included:

  * `add_class` - Add classes to elements, with optional transitions
  * `remove_class` - Remove classes from elements, with optional transitions
  * `toggle_class` - Sets or removes classes from elements, with optional transitions
  * `set_attribute` - Set an attribute on elements
  * `remove_attribute` - Remove an attribute from elements
  * `toggle_attribute` - Sets or removes element attribute based on attribute presence.
  * `ignore_attributes` - Marks attributes as ignored, skipping them when patching the DOM.
  * `show` - Show elements, with optional transitions
  * `hide` - Hide elements, with optional transitions
  * `toggle` - Shows or hides elements based on visibility, with optional transitions
  * `transition` - Apply a temporary transition to elements for animations
  * `dispatch` - Dispatch a DOM event to elements

For example, the following modal component can be shown or hidden on the
client without a trip to the server:

    alias Phoenix.LiveView.JS

    def hide_modal(js \\ %JS{}) do
      js
      |> JS.hide(transition: "fade-out", to: "#modal")
      |> JS.hide(transition: "fade-out-scale", to: "#modal-content")
    end

    def modal(assigns) do
      ~H"""
      <div id="modal" class="phx-modal" phx-remove={hide_modal()}>
        <div
          id="modal-content"
          class="phx-modal-content"
          phx-click-away={hide_modal()}
          phx-window-keydown={hide_modal()}
          phx-key="escape"
        >
          <button class="phx-modal-close" phx-click={hide_modal()}>✖</button>
          <p>{@text}</p>
        </div>
      </div>
      """
    end

## Enhanced push events

The `push/1` command allows you to extend the built-in pushed event handling
when a `phx-` event is pushed to the server. For example, you may wish to
target a specific component, specify additional payload values to include
with the event, apply loading states to external elements, etc. For example,
given this basic `phx-click` event:

```heex
<button phx-click="inc">+</button>
```

Imagine you need to target your current component, and apply a loading state
to the parent container while the client awaits the server acknowledgement:

    alias Phoenix.LiveView.JS

    ~H"""
    <button phx-click={JS.push("inc", loading: ".thermo", target: @myself)}>+</button>
    """

Push commands also compose with all other utilities. For example,
to add a class when pushing:

```heex
<button phx-click={
  JS.push("inc", loading: ".thermo", target: @myself)
  |> JS.add_class("warmer", to: ".thermo")
}>+</button>
```

Any `phx-value-*` attributes will also be included in the payload, their
values will be overwritten by values given directly to `push/1`. Any
`phx-target` attribute will also be used, and overwritten.

```heex
<button
  phx-click={JS.push("inc", value: %{limit: 40})}
  phx-value-room="bedroom"
  phx-value-limit="this value will be 40"
  phx-target={@myself}
>+</button>
```

## DOM Selectors

The client utility commands in this module all take an optional DOM selector
using the `:to` option.

This can be a string for a regular DOM selector such as:

```elixir
JS.add_class("warmer", to: ".thermo")
JS.hide(to: "#modal")
JS.show(to: "body a:nth-child(2)")
```

It is also possible to provide scopes to the DOM selector. The following scopes
are available:

 * `{:inner, "selector"}` To target an element within the interacted element.
 * `{:closest, "selector"}` To target the closest element from the interacted
 element upwards.

 For example, if building a dropdown component, the button could use the `:inner`
 scope:

 ```heex
 <div phx-click={JS.show(to: {:inner, ".menu"})}>
   <div>Open me</div>
   <div class="menu hidden" phx-click-away={JS.hide()}>
     I'm in the dropdown menu
   </div>
 </div>
 ```

## Custom JS events with `JS.dispatch/1` and `window.addEventListener`

`dispatch/1` can be used to dispatch custom JavaScript events to
elements. For example, you can use `JS.dispatch("click", to: "#foo")`,
to dispatch a click event to an element.

This also means you can augment your elements with custom events,
by using JavaScript's `window.addEventListener` and invoking them
with `dispatch/1`. For example, imagine you want to provide
a copy-to-clipboard functionality in your application. You can
add a custom event for it:

```javascript
window.addEventListener("my_app:clipcopy", (event) => {
  if ("clipboard" in navigator) {
    const text = event.target.textContent;
    navigator.clipboard.writeText(text);
  } else {
    alert("Sorry, your browser does not support clipboard copy.");
  }
});
```

Now you can have a button like this:

```heex
<button phx-click={JS.dispatch("my_app:clipcopy", to: "#element-with-text-to-copy")}>
  Copy content
</button>
```

The combination of `dispatch/1` with `window.addEventListener` is
a powerful mechanism to increase the amount of actions you can trigger
client-side from your LiveView code.

You can also use `window.addEventListener` to listen to events pushed
from the server. You can learn more in our [JS interoperability guide](js-interop.md).

## Composing JS commands

All the functions in this module optionally accept an existing `%JS{}` struct as the first argument,
allowing you to chain multiple commands, like pushing an event to the server and optimistically hiding
a modal:

```heex
<div id="modal" class="modal">
  My Modal
</div>

<button phx-click={JS.push("modal-closed") |> JS.remove_class("show", to: "#modal", transition: "fade-out")}>
  hide modal
</button>
```

Note that the commands themselves are executed on the client in the order they are composed
and the client does not wait for a confirmation before executing the next command. If you chain
`JS.push(...) |> JS.hide(...)`, since hide is a fully client-side command, it hides immediately
after pushing the event, not waiting for the server to respond.

JS commands interacting with the server are documented as such. If you chain multiple commands that
interact with the server, those are also guaranteed to be executed in the order they are composed,
since a LiveView can only handle one event at a time. Therefore, if you do something like

```elixir
JS.push("my-event") |> JS.patch("/my-path?foo=bar")
```

it is guaranteed that the event will be pushed first and the patch will only be handled after
the first event was handled by the LiveView.

# `internal`

```elixir
@opaque internal()
```

# `t`

```elixir
@type t() :: %Phoenix.LiveView.JS{ops: internal()}
```

# `add_class`

Adds classes to elements.

  * `names` - A string with one or more class names to add.

## Options

  * `:to` - An optional DOM selector to add classes to.
    Defaults to the interacted element. See the `DOM selectors`
    section for details.
  * `:transition` - A string of classes to apply before adding classes or
    a 3-tuple containing the transition class, the class to apply
    to start the transition, and the ending transition class, such as:
    `{"ease-out duration-300", "opacity-0", "opacity-100"}`
  * `:time` - The time in milliseconds to apply the transition from `:transition`.
    Defaults to 200.
  * `:blocking` - A boolean flag to block the UI during the transition. Defaults `true`.

## Examples

```heex
<div id="item">My Item</div>
<button phx-click={JS.add_class("highlight underline", to: "#item")}>
  highlight!
</button>
```

# `add_class`

See `add_class/1`.

# `add_class`

See `add_class/1`.

# `concat`

Combines two JS commands, appending the second to the first.

# `dispatch`

Dispatches an event to the DOM.

  * `event` - The string event name to dispatch.

*Note*: All events dispatched are of a type
[CustomEvent](https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent),
with the exception of `"click"`. For a `"click"`, a
[MouseEvent](https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent)
is dispatched to properly simulate a UI click.

For emitted `CustomEvent`'s, the event detail will contain a `dispatcher`,
which references the DOM node that dispatched the JS event to the target
element.

## Options

  * `:to` - An optional DOM selector to dispatch the event to.
    Defaults to the interacted element. See the `DOM selectors`
    section for details.
  * `:detail` - An optional detail map to dispatch along
    with the client event. The details will be available in the
    `event.detail` attribute for event listeners.
  * `:bubbles` – A boolean flag to bubble the event or not. Defaults to `true`.
  * `:blocking` - A boolean flag to block the UI until the event handler calls `event.detail.done()`.
    The done function is injected by LiveView and *must* be called eventually to unblock the UI.
    This is useful to integrate with third party JavaScript based animation libraries.

## Examples

```javascript
window.addEventListener("click", e => console.log("clicked!", e.detail))
```

```heex
<button phx-click={JS.dispatch("click", to: ".nav")}>Click me!</button>
```

# `dispatch`

See `dispatch/2`.

# `exec`

Executes JS commands located in an element's attribute.

  * `attr` - The string attribute where the JS command is specified

## Options

  * `:to` - An optional DOM selector to fetch the attribute from.
    Defaults to the interacted element. See the `DOM selectors`
    section for details.

## Examples

```heex
<div id="modal" phx-remove={JS.hide("#modal")}>...</div>
<button phx-click={JS.exec("phx-remove", to: "#modal")}>close</button>
```

# `exec`

See `exec/1`.

# `exec`

See `exec/1`.

# `focus`

Sends focus to a selector.

## Options

  * `:to` - An optional DOM selector to send focus to.
    Defaults to the interacted element. See the `DOM selectors`
    section for details.

## Examples

    JS.focus(to: "main")

# `focus`

See `focus/1`.

# `focus_first`

Sends focus to the first focusable child in selector.

## Options

  * `:to` - An optional DOM selector to focus.
    Defaults to the interacted element. See the `DOM selectors`
    section for details.

## Examples

    JS.focus_first(to: "#modal")

# `focus_first`

See `focus_first/1`.

# `hide`

Hides elements.

*Note*: Only targets elements that are visible, meaning they have a height and/or width greater than zero.

## Options

  * `:to` - An optional DOM selector to hide.
    Defaults to the interacted element. See the `DOM selectors`
    section for details.
  * `:transition` - A string of classes to apply before hiding or
    a 3-tuple containing the transition class, the class to apply
    to start the transition, and the ending transition class, such as:
    `{"ease-out duration-300", "opacity-100", "opacity-0"}`
  * `:time` - The time in milliseconds to apply the transition from `:transition`.
    Defaults to 200.
  * `:blocking` - A boolean flag to block the UI during the transition. Defaults `true`.

During the process, the following events will be dispatched to the hidden elements:

  * When the action is triggered on the client, `phx:hide-start` is dispatched.
  * After the time specified by `:time`, `phx:hide-end` is dispatched.

## Examples

```heex
<div id="item">My Item</div>

<button phx-click={JS.hide(to: "#item")}>
  hide!
</button>

<button phx-click={JS.hide(to: "#item", transition: "fade-out-scale")}>
  hide fancy!
</button>
```

# `hide`

See `hide/1`.

# `ignore_attributes`

Mark attributes as ignored, skipping them when patching the DOM.

Accepts a single attribute name or a list of attribute names.
An asterisk `*` can be used as a wildcard.

Once set, the given attributes will not be patched across LiveView updates.
This includes attributes that are removed by the server.

If you need to "unmark" an attribute, you need to call `ignore_attributes/1` again
with an updated list of attributes.

This is mostly useful in combination with the `phx-mounted` binding, for example:

```heex
<dialog phx-mounted={JS.ignore_attributes("open")}>
  ...
</dialog>
```

> #### A note on the behavior of phx-mounted {: .info}
>
> The `phx-mounted` binding executes when the LiveView is mounted.
> This means that you cannot use `ignore_attributes/1` to retain attributes
> that are set on the client during the disconnected render.
> `JS.ignore_attributes/1` will only ever ignore future changes from the server.

## Options

  * `:to` - An optional DOM selector to select the target element.
    Defaults to the interacted element. See the `DOM selectors`
    section for details.

## Examples

    JS.ignore_attributes(["open", "data-*"], to: "#my-dialog")

# `ignore_attributes`

# `ignore_attributes`

# `navigate`

Sends a navigation event to the server and updates the browser's pushState history.

## Options

  * `:replace` - Whether to replace the browser's pushState history. Defaults to `false`.

## Examples

    JS.navigate("/my-path")

# `navigate`

See `navigate/1`.

# `navigate`

See `navigate/1`.

# `patch`

Sends a patch event to the server and updates the browser's pushState history.

## Options

  * `:replace` - Whether to replace the browser's pushState history. Defaults to `false`.

## Examples

    JS.patch("/my-path")

# `patch`

See `patch/1`.

# `patch`

See `patch/1`.

# `pop_focus`

Focuses the last pushed element.

## Examples

    JS.pop_focus()

# `push`

Pushes an event to the server.

  * `event` - The string event name to push.

## Options

  * `:target` - A selector or component ID to push to. This value will
    overwrite any `phx-target` attribute present on the element.
  * `:loading` - A selector to apply the phx loading classes to,
    such as `phx-click-loading` in case the event was triggered by
    `phx-click`. The element will be locked from server updates
    until the push is acknowledged by the server.
  * `:page_loading` - Boolean to trigger the phx:page-loading-start and
    phx:page-loading-stop events for this push. Defaults to `false`.
  * `:value` - A map of values to send to the server. These values will be
    merged over any `phx-value-*` attributes that are present on the element.
    All keys will be treated as strings when merging. When used on a form event
    like `phx-change` or `phx-submit`, the precedence is
    `JS.push value > phx-value-* > input value`.

## Examples

```heex
<button phx-click={JS.push("clicked")}>click me!</button>
<button phx-click={JS.push("clicked", value: %{id: @id})}>click me!</button>
<button phx-click={JS.push("clicked", page_loading: true)}>click me!</button>
```

# `push`

See `push/1`.

# `push`

See `push/1`.

# `push_focus`

Pushes focus from the source element to be later popped.

## Options

  * `:to` - An optional DOM selector to push focus to.
    Defaults to the interacted element. See the `DOM selectors`
    section for details.

## Examples

    JS.push_focus()
    JS.push_focus(to: "#my-button")

# `push_focus`

See `push_focus/1`.

# `remove_attribute`

Removes an attribute from elements.

  * `attr` - The string attribute name to remove.

## Options

  * `:to` - An optional DOM selector to remove attributes from.
    Defaults to the interacted element. See the `DOM selectors`
    section for details.

## Examples

```heex
<button phx-click={JS.remove_attribute("aria-expanded", to: "#dropdown")}>
  hide
</button>
```

# `remove_attribute`

See `remove_attribute/1`.

# `remove_attribute`

See `remove_attribute/1`.

# `remove_class`

Removes classes from elements.

  * `names` - A string with one or more class names to remove.

## Options

  * `:to` - An optional DOM selector to remove classes from.
    Defaults to the interacted element. See the `DOM selectors`
    section for details.
  * `:transition` - A string of classes to apply before removing classes or
    a 3-tuple containing the transition class, the class to apply
    to start the transition, and the ending transition class, such as:
    `{"ease-out duration-300", "opacity-0", "opacity-100"}`
  * `:time` - The time in milliseconds to apply the transition from `:transition`.
    Defaults to 200.
  * `:blocking` - A boolean flag to block the UI during the transition. Defaults `true`.

## Examples

```heex
<div id="item">My Item</div>
<button phx-click={JS.remove_class("highlight underline", to: "#item")}>
  remove highlight!
</button>
```

# `remove_class`

See `remove_class/1`.

# `remove_class`

See `remove_class/1`.

# `set_attribute`

Sets an attribute on elements.

Accepts a tuple containing the string attribute name/value pair.

## Options

  * `:to` - An optional DOM selector to add attributes to.
    Defaults to the interacted element. See the `DOM selectors`
    section for details.

## Examples

```heex
<button phx-click={JS.set_attribute({"aria-expanded", "true"}, to: "#dropdown")}>
  show
</button>
```

> #### A note on properties {: .warning}
>
> `JS.set_attribute/1` cannot be used to set DOM properties such as the [`value` of an input](https://jakearchibald.com/2024/attributes-vs-properties/#value-on-input-fields).
> So if you find yourself wanting to do `JS.set_attribute({"value", "..."})` on an input, and
> see that updated value reflected in a form event, you should use `JS.dispatch/2`
> instead:
>
> Instead of
>
> ```heex
> <.button phx-click={JS.set_attribute({"value", ""}, to: "#my_input")}>...</.button>
> ```
>
> do
>
> ```heex
> <script :type={Phoenix.LiveView.ColocatedJS} name="clear_input">
>   window.addEventListener("input:clear", (e) => {
>     e.target.value = ""
>     e.target.dispatchEvent(new Event("input", {bubbles: true}))
>   })
> </script>
> <.button phx-click={JS.dispatch("input:clear", to: "#my_input")}>...</.button>
> ```
>
> Note: this uses `Phoenix.LiveView.ColocatedJS`, but you can also define the event listener directly inside
> your `app.js` instead.

# `set_attribute`

See `set_attribute/1`.

# `set_attribute`

See `set_attribute/1`.

# `show`

Shows elements.

*Note*: Only targets elements that are hidden, meaning they have a height and/or width equal to zero.

## Options

  * `:to` - An optional DOM selector to show.
    Defaults to the interacted element. See the `DOM selectors`
    section for details.
  * `:transition` - A string of classes to apply before showing or
    a 3-tuple containing the transition class, the class to apply
    to start the transition, and the ending transition class, such as:
    `{"ease-out duration-300", "opacity-0", "opacity-100"}`
  * `:time` - The time in milliseconds to apply the transition from `:transition`.
    Defaults to 200.
  * `:blocking` - A boolean flag to block the UI during the transition. Defaults `true`.
  * `:display` - An optional display value to set when showing. Defaults to `"block"`.

During the process, the following events will be dispatched to the shown elements:

  * When the action is triggered on the client, `phx:show-start` is dispatched.
  * After the time specified by `:time`, `phx:show-end` is dispatched.

## Examples

```heex
<div id="item">My Item</div>

<button phx-click={JS.show(to: "#item")}>
  show!
</button>

<button phx-click={JS.show(to: "#item", transition: "fade-in-scale")}>
  show fancy!
</button>
```

# `show`

See `show/1`.

# `toggle`

Toggles element visibility.

## Options

  * `:to` - An optional DOM selector to toggle.
    Defaults to the interacted element. See the `DOM selectors`
    section for details.
  * `:in` - A string of classes to apply when toggling in, or
    a 3-tuple containing the transition class, the class to apply
    to start the transition, and the ending transition class, such as:
    `{"ease-out duration-300", "opacity-0", "opacity-100"}`
  * `:out` - A string of classes to apply when toggling out, or
    a 3-tuple containing the transition class, the class to apply
    to start the transition, and the ending transition class, such as:
    `{"ease-out duration-300", "opacity-100", "opacity-0"}`
  * `:time` - The time in milliseconds to apply the transition `:in` and `:out` classes.
    Defaults to 200.
  * `:display` - An optional display value to set when toggling in. Defaults
    to `"block"`.
  * `:blocking` - A boolean flag to block the UI during the transition. Defaults `true`.

When the toggle is complete on the client, a `phx:show-start` or `phx:hide-start`, and
`phx:show-end` or `phx:hide-end` event will be dispatched to the toggled elements.

## Examples

```heex
<div id="item">My Item</div>

<button phx-click={JS.toggle(to: "#item")}>
  toggle item!
</button>

<button phx-click={JS.toggle(to: "#item", in: "fade-in-scale", out: "fade-out-scale")}>
  toggle fancy!
</button>
```

# `toggle`

See `toggle/1`.

# `toggle_attribute`

Sets or removes element attribute based on attribute presence.

Accepts a two or three-element tuple:

* `{attr, val}` - Sets the attribute to the given value or removes it
* `{attr, val1, val2}` - Toggles the attribute between `val1` and `val2`

## Options

  * `:to` - An optional DOM selector to set or remove attributes from.
    Defaults to the interacted element. See the `DOM selectors`
    section for details.

## Examples

```heex
<button phx-click={JS.toggle_attribute({"aria-expanded", "true", "false"}, to: "#dropdown")}>
  toggle
</button>

<button phx-click={JS.toggle_attribute({"open", "true"}, to: "#dialog")}>
  toggle
</button>
```

# `toggle_attribute`

See `toggle_attribute/1`.

# `toggle_attribute`

See `toggle_attribute/1`.

# `toggle_class`

Adds or removes element classes based on presence.

  * `names` - A string with one or more class names to toggle.

## Options

  * `:to` - An optional DOM selector to target.
    Defaults to the interacted element. See the `DOM selectors`
    section for details.
  * `:transition` - A string of classes to apply before adding classes or
    a 3-tuple containing the transition class, the class to apply
    to start the transition, and the ending transition class, such as:
    `{"ease-out duration-300", "opacity-0", "opacity-100"}`
  * `:time` - The time in milliseconds to apply the transition from `:transition`.
    Defaults to 200.
  * `:blocking` - A boolean flag to block the UI during the transition. Defaults `true`.

## Examples

```heex
<div id="item">My Item</div>
<button phx-click={JS.toggle_class("active", to: "#item")}>
  toggle active!
</button>
```

# `toggle_class`

# `toggle_class`

# `transition`

Transitions elements.

  * `transition` - A string of classes to apply during the transition or
    a 3-tuple containing the transition class, the class to apply
    to start the transition, and the ending transition class, such as:
    `{"ease-out duration-300", "opacity-0", "opacity-100"}`

Transitions are useful for temporarily adding an animation class
to elements, such as for highlighting content changes.

## Options

  * `:to` - An optional DOM selector to apply transitions to.
    Defaults to the interacted element. See the `DOM selectors`
    section for details.
  * `:time` - The time in milliseconds to apply the transition from `:transition`.
    Defaults to 200.
  * `:blocking` - A boolean flag to block the UI during the transition. Defaults `true`.

## Examples

```heex
<div id="item">My Item</div>
<button phx-click={JS.transition("shake", to: "#item")}>Shake!</button>

<div phx-mounted={JS.transition({"ease-out duration-300", "opacity-0", "opacity-100"}, time: 300)}>
    duration-300 milliseconds matches time: 300 milliseconds
</div>
```

# `transition`

See `transition/1`.

# `transition`

See `transition/1`.

---

*Consult [api-reference.md](api-reference.md) for complete listing*
