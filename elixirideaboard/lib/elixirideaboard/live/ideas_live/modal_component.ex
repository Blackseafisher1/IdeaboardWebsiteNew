defmodule Elixirideaboard.IdeasLive.ModalComponent do
  use Elixirideaboard.Web, :live_component

  def render(assigns) do
    ~H"""
    <div class="modal-overlay" id="idea-modal" phx-cancel="close-modal">
      <div class="modal-content">
        <button class="modal-close" phx-click="close-modal">×</button>
        <%= if @idea do %>
          <h3><%= @idea.title %></h3>
          <p><%= @idea.description %></p>

          <div class="idea-files">
            <%= for file <- (@idea.files || []) do %>
              <a href={"/ideas/files/#{file.file_id}/download"} target="_blank">📎 <%= file.original_name %></a>
            <% end %>
          </div>

          <form phx-submit="update-idea" phx-target={@myself}>
            <input type="hidden" name="idea_id" value={@idea.idea_id} />
            <label>Titel</label>
            <input type="text" name="title" value={@idea.title} class="input" />
            <label>Beschreibung</label>
            <textarea name="description" class="input"><%= @idea.description %></textarea>
            <label>Kategorie</label>
            <select name="category_id" class="input">
              <%= for cat <- @categories do %>
                <option value={cat.category_id} selected={@idea.category_id == cat.category_id}><%= cat.name %></option>
              <% end %>
            </select>
            <button class="btn" type="submit">Speichern</button>
          </form>
        <% end %>
      </div>
    </div>
    """
  end
end
