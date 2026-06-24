defmodule Elixirideaboard.ChatLive.MessageInputComponent do
  use Elixirideaboard.Web, :live_component

  def render(assigns) do
    ~H"""
    <form phx-submit="send" class="message-input">
      <textarea name="message" placeholder="Nachricht..." rows="2" class="input"></textarea>
      <button class="btn" type="submit">Senden</button>
    </form>
    """
  end
end
