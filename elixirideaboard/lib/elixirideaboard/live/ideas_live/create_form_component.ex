defmodule Elixirideaboard.IdeasLive.CreateFormComponent do
  use Elixirideaboard.Web, :live_component

  def render(assigns) do
    ~H"""
    <dialog open class="modal" id="create-idea-modal">
      <form phx-submit="create-idea" phx-target={@myself} class="modal-content">
        <button class="modal-close" phx-click="close-modal" type="button">×</button>
        <h3>Neue Idee</h3>

        <label>Titel</label>
        <input type="text" name="title" class="input" required maxlength="50" />

        <label>Beschreibung</label>
        <textarea name="description" class="input" rows="4" required></textarea>

        <label>Kategorie</label>
        <select name="category_id" class="input" required>
          <%= for cat <- @categories do %>
            <option value={cat.category_id}><%= cat.name %></option>
          <% end %>
        </select>

        <label>Tags</label>
        <input type="text" name="tags" class="input" placeholder="ux, performance, kosten" />

        <button class="btn" type="submit">Erstellen</button>
      </form>
    </dialog>
    """
  end

  def handle_event("create-idea", params, socket) do
    user_id = socket.assigns.user.id
    case Elixirideaboard.IdeasService.create(user_id, params) do
      {:ok, idea_id} ->
        Phoenix.PubSub.broadcast(Elixirideaboard.PubSub, "ideas", {:new_idea, idea_id})
        {:noreply, send_self(socket.parent, :close_modal)}
      _ ->
        {:noreply, socket}
    end
  end

  defp send_self(nil, _msg), do: nil
  defp send_self(pid, msg), do: send(pid, msg)
end
