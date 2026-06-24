# `Phoenix.Component`
[🔗](https://github.com/phoenixframework/phoenix_live_view/blob/v1.1.28/lib/phoenix_component.ex#L1)

Define reusable function components with HEEx templates.

A function component is any function that receives an assigns
map as an argument and returns a rendered struct built with
[the `~H` sigil](`sigil_H/2`):

    defmodule MyComponent do
      # In Phoenix apps, the line is typically: use MyAppWeb, :html
      use Phoenix.Component

      def greet(assigns) do
        ~H"""
        <p>Hello, {@name}!</p>
        """
      end
    end

This function uses the `~H` sigil to return a rendered template.
`~H` stands for HEEx (HTML + EEx). HEEx is a template language for
writing HTML mixed with Elixir interpolation. We can write Elixir
code inside `{...}` for HTML-aware interpolation inside tag attributes
and the body. We can also interpolate arbitrary HEEx blocks using `<%= ... %>`
We use `@name` to access the key `name` defined inside `assigns`.

When invoked within a `~H` sigil or HEEx template file:

```heex
<MyComponent.greet name="Jane" />
```

The following HTML is rendered:

```html
<p>Hello, Jane!</p>
```

If the function component is defined locally, or its module is imported,
then the caller can invoke the function directly without specifying the module:

```heex
<.greet name="Jane" />
```

For dynamic values, you can interpolate Elixir expressions into a function component:

```heex
<.greet name={@user.name} />
```

Function components can also accept blocks of HEEx content (more on this later):

```heex
<.card>
  <p>This is the body of my card!</p>
</.card>
```

In this module we will learn how to build rich and composable components to
use in our applications.

## Attributes

`Phoenix.Component` provides the `attr/3` macro to declare what attributes the proceeding function
component expects to receive when invoked:

    attr :name, :string, required: true

    def greet(assigns) do
      ~H"""
      <p>Hello, {@name}!</p>
      """
    end

By calling `attr/3`, it is now clear that `greet/1` requires a string attribute called `name`
present in its assigns map to properly render. Failing to do so will result in a compilation
warning:

```heex
<MyComponent.greet />
  <!-- warning: missing required attribute "name" for component MyAppWeb.MyComponent.greet/1
           lib/app_web/my_component.ex:15 -->
```

Attributes can provide default values that are automatically merged into the assigns map:

    attr :name, :string, default: "Bob"

Now you can invoke the function component without providing a value for `name`:

```heex
<.greet />
```

Rendering the following HTML:

```html
<p>Hello, Bob!</p>
```

Accessing an attribute which is required and does not have a default value will fail.
You must explicitly declare `default: nil` or assign a value programmatically with the
`assign_new/3` function.

Multiple attributes can be declared for the same function component:

    attr :name, :string, required: true
    attr :age, :integer, required: true

    def celebrate(assigns) do
      ~H"""
      <p>
        Happy birthday {@name}!
        You are {@age} years old.
      </p>
      """
    end

Allowing the caller to pass multiple values:

```heex
<.celebrate name={"Genevieve"} age={34} />
```

Rendering the following HTML:

```html
<p>
  Happy birthday Genevieve!
  You are 34 years old.
</p>
```

Multiple function components can be defined in the same module, with different attributes. In the
following example, `<Components.greet/>` requires a `name`, but *does not* require a `title`, and
`<Components.heading>` requires a `title`, but *does not* require a `name`.

    defmodule Components do
      # In Phoenix apps, the line is typically: use MyAppWeb, :html
      use Phoenix.Component

      attr :title, :string, required: true

      def heading(assigns) do
        ~H"""
        <h1>{@title}</h1>
        """
      end

      attr :name, :string, required: true

      def greet(assigns) do
        ~H"""
        <p>Hello {@name}</p>
        """
      end
    end

With the `attr/3` macro you have the core ingredients to create reusable function components.
But what if you need your function components to support dynamic attributes, such as common HTML
attributes to mix into a component's container?

## Global attributes

Global attributes are a set of attributes that a function component can accept when it
declares an attribute of type `:global`. By default, the set of attributes accepted are those
attributes common to all standard HTML tags.
See [Global attributes](https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes)
for a complete list of attributes.

Once a global attribute is declared, any number of attributes in the set can be passed by
the caller without having to modify the function component itself.

Below is an example of a function component that accepts a dynamic number of global attributes:

    attr :message, :string, required: true
    attr :rest, :global

    def notification(assigns) do
      ~H"""
      <span {@rest}>{@message}</span>
      """
    end

The caller can pass multiple global attributes (such as `phx-*` bindings or the `class` attribute):

```heex
<.notification message="You've got mail!" class="bg-green-200" phx-click="close" />
```

Rendering the following HTML:

```html
<span class="bg-green-200" phx-click="close">You've got mail!</span>
```

Note that the function component did not have to explicitly declare a `class` or `phx-click`
attribute in order to render.

Global attributes can define defaults which are merged with attributes provided by the caller.
For example, you may declare a default `class` if the caller does not provide one:

    attr :rest, :global, default: %{class: "bg-blue-200"}

Now you can call the function component without a `class` attribute:

```heex
<.notification message="You've got mail!" phx-click="close" />
```

Rendering the following HTML:

```html
<span class="bg-blue-200" phx-click="close">You've got mail!</span>
```

Note that the global attribute cannot be provided directly and doing so will emit
a warning. In other words, this is invalid:

```heex
<.notification message="You've got mail!" rest={%{"phx-click" => "close"}} />
```

### Included globals

You may also specify which attributes are included in addition to the known globals
with the `:include` option. For example to support the `form` attribute on a button
component:

```elixir
# <.button form="my-form"/>
attr :rest, :global, include: ~w(form)
slot :inner_block
def button(assigns) do
  ~H"""
  <button {@rest}>{render_slot(@inner_block)}</button>
  """
end
```

The `:include` option is useful to apply global additions on a case-by-case basis,
but sometimes you want to extend existing components with new global attributes,
such as Alpine.js' `x-` prefixes, which we'll outline next.

### Custom global attribute prefixes

You can extend the set of global attributes by providing a list of attribute prefixes to
`use Phoenix.Component`. Like the default attributes common to all HTML elements,
any number of attributes that start with a global prefix will be accepted by function
components invoked by the current module. By default, the following prefixes are supported:
`phx-`, `aria-`, and `data-`. For example, to support the `x-` prefix used by
[Alpine.js](https://alpinejs.dev/), you can pass the `:global_prefixes` option to
`use Phoenix.Component`:

    use Phoenix.Component, global_prefixes: ~w(x-)

In your Phoenix application, this is typically done in your
`lib/my_app_web.ex` file, inside the `def html` definition:

    def html do
      quote do
        use Phoenix.Component, global_prefixes: ~w(x-)
        # ...
      end
    end

Now all function components invoked by this module will accept any number of attributes
prefixed with `x-`, in addition to the default global prefixes.

You can learn more about attributes by reading the documentation for `attr/3`.

## Slots

In addition to attributes, function components can accept blocks of HEEx content, referred to
as slots. Slots enable further customization of the rendered HTML, as the caller can pass the
function component HEEx content they want the component to render. `Phoenix.Component` provides
the `slot/3` macro used to declare slots for function components:

    slot :inner_block, required: true

    def button(assigns) do
      ~H"""
      <button>
        {render_slot(@inner_block)}
      </button>
      """
    end

The expression `render_slot(@inner_block)` renders the HEEx content. You can invoke this function
component like so:

```heex
<.button>
  This renders <strong>inside</strong> the button!
</.button>
```

Which renders the following HTML:

```html
<button>
  This renders <strong>inside</strong> the button!
</button>
```

Like the `attr/3` macro, using the `slot/3` macro will provide compile-time validations.
For example, invoking `button/1` without a slot of HEEx content will result in a compilation
warning being emitted:

```heex
<.button />
  <!-- warning: missing required slot "inner_block" for component MyAppWeb.MyComponent.button/1
           lib/app_web/my_component.ex:15 -->
```

### The default slot

The example above uses the default slot, accessible as an assign named `@inner_block`, to render
HEEx content via the `render_slot/1` function.

If the values rendered in the slot need to be dynamic, you can pass a second value back to the
HEEx content by calling `render_slot/2`:

    slot :inner_block, required: true

    attr :entries, :list, default: []

    def unordered_list(assigns) do
      ~H"""
      <ul>
        <li :for={entry <- @entries}>{render_slot(@inner_block, entry)}</li>
      </ul>
      """
    end

When invoking the function component, you can use the special attribute `:let` to take the value
that the function component passes back and bind it to a variable:

```heex
<.unordered_list :let={fruit} entries={~w(apples bananas cherries)}>
  I like <b>{fruit}</b>!
</.unordered_list>
```

Rendering the following HTML:

```html
<ul>
  <li>I like <b>apples</b>!</li>
  <li>I like <b>bananas</b>!</li>
  <li>I like <b>cherries</b>!</li>
</ul>
```

Now the separation of concerns is maintained: the caller can specify multiple values in a list
attribute without having to specify the HEEx content that surrounds and separates them.

### Named slots

In addition to the default slot, function components can accept multiple, named slots of HEEx
content. For example, imagine you want to create a modal that has a header, body, and footer:

    slot :header
    slot :inner_block, required: true
    slot :footer, required: true

    def modal(assigns) do
      ~H"""
      <div class="modal">
        <div class="modal-header">
          {render_slot(@header) || "Modal"}
        </div>
        <div class="modal-body">
          {render_slot(@inner_block)}
        </div>
        <div class="modal-footer">
          {render_slot(@footer)}
        </div>
      </div>
      """
    end

You can invoke this function component using the named slot HEEx syntax:

```heex
<.modal>
  This is the body, everything not in a named slot is rendered in the default slot.
  <:footer>
    This is the bottom of the modal.
  </:footer>
</.modal>
```

Rendering the following HTML:

```html
<div class="modal">
  <div class="modal-header">
    Modal.
  </div>
  <div class="modal-body">
    This is the body, everything not in a named slot is rendered in the default slot.
  </div>
  <div class="modal-footer">
    This is the bottom of the modal.
  </div>
</div>
```

As shown in the example above, `render_slot/1` returns `nil` when an optional slot
is declared and none is given. This can be used to attach default behaviour.

### Slot attributes

Unlike the default slot, it is possible to pass a named slot multiple pieces of HEEx content.
Named slots can also accept attributes, defined by passing a block to the `slot/3` macro.
If multiple pieces of content are passed, `render_slot/2` will merge and render all the values.

Below is a table component illustrating multiple named slots with attributes:

    slot :column, doc: "Columns with column labels" do
      attr :label, :string, required: true, doc: "Column label"
    end

    attr :rows, :list, default: []

    def table(assigns) do
      ~H"""
      <table>
        <tr>
          <th :for={col <- @column}>{col.label}</th>
        </tr>
        <tr :for={row <- @rows}>
          <td :for={col <- @column}>{render_slot(col, row)}</td>
        </tr>
      </table>
      """
    end

You can invoke this function component like so:

```heex
<.table rows={[%{name: "Jane", age: "34"}, %{name: "Bob", age: "51"}]}>
  <:column :let={user} label="Name">
    {user.name}
  </:column>
  <:column :let={user} label="Age">
    {user.age}
  </:column>
</.table>
```

Rendering the following HTML:

```html
<table>
  <tr>
    <th>Name</th>
    <th>Age</th>
  </tr>
  <tr>
    <td>Jane</td>
    <td>34</td>
  </tr>
  <tr>
    <td>Bob</td>
    <td>51</td>
  </tr>
</table>
```

You can learn more about slots and the `slot/3` macro [in its documentation](`slot/3`).

## Embedding external template files

The `embed_templates/1` macro can be used to embed `.html.heex` files
as function components. The directory path is based on the current
module (`__DIR__`), and a wildcard pattern may be used to select all
files within a directory tree. For example, imagine a directory listing:

```plain
├── components.ex
├── cards
│   ├── pricing_card.html.heex
│   └── features_card.html.heex
```

Then you can embed the page templates in your `components.ex` module
and call them like any other function component:

    defmodule MyAppWeb.Components do
      use Phoenix.Component

      embed_templates "cards/*"

      def landing_hero(assigns) do
        ~H"""
        <.pricing_card />
        <.features_card />
        """
      end
    end

See `embed_templates/1` for more information, including declarative
assigns support for embedded templates.

## Debug information

HEEx templates support adding annotations and locations to the rendered
page, which are special HTML comments and attributes that help you identify
where markup in your HTML document is rendered within your function component
tree.

For example, imagine the following HEEx template:

```heex
<.header>
  <.button>Click</.button>
</.header>
```

By turning on `debug_heex_annotations`, the HTML document would receive the
following comments when debug annotations are enabled:

```html
<!-- @caller lib/app_web/home_live.ex:20 -->
<!-- <AppWeb.CoreComponents.header> lib/app_web/core_components.ex:123 -->
<header class="p-5">
  <!-- @caller lib/app_web/home_live.ex:48 -->
  <!-- <AppWeb.CoreComponents.button> lib/app_web/core_components.ex:456 -->
  <button class="px-2 bg-indigo-500 text-white">Click</button>
  <!-- </AppWeb.CoreComponents.button> -->
</header>
<!-- </AppWeb.CoreComponents.header> -->
```

Similarly, you can also turn on `:debug_attributes`, which adds a
`data-phx-loc` attribute with the line of where each HTML tag is defined
(as well as `data-phx-pid` to the LiveView container):

```html
<header data-phx-loc="125" class="p-5">
  <button data-phx-loc="458" class="px-2 bg-indigo-500 text-white">Click</button>
</header>
```

These features work on any `~H` or `.html.heex` template. They can be enabled
globally with the following configuration in your `config/dev.exs` file:

    config :phoenix_live_view,
      debug_heex_annotations: true,
      debug_attributes: true

Changing this configuration will require `mix clean` and a full recompile.

## Dynamic Component Rendering

Sometimes you might need to decide at runtime which component to render.
Because function components are just regular functions, we can leverage
Elixir's `apply/3` function to dynamically call a module and/or function passed
in as an assign.

For example, using the following function component definition:

```elixir
attr :module, :atom, required: true
attr :function, :atom, required: true
# any shared attributes
attr :shared, :string, required: true

# any shared slots
slot :named_slot, required: true
slot :inner_block, required: true

def dynamic_component(assigns) do
  {mod, assigns} = Map.pop(assigns, :module)
  {func, assigns} = Map.pop(assigns, :function)

  apply(mod, func, [assigns])
end
```

Then you can use the `dynamic_component` function like so:

```heex
<.dynamic_component
  module={MyAppWeb.MyModule}
  function={:my_function}
  shared="Yay Elixir!"
>
  <p>Howdy from the inner block!</p>
  <:named_slot>
    <p>Howdy from the named slot!</p>
  </:named_slot>
</.dynamic_component>
```

This will call the `MyAppWeb.MyModule.my_function/1` function passing in the remaining assigns.

```elixir
defmodule MyAppWeb.MyModule do
  attr :shared, :string, required: true

  slot :named_slot, required: true
  slot :inner_block, required: true

  def my_function(assigns) do
    ~H"""
    <p>Dynamic component with shared assigns: {@shared}</p>
    {render_slot(@inner_block)}
    {render_slot(@named_slot)}
    """
  end
end
```

Resulting in the following HTML:

```html
<p>Dynamic component with shared assigns: Yay Elixir!</p>
<p>Howdy from the inner block!</p>
<p>Howdy from the named slot!</p>
```

Note that to get the most out of `Phoenix.Component`'s compile-time validations, it is beneficial to
define such a `dynamic_component` for a specific set of components sharing the same API, instead of
defining it for the general case.
In this example, we defined our `dynamic_component` to expect an assign called `shared`, as well as
two slots that all components we want to use with it must implement.
The called `my_function` component's attribute and slot definitions cannot be validated through the apply call.

# `async_result`

Renders a `Phoenix.LiveView.AsyncResult` struct (e.g. from `Phoenix.LiveView.assign_async/4`)
with slots for the different loading states.
The result state takes precedence over subsequent loading and failed
states.

> #### Note {: .info}
>
> The inner block receives the result of the async assign as a `:let`.
> The let is only accessible to the inner block and is not in scope to the
> other slots.

## Examples

```elixir
def mount(%{"slug" => slug}, _, socket) do
  {:ok,
    socket
    |> assign_async(:org, fn -> {:ok, %{org: fetch_org!(slug)}} end)}
end
```

```heex
<.async_result :let={org} assign={@org}>
  <:loading>Loading organization...</:loading>
  <:failed :let={_failure}>there was an error loading the organization</:failed>
  <%= if org do %>
    {org.name}
  <% else %>
    You don't have an organization yet.
  <% end %>
</.async_result>
```

See [Async Operations](`m:Phoenix.LiveView#module-async-operations`) for more information.

To display loading and failed states again on subsequent `assign_async` calls,
reset the assign to a result-free `%AsyncResult{}`:

```elixir
{:noreply,
  socket
  |> assign_async(:page, :data, &reload_data/0)
  |> assign(:page, AsyncResult.loading())}
```

## Attributes

* `assign` (`Phoenix.LiveView.AsyncResult`) (required)
## Slots

* `loading` - rendered while the assign is loading for the first time.
* `failed` - rendered when an error or exit is caught or assign_async returns `{:error, reason}` for the first time. Receives the error as a `:let`.
* `inner_block` - rendered when the assign is loaded successfully via `AsyncResult.ok/2`. Receives the result as a `:let`.

# `dynamic_tag`

Generates a dynamically named HTML tag.

Raises an `ArgumentError` if the tag name is found to be unsafe HTML.

## Attributes

* `tag_name` (`:string`) (required) - The name of the tag, such as `div`.
* `name` (`:string`) - Deprecated: use tag_name instead. If tag_name is used, passed to the tag. Otherwise the name of the tag, such as `div`.
* Global attributes are accepted. Additional HTML attributes to add to the tag, ensuring proper escaping.
## Slots

* `inner_block`

## Examples

```heex
<.dynamic_tag tag_name="input" name="my-input" type="text"/>
```

```html
<input name="my-input" type="text"/>
```

```heex
<.dynamic_tag tag_name="p">content</.dynamic_tag>
```

```html
<p>content</p>
```

# `focus_wrap`

Wraps tab focus around a container for accessibility.

This is an essential accessibility feature for interfaces such as modals, dialogs, and menus.

## Attributes

* `id` (`:string`) (required) - The DOM identifier of the container tag.
* Global attributes are accepted. Additional HTML attributes to add to the container tag.
## Slots

* `inner_block` (required) - The content rendered inside of the container tag.

## Examples

Simply render your inner content within this component and focus will be wrapped around the
container as the user tabs through the containers content:

```heex
<.focus_wrap id="my-modal" class="bg-white">
  <div id="modal-content">
    Are you sure?
    <button phx-click="cancel">Cancel</button>
    <button phx-click="confirm">OK</button>
  </div>
</.focus_wrap>
```

# `form`

Renders a form.

This function receives a `Phoenix.HTML.Form` struct, generally created with
`to_form/2`, and generates the relevant form tags. It can be used either
inside LiveView or outside.

> To see how forms work in practice, you can run
> `mix phx.gen.live Blog Post posts title body:text` inside your Phoenix
> application, which will setup the necessary database tables and LiveViews
> to manage your data.

## Examples: inside LiveView

Inside LiveViews, this function component is typically called with
as `for={@form}`, where `@form` is the result of the `to_form/1` function.
`to_form/1` expects either a map or an [`Ecto.Changeset`](https://hexdocs.pm/ecto/Ecto.Changeset.html)
as the source of data and normalizes it into `Phoenix.HTML.Form` structure.

For example, you may use the parameters received in a
`c:Phoenix.LiveView.handle_event/3` callback to create an Ecto changeset
and then use `to_form/1` to convert it to a form. Then, in your templates,
you pass the `@form` as argument to `:for`:

```heex
<.form
  for={@form}
  id="my-form"
  phx-change="change_name"
>
  <.input field={@form[:email]} />
</.form>
```

The `.input` component is generally defined as part of your own application
and adds all styling necessary:

```heex
def input(assigns) do
  ~H"""
  <input type="text" name={@field.name} id={@field.id} value={@field.value} class="..." />
  """
end
```

A form accepts multiple options. For example, if you are doing file uploads
and you want to capture submissions, you might write instead:

```heex
<.form
  for={@form}
  id="my-form"
  phx-change="change_user"
  phx-submit="save_user"
  multipart
>
  ...
  <input type="submit" value="Save" />
</.form>
```

Notice how both examples use `phx-change`. The LiveView must implement the
`phx-change` event and store the input values as they arrive on change.
This is important because, if an unrelated change happens on the page,
LiveView should re-render the inputs with their updated values. Without `phx-change`,
the inputs would otherwise be cleared. Alternatively, you can use `phx-update="ignore"`
on the form to discard any updates.

### Using the `for` attribute

The `for` attribute can also be a map or an Ecto.Changeset. In such cases,
a form will be created on the fly, and you can capture it using `:let`:

```heex
<.form
  :let={form}
  for={@changeset}
  id="my-form"
  phx-change="change_user"
>
```

However, such approach is discouraged in LiveView for two reasons:

  * LiveView can better optimize your code if you access the form fields
    using `@form[:field]` rather than through the let-variable `form`

  * Ecto changesets are meant to be single use. By never storing the changeset
    in the assign, you will be less tempted to use it across operations

### A note on `:errors`

Even if `changeset.errors` is non-empty, errors will not be displayed in a
form if [the changeset
`:action`](https://hexdocs.pm/ecto/Ecto.Changeset.html#module-changeset-actions)
is `nil` or `:ignore`.

This is useful for things like validation hints on form fields, e.g. an empty
changeset for a new form. That changeset isn't valid, but we don't want to
show errors until an actual user action has been performed.

For example, if the user submits and a `Repo.insert/1` is called and fails on
changeset validation, the action will be set to `:insert` to show that an
insert was attempted, and the presence of that action will cause errors to be
displayed. The same is true for Repo.update/delete.

Error visibility is handled by providing the action to `to_form/2`, which will
set the underlying changeset action. You can also set the action manually by
directly updating on the `Ecto.Changeset` struct field, or by using
`Ecto.Changeset.apply_action/2`. Since the action can be arbitrary, you can
set it to `:validate` or anything else to avoid giving the impression that a
database operation has actually been attempted.

### Displaying errors on used and unused input fields

Used inputs are only those inputs that have been focused, interacted with, or
submitted by the client. In most cases, a user shouldn't receive error feedback
for forms they haven't yet interacted with, until they submit the form. Filtering
the errors based on used input fields can be done with `used_input?/1`.

## Example: outside LiveView (regular HTTP requests)

The `form` component can still be used to submit forms outside of LiveView.
In such cases, the standard HTML `action` attribute MUST be given.
Without said attribute, the `form` method and csrf token are discarded.

```heex
<.form :let={f} for={@changeset} action={~p"/comments/#{@comment}"}>
  <.input field={f[:body]} />
</.form>
```

In the example above, we passed a changeset to `for` and captured
the value using `:let={f}`. This approach is ok outside of LiveViews,
as there are no change tracking optimizations to consider.

### CSRF protection

CSRF protection is a mechanism to ensure that the user who rendered
the form is the one actually submitting it. This module generates a
CSRF token by default. Your application should check this token on
the server to avoid attackers from making requests on your server on
behalf of other users. Phoenix by default checks this token.

When posting a form with a host in its address, such as "//host.com/path"
instead of only "/path", Phoenix will include the host signature in the
token and validate the token only if the accessed host is the same as
the host in the token. This is to avoid tokens from leaking to third
party applications. If this behaviour is problematic, you can generate
a non-host specific token with `Plug.CSRFProtection.get_csrf_token/0` and
pass it to the form generator via the `:csrf_token` option.

## Attributes

* `for` (`:any`) (required) - An existing form or the form source data.
* `action` (`:string`) - The action to submit the form on.
  This attribute must be given if you intend to submit the form to a URL without LiveView.

* `as` (`:atom`) - The prefix to be used in names and IDs generated by the form.
  For example, setting `as: :user_params` means the parameters
  will be nested "user_params" in your `handle_event` or
  `conn.params["user_params"]` for regular HTTP requests.
  If you set this option, you must capture the form with `:let`.

* `csrf_token` (`:any`) - A token to authenticate the validity of requests.
  One is automatically generated when an action is given and the method is not `get`.
  When set to `false`, no token is generated.

* `errors` (`:list`) - Use this to manually pass a keyword list of errors to the form.
  This option is useful when a regular map is given as the form
  source and it will make the errors available under `f.errors`.
  If you set this option, you must capture the form with `:let`.

* `method` (`:string`) - The HTTP method.
  It is only used if an `:action` is given. If the method is not `get` nor `post`,
  an input tag with name `_method` is generated alongside the form tag.
  If an `:action` is given with no method, the method will default to the return value
  of `Phoenix.HTML.FormData.to_form/2` (usually `post`).

* `multipart` (`:boolean`) - Sets `enctype` to `multipart/form-data`.
  Required when uploading files.

  Defaults to `false`.
* Global attributes are accepted. Additional HTML attributes to add to the form tag. Supports all globals plus: `["autocomplete", "name", "rel", "enctype", "novalidate", "target"]`.
## Slots

* `inner_block` (required) - The content rendered inside of the form tag.

# `inputs_for`

Renders nested form inputs for associations or embeds.

## Attributes

* `field` (`Phoenix.HTML.FormField`) (required) - A %Phoenix.HTML.Form{}/field name tuple, for example: {@form[:email]}.
* `id` (`:string`) - The id base to be used in the form inputs. Defaults to the parent form id. The computed
  id will be the concatenation of the base id with the field name, along with a book keeping
  index for each input in the list.

* `as` (`:atom`) - The name to be used in the form, defaults to the concatenation of the given
  field to the parent form name.

* `default` (`:any`) - The value to use if none is available.
* `prepend` (`:list`) - The values to prepend when rendering. This only applies if the field value
  is a list and no parameters were sent through the form.

* `append` (`:list`) - The values to append when rendering. This only applies if the field value
  is a list and no parameters were sent through the form.

* `skip_hidden` (`:boolean`) - Skip the automatic rendering of hidden fields to allow for more tight control
  over the generated markup.

  Defaults to `false`.
* `skip_persistent_id` (`:boolean`) - Skip the automatic rendering of hidden _persistent_id fields used for reordering
  inputs.

  Defaults to `false`.
* `options` (`:list`) - Any additional options for the `Phoenix.HTML.FormData` protocol
  implementation.

  Defaults to `[]`.
## Slots

* `inner_block` (required) - The content rendered for each nested form.

## Examples

```heex
<.form
  for={@form}
  id="my-form"
  phx-change="change_name"
>
  <.inputs_for :let={f_nested} field={@form[:nested]}>
    <.input type="text" field={f_nested[:name]} />
  </.inputs_for>
</.form>
```

## Dynamically adding and removing inputs

Dynamically adding and removing inputs is supported by rendering named buttons for
inserts and removals. Like inputs, buttons with name/value pairs are serialized with
form data on change and submit events. Libraries such as Ecto, or custom param
filtering can then inspect the parameters and handle the added or removed fields.
This can be combined with `Ecto.Changeset.cast_assoc/3`'s `:sort_param` and `:drop_param`
options. For example, imagine a parent with an `:emails` `has_many` or `embeds_many`
association. To cast the user input from a nested form, one simply needs to configure
the options:

    schema "mailing_lists" do
      field :title, :string

      embeds_many :emails, EmailNotification, on_replace: :delete do
        field :email, :string
        field :name, :string
      end
    end

    def changeset(list, attrs) do
      list
      |> cast(attrs, [:title])
      |> cast_embed(:emails,
        with: &email_changeset/2,
        sort_param: :emails_sort,
        drop_param: :emails_drop
      )
    end

Here we see the `:sort_param` and `:drop_param` options in action.

> Note: `on_replace: :delete` on the `has_many` and `embeds_many` is required
> when using these options.

When Ecto sees the specified sort or drop parameter from the form, it will sort
the children based on the order they appear in the form, add new children it hasn't
seen, or drop children if the parameter instructs it to do so.

The markup for such a schema and association would look like this:

```heex
<.inputs_for :let={ef} field={@form[:emails]}>
  <input type="hidden" name="mailing_list[emails_sort][]" value={ef.index} />
  <.input type="text" field={ef[:email]} placeholder="email" />
  <.input type="text" field={ef[:name]} placeholder="name" />
  <button
    type="button"
    name="mailing_list[emails_drop][]"
    value={ef.index}
    phx-click={JS.dispatch("change")}
  >
    <.icon name="hero-x-mark" class="w-6 h-6 relative top-2" />
  </button>
</.inputs_for>

<input type="hidden" name="mailing_list[emails_drop][]" />

<button type="button" name="mailing_list[emails_sort][]" value="new" phx-click={JS.dispatch("change")}>
  add more
</button>
```

We used `inputs_for` to render inputs for the `:emails` association, which
contains an email address and name input for each child. Within the nested inputs,
we render a hidden `mailing_list[emails_sort][]` input, which is set to the index of the
given child. This tells Ecto's cast operation how to sort existing children, or
where to insert new children. Next, we render the email and name inputs as usual.
Then we render a button containing the "delete" text with the name `mailing_list[emails_drop][]`,
containing the index of the child as its value.

Like before, this tells Ecto to delete the child at this index when the button is
clicked. We use `phx-click={JS.dispatch("change")}` on the button to tell LiveView
to treat this button click as a change event, rather than a submit event on the form,
which invokes our form's `phx-change` binding.

Outside the `inputs_for`, we render an empty `mailing_list[emails_drop][]` input,
to ensure that all children are deleted when saving a form where the user
dropped all entries. This hidden input is required whenever dropping associations.

Finally, we also render another button with the sort param name `mailing_list[emails_sort][]`
and `value="new"` name with accompanied "add more" text. Please note that this button must
have `type="button"` to prevent it from submitting the form.
Ecto will treat unknown sort params as new children and build a new child.
This button is optional and only necessary if you want to dynamically add entries.
You can optionally add a similar button before the `<.inputs_for>`, in the case you want
to prepend entries.

> ### A note on accessing a field's `value` {: .warning}
>
> You may be tempted to access `form[:field].value` or attempt to manipulate
> the form metadata in your templates. However, bear in mind that the `form[:field]`
> value reflects the most recent changes. For example, an `:integer` field may
> either contain integer values, but it may also hold a string, if the form has
> been submitted.
>
> This is particularly noticeable when using `inputs_for`. Accessing the `.value`
> of a nested field may either return a struct, a changeset, or raw parameters
> sent by the client (when using `drop_param`). This makes the `form[:field].value`
> impractical for deriving or computing other properties.
>
> The correct way to approach this problem is by computing any property either in
> your LiveViews, by traversing the relevant changesets and data structures, or by
> moving the logic to the `Ecto.Changeset` itself.
>
> As an example, imagine you are building a time tracking application where:
>
> - users enter the total work time for a day
> - individual activities are tracked as embeds
> - the sum of all activities should match the total time
> - the form should display the remaining time
>
> Instead of trying to calculate the remaining time in your template by
> doing something like `calculate_remaining(@form)` and accessing
> `form[:activities].value`, calculate the remaining time based
> on the changeset in your `handle_event` instead:
>
> ```elixir
> def handle_event("validate", %{"tracked_day" => params}, socket) do
>   changeset = TrackedDay.changeset(socket.assigns.tracked_day, params)
>   remaining = calculate_remaining(changeset)
>   {:noreply, assign(socket, form: to_form(changeset, action: :validate), remaining: remaining)}
> end
>
> # Helper function to calculate remaining time
> defp calculate_remaining(changeset) do
>   total = Ecto.Changeset.get_field(changeset, :total)
>   activities = Ecto.Changeset.get_embed(changeset, :activities)
>
>   Enum.reduce(activities, total, fn activity, acc ->
>     duration =
>       case activity do
>         %{valid?: true} = changeset -> Ecto.Changeset.get_field(changeset, :duration)
>         # if the activity is invalid, we don't include its duration in the calculation
>         _ -> 0
>       end
>
>     acc - length
>   end)
> end
> ```
>
> This logic might also be implemented directly in your schema module and, if you
> often need the `:remaining` value, you could also add it as a `:virtual` field to
> your schema and run the calculation when validating the changeset:
>
> ```elixir
> def changeset(tracked_day, attrs) do
>   tracked_day
>   |> cast(attrs, [:total_duration])
>   |> cast_embed(:activities)
>   |> validate_required([:total_duration])
>   |> validate_number(:total_duration, greater_than: 0)
>   |> validate_and_put_remaining_time()
> end
>
> defp validate_and_put_remaining_time(changeset) do
>   remaining = calculate_remaining(changeset)
>   put_change(changeset, :remaining, remaining)
> end
> ```
>
> By using this approach, you can safely render the remaining time in your template
> using `@form[:remaining].value`, avoiding the pitfalls of directly accessing complex field values.

# `intersperse`

Intersperses separator slot between an enumerable.

Useful when you need to add a separator between items such as when
rendering breadcrumbs for navigation. Provides each item to the
inner block.

## Examples

```heex
<.intersperse :let={item} enum={["home", "profile", "settings"]}>
  <:separator>
    <span class="sep">|</span>
  </:separator>
  {item}
</.intersperse>
```

Renders the following markup:

```html
home <span class="sep">|</span> profile <span class="sep">|</span> settings
```

## Attributes

* `enum` (`:any`) (required) - the enumerable to intersperse with separators.
## Slots

* `inner_block` (required) - the inner_block to render for each item.
* `separator` (required) - the slot for the separator.

# `link`

Generates a link to a given route.

It is typically used with one of the three attributes:

  * `patch` - on click, it patches the current LiveView with the given path
  * `navigate` - on click, it navigates to a new LiveView at the given path
  * `href` - on click, it performs traditional browser navigation (as any `<a>` tag)

## Attributes

* `navigate` (`:string`) - Navigates to a LiveView.
  When redirecting across LiveViews, the browser page is kept, but a new LiveView process
  is mounted and its contents is loaded on the page. It is only possible to navigate
  between LiveViews declared under the same router
  [`live_session`](`Phoenix.LiveView.Router.live_session/3`).
  When used outside of a LiveView or across live sessions, it behaves like a regular
  browser redirect.

* `patch` (`:string`) - Patches the current LiveView.
  The `handle_params` callback of the current LiveView will be invoked and the minimum content
  will be sent over the wire, as any other LiveView diff.

* `href` (`:any`) - Uses traditional browser navigation to the new location.
  This means the whole page is reloaded on the browser.

* `replace` (`:boolean`) - When using `:patch` or `:navigate`,
  should the browser's history be replaced with `pushState`?

  Defaults to `false`.
* `method` (`:string`) - The HTTP method to use with the link. This is intended for usage outside of LiveView
  and therefore only works with the `href={...}` attribute. It has no effect on `patch`
  and `navigate` instructions.

  In case the method is not `get`, the link is generated with the `data-method`
  attribute that is intercepted by the `phoenix_html` JavaScript library to
  trigger a form submission. In order to submit the form, JavaScript must
  be enabled in the browser.

  Defaults to `"get"`.
* `csrf_token` (`:any`) - A boolean or custom token to use for links with an HTTP method other than `get`. Defaults to `true`.
* Global attributes are accepted. Additional HTML attributes added to the `a` tag. Supports all globals plus: `["download", "hreflang", "referrerpolicy", "rel", "target", "type"]`.
## Slots

* `inner_block` (required) - The content rendered inside of the `a` tag.

## Examples

```heex
<.link href="/">Regular anchor link</.link>
```

```heex
<.link navigate={~p"/"} class="underline">home</.link>
```

```heex
<.link navigate={~p"/?sort=asc"} replace={false}>
  Sort By Price
</.link>
```

```heex
<.link patch={~p"/details"}>view details</.link>
```

```heex
<.link href={URI.parse("https://elixir-lang.org")}>hello</.link>
```

```heex
<.link href="/the_world" method="delete" data-confirm="Really?">delete</.link>
```

## JavaScript dependency

In order to support links where `:method` is not `"get"` or use the above data attributes,
`Phoenix.HTML` relies on JavaScript. You can load `priv/static/phoenix_html.js` into your
build tool.

### Data attributes

Data attributes are added as a keyword list passed to the `data` key. The following data
attributes are supported:

* `data-confirm` - shows a confirmation prompt before generating and submitting the form when
`:method` is not `"get"`.

### Overriding the default confirm behaviour

`phoenix_html.js` does trigger a custom event `phoenix.link.click` on the clicked DOM element
when a click happened. This allows you to intercept the event on its way bubbling up
to `window` and do your own custom logic to enhance or replace how the `data-confirm`
attribute is handled. You could for example replace the browsers `confirm()` behavior with
a custom javascript implementation:

```javascript
// Compared to a javascript window.confirm, the custom dialog does not block
// javascript execution. Therefore to make this work as expected we store
// the successful confirmation as an attribute and re-trigger the click event.
// On the second click, the `data-confirm-resolved` attribute is set and we proceed.
const RESOLVED_ATTRIBUTE = "data-confirm-resolved";
// listen on document.body, so it's executed before the default of
// phoenix_html, which is listening on the window object
document.body.addEventListener('phoenix.link.click', function (e) {
  // Prevent default implementation
  e.stopPropagation();
  // Introduce alternative implementation
  var message = e.target.getAttribute("data-confirm");
  if(!message){ return; }

  // Confirm is resolved execute the click event
  if (e.target?.hasAttribute(RESOLVED_ATTRIBUTE)) {
    e.target.removeAttribute(RESOLVED_ATTRIBUTE);
    return;
  }

  // Confirm is needed, preventDefault and show your modal
  e.preventDefault();
  e.target?.setAttribute(RESOLVED_ATTRIBUTE, "");

  vex.dialog.confirm({
    message: message,
    callback: function (value) {
      if (value == true) {
        // Customer confirmed, re-trigger the click event.
        e.target?.click();
      } else {
        // Customer canceled
        e.target?.removeAttribute(RESOLVED_ATTRIBUTE);
      }
    }
  })
}, false);
```

Or you could attach your own custom behavior.

```javascript
window.addEventListener('phoenix.link.click', function (e) {
  // Introduce custom behaviour
  var message = e.target.getAttribute("data-prompt");
  var answer = e.target.getAttribute("data-prompt-answer");
  if(message && answer && (answer != window.prompt(message))) {
    e.preventDefault();
  }
}, false);
```

The latter could also be bound to any `click` event, but this way you can be sure your custom
code is only executed when the code of `phoenix_html.js` is run.

## CSRF Protection

By default, CSRF tokens are generated through `Plug.CSRFProtection`.

# `live_component`

A function component for rendering `Phoenix.LiveComponent` within a parent LiveView.

While LiveViews can be nested, each LiveView starts its own process. A LiveComponent provides
similar functionality to LiveView, except they run in the same process as the LiveView,
with its own encapsulated state. That's why they are called stateful components.

## Attributes

* `id` (`:string`) (required) - A unique identifier for the LiveComponent. Note the `id` won't
necessarily be used as the DOM `id`. That is up to the component to decide.

* `module` (`:atom`) (required) - The LiveComponent module to render.

Any additional attributes provided will be passed to the LiveComponent as a map of assigns.
See `Phoenix.LiveComponent` for more information.

## Examples

```heex
<.live_component module={MyApp.WeatherComponent} id="thermostat" city="Kraków" />
```

# `live_file_input`

Builds a file input tag for a LiveView upload.

## Attributes

* `upload` (`Phoenix.LiveView.UploadConfig`) (required) - The `Phoenix.LiveView.UploadConfig` struct.
* `accept` (`:string`) - the optional override for the accept attribute. Defaults to :accept specified by allow_upload.
* Global attributes are accepted. Supports all globals plus: `["webkitdirectory", "required", "disabled", "capture", "form"]`.

## Customizing the Label

The `id` attribute cannot be overwritten, but you can create a label with a `for` attribute
pointing to the UploadConfig `ref`:

```heex
<label for={@uploads.avatar.ref}>
  <.live_file_input upload={@uploads.avatar} />
</label>
```

## Drag and Drop

Drag and drop is supported by annotating the droppable container with a `phx-drop-target`
attribute pointing to the UploadConfig `ref`, so the following markup is all that is required
for drag and drop support:

```heex
<label for={@uploads.avatar.ref} phx-drop-target={@uploads.avatar.ref}>
  <.live_file_input upload={@uploads.avatar} />
</label>
```

The drop target receives the `phx-drop-target-active` class when it is active. For more information, see the [uploads guide](guides/server/uploads.md).
## Examples

Rendering a file input:

```heex
<.live_file_input upload={@uploads.avatar} />
```

Rendering a file input with a label:

```heex
<label for={@uploads.avatar.ref}>Avatar</label>
<.live_file_input upload={@uploads.avatar} />
```

# `live_img_preview`

Generates an image preview on the client for a selected file.

## Attributes

* `entry` (`Phoenix.LiveView.UploadEntry`) (required) - The `Phoenix.LiveView.UploadEntry` struct.
* `id` (`:string`) - the id of the img tag. Derived by default from the entry ref, but can be overridden as needed if you need to render a preview of the same entry multiple times on the same page. Defaults to `nil`.
* Global attributes are accepted.

## Examples

```heex
<.live_img_preview :for={entry <- @uploads.avatar.entries} entry={entry} width="75" />
```

When you need to use it multiple times, make sure that they have distinct ids

```heex
<.live_img_preview :for={entry <- @uploads.avatar.entries} entry={entry} width="75" />

<.live_img_preview :for={entry <- @uploads.avatar.entries} id={"modal-#{entry.ref}"} entry={entry} width="500" />
```

# `live_title`

Renders a title with automatic prefix/suffix on `@page_title` updates.

## Attributes

* `prefix` (`:string`) - A prefix added before the content of `inner_block`. Defaults to `nil`.
* `default` (`:string`) - The default title to use if the inner block is empty on regular or connected mounts. *Note*: empty titles, such as `nil` or an empty string, fall back to the default value. Defaults to `nil`.
* `suffix` (`:string`) - A suffix added after the content of `inner_block`. Defaults to `nil`.
## Slots

* `inner_block` (required) - Content rendered inside the `title` tag.

## Examples

```heex
<.live_title default="Welcome" prefix="MyApp · ">
  {assigns[:page_title]}
</.live_title>
```

```heex
<.live_title default="Welcome" suffix=" · MyApp">
  {assigns[:page_title]}
</.live_title>
```

# `attr`
*macro* 

Declares attributes for a HEEx function components.

## Arguments

* `name` - an atom defining the name of the attribute. Note that attributes cannot define the
same name as any other attributes or slots declared for the same component.

* `type` - an atom defining the type of the attribute.

* `opts` - a keyword list of options. Defaults to `[]`.

### Types

An attribute is declared by its name, type, and options. The following types are supported:

| Name            | Description                                                          |
|-----------------|----------------------------------------------------------------------|
| `:any`          | any term (including `nil`)                                           |
| `:string`       | any binary string                                                    |
| `:atom`         | any atom (including `true`, `false`, and `nil`)                      |
| `:boolean`      | any boolean                                                          |
| `:integer`      | any integer                                                          |
| `:float`        | any float                                                            |
| `:list`         | any list of any arbitrary types                                      |
| `:map`          | any map of any arbitrary types                                       |
| `:fun`          | any function                                                         |
| `{:fun, arity}` | any function of arity                                                |
| `:global`       | any common HTML attributes, plus those defined by `:global_prefixes` |
| A struct module | any module that defines a struct with `defstruct/1`                  |

Note only `:any` and `:atom` expect the value to be set to `nil`.

### Options

* `:required` - marks an attribute as required. If a caller does not pass the given attribute,
a compile warning is issued.

* `:default` - the default value for the attribute if not provided. If this option is
  not set and the attribute is not given, accessing the attribute will fail unless a
  value is explicitly set with `assign_new/3`.

* `:examples` - a non-exhaustive list of values accepted by the attribute, used for documentation
  purposes.

* `:values` - an exhaustive list of values accepted by the attributes. If a caller passes a literal
  not contained in this list, a compile warning is issued.

* `:doc` - documentation for the attribute.

## Compile-Time Validations

LiveView performs some validation of attributes via the `:phoenix_live_view` compiler.
When attributes are defined, LiveView will warn at compilation time on the caller if:

* A required attribute of a component is missing.

* An unknown attribute is given.

* You specify a literal attribute (such as `value="string"` or `value`, but not `value={expr}`)
and the type does not match. The following types currently support literal validation:
`:string`, `:atom`, `:boolean`, `:integer`, `:float`, `:map` and `:list`.

* You specify a literal attribute and it is not a member of the `:values` list.

LiveView does not perform any validation at runtime. This means the type information is mostly
used for documentation and reflection purposes.

On the side of the LiveView component itself, defining attributes provides the following quality
of life improvements:

* The default value of all attributes will be added to the `assigns` map upfront.

* Attribute documentation is generated for the component.

* Required struct types are annotated and emit compilation warnings. For example, if you specify
`attr :user, User, required: true` and then you write `@user.non_valid_field` in your template,
a warning will be emitted.

* Calls made to the component are tracked for reflection and validation purposes.

## Documentation Generation

Public function components that define attributes will have their attribute
types and docs injected into the function's documentation, depending on the
value of the `@doc` module attribute:

* if `@doc` is a string, the attribute docs are injected into that string. The optional
placeholder `[INSERT LVATTRDOCS]` can be used to specify where in the string the docs are
injected. Otherwise, the docs are appended to the end of the `@doc` string.

* if `@doc` is unspecified, the attribute docs are used as the default `@doc` string.

* if `@doc` is `false`, the attribute docs are omitted entirely.

The injected attribute docs are formatted as a markdown list:

  * `name` (`:type`) (required) - attr docs. Defaults to `:default`.

By default, all attributes will have their types and docs injected into the function `@doc`
string. To hide a specific attribute, you can set the value of `:doc` to `false`.

## Example

    attr :name, :string, required: true
    attr :age, :integer, required: true

    def celebrate(assigns) do
      ~H"""
      <p>
        Happy birthday {@name}!
        You are {@age} years old.
      </p>
      """
    end

# `embed_templates`
*macro* 

Embeds external template files into the module as function components.

## Options

  * `:root` - The root directory to embed files. Defaults to the current
    module's directory (`__DIR__`)
  * `:suffix` - A string value to append to embedded function names. By
    default, function names will be the name of the template file excluding
    the format and engine.

A wildcard pattern may be used to select all files within a directory tree.
For example, imagine a directory listing:

```plain
├── components.ex
├── pages
│   ├── about_page.html.heex
│   └── welcome_page.html.heex
```

Then to embed the page templates in your `components.ex` module:

    defmodule MyAppWeb.Components do
      use Phoenix.Component

      embed_templates "pages/*"
    end

Now, your module will have an `about_page/1` and `welcome_page/1` function
component defined. Embedded templates also support declarative assigns
via bodyless function definitions, for example:

    defmodule MyAppWeb.Components do
      use Phoenix.Component

      embed_templates "pages/*"

      attr :name, :string, required: true
      def welcome_page(assigns)

      slot :header
      def about_page(assigns)
    end

Multiple invocations of `embed_templates` is also supported, which can be
useful if you have more than one template format. For example:

    defmodule MyAppWeb.Emails do
      use Phoenix.Component

      embed_templates "emails/*.html", suffix: "_html"
      embed_templates "emails/*.text", suffix: "_text"
    end

Note: this function is the same as `Phoenix.Template.embed_templates/2`.
It is also provided here for convenience and documentation purposes.
Therefore, if you want to embed templates for other formats, which are
not related to `Phoenix.Component`, prefer to
`import Phoenix.Template, only: [embed_templates: 1]` than this module.

# `sigil_H`
*macro* 

The `~H` sigil for writing HEEx templates inside source files.

`HEEx` is a HTML-aware and component-friendly extension of Elixir Embedded
language (`EEx`) that provides:

  * Built-in handling of HTML attributes

  * An HTML-like notation for injecting function components

  * Compile-time validation of the structure of the template

  * The ability to minimize the amount of data sent over the wire

  * Out-of-the-box code formatting via `mix format`

## Example

    ~H"""
    <div title="My div" class={@class}>
      <p>Hello {@name}</p>
      <MyApp.Weather.city name="Kraków"/>
    </div>
    """

## Syntax

`HEEx` is built on top of Embedded Elixir (`EEx`). In this section, we are going to
cover the basic constructs in `HEEx` templates as well as its syntax extensions.

### Interpolation

`HEEx` allows using `{...}` for HTML-aware interpolation, inside tag attributes
as well as the body:

```heex
<p>Hello, {@name}</p>
```

If you want to interpolate an attribute, you write:

```heex
<div class={@class}>
  ...
</div>
```

You can put any Elixir expression between `{ ... }`. For example, if you want
to set classes, where some are static and others are dynamic, you can using
string interpolation:

```heex
<div class={"btn btn-#{@type}"}>
  ...
</div>
```

The following attribute values have special meaning on HTML tags:

* `true` - if a value is `true`, the attribute is rendered with no value at all.
  For example, `<input required={true}>` is the same as `<input required>`;

* `false` or `nil` - if a value is `false` or `nil`, the attribute is omitted.
  Note the `class` and `style` attributes will be rendered as empty strings,
  instead of ommitted, which has the same effect as not rendering them, but
  allows for rendering optimizations.

* `list` (only for the `class` attribute) - each element of the list is processed
  as a different class. `nil` and `false` elements are discarded. Nested lists
  are supported and flattened.

For multiple dynamic attributes, you can use the same notation but without
assigning the expression to any specific attribute:

```heex
<div {@dynamic_attrs}>
  ...
</div>
```

In this case, the expression inside `{...}` must be either a keyword list or
a map containing the key-value pairs representing the dynamic attributes.
If using a map, ensure your keys are atoms.

### Interpolating blocks

The curly braces syntax is the default mechanism for interpolating code.
However, it cannot be used in all scenarios, in particular:

  * Curly braces cannot be used inside `<script>` and `<style>` tags,
    as that would make writing JS and CSS quite tedious. You can also
    fully disable curly braces interpolation in a given tag and
    its children by adding the `phx-no-curly-interpolation` attribute

  * it does not support multiline block constructs, such as `if`,
    `case`, and similar

For example, if you need to interpolate a string inside a script tag,
you could do:

```heex
<script>
  window.URL = "<%= @my_url %>"
</script>
```

Similarly, for block constructs in Elixir, you can write:

```heex
<%= if @show_greeting? do %>
  <p>Hello, {@name}</p>
<% end %>
```

However, for conditionals and for-comprehensions, there are built-in constructs
in HEEx too, which we will explore next.

> #### Curly braces in text within tag bodies {: .tip}
>
> If you have text in your tag bodies, which includes curly braces you can use
> `&lbrace;` or `<%= "{" %>` to prevent them from being considered the start of
> interpolation.

### Special attributes

Apart from normal HTML attributes, HEEx also supports some special attributes
such as `:let` and `:for`.

#### :let

This is used by components and slots that want to yield a value back to the
caller. For an example, see how `form/1` works:

```heex
<.form :let={f} for={@form} id="my-form" phx-change="validate" phx-submit="save">
  <.input field={f[:username]} type="text" />
  ...
</.form>
```

Notice how the variable `f`, defined by `.form` is used by your `input` component.
The `Phoenix.Component` module has detailed documentation on how to use and
implement such functionality.

#### :if and :for

It is a syntax sugar for `<%= if .. do %>` and `<%= for .. do %>` that can be
used in regular HTML, function components, and slots.

For example in an HTML tag:

```heex
<table id="admin-table" :if={@admin?}>
  <tr :for={user <- @users}>
    <td>{user.name}</td>
  </tr>
<table>
```

The snippet above will only render the table if `@admin?` is true,
and generate a `tr` per user as you would expect from the collection.

`:for` can be used similarly in function components:

```heex
<.error :for={msg <- @errors} message={msg}/>
```

Which is equivalent to writing:

```heex
<%= for msg <- @errors do %>
  <.error message={msg} />
<% end %>
```

And `:for` in slots behaves the same way:

```heex
<.table id="my-table" rows={@users}>
  <:col :for={header <- @headers} :let={user}>
    <td>{user[header]}</td>
  </:col>
<.table>
```

You can also combine `:for` and `:if` for tags, components, and slot to act as a filter:

```heex
<.error :for={msg <- @errors} :if={msg != nil} message={msg} />
```

Note that unlike Elixir's regular `for`, HEEx' `:for` does not support multiple
generators in one expression. In such cases, you must use `EEx`'s blocks.

> #### Change tracking `:for` on slots {: .warning}
>
> Compared to regular HTML tags and components, LiveView does not
> optimize comprehensions on slots.
> This means that if `@headers` changes in the example above, all
> headers are sent over the wire again.
>
> Furthermore, `:key` (see below) is also not supported on slots
> right now.

#### `:key`ed comprehensions

When using `:for`, you can optionally provide a `:key` expression to perform
better change tracking inside the comprehension:

```heex
<ul>
  <li :for={%{id: id, name: name} <- @items} :key={id}>
    Count: <span>{@count}</span>,
    item: {name}
  </li>
</ul>
```

By default, the index is used as a key, which means that appending an entry leads to
all items being considered changed. Therefore, we recommend to use a `:key` whenever possible.

Note that the `:key` has no effect when using [streams](`Phoenix.LiveView.stream/4`).

### Function components

Function components are stateless components implemented as pure functions
with the help of the `Phoenix.Component` module. They can be either local
(same module) or remote (external module).

`HEEx` allows invoking these function components directly in the template
using an HTML-like notation. For example, a remote function:

```heex
<MyApp.Weather.city name="Kraków"/>
```

A local function can be invoked with a leading dot:

```heex
<.city name="Kraków"/>
```

where the component could be defined as follows:

    defmodule MyApp.Weather do
      use Phoenix.Component

      def city(assigns) do
        ~H"""
        The chosen city is: {@name}.
        """
      end

      def country(assigns) do
        ~H"""
        The chosen country is: {@name}.
        """
      end
    end

It is typically best to group related functions into a single module, as
opposed to having many modules with a single `render/1` function. Function
components support other important features, such as slots. You can learn
more about components in `Phoenix.Component`.

## Code formatting

You can automatically format HEEx templates (.heex) and `~H` sigils
using `Phoenix.LiveView.HTMLFormatter`. Please check that module
for more information.

# `slot`
*macro* 

Declares a slot. See `slot/3` for more information.

# `slot`
*macro* 

Declares a function component slot.

## Arguments

* `name` - an atom defining the name of the slot. Note that slots cannot define the same name
as any other slots or attributes declared for the same component.

* `opts` - a keyword list of options. Defaults to `[]`.

* `block` - a code block containing calls to `attr/3`. Defaults to `nil`.

### Options

* `:required` - marks a slot as required. If a caller does not pass a value for a required slot,
a compilation warning is emitted. Otherwise, an omitted slot will default to `[]`.

* `:validate_attrs` - when set to `false`, no warning is emitted when a caller passes attributes
to a slot defined without a do block. If not set, defaults to `true`.

* `:doc` - documentation for the slot. Any slot attributes declared
will have their documentation listed alongside the slot.

### Slot Attributes

A named slot may declare attributes by passing a block with calls to `attr/3`.

Unlike attributes, slot attributes cannot accept the `:default` option. Passing one
will result in a compile warning being issued.

### The Default Slot

The default slot can be declared by passing `:inner_block` as the `name` of the slot.

Note that the `:inner_block` slot declaration cannot accept a block. Passing one will
result in a compilation error.

## Compile-Time Validations

LiveView performs some validation of slots via the `:phoenix_live_view` compiler.
When slots are defined, LiveView will warn at compilation time on the caller if:

* A required slot of a component is missing.

* An unknown slot is given.

* An unknown slot attribute is given.

On the side of the function component itself, defining attributes provides the following
quality of life improvements:

* Slot documentation is generated for the component.

* Calls made to the component are tracked for reflection and validation purposes.

## Documentation Generation

Public function components that define slots will have their docs injected into the function's
documentation, depending on the value of the `@doc` module attribute:

* if `@doc` is a string, the slot docs are injected into that string. The optional placeholder
`[INSERT LVATTRDOCS]` can be used to specify where in the string the docs are injected.
Otherwise, the docs are appended to the end of the `@doc` string.

* if `@doc` is unspecified, the slot docs are used as the default `@doc` string.

* if `@doc` is `false`, the slot docs are omitted entirely.

The injected slot docs are formatted as a markdown list:

  * `name` (required) - slot docs. Accepts attributes:
    * `name` (`:type`) (required) - attr docs. Defaults to `:default`.

By default, all slots will have their docs injected into the function `@doc` string.
To hide a specific slot, you can set the value of `:doc` to `false`.

## Example

    slot :header
    slot :inner_block, required: true
    slot :footer

    def modal(assigns) do
      ~H"""
      <div class="modal">
        <div class="modal-header">
          {render_slot(@header) || "Modal"}
        </div>
        <div class="modal-body">
          {render_slot(@inner_block)}
        </div>
        <div class="modal-footer">
          {render_slot(@footer) || submit_button()}
        </div>
      </div>
      """
    end

As shown in the example above, `render_slot/1` returns `nil` when an optional slot is declared
and none is given. This can be used to attach default behaviour.

# `assign`

Adds key-value pairs to assigns.

The first argument is either a LiveView `socket` or an `assigns` map from function components.

When a keyword list or map is provided as the second argument, it will be merged into the existing assigns.
If a function is given, it takes the current assigns as an argument and its return
value will be merged into the current assigns.

## Examples

    iex> assign(socket, name: "Elixir", logo: "💧")
    iex> assign(socket, %{name: "Elixir"})
    iex> assign(socket, fn %{name: name, logo: logo} -> %{title: Enum.join([name, logo], " | ")} end)

# `assign`

Adds a `key`-`value` pair to `socket_or_assigns`.

The first argument is either a LiveView `socket` or an `assigns` map from function components.

## Examples

    iex> assign(socket, :name, "Elixir")

# `assign_new`

Assigns the given `key` with value from `fun` into `socket_or_assigns` if one does not yet exist.

The first argument is either a LiveView `socket` or an `assigns` map from function components.

This function is useful for lazily assigning values and sharing assigns.
We will cover both use cases next.

## Lazy assigns

Imagine you have a function component that accepts a color:

```heex
<.my_component bg_color="red" />
```

The color is also optional, so you can skip it:

```heex
<.my_component />
```

In such cases, the implementation can use `assign_new` to lazily
assign a color if none is given. Let's make it so it picks a random one
when none is given:

    def my_component(assigns) do
      assigns = assign_new(assigns, :bg_color, fn -> Enum.random(~w(bg-red-200 bg-green-200 bg-blue-200)) end)

      ~H"""
      <div class={@bg_color}>
        Example
      </div>
      """
    end

## Sharing assigns

It is possible to share assigns between the Plug pipeline and LiveView on disconnected render
and between parent-child LiveViews when connected.

### When disconnected

When a user first accesses an application using LiveView, the LiveView is first rendered in its
disconnected state, as part of a regular HTML response. By using `assign_new` in the mount
callback of your LiveView, you can instruct LiveView to re-use any assigns already set in `conn`
during disconnected state.

Imagine you have a Plug that does:

    # A plug
    def authenticate(conn, _opts) do
      if user_id = get_session(conn, :user_id) do
        assign(conn, :current_user, Accounts.get_user!(user_id))
      else
        send_resp(conn, :forbidden)
      end
    end

You can re-use the `:current_user` assign in your LiveView during the initial render:

    def mount(_params, %{"user_id" => user_id}, socket) do
      {:ok, assign_new(socket, :current_user, fn -> Accounts.get_user!(user_id) end)}
    end

In such case `conn.assigns.current_user` will be used if present. If there is no such
`:current_user` assign or the LiveView was mounted as part of the live navigation, where no Plug
pipelines are invoked, then the anonymous function is invoked to execute the query instead.

### When connected

LiveView is also able to share assigns via `assign_new` with children LiveViews,
as long as the child LiveView is also mounted when the parent LiveView is mounted
and the child LiveView is not rendered with `sticky: true`. Let's see an example.

If the parent LiveView defines a `:current_user` assign and the child LiveView also
uses `assign_new/3` to fetch the `:current_user` in its `mount/3` callback, as in
the previous subsection, the assign will be fetched from the parent LiveView, once
again avoiding additional database queries.

Note that `fun` also provides access to the previously assigned values:

    assigns =
      assigns
      |> assign_new(:foo, fn -> "foo" end)
      |> assign_new(:bar, fn %{foo: foo} -> foo <> "bar" end)

Assigns sharing is performed when possible but not guaranteed. Therefore, you must
ensure the result of the function given to `assign_new/3` is the same as if the value
was fetched from the parent. Otherwise consider passing values to the child LiveView
as part of its session.

# `assigns_to_attributes`

Filters the assigns as a list of keywords for use in dynamic tag attributes.

One should prefer to use declarative assigns and `:global` attributes
over this function.

## Examples

Imagine the following `my_link` component which allows a caller
to pass a `new_window` assign, along with any other attributes they
would like to add to the element, such as class, data attributes, etc:

```heex
<.my_link to="/" id={@id} new_window={true} class="my-class">Home</.my_link>
```

We could support the dynamic attributes with the following component:

    def my_link(assigns) do
      target = if assigns[:new_window], do: "_blank", else: false
      extra = assigns_to_attributes(assigns, [:new_window, :to])

      assigns =
        assigns
        |> assign(:target, target)
        |> assign(:extra, extra)

      ~H"""
      <a href={@to} target={@target} {@extra}>
        {render_slot(@inner_block)}
      </a>
      """
    end

The above would result in the following rendered HTML:

```heex
<a href="/" target="_blank" id="1" class="my-class">Home</a>
```

The second argument (optional) to `assigns_to_attributes` is a list of keys to
exclude. It typically includes reserved keys by the component itself, which either
do not belong in the markup, or are already handled explicitly by the component.

# `changed?`

Checks if the given key changed in `socket_or_assigns`.

The first argument is either a LiveView `socket` or an `assigns` map from function components.

## Examples

    iex> changed?(socket, :count)

# `live_flash`

> This function is deprecated. Use Phoenix.Flash.get/2 in Phoenix v1.7+.

Returns the flash message from the LiveView flash assign.

## Examples

```heex
<p class="alert alert-info">{live_flash(@flash, :info)}</p>
<p class="alert alert-danger">{live_flash(@flash, :error)}</p>
```

# `live_render`

Renders a LiveView within a template.

This is useful in two situations:

* When rendering a child LiveView inside a LiveView.

* When rendering a LiveView inside a regular (non-live) controller/view.

Most other cases for shared functionality, including state management and user interactions, can be
[achieved with function components or LiveComponents](welcome.html#compartmentalize-state-markup-and-events-in-liveview)

## Options

* `:session` - a map of binary keys with extra session data to be serialized and sent
to the client. All session data currently in the connection is automatically available
in LiveViews. You can use this option to provide extra data. Remember all session data is
serialized and sent to the client, so you should always keep the data in the session
to a minimum. For example, instead of storing a User struct, you should store the "user_id"
and load the User when the LiveView mounts.

* `:container` - an optional tuple for the HTML tag and DOM attributes to be used for the
LiveView container. For example: `{:li, style: "color: blue;"}`. By default it uses the module
definition container. See the "Containers" section below for more information.

* `:id` - both the DOM ID and the ID to uniquely identify a LiveView. An `:id` is
automatically generated when rendering root LiveViews but it is a required option when
rendering a child LiveView.

* `:sticky` - an optional flag to maintain the LiveView across live redirects, even if it is
nested within another LiveView. Note that this only works for LiveViews that are in the same
[live_session](`Phoenix.LiveView.Router.live_session/3`).
If you are rendering the sticky view within another LiveView, make sure that the sticky view
itself does not use the same layout. You can do so by returning `{:ok, socket, layout: false}`
from mount.

## Examples

When rendering from a controller/view, you can call:

```heex
{live_render(@conn, MyApp.ThermostatLive)}
```

Or:

```heex
{live_render(@conn, MyApp.ThermostatLive, session: %{"home_id" => @home.id})}
```

Within another LiveView, you must pass the `:id` option:

```heex
{live_render(@socket, MyApp.ThermostatLive, id: "thermostat")}
```

## Containers

When a LiveView is rendered, its contents are wrapped in a container. By default,
the container is a `div` tag with a handful of LiveView-specific attributes.

The container can be customized in different ways:

* You can change the default `container` on `use Phoenix.LiveView`:

      use Phoenix.LiveView, container: {:tr, id: "foo-bar"}

* You can override the container tag and pass extra attributes when calling `live_render`
(as well as on your `live` call in your router):

      live_render socket, MyLiveView, container: {:tr, class: "highlight"}

If you don't want the container to affect layout, you can use the CSS property
`display: contents` or a class that applies it, like Tailwind's `.contents`.

Beware if you set this to `:body`, as any content injected inside the body
(such as `Phoenix.LiveReload` features) will be discarded once the LiveView
connects

## Testing

Note that `render_click/1` and other testing functions will send events to the root LiveView, and you will want to
`find_live_child/2` to interact with nested LiveViews in your live tests.

# `portal`

Renders a portal.

A portal is a component that teleports its content to another place in the DOM.
It is useful in cases where you need to render some content in another place, for
example due to overflow or [stacking context](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_positioned_layout/Stacking_context).

A portal consists of two parts:

1. The portal source: the component that should be teleported.
2. The portal target: the DOM element that will render the content of the portal source.

Any element can be a portal target. In most cases, the target would be rendered inside
the layout of your application. Portal sources must be defined with the `.portal` component.

> #### A note on testing {: .info}
>
> Because portals use `<template>` elements under the hood, you cannot query for elements
> inside of a portal when using `Phoenix.LiveViewTest.element/3` and other LiveViewTest functions.
>
> Instead, `Phoenix.LiveViewTest.render/1` the portal element itself to an HTML string and do
> assertions on those:
>
> ```heex
> <.portal id="my-portal" target="body">
>   <div id="something-inside">...</div>
> </.portal>
> ```
>
> ```elixir
> # in your test, instead of
> # assert has_element?(view, "#something-inside")  <-- this won't work
> html = view |> element("#my-portal") |> render()
> assert html =~ "something-inside"
> ```

## Examples

```heex
<.portal id="modal" target="body">
  ...
</.portal>
```

## Attributes

* `id` (`:string`) (required)
* `target` (`:string`) (required) - A CSS selector that identifies the target. The target must be unique.
* `class` (`:any`) - The class to apply to the portal wrapper. Defaults to `nil`.
* `container` (`:string`) - The HTML tag to use as the portal wrapper. Defaults to `"div"`.
## Slots

* `inner_block` (required)

# `render_slot`
*macro* 

Renders a slot entry with the given optional `argument`.

```heex
{render_slot(@inner_block, @form)}
```

If the slot has no entries, nil is returned.

If multiple slot entries are defined for the same slot,`render_slot/2` will automatically render
all entries, merging their contents. In case you want to use the entries' attributes, you need
to iterate over the list to access each slot individually.

For example, imagine a table component:

```heex
<.table rows={@users}>
  <:col :let={user} label="Name">
    {user.name}
  </:col>

  <:col :let={user} label="Address">
    {user.address}
  </:col>
</.table>
```

At the top level, we pass the rows as an assign and we define a `:col` slot for each column we
want in the table. Each column also has a `label`, which we are going to use in the table header.

Inside the component, you can render the table with headers, rows, and columns:

    def table(assigns) do
      ~H"""
      <table>
        <tr>
          <th :for={col <- @col}>{col.label}</th>
        </tr>
        <tr :for={row <- @rows}>
          <td :for={col <- @col}>{render_slot(col, row)}</td>
        </tr>
      </table>
      """
    end

# `to_form`

Converts a given data structure to a `Phoenix.HTML.Form`.

This is commonly used to convert a map or an Ecto changeset
into a form to be given to the `form/1` component.

## Creating a form from params

If you want to create a form based on `handle_event` parameters,
you could do:

    def handle_event("submitted", params, socket) do
      {:noreply, assign(socket, form: to_form(params))}
    end

When you pass a map to `to_form/1`, it assumes said map contains
the form parameters, which are expected to have string keys.

You can also specify a name to nest the parameters:

    def handle_event("submitted", %{"user" => user_params}, socket) do
      {:noreply, assign(socket, form: to_form(user_params, as: :user))}
    end

## Creating a form from changesets

When using changesets, the underlying data, form parameters, and
errors are retrieved from it. The `:as` option is automatically
computed too. For example, if you have a user schema:

    defmodule MyApp.Users.User do
      use Ecto.Schema

      schema "..." do
        ...
      end
    end

And then you create a changeset that you pass to `to_form`:

    %MyApp.Users.User{}
    |> Ecto.Changeset.change()
    |> to_form()

In this case, once the form is submitted, the parameters will
be available under `%{"user" => user_params}`.

## Options

  * `:as` - the `name` prefix to be used in form inputs
  * `:id` - the `id` prefix to be used in form inputs
  * `:errors` - keyword list of errors (used by maps exclusively)
  * `:action` - The action that was taken against the form. This value can be
    used to distinguish between different operations such as the user typing
    into a form for validation, or submitting a form for a database insert.
    For example: `to_form(changeset, action: :validate)`,
    or `to_form(changeset, action: :save)`. The provided action is passed
    to the underlying `Phoenix.HTML.FormData` implementation options.

The underlying data may accept additional options when
converted to forms. For example, a map accepts `:errors`
to list errors, but such option is not accepted by
changesets. `:errors` is a keyword of tuples in the shape
of `{error_message, options_list}`. Here is an example:

    to_form(%{"search" => nil}, errors: [search: {"Can't be blank", []}])

If an existing `Phoenix.HTML.Form` struct is given, the
options above will override its existing values if given.
Then the remaining options are merged with the existing
form options.

Errors in a form are only displayed if the changeset's `action`
field is set (and it is not set to `:ignore`) and can be filtered
by whether the fields have been used on the client or not. Refer to
[a note on :errors for more information](#form/1-a-note-on-errors).

# `update`

Updates an existing `key` with `fun` in the given `socket_or_assigns`.

The first argument is either a LiveView `socket` or an `assigns` map from function components.

The update function receives the current key's value and returns the updated value.
Raises if the key does not exist.

The update function may also be of arity 2, in which case it receives the current key's value
as the first argument and the current assigns as the second argument.
Raises if the key does not exist.

## Examples

    iex> update(socket, :count, fn count -> count + 1 end)
    iex> update(socket, :count, &(&1 + 1))
    iex> update(socket, :max_users_this_session, fn current_max, %{users: users} ->
    ...>   max(current_max, length(users))
    ...> end)

# `upload_errors`

Returns errors for the upload as a whole.

For errors that apply to a specific upload entry, use `upload_errors/2`.

The output is a list. The following error may be returned:

* `:too_many_files` - The number of selected files exceeds the `:max_entries` constraint

## Examples

    def upload_error_to_string(:too_many_files), do: "You have selected too many files"

```heex
<div :for={err <- upload_errors(@uploads.avatar)} class="alert alert-danger">
  {upload_error_to_string(err)}
</div>
```

# `upload_errors`

Returns errors for the upload entry.

For errors that apply to the upload as a whole, use `upload_errors/1`.

The output is a list. The following errors may be returned:

* `:too_large` - The entry exceeds the `:max_file_size` constraint
* `:not_accepted` - The entry does not match the `:accept` MIME types
* `:external_client_failure` - When external upload fails
* `{:writer_failure, reason}` - When the custom writer fails with `reason`

## Examples

```elixir
defp upload_error_to_string(:too_large), do: "The file is too large"
defp upload_error_to_string(:not_accepted), do: "You have selected an unacceptable file type"
defp upload_error_to_string(:external_client_failure), do: "Something went terribly wrong"
```

```heex
<%= for entry <- @uploads.avatar.entries do %>
  <div :for={err <- upload_errors(@uploads.avatar, entry)} class="alert alert-danger">
    {upload_error_to_string(err)}
  </div>
<% end %>
```

# `used_input?`

Checks if the input field was used by the client.

Used inputs are only those inputs that have been focused, interacted with, or
submitted by the client. For LiveView, this is used to filter errors from the
`Phoenix.HTML.FormData` implementation to avoid showing "field can't be blank"
in scenarios where the client hasn't yet interacted with specific fields.

Used inputs are tracked internally by the client sending a sibling key
derived from each input name, which indicates the inputs that remain  unused
on the client. For example, a form with email and title fields where only the
title has been modified so far on the client, would send the following payload:

    %{
      "title" => "new title",
      "email" => "",
      "_unused_email" => ""
    }

The `_unused_email` key indicates that the email field has not been used by the
client, which is used to filter errors from the UI.

Nested fields are also supported. For example, a form with a nested datetime field
is considered used if any of the nested parameters are used.

    %{
      "bday" => %{
        "year" => "",
        "month" => "",
        "day" => "",
        "_unused_day" => ""
      }
    }

The `_unused_day` key indicates that the day field has not been used by the client,
but the year and month fields have been used, meaning the birthday field as a whole
was used.

## Examples

For example, imagine in your template you render a title and email input.
On initial load the end-user begins typing the title field. The client will send
the entire form payload to the server with the typed title and an empty email.

The `Phoenix.HTML.FormData` implementation will consider an empty email in
this scenario as invalid, but the user shouldn't see the error because they
haven't yet used the email input. To handle this, `used_input?/1` can be used to
filter errors from the client by referencing param metadata to distinguish between
used and unused input fields. For non-LiveViews, all inputs are considered used.

```heex
<input type="text" name={@form[:title].name} value={@form[:title].value} />

<div :if={used_input?(@form[:title])}>
  <p :for={error <- @form[:title].errors}>{error}</p>
</div>

<input type="text" name={@form[:email].name} value={@form[:email].value} />

<div :if={used_input?(@form[:email])}>
  <p :for={error <- @form[:email].errors}>{error}</p>
</div>
```

---

*Consult [api-reference.md](api-reference.md) for complete listing*
