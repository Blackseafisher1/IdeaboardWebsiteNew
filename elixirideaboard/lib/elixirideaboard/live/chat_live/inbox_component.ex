defmodule Elixirideaboard.ChatLive.InboxComponent do
  use Elixirideaboard.Web, :live_component

  def render(assigns) do
    ~H"""
    <div class="inbox">
      <h2>Nachrichten</h2>
      <div class="conversation-list">
        <%= for conv <- @conversations do %>
          <a href={"/dms/chat/#{conv.partner_id}"} class="conversation-item">
            <div class="conversation-info">
              <strong><%= conv.partner_username %></strong>
              <span class="last-message"><%= conv.last_message %></span>
            </div>
          </a>
        <% end %>
      </div>
    </div>
    """
  end
end
