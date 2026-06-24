defmodule Elixirideaboard.AuthLive do
  use Elixirideaboard.Web, :live_view

  def mount(_params, session, socket) do
    user = if session["user_id"] do
      Elixirideaboard.UserService.get(session["user_id"])
    end
    {:ok, assign(socket, user: user, error: nil, flipped: false)}
  end

  def on_mount(:mount_user, _params, session, socket) do
    user = if session["user_id"] do
      Elixirideaboard.UserService.get(session["user_id"])
    end
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

  @impl true
  def handle_params(_params, _uri, socket) do
    {:noreply, assign(socket, page: socket.assigns.live_action)}
  end

  @impl true
  def handle_event("flip", _, socket) do
    {:noreply, assign(socket, error: nil, flipped: !socket.assigns.flipped)}
  end

  @impl true
  def handle_event("login", %{"email" => email, "password" => password}, socket) do
    case Elixirideaboard.AuthService.login(email, password) do
      {:ok, user} ->
        {:noreply, redirect(socket, to: "/auth/set-session?user_id=#{user.user_id}")}
      {:error, _reason} ->
        {:noreply, assign(socket, error: "Login fehlgeschlagen. Bitte überprüfe deine Eingaben.")}
    end
  end

  @impl true
  def handle_event("register", %{"username" => username, "email" => email, "password" => password}, socket) do
    case Elixirideaboard.UserService.create(%{username: username, email: email, password: password}) do
      {:ok, user_id} ->
        {:noreply, redirect(socket, to: "/auth/set-session?user_id=#{user_id}")}
      _ ->
        {:noreply, assign(socket, error: "Registrierung fehlgeschlagen. Möglicherweise existiert der Benutzername oder die E-Mail bereits.")}
    end
  end
end
