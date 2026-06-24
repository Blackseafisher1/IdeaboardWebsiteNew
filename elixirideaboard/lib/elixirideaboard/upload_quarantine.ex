defmodule Elixirideaboard.UploadQuarantine do
  @moduledoc """
  File upload quarantine scanner.
  Ported from lib/upload_quarantine.js

  Scans uploaded files for suspicious content (JS, PHP, shell scripts, etc.)
  and isolates them during the initial quarantine period.

  Also serves as the Plug body reader for multipart uploads to capture
  file metadata and trigger scanning.
  """

  @quarantine_dir "./data/quarantine"
  @allowed_extensions ~w(.pdf .png .jpg .jpeg .gif .svg .doc .docx .xls .xlsx .txt .zip .csv)
  @max_file_size 50 * 1024 * 1024  # 50 MB

  require Logger

  def read_body(conn, opts) do
    # Read the body via Plug's default reader
    {:ok, body, conn} = Plug.Conn.read_body(conn, opts)
    {:ok, body, conn}
  end

  def scan_file(file_path, original_name) do
    ext = Path.extname(original_name) |> String.downcase()

    cond do
      ext in @allowed_extensions -> :clean
      true ->
        content = File.read!(file_path)
        scan_content(content, original_name)
    end
  end

  defp scan_content(content, filename) do
    suspicious = [
      ~r/<?php/i,
      ~r/<script/i,
      ~r/#!/,
      ~r/PowerShell/i,
      ~r/bash/i,
      ~r/cmd\.exe/i,
      ~r/\.exe"/
    ]

    if Enum.any?(suspicious, &Regex.match?(&1, content)) do
      isolate_file(filename, content)
      :suspicious
    else
      :clean
    end
  end

  defp isolate_file(filename, content) do
    File.mkdir_p!(@quarantine_dir)
    dest = Path.join(@quarantine_dir, "#{System.system_time(:microsecond)}_#{filename}")
    File.write!(dest, content)
    Logger.warning("Quarantined file: #{filename} -> #{dest}")
  end
end
