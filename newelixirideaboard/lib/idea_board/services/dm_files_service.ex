defmodule IdeaBoard.DmFilesService do
  def get_file(conv_id, filename, _user) do
    {:ok, result} = IdeaBoard.Repo.query(
      "SELECT * FROM dm_files WHERE conversation_id = ? AND filename = ?",
      [conv_id, filename]
    )
    case result.rows do
      [file] -> {:ok, file}
      _ -> {:error, "Datei nicht gefunden"}
    end
  end
end
