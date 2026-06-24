defmodule IdeaBoard.Renderer do
  require Phoenix.Template

  root = "priv/templates"

  converter = fn path ->
    path
    |> Path.rootname(".html.heex")
    |> Path.relative_to(root)
  end

  Phoenix.Template.compile_all(converter, root, "**/*")

  def render_page(template, assigns, conn \\ nil) do
    user = get_user(conn)
    assigns = assigns |> Enum.into(%{}) |> Map.put(:user, user)
    assigns = Map.put(assigns, :layout, {__MODULE__, "layouts/root"})
    Phoenix.Template.render(__MODULE__, template, "heex", assigns)
    |> Phoenix.HTML.safe_to_string()
  end

  def render_partial(template, assigns, conn \\ nil) do
    user = get_user(conn)
    assigns = assigns |> Enum.into(%{}) |> Map.put(:user, user)
    result = Phoenix.Template.render(__MODULE__, template, "heex", assigns)
    if is_binary(result), do: [result], else: result
  end

  def render_partial_string(template, assigns, conn \\ nil) do
    render_partial(template, assigns, conn)
    |> Phoenix.HTML.safe_to_string()
  end

  defp get_user(nil), do: nil
  defp get_user(%Plug.Conn{assigns: %{user: user}}), do: user
  defp get_user(%Plug.Conn{} = conn) do
    try do
      Plug.Conn.get_session(conn, :user)
    rescue
      _ -> nil
    end
  end
  defp get_user(%{user: user}), do: user
  defp get_user(_), do: nil
end
