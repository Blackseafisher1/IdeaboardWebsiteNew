# `Phoenix.LiveView.Engine`
[🔗](https://github.com/phoenixframework/phoenix_live_view/blob/v1.1.28/lib/phoenix_live_view/engine.ex#L155)

An `EEx` template engine that tracks changes.

This is often used by `Phoenix.LiveView.TagEngine` which also adds
HTML validation. In the documentation below, we will explain how it
works internally. For user-facing documentation, see `Phoenix.LiveView`.

## Phoenix.LiveView.Rendered

Whenever you render a live template, it returns a
`Phoenix.LiveView.Rendered` structure. This structure has
three fields: `:static`, `:dynamic` and `:fingerprint`.

The `:static` field is a list of literal strings. This
allows the Elixir compiler to optimize this list and avoid
allocating its strings on every render.

The `:dynamic` field contains a function that takes a boolean argument
(see "Tracking changes" below), and returns a list of dynamic content.
Each element in the list is either one of:

  1. iodata - which is the dynamic content
  2. nil - the dynamic content did not change
  3. another `Phoenix.LiveView.Rendered` struct, see "Nesting and fingerprinting" below
  4. a `Phoenix.LiveView.Comprehension` struct, see "Comprehensions" below
  5. a `Phoenix.LiveView.Component` struct, see "Component" below

When you render a live template, you can convert the
rendered structure to iodata by alternating the static
and dynamic fields, always starting with a static entry
followed by a dynamic entry. The last entry will always
be static too. So the following structure:

    %Phoenix.LiveView.Rendered{
      static: ["foo", "bar", "baz"],
      dynamic: fn track_changes? -> ["left", "right"] end
    }

Results in the following content to be sent over the wire
as iodata:

    ["foo", "left", "bar", "right", "baz"]

This is also what calling `Phoenix.HTML.Safe.to_iodata/1`
with a `Phoenix.LiveView.Rendered` structure returns.

Of course, the benefit of live templates is exactly
that you do not need to send both static and dynamic
segments every time. So let's talk about tracking changes.

## Tracking changes

By default, a live template does not track changes.
Change tracking can be enabled by including a changed
map in the assigns with the key `__changed__` and passing
`true` to the dynamic parts. The map should contain
the name of any changed field as key and the boolean
true as value. If a field is not listed in `__changed__`,
then it is always considered unchanged.

If a field is unchanged and live believes a dynamic
expression no longer needs to be computed, its value
in the `dynamic` list will be `nil`. This information
can be leveraged to avoid sending data to the client.

## Nesting and fingerprinting

`Phoenix.LiveView` also tracks changes across live
templates. Therefore, if your view has this:

```heex
{render("form.html", assigns)}
```

Phoenix will be able to track what is static and dynamic
across templates, as well as what changed. A rendered
nested `live` template will appear in the `dynamic`
list as another `Phoenix.LiveView.Rendered` structure,
which must be handled recursively.

However, because the rendering of live templates can
be dynamic in itself, it is important to distinguish
which live template was rendered. For example,
imagine this code:

```heex
<%= if something?, do: render("one.html", assigns), else: render("other.html", assigns) %>
```

To solve this, all `Phoenix.LiveView.Rendered` structs
also contain a fingerprint field that uniquely identifies
it. If the fingerprints are equal, you have the same
template, and therefore it is possible to only transmit
its changes.

## Comprehensions

Another optimization done by live templates is to
track comprehensions. If your code has this:

```heex
<%= for point <- @points do %>
  x: {point.x}
  y: {point.y}
<% end %>
```

Instead of rendering all points with both static and
dynamic parts, it returns a `Phoenix.LiveView.Comprehension`
struct with the static parts, that are shared across all
points, and a list of entries with a render function for the
dynamics inside. If `@points` is a list with `%{x: 1, y: 2}`
and `%{x: 3, y: 4}`, the above expression would return:

    %Phoenix.LiveView.Comprehension{
      static: ["\n  x: ", "\n  y: ", "\n"],
      entries: [
        {nil, %{point: %{x: 1, y: 2}}, fn vars_changed, track_changes? -> ... end,
        {nil, %{point: %{x: 3, y: 4}}, fn vars_changed, track_changes? -> ... end,
      ]
    }

This allows live templates to send the static parts only once,
regardless of the number of items. Moreover, the diff algorithm
also tracks the variables introduced by the comprehension as part
of the entries and calculates which variables changed between renders.

In HEEx templates, a `:key` attribute can be provided when using `:for`
on a tag to make the diffing more efficient. By default, the index
of each item is used for diffing, which means that if an element is
prepended to the list, the whole collection is sent again.

## Components

Live also supports stateful components defined with
`Phoenix.LiveComponent`. Since they are stateful, they are always
handled lazily by the diff algorithm.

---

*Consult [api-reference.md](api-reference.md) for complete listing*
