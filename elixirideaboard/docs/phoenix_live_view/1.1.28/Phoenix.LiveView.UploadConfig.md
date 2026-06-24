# `Phoenix.LiveView.UploadConfig`
[🔗](https://github.com/phoenixframework/phoenix_live_view/blob/v1.1.28/lib/phoenix_live_view/upload_config.ex#L51)

The struct representing an upload.

# `t`

```elixir
@type t() :: %Phoenix.LiveView.UploadConfig{
  accept: list() | :any,
  acceptable_exts: MapSet.t(),
  acceptable_types: MapSet.t(),
  allowed?: boolean(),
  auto_upload?: boolean(),
  chunk_size: term(),
  chunk_timeout: term(),
  cid: :unregistered | nil | integer(),
  client_key: String.t(),
  entries: list(),
  entry_refs_to_metas: %{required(String.t()) =&gt; map()},
  entry_refs_to_pids: %{required(String.t()) =&gt; pid() | :unregistered | :done},
  errors: list(),
  external:
    (Phoenix.LiveView.UploadEntry.t(), Phoenix.LiveView.Socket.t() -&gt;
       {:ok | :error, meta :: %{uploader: String.t()},
        Phoenix.LiveView.Socket.t()})
    | false,
  max_entries: pos_integer(),
  max_file_size: pos_integer(),
  name: atom() | String.t(),
  progress_event:
    (name :: atom() | String.t(),
     Phoenix.LiveView.UploadEntry.t(),
     Phoenix.LiveView.Socket.t() -&gt;
       {:noreply, Phoenix.LiveView.Socket.t()})
    | nil,
  ref: String.t(),
  writer: (name :: atom() | String.t(),
           Phoenix.LiveView.UploadEntry.t(),
           Phoenix.LiveView.Socket.t() -&gt;
             {module(), term()})
}
```

---

*Consult [api-reference.md](api-reference.md) for complete listing*
