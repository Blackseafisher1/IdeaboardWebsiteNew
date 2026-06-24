# `mix compile.phoenix_live_view`
[🔗](https://github.com/phoenixframework/phoenix_live_view/blob/v1.1.28/lib/mix/tasks/compile/phoenix_live_view.ex#L1)

A LiveView compiler for HEEx macro components.

Right now, only `Phoenix.LiveView.ColocatedHook` and `Phoenix.LiveView.ColocatedJS`
are handled.

You must add it to your `mix.exs` as:

    compilers: [:phoenix_live_view] ++ Mix.compilers()

---

*Consult [api-reference.md](api-reference.md) for complete listing*
