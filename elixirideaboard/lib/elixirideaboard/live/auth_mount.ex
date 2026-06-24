defmodule Elixirideaboard.Live.AuthMount do
  @moduledoc """
  LiveView on_mount hooks for authentication.
  """

  def on_mount(:mount_user, _params, session, socket) do
    user_id = session["user_id"]
    user = if user_id, do: Elixirideaboard.UserService.get(user_id)
    {:cont, Phoenix.Component.assign(socket, :user, user)}
  end

  def on_mount(:require_user, _params, _session, socket) do
    if socket.assigns.user do
      {:cont, socket}
    else
      {:halt, Phoenix.LiveView.redirect(socket, to: "/users/auth")}
    end
  end

  def on_mount(:require_admin, _params, _session, socket) do
    if socket.assigns.user && Elixirideaboard.RoleHelpers.is_admin?(socket.assigns.user) do
      {:cont, socket}
    else
      {:halt, Phoenix.LiveView.redirect(socket, to: "/")}
    end
  end
end
