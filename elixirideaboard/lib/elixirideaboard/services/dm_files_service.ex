defmodule Elixirideaboard.DmFilesService do
  @upload_dir "./data/uploads/chat"

  def save(plug_upload) do
    ext = Path.extname(plug_upload.filename)
    filename = "#{System.system_time(:microsecond)}_#{:crypto.strong_rand_bytes(4) |> Base.encode16(case: :lower)}#{ext}"
    dest = Path.join(@upload_dir, filename)
    File.mkdir_p!(@upload_dir)
    File.cp!(plug_upload.path, dest)
    %{filename: filename, original_name: plug_upload.filename, size: plug_upload.content_length || File.stat!(dest).size}
  end

  def serve_path(filename) do
    Path.join(@upload_dir, filename)
  end
end
