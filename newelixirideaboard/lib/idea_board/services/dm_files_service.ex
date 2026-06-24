defmodule IdeaBoard.DmFilesService do
  def get_file(conv_id, filename, _user) do
    try do
      case IdeaBoard.Repo.query_map(
        "SELECT * FROM dm_files WHERE conversation_id = ? AND filename = ?",
        [conv_id, filename]
      ) do
        {:ok, nil} -> {:error, "Datei nicht gefunden"}
        {:ok, file} -> {:ok, file}
        error -> error
      end
    rescue
      _e in [DBConnection.ConnectionError, ArgumentError, MyXQL.Error] -> {:error, "DB not available"}
    end
  end
end
