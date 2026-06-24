defmodule IdeaBoard.IdeasFilesService do
  def save_file(idea_id, file) do
    ext = Path.extname(file.filename)
    filename = "#{System.system_time(:microsecond)}#{ext}"
    dest = Path.join(["./data/uploads/ideas/", filename])
    File.mkdir_p!(Path.dirname(dest))
    File.cp!(file.path, dest)

    IdeaBoard.Repo.query(
      "INSERT INTO idea_files (idea_id, filename, original_name, mimetype) VALUES (?, ?, ?, ?)",
      [idea_id, filename, file.filename, file.content_type]
    )
  end

  def get_file(file_id, _user) do
    case IdeaBoard.Repo.query("SELECT * FROM idea_files WHERE file_id = ?", [file_id]) do
      {:ok, %{rows: [file]}} -> {:ok, file}
      _ -> {:error, "Datei nicht gefunden"}
    end
  end
end
