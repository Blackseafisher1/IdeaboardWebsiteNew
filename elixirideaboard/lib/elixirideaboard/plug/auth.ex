defmodule Elixirideaboard.Plug.Auth do
  @moduledoc """
  Plug that loads user from session and assigns to conn.
  Replaces the old Express `isLoggedIn` middleware and `res.locals.user` pattern.
  """

  import Plug.Conn

  def init(opts), do: opts

  def call(conn, _opts) do
    user_id = get_session(conn, :user_id)

    user = if user_id do
      Elixirideaboard.UserService.get(user_id)
    end

    assign(conn, :current_user, user)
  end
end
