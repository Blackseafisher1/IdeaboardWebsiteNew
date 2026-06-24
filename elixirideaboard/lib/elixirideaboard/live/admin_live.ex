defmodule Elixirideaboard.AdminLive do
  use Elixirideaboard.Web, :live_view

  alias Elixirideaboard.AdminService

  @impl true
  def mount(_params, _session, socket) do
    {:ok, assign(socket, users: AdminService.list_users())}
  end

  @impl true
  def handle_event("set-role", %{"user_id" => user_id, "role" => role}, socket) do
    AdminService.set_role(String.to_integer(user_id), role)
    {:noreply, assign(socket, users: AdminService.list_users())}
  end

  @impl true
  def handle_event("delete-user", %{"user_id" => user_id}, socket) do
    AdminService.delete(String.to_integer(user_id))
    {:noreply, assign(socket, users: AdminService.list_users())}
  end
end
