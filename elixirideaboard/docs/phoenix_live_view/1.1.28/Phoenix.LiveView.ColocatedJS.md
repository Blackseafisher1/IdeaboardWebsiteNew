# `Phoenix.LiveView.ColocatedJS`
[🔗](https://github.com/phoenixframework/phoenix_live_view/blob/v1.1.28/lib/phoenix_live_view/colocated_js.ex#L1)

A special HEEx `:type` that extracts any JavaScript code from a co-located
`<script>` tag at compile time.

Note: To use `ColocatedJS`, you need to run Phoenix 1.8+.

Colocated JavaScript is a more generalized version of `Phoenix.LiveView.ColocatedHook`.
In fact, colocated hooks are built on top of `ColocatedJS`.

You can use `ColocatedJS` to define any JavaScript code (Web Components, global event listeners, etc.)
that do not necessarily need the functionalities of hooks, for example:

```heex
<script :type={Phoenix.LiveView.ColocatedJS} name="MyWebComponent">
  export default class MyWebComponent extends HTMLElement {
    connectedCallback() {
      this.innerHTML = "Hello, world!";
    }
  }
</script>
```

Then, in your `app.js` file, you could import it like this:

```javascript
import colocated from "phoenix-colocated/my_app";
customElements.define("my-web-component", colocated.MyWebComponent);
```

In this example, you don't actually need to have special code for the web component
inside your `app.js` file, since you could also directly call `customElements.define`
inside the colocated JavaScript. However, this example shows how you can access the
exported values inside your bundle.

> #### A note on dependencies and umbrella projects {: .info}
>
> For each application that uses colocated JavaScript, a separate directory is created
> inside the `phoenix-colocated` folder. This allows to have clear separation between
> hooks and code of dependencies, but also applications inside umbrella projects.
>
> While dependencies would typically still bundle their own hooks and colocated JavaScript
> into a separate file before publishing, simple hooks or code snippets that do not require
> access to third-party libraries can also be directly imported into your own bundle.
> If a library requires this, it should be stated in its documentation.

## Internals

While compiling the template, colocated JavaScript is extracted into a special folder inside the
`Mix.Project.build_path()`, called `phoenix-colocated`. This is customizable, as we'll see below,
but it is important that it is a directory that is not tracked by version control, because the
components are the source of truth for the code. Also, the directory is shared between applications
(this also applies to applications in umbrella projects), so it should typically also be a shared
directory not specific to a single application.

The colocated JS directory follows this structure:

```text
_build/$MIX_ENV/phoenix-colocated/
_build/$MIX_ENV/phoenix-colocated/my_app/
_build/$MIX_ENV/phoenix-colocated/my_app/index.js
_build/$MIX_ENV/phoenix-colocated/my_app/MyAppWeb.DemoLive/line_HASH.js
_build/$MIX_ENV/phoenix-colocated/my_dependency/MyDependency.Module/line_HASH.js
...
```

Each application has its own folder. Inside, each module also gets its own folder, which allows
us to track and clean up outdated code.

To use colocated JS from your `app.js`, your bundler needs to be configured to resolve the
`phoenix-colocated` folder. For new Phoenix applications, this configuration is already included
in the esbuild configuration inside `config.exs`:

    config :esbuild,
      ...
      my_app: [
        args:
          ~w(js/app.js --bundle --target=es2022 --outdir=../priv/static/assets/js --external:/fonts/* --external:/images/* --alias:@=.),
        cd: Path.expand("../assets", __DIR__),
        env: %{
          "NODE_PATH" => [Path.expand("../deps", __DIR__), Mix.Project.build_path()]
        }
      ]

The important part here is the `NODE_PATH` environment variable, which tells esbuild to also look
for packages inside the `deps` folder, as well as the `Mix.Project.build_path()`, which resolves to
`_build/$MIX_ENV`. If you use a different bundler, you'll need to configure it accordingly. If it is not
possible to configure the `NODE_PATH`, you can also change the folder to which LiveView writes colocated
JavaScript by setting the `:target_directory` option in your `config.exs`:

```elixir
config :phoenix_live_view, :colocated_js,
  target_directory: Path.expand("../assets/node_modules/phoenix-colocated", __DIR__)
```

An alternative approach could be to symlink the `phoenix-colocated` folder into your `node_modules`
folder.

> #### Tip {: .info}
>
> If you remove or modify the contents of the `:target_directory` folder, you can use
> `mix clean --all` and `mix compile` to regenerate all colocated JavaScript.

> #### Warning! {: .warning}
>
> LiveView assumes full ownership over the configured `:target_directory`. When
> compiling, it will **delete** any files and folders inside the `:target_directory`,
> that it does not associate with a colocated JavaScript module or manifest.

### Imports in colocated JS

The colocated JS files are fully handled by your bundler. For Phoenix apps, this is typically
`esbuild`. Because colocated JS is extracted to a folder outside the regular `assets` folder,
special care is necessary when you need to import other files inside the colocated JS:

```elixir
def sha256(assigns) do
  ~H"""
  <div id="sha-256" phx-hook=".Sha256">Hello World</div>
  <script :type={Phoenix.LiveView.ColocatedHook} name=".Sha256">
    import { sha256 } from "my-example-sha256-library"
    import { reverse } from "@/vendor/vendored-file"
    export default {
      mounted() {
        this.el.innerHTML = sha256(reverse(this.el.innerHTML))
      }
    }
  </script>
  """
end
```

While dependencies from `node_modules` should work out of the box, you cannot simply refer to your
`assets/vendor` folder using a relative path. Instead, your bundler needs to be configured to handle
an alias like `@` to resolve to your local `assets` folder. This is configured by default in the
esbuild configuration for new Phoenix 1.8 applications using `esbuild`'s [alias option](https://esbuild.github.io/api/#alias),
as can be seen in the config snippet above (`--alias=@=.`).

If your `node_modules` location is not `assets/node_modules` or `node_modules`, you may need to
configure the `:node_modules_path` option:

```elixir
# mix.exs
def project do
  [
    ...
    compilers: [:phoenix_live_view] ++ Mix.compilers(),
    phoenix_live_view: [colocated_js: [node_modules_path: "assets/node_modules"]],
    ...
  ]
end
```

This example shows the default behavior.

Note: In contrast to `:target_directory`, the `:node_modules_path` is a project
specific setting you need to set in your `mix.exs`.

## Options

Colocated JavaScript can be configured through the attributes of the `<script>` tag.
The supported attributes are:

  * `name` - The name under which the default export of the script is available when importing
    the manifest. If omitted, the file will be imported for side effects only.

  * `key` - A custom key to use for the export. This is used by `Phoenix.LiveView.ColocatedHook` to
    export all hooks under the named `hooks` export (`export { ... as hooks }`).
    For example, you could set this to `web_components` for each colocated script that defines
    a web component and then import all of them as `import { web_components } from "phoenix-colocated/my_app"`.
    Defaults to `:default`, which means the export will be available under the manifest's `default` export.
    This needs to be a valid JavaScript identifier. When given, a `name` is required as well.

  * `extension` - a custom extension to use when writing the extracted file. The default is `js`.

  * `manifest` - a custom manifest file to use instead of the default `index.js`. For example,
    `web_components.ts`. If you change the manifest, you will need to change the
    path of your JavaScript imports accordingly.

---

*Consult [api-reference.md](api-reference.md) for complete listing*
