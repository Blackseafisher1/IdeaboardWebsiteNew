defmodule Elixirideaboard.ChatLive.MessageListComponent do
  use Elixirideaboard.Web, :live_component

  def render(assigns) do
    has_history = length(assigns.messages) > 0

    ~H"""
    <div class="message-list" id="message-list" phx-update="stream">
      <%= if has_history do %>
        <button phx-click="load-history" class="load-more">Ältere Nachrichten laden</button>
      <% end %>
      <%= for msg <- @messages do %>
        <.message msg={msg} current_user_id={@current_user_id} />
      <% end %>
    </div>
    """
  end

  def message(assigns) do
    is_mine = assigns.msg.sender_id == assigns.current_user_id

    ~H"""
    <div class={"message #{if is_mine, do: "mine", else: "theirs"}"} id={"msg-#{@msg.message_id}"}>
      <div class="message-sender"><%= @msg.sender_username %></div>
      <div class="message-content"><%= @msg.content %></div>
      <div class="message-time"><%= @msg.created_at %></div>
    </div>
    """
  end
end
