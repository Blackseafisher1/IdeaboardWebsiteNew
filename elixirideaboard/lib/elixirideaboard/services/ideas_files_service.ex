defmodule Elixirideaboard.IdeasFilesService do
  use AyeSQL, runner: Elixirideaboard.RepoRunner, repo: Elixirideaboard.Repo

  defqueries("../queries/ideas_files.sql")

  def save(idea_id, user_id, plug_upload) do
    ext = Path.extname(plug_upload.filename)
    filename = "#{System.system_time(:microsecond)}_#{:crypto.strong_rand_bytes(4) |> Base.encode16(case: :lower)}#{ext}"
    dest = Path.join(upload_dir(), filename)
    File.mkdir_p!(Path.dirname(dest))
    File.cp!(plug_upload.path, dest)

    create_idea_file(
      idea_id: idea_id,
      user_id: user_id,
      file_path: filename,
      original_name: plug_upload.filename,
      file_size: plug_upload.content_length || File.stat!(dest).size,
      mime_type: plug_upload.content_type
    )
  end

  def get(file_id) do
    case get_idea_file(file_id: file_id) do
      {:ok, [file]} -> file
      _ -> nil
    end
  end

  def delete(file_id, user_id, role) do
    case check_idea_file_owner(file_id: file_id) do
      {:ok, [%{user_id: uid}]} when uid == user_id ->
        file = get(file_id)
        if file, do: File.rm(Path.join(upload_dir(), file.file_path))
        delete_idea_file(file_id: file_id)
        :ok
      {:ok, _} when role in ["admin", "Admin"] ->
        file = get(file_id)
        if file, do: File.rm(Path.join(upload_dir(), file.file_path))
        delete_idea_file(file_id: file_id)
        :ok
      _ -> {:error, :not_authorized}
    end
  end

  defp upload_dir, do: "./data/uploads/ideas"
end
