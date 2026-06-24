defmodule IdeaBoard.FileController do
  import Plug.Conn

  def call(conn, action) do
    case action do
      :idea_download -> handle_idea_download(conn)
      :dm_download -> handle_dm_download(conn)
      :group_download -> handle_group_download(conn)
    end
  end

  defp handle_idea_download(conn) do
    file_id = Map.get(conn.params, "file_id")
    user = get_session(conn, :user)

    case IdeaBoard.IdeasFilesService.get_file(file_id, user) do
      {:ok, file} -> send_file(conn, file)
      {:error, reason} -> send_resp(conn, 403, reason)
    end
  end

  defp handle_dm_download(conn) do
    conv_id = Map.get(conn.params, "conversation_id")
    filename = Map.get(conn.params, "filename")
    user = get_session(conn, :user)

    case IdeaBoard.DmFilesService.get_file(conv_id, filename, user) do
      {:ok, file} -> send_file(conn, file)
      {:error, reason} -> send_resp(conn, 403, reason)
    end
  end

  defp handle_group_download(conn) do
    group_id = Map.get(conn.params, "group_id")
    filename = Map.get(conn.params, "filename")
    user = get_session(conn, :user)

    case IdeaBoard.GroupService.get_file(group_id, filename, user) do
      {:ok, file} -> send_file(conn, file)
      {:error, reason} -> send_resp(conn, 403, reason)
    end
  end

  defp send_file(conn, file) do
    conn
    |> put_resp_header("content-disposition", ~s(attachment; filename="#{file.original_name}"))
    |> put_resp_header("content-type", file.mimetype)
    |> send_file(200, file.file_path)
  end
end
