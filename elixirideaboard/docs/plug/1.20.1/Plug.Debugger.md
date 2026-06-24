# `Plug.Debugger`
[🔗](https://github.com/elixir-plug/plug/blob/v1.20.1/lib/plug/debugger.ex#L1)

A module (**not a plug**) for debugging in development.

This module is commonly used within a `Plug.Builder` or a `Plug.Router`
and it wraps the `call/2` function.

Notice `Plug.Debugger` *does not* catch errors, as errors should still
propagate so that the Elixir process finishes with the proper reason.
This module does not perform any logging either, as all logging is done
by the web server handler.

**Note:** If this module is used with `Plug.ErrorHandler`, only one of
them will effectively handle errors. For this reason, it is recommended
that `Plug.Debugger` is used before `Plug.ErrorHandler` and only in
particular environments, like `:dev`.

In case of an error, the rendered page drops the `content-security-policy`
header before rendering the error to ensure that the error is displayed
correctly.

## Examples

    defmodule MyApp do
      use Plug.Builder

      if Mix.env == :dev do
        use Plug.Debugger, otp_app: :my_app
      end

      plug :boom

      def boom(conn, _) do
        # Error raised here will be caught and displayed in a debug page
        # complete with a stacktrace and other helpful info.
        raise "oops"
      end
    end

## Options

  * `:otp_app` - the OTP application that is using Plug. This option is used
    to filter stacktraces that belong only to the given application.
  * `:style` - custom styles (see below)
  * `:banner` - the optional MFA (`{module, function, args}`) which receives
    exception details and returns banner contents to appear at the top of
    the page. May be any string, including markup.

## Custom styles

You may pass a `:style` option to customize the look of the HTML page.

    use Plug.Debugger, style:
      [primary: "#c0392b", logo: "data:image/png;base64,..."]

The following keys are available:

  * `:primary` - primary color
  * `:accent` - accent color
  * `:logo` - logo URI, or `nil` to disable

The `:logo` is preferred to be a base64-encoded data URI so not to make any
external requests, though external URLs (eg, `https://...`) are supported.

## Custom Banners

You may pass an MFA (`{module, function, args}`) to be invoked when an
error is rendered which provides a custom banner at the top of the
debugger page. The function receives the following arguments, with the
passed `args` concatenated at the end:

    [conn, status, kind, reason, stacktrace]

For example, the following `:banner` option:

    use Plug.Debugger, banner: {MyModule, :debug_banner, []}

would invoke the function:

    MyModule.debug_banner(conn, status, kind, reason, stacktrace)

## Links to the text editor

If a `PLUG_EDITOR` environment variable is set, `Plug.Debugger` will
use it to generate links to your text editor. The variable should be
set with `__FILE__` and `__LINE__` placeholders which will be correctly
replaced. For example (with the [TextMate](http://macromates.com) editor):

    txmt://open/?url=file://__FILE__&line=__LINE__

Or, using Visual Studio Code:

    vscode://file/__FILE__:__LINE__

You can also use `__RELATIVEFILE__` if your project path is different from
the running application. This is useful when working with Docker containers.

    vscode://file//path/to/your/project/__RELATIVEFILE__:__LINE__

# `get_mfa`

---

*Consult [api-reference.md](api-reference.md) for complete listing*
