# `DBConnection.ConnectionPool`
[🔗](https://github.com/elixir-ecto/db_connection/blob/v2.10.1/lib/db_connection/connection_pool.ex#L1)

The default connection pool.

The queueing algorithm is based on [CoDel](https://queue.acm.org/appendices/codel.html).

You're not supposed to call any functions on this pool directly, but only pass this
as the value of the `:pool` option in functions such as `DBConnection.start_link/2`.

# `child_spec`

Returns a specification to start this module under a supervisor.

See `Supervisor`.

---

*Consult [api-reference.md](api-reference.md) for complete listing*
