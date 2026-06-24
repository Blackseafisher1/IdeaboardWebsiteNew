# `Phoenix.LiveView.Controller`
[🔗](https://github.com/phoenixframework/phoenix_live_view/blob/v1.1.28/lib/phoenix_live_view/controller.ex#L1)

Helpers for rendering LiveViews from a controller.

# `live_render`

Renders a live view from a Plug request and sends an HTML response
from within a controller.

It also automatically sets the `@live_module` assign with the value
of the LiveView to be rendered.

## Options

See `Phoenix.Component.live_render/3` for all supported options.

## Examples

    defmodule ThermostatController do
      use MyAppWeb, :controller

      # "use MyAppWeb, :controller" should import Phoenix.LiveView.Controller.
      # If it does not, you can either import it there or uncomment the line below:
      # import Phoenix.LiveView.Controller

      def show(conn, %{"id" => thermostat_id}) do
        live_render(conn, ThermostatLive, session: %{
          "thermostat_id" => thermostat_id,
          "current_user_id" => get_session(conn, :user_id)
        })
      end
    end

---

*Consult [api-reference.md](api-reference.md) for complete listing*
