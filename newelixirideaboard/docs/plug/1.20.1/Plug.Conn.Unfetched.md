# `Plug.Conn.Unfetched`
[🔗](https://github.com/elixir-plug/plug/blob/v1.20.1/lib/plug/conn/unfetched.ex#L1)

A struct used as default on unfetched fields.

The `:aspect` key of the struct specifies what field is still unfetched.

## Examples

    unfetched = %Plug.Conn.Unfetched{aspect: :cookies}

# `t`

```elixir
@type t() :: %Plug.Conn.Unfetched{aspect: atom()}
```

# `fetch`

# `get`

# `get_and_update`

# `pop`

---

*Consult [api-reference.md](api-reference.md) for complete listing*
