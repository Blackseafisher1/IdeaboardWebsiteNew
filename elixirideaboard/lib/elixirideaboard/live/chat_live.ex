defmodule Elixirideaboard.ChatLive do
  use Elixirideaboard.Web, :live_view

  alias Elixirideaboard.{DmMessagingService, GroupService, UserService}

  @impl true
  def mount(_params, _session, socket) do
    if connected?(socket) do
      Phoenix.PubSub.subscribe(Elixirideaboard.PubSub, "chat")
    end
    {:ok, assign(socket,
      conversations: [],
      messages: [],
      online: [],
      other_user: nil,
      group: nil,
      page: :inbox
    )}
  end

  @impl true
  def handle_params(params, _url, socket) do
    case socket.assigns.live_action do
      :direct ->
        other = UserService.get_minimal(String.to_integer(params["user_id"]))
        conv_id = DmMessagingService.get_or_create(socket.assigns.user.user_id, other.user_id)
        messages = DmMessagingService.latest_messages(conv_id)

        if connected?(socket) do
          Phoenix.PubSub.subscribe(Elixirideaboard.PubSub, "dm:#{conv_id}")
        end

        {:noreply, assign(socket, messages: messages, other_user: other, page: :direct, conv_id: conv_id)}

      :group ->
        gid = String.to_integer(params["id"])
        group = GroupService.get(gid)

        unless group do
          {:noreply, redirect(socket, to: "/dms")}
        else
          GroupService.ensure_project_sync(gid, socket.assigns.user.user_id)
          messages = GroupService.latest_messages(gid)

          if connected?(socket) do
            Phoenix.PubSub.subscribe(Elixirideaboard.PubSub, "group:#{gid}")
            Elixirideaboard.Presence.track(self(), "group:#{gid}", socket.assigns.user.user_id, %{})
          end

          members = GroupService.members(gid)
          online = Elixirideaboard.Presence.list("group:#{gid}")

          {:noreply, assign(socket, messages: messages, group: group, members: members, online: Map.keys(online), page: :group, group_id: gid)}
        end

      _ ->
        {:noreply, assign(socket, conversations: DmMessagingService.conversations(socket.assigns.user.user_id), page: :inbox)}
    end
  end

  @impl true
  def handle_event("send", %{"message" => text}, socket) do
    user_id = socket.assigns.user.user_id
    case socket.assigns.page do
      :direct ->
        msg = DmMessagingService.send(socket.assigns.conv_id, user_id, text)
        Phoenix.PubSub.broadcast(Elixirideaboard.PubSub, "dm:#{socket.assigns.conv_id}", {:new_message, msg})
        {:noreply, update(socket, :messages, &(&1 ++ [msg]))}

      :group ->
        GroupService.send_message(socket.assigns.group_id, user_id, text)
        msgs = GroupService.latest_messages(socket.assigns.group_id)
        {:noreply, assign(socket, messages: msgs)}
    end
  end

  @impl true
  def handle_event("load-history", _, socket) do
    case socket.assigns.page do
      :direct ->
        first_id = if socket.assigns.messages != [], do: hd(socket.assigns.messages).message_id, else: 0
        older = DmMessagingService.messages_before(socket.assigns.conv_id, first_id)
        {:noreply, assign(socket, messages: older ++ socket.assigns.messages)}
      :group ->
        first_id = if socket.assigns.messages != [], do: hd(socket.assigns.messages).message_id, else: 0
        older = GroupService.messages_before(socket.assigns.group_id, first_id)
        {:noreply, assign(socket, messages: older ++ socket.assigns.messages)}
    end
  end

  @impl true
  def handle_info({:new_message, msg}, socket) do
    {:noreply, update(socket, :messages, &(&1 ++ [msg]))}
  end

  @impl true
  def handle_info(%{event: "presence_diff"}, socket) do
    online = Elixirideaboard.Presence.list("group:#{socket.assigns.group_id}")
    {:noreply, assign(socket, online: Map.keys(online))}
  end
end
