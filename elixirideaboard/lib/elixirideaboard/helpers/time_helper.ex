defmodule Elixirideaboard.Helpers.TimeHelper do
  @moduledoc """
  Date/time formatting helpers for templates.
  """

  def relative_time(nil), do: ""
  def relative_time(dt) when is_binary(dt), do: dt

  def relative_time(%DateTime{} = dt) do
    now = DateTime.utc_now()
    diff = DateTime.diff(now, dt, :second)

    cond do
      diff < 60 -> "gerade eben"
      diff < 3600 -> "#{div(diff, 60)} Minuten"
      diff < 86400 -> "#{div(diff, 3600)} Stunden"
      diff < 604800 -> "#{div(diff, 86400)} Tagen"
      true -> Calendar.strftime(dt, "%d.%m.%Y")
    end
  end

  def format_date(nil), do: ""
  def format_date(dt), do: Calendar.strftime(dt, "%d.%m.%Y %H:%M")
end
