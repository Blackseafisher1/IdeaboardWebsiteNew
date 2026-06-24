# `Phoenix.LiveView.TagEngine`
[🔗](https://github.com/phoenixframework/phoenix_live_view/blob/v1.1.28/lib/phoenix_live_view/tag_engine.ex#L1)

Building blocks for tag based `Phoenix.Template.Engine`s.

This cannot be directly used by Phoenix applications.
Instead, it is the building block for engines such as
`Phoenix.LiveView.HTMLEngine`.

It is typically invoked like this:

    Phoenix.LiveView.TagEngine.compile(source,
      line: 1,
      file: path,
      caller: __CALLER__,
      source: source,
      tag_handler: FooBarEngine
    )

Where `:tag_handler` implements the behaviour defined by this module.

# `annotate_body`

```elixir
@callback annotate_body(caller :: Macro.Env.t()) :: {String.t(), String.t()} | nil
```

Callback invoked to add annotations around the whole body of a template.

# `annotate_caller`

```elixir
@callback annotate_caller(file :: String.t(), line :: integer()) :: String.t() | nil
```

Callback invoked to add caller annotations before a function component is invoked.

# `annotate_slot`

```elixir
@callback annotate_slot(
  name :: atom(),
  tag_meta :: %{line: non_neg_integer(), column: non_neg_integer()},
  close_tag_meta :: %{line: non_neg_integer(), column: non_neg_integer()},
  caller :: Macro.Env.t()
) :: {String.t(), String.t()} | nil
```

Callback invoked to add annotations around each slot of a template.

In case the slot is an implicit inner block, the tag meta points to
the component.

# `classify_type`

```elixir
@callback classify_type(name :: binary()) :: {type :: atom(), name :: binary()}
```

Classify the tag type from the given binary.

This must return a tuple containing the type of the tag and the name of tag.
For instance, for LiveView which uses HTML as default tag handler this would
return `{:tag, 'div'}` in case the given binary is identified as HTML tag.

You can also return `{:error, "reason"}` so that the compiler will display this
error.

# `handle_attributes`

```elixir
@callback handle_attributes(ast :: Macro.t(), meta :: keyword()) ::
  {:attributes, [{binary(), Macro.t()} | Macro.t()]} | {:quoted, Macro.t()}
```

Implements processing of attributes.

It returns a quoted expression or attributes. If attributes are returned,
the second element is a list where each element in the list represents
one attribute. If the list element is a two-element tuple, it is assumed
the key is the name to be statically written in the template. The second
element is the value which is also statically written to the template whenever
possible (such as binaries or binaries inside a list).

# `void?`

```elixir
@callback void?(name :: binary()) :: boolean()
```

Returns if the given tag name is void or not.

That's mainly useful for HTML tags and used internally by the compiler. You
can just implement as `def void?(_), do: false` if you want to ignore this.

# `compile`

Compiles the given string into Elixir AST.

The accepted options are:

  * `tag_handler` - Required. The module implementing the `Phoenix.LiveView.TagEngine` behavior.
  * `caller` - Required. The `Macro.Env`.
  * `line` - the starting line offset. Defaults to 1.
  * `file` - the file of the template. Defaults to `"nofile"`.
  * `indentation` - the indentation of the template. Defaults to 0.

# `component`

Renders a component defined by the given function.

This function is rarely invoked directly by users. Instead, it is used by `~H`
and other engine implementations to render `Phoenix.Component`s. For example,
the following:

```heex
<MyApp.Weather.city name="Kraków" />
```

Is the same as:

```heex
<%= component(
      &MyApp.Weather.city/1,
      [name: "Kraków"],
      {__ENV__.module, __ENV__.function, __ENV__.file, __ENV__.line}
    ) %>
```

# `inner_block`
*macro* 

Define a inner block, generally used by slots.

This macro is mostly used by custom HTML engines that provide
a `slot` implementation and rarely called directly. The
`name` must be the assign name the slot/block will be stored
under.

If you're using HEEx templates, you should use its higher
level `<:slot>` notation instead. See `Phoenix.Component`
for more information.

---

*Consult [api-reference.md](api-reference.md) for complete listing*
