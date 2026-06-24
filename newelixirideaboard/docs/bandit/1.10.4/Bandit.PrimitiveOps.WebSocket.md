# `Bandit.PrimitiveOps.WebSocket`
[🔗](https://github.com/mtrudel/bandit/blob/main/lib/bandit/primitive_ops/websocket.ex#L1)

WebSocket primitive operations behaviour and default implementation

# `ws_mask`

```elixir
@callback ws_mask(payload :: binary(), mask :: integer()) :: binary()
```

WebSocket masking according to [RFC6455§5.3](https://www.rfc-editor.org/rfc/rfc6455#section-5.3)

---

*Consult [api-reference.md](api-reference.md) for complete listing*
