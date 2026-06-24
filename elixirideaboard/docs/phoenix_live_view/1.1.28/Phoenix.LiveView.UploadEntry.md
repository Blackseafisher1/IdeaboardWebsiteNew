# `Phoenix.LiveView.UploadEntry`
[🔗](https://github.com/phoenixframework/phoenix_live_view/blob/v1.1.28/lib/phoenix_live_view/upload_config.ex#L1)

The struct representing an upload entry.

# `t`

```elixir
@type t() :: %Phoenix.LiveView.UploadEntry{
  cancelled?: boolean(),
  client_last_modified: integer() | nil,
  client_meta: map() | nil,
  client_name: String.t() | nil,
  client_relative_path: String.t() | nil,
  client_size: integer() | nil,
  client_type: String.t() | nil,
  done?: boolean(),
  preflighted?: term(),
  progress: integer(),
  ref: String.t() | nil,
  upload_config: String.t() | :atom,
  upload_ref: String.t(),
  uuid: String.t() | nil,
  valid?: boolean()
}
```

---

*Consult [api-reference.md](api-reference.md) for complete listing*
