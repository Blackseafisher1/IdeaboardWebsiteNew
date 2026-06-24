defmodule Elixirideaboard.FileController do
  use Elixirideaboard.Web, :controller

  def idea_download(conn, %{"file_id" => file_id}) do
    file = Elixirideaboard.IdeasFilesService.get(String.to_integer(file_id))
    if file do
      path = Path.join("./data/uploads/ideas", file.file_path)
      send_download(conn, {:file, path}, filename: file.original_name)
    else
      send_resp(conn, 404, "Datei nicht gefunden")
    end
  end

  def dm_download(conn, %{"conversation_id" => conv_id, "filename" => filename}) do
    path = Path.join("./data/uploads/chat", filename)
    if File.exists?(path) do
      send_download(conn, {:file, path})
    else
      send_resp(conn, 404, "Datei nicht gefunden")
    end
  end

  def group_download(conn, %{"group_id" => _group_id, "filename" => filename}) do
    path = Path.join("./data/uploads/chat", filename)
    if File.exists?(path) do
      send_download(conn, {:file, path})
    else
      send_resp(conn, 404, "Datei nicht gefunden")
    end
  end
end
