defmodule Elixirideaboard.SurveyLive do
  use Elixirideaboard.Web, :live_view

  alias Elixirideaboard.SurveyService

  @impl true
  def mount(_params, _session, socket) do
    {:ok, assign(socket, surveys: SurveyService.list(), survey: nil, page: :index)}
  end

  @impl true
  def handle_params(params, _url, socket) do
    case socket.assigns.live_action do
      :new ->
        {:noreply, assign(socket, page: :new, survey: nil)}
      :show ->
        survey = SurveyService.get(String.to_integer(params["id"]))
        {:noreply, assign(socket, survey: survey, page: :show)}
      _ ->
        {:noreply, assign(socket, surveys: SurveyService.list(), page: :index)}
    end
  end

  @impl true
  def handle_event("create", params, socket) do
    case SurveyService.create(Map.put(params, :creator_id, socket.assigns.user.user_id)) do
      {:ok, _id} -> {:noreply, redirect(socket, to: "/surveys")}
      _ -> {:noreply, socket}
    end
  end
end
