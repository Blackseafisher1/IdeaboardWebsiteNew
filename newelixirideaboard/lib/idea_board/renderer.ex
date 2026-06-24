defmodule IdeaBoard.Renderer do
  @moduledoc """
  Renders HEEx templates using Phoenix.Template.
  Templates compiled from priv/templates/ at compile time.
  """

  use Phoenix.Template, root: "priv/templates", namespace: IdeaBoard.Renderer

  def render(template, assigns \\ [], conn \\ nil) do
    assigns =
      assigns
      |> Enum.into(%{})
      |> Map.put_new(:conn, conn)
      |> Map.put_new(:user, get_user(conn))

    Phoenix.Template.render_to_string(__MODULE__, template, "heex", assigns)
  end

  defp get_user(nil), do: nil

  defp get_user(%Plug.Conn{} = conn), do: Plug.Conn.get_session(conn, :user)

  defp get_user(%{assigns: %{user: user}}), do: user

  defp get_user(_), do: nil
end
