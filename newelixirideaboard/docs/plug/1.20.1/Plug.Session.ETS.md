# `Plug.Session.ETS`
[🔗](https://github.com/elixir-plug/plug/blob/v1.20.1/lib/plug/session/ets.ex#L1)

Stores the session in an in-memory ETS table.

This store does not create the ETS table; it expects that an
existing named table with public properties is passed as an
argument.

We don't recommend using this store in production as every
session will be stored in ETS and never cleaned until you
create a task responsible for cleaning up old entries.

Also, since the store is in-memory, it means sessions are
not shared between servers. If you deploy to more than one
machine, using this store is again not recommended.

This store, however, can be used as an example for creating
custom storages, based on Redis, Memcached, or a database
itself.

## Options

  * `:table` - ETS table name (required)

For more information on ETS tables, visit the Erlang documentation at
http://www.erlang.org/doc/man/ets.html.

## Storage

The data is stored in ETS in the following format:

    {sid :: String.t, data :: map, timestamp :: :erlang.timestamp}

The timestamp is updated whenever there is a read or write to the
table and it may be used to detect if a session is still active.

## Examples

    # Create an ETS table when the application starts
    :ets.new(:session, [:named_table, :public, read_concurrency: true])

    # Use the session plug with the table name
    plug Plug.Session, store: :ets, key: "sid", table: :session

---

*Consult [api-reference.md](api-reference.md) for complete listing*
