defmodule IdeaBoard.PageController do
  import Plug.Conn

  def call(conn, action) do
    case action do
      :index -> render_page(conn, "index", title: "Ideenboard")
      :gate -> render_page(conn, "gate", title: "Zugangscode erforderlich", error: nil)
      :gate_post -> handle_gate_post(conn)
      :static_page -> render_static(conn)
    end
  end

  defp handle_gate_post(conn) do
    password = Map.get(conn.params, "password", "")
    gate_password = Application.get_env(:newelixirideaboard, :public_gate_password, "")

    if gate_password == "" or password == gate_password do
      conn = put_session(conn, :gate_passed, true)
      redirect(conn, Map.get(conn.params, "back", "/"))
    else
      render_page(conn, "gate", title: "Zugangscode erforderlich", error: "Falsches Passwort")
    end
  end

  defp render_page(conn, template, assigns) do
    html = IdeaBoard.Renderer.render(template, assigns, conn)
    send_resp(conn, 200, html)
  end

  defp render_static(conn) do
    page = conn.request_path |> String.trim("/")
    title = page |> String.capitalize()
    html = IdeaBoard.Renderer.render("legal/#{page}", [title: title], conn)
    send_resp(conn, 200, html)
  end

  defp redirect(conn, location) do
    conn
    |> put_resp_header("location", location)
    |> send_resp(302, "")
  end
end
