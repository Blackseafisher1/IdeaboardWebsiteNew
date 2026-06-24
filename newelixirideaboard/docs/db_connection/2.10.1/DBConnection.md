# `DBConnection`
[🔗](https://github.com/elixir-ecto/db_connection/blob/v2.10.1/lib/db_connection.ex#L39)

A behaviour module for implementing efficient database connection
client processes, pools and transactions.

`DBConnection` handles callbacks differently to most behaviours. Some
callbacks will be called in the calling process, with the state
copied to and from the calling process. This is useful when the data
for a request is large and means that a calling process can interact
with a socket directly.

A side effect of this is that query handling can be written in a
simple blocking fashion, while the connection process itself will
remain responsive to OTP messages and can enqueue and cancel queued
requests.

If a request or series of requests takes too long to handle in the
client process a timeout will trigger and the socket can be cleanly
disconnected by the connection process.

If a calling process waits too long to start its request it will
timeout and its request will be cancelled. This prevents requests
building up when the database can not keep up.

If no requests are received for an idle interval, the pool will
ping all stale connections which can then ping the database to keep
the connection alive.

Should the connection be lost, attempts will be made to reconnect with
(configurable) exponential random backoff to reconnect. All state is
lost when a connection disconnects but the process is reused.

The `DBConnection.Query` protocol provide utility functions so that
queries can be encoded and decoded without blocking the connection or pool.

## Connection pools

DBConnection connections support using different pools via the `:pool` option
passed to `start_link/2`. The default pool is `DBConnection.ConnectionPool`.
Another supported pool that is commonly used for tests is `DBConnection.Ownership`.

For now, using *custom* pools is not supported since the API for pools is not
public.

## Errors

Most functions in this module raise a `DBConnection.ConnectionError` exception
when failing to check out a connection from the pool.

# `conn`

```elixir
@type conn() :: GenServer.server() | t()
```

# `connection_option`
*since 2.6.0* 

```elixir
@type connection_option() ::
  {:log,
   (DBConnection.LogEntry.t() -&gt; any()) | {module(), atom(), [any()]} | nil}
  | {:queue, boolean()}
  | {:timeout, timeout()}
  | {:deadline, integer() | nil}
```

An option you can pass to DBConnection functions.

# `cursor`

```elixir
@type cursor() :: any()
```

# `option`

```elixir
@type option() :: connection_option()
```

An option you can pass to DBConnection functions (*deprecated*).

> #### Deprecated {: .warning}
>
> This option is deprecated since v2.6.0. Use `t:connection_option/0` instead.

# `params`

```elixir
@type params() :: any()
```

# `query`

```elixir
@type query() :: DBConnection.Query.t()
```

# `result`

```elixir
@type result() :: any()
```

# `start_option`

```elixir
@type start_option() ::
  {:after_connect, (t() -&gt; any()) | {module(), atom(), [any()]} | nil}
  | {:after_connect_timeout, timeout()}
  | {:connection_listeners, [Process.dest()] | nil | {[Process.dest()], any()}}
  | {:backoff_max, non_neg_integer()}
  | {:backoff_min, non_neg_integer()}
  | {:backoff_type, :stop | :exp | :rand | :rand_exp}
  | {:checkout_retries, non_neg_integer()}
  | {:configure, (keyword() -&gt; keyword()) | {module(), atom(), [any()]} | nil}
  | {:idle_interval, non_neg_integer()}
  | {:idle_limit, non_neg_integer()}
  | {:max_lifetime, Range.t()}
  | {:max_restarts, non_neg_integer()}
  | {:max_seconds, pos_integer()}
  | {:name, GenServer.name()}
  | {:pool, module()}
  | {:pool_size, pos_integer()}
  | {:queue_interval, non_neg_integer()}
  | {:queue_target, non_neg_integer()}
  | {:show_sensitive_data_on_connection_error, boolean()}
```

# `status`

```elixir
@type status() :: :idle | :transaction | :error
```

# `t`

```elixir
@type t() :: %DBConnection{conn_mode: term(), conn_ref: reference(), pool_ref: any()}
```

Run or transaction connection reference.

# `checkout`

```elixir
@callback checkout(state :: any()) ::
  {:ok, new_state :: any()} | {:disconnect, Exception.t(), new_state :: any()}
```

Checkouts the state from the connection process. Return `{:ok, state}`
to allow the checkout or `{:disconnect, exception, state}` to disconnect.

This callback is called immediately after the connection is established
and the state is never effectively checked in again. That's because
DBConnection keeps the connection state in an ETS table that is moved
between the different clients checking out connections. There is no
`checkin` callback. The state is only handed back to the connection
process during pings and (re)connects.

This callback is called in the connection process.

# `connect`

```elixir
@callback connect(opts :: Keyword.t()) :: {:ok, state :: any()} | {:error, Exception.t()}
```

Connect to the database. Return `{:ok, state}` on success or
`{:error, exception}` on failure.

If an error is returned it will be logged and another
connection attempt will be made after a backoff interval.

This callback is called in the connection process.

# `disconnect`

```elixir
@callback disconnect(err :: Exception.t(), state :: any()) :: :ok
```

Disconnect from the database. Return `:ok`.

This callback is called from the connection process. The first argument is
either the exception from a `:disconnect` 3-tuple returned by a previous
callback or an exception generated by the connection process.

If the state is controlled by a client and it exits or times out while
processing a request, the last known state will be sent and the exception
will be a `DBConnection.ConnectionError`.

When the connection is stopped, this callback will be invoked from `terminate`.
The last known state will be sent and the exception will be a `DBConnection.ConnectionError`
containing the reason for the exit. To have the same happen on unexpected
shutdowns, you may trap exits from the `connect` callback.

# `handle_begin`

```elixir
@callback handle_begin(opts :: Keyword.t(), state :: any()) ::
  {:ok, result(), new_state :: any()}
  | {:ok, query(), result(), new_state :: any()}
  | {status(), new_state :: any()}
  | {:disconnect | :disconnect_and_retry, Exception.t(), new_state :: any()}
```

Handle the beginning of a transaction.

Return `{:ok, result, state}`/`{:ok, query, result, state}` to continue,
`{status, state}` to notify caller that the transaction can not begin due
to the transaction status `status`, or `{:disconnect | :disconnect_and_retry, exception, state}`
to error and disconnect (and optionally retry). If `{:ok, query, result, state}`
is returned, the query will be used to log the begin command. Otherwise,
it will be logged as `begin`.

A callback implementation should only return `status` if it
can determine the database's transaction status without side effect.

This callback is called in the client process.

# `handle_close`

```elixir
@callback handle_close(query(), opts :: Keyword.t(), state :: any()) ::
  {:ok, result(), new_state :: any()}
  | {:error | :disconnect | :disconnect_and_retry, Exception.t(),
     new_state :: any()}
```

Close a query prepared by `c:handle_prepare/3` with the database. Return
`{:ok, result, state}` on success and to continue,
`{:error, exception, state}` to return an error and continue, or
`{:disconnect | :disconnect_and_retry, exception, state}` to
error and disconnect (and optionally retry).

This callback is called in the client process.

# `handle_commit`

```elixir
@callback handle_commit(opts :: Keyword.t(), state :: any()) ::
  {:ok, result(), new_state :: any()}
  | {status(), new_state :: any()}
  | {:disconnect, Exception.t(), new_state :: any()}
```

Handle committing a transaction. Return `{:ok, result, state}` on successfully
committing transaction, `{status, state}` to notify caller that the
transaction can not commit due to the transaction status `status`,
or `{:disconnect, exception, state}` to error and disconnect.

A callback implementation should only return `status` if it
can determine the database's transaction status without side effect.

This callback is called in the client process.

# `handle_deallocate`

```elixir
@callback handle_deallocate(query(), cursor(), opts :: Keyword.t(), state :: any()) ::
  {:ok, result(), new_state :: any()}
  | {:error | :disconnect, Exception.t(), new_state :: any()}
```

Deallocate a cursor declared by `c:handle_declare/4` with the database. Return
`{:ok, result, state}` on success and to continue,
`{:error, exception, state}` to return an error and continue, or
`{:disconnect, exception, state}` to return an error and disconnect.

This callback is called in the client process.

# `handle_declare`

```elixir
@callback handle_declare(query(), params(), opts :: Keyword.t(), state :: any()) ::
  {:ok, query(), cursor(), new_state :: any()}
  | {:error | :disconnect, Exception.t(), new_state :: any()}
```

Declare a cursor using a query prepared by `c:handle_prepare/3`. Return
`{:ok, query, cursor, state}` to return altered query `query` and cursor
`cursor` for a stream and continue, `{:error, exception, state}` to return an
error and continue or `{:disconnect, exception, state}` to error and disconnect.

This callback is called in the client process.

# `handle_execute`

```elixir
@callback handle_execute(query(), params(), opts :: Keyword.t(), state :: any()) ::
  {:ok, query(), result(), new_state :: any()}
  | {:error | :disconnect | :disconnect_and_retry, Exception.t(),
     new_state :: any()}
```

Execute a query prepared by `c:handle_prepare/3`. Return
`{:ok, query, result, state}` to return altered query `query` and result
`result` and continue, `{:error, exception, state}` to return an error and
continue or `{:disconnect | :disconnect_and_retry, exception, state}` to
error and disconnect (and optionally retry).

This callback is called in the client process.

# `handle_fetch`

```elixir
@callback handle_fetch(query(), cursor(), opts :: Keyword.t(), state :: any()) ::
  {:cont | :halt, result(), new_state :: any()}
  | {:error | :disconnect, Exception.t(), new_state :: any()}
```

Fetch the next result from a cursor declared by `c:handle_declare/4`. Return
`{:cont, result, state}` to return the result `result` and continue using
cursor, `{:halt, result, state}` to return the result `result` and close the
cursor, `{:error, exception, state}` to return an error and close the
cursor, `{:disconnect, exception, state}` to return an error and disconnect.

This callback is called in the client process.

# `handle_prepare`

```elixir
@callback handle_prepare(query(), opts :: Keyword.t(), state :: any()) ::
  {:ok, query(), new_state :: any()}
  | {:error | :disconnect | :disconnect_and_retry, Exception.t(),
     new_state :: any()}
```

Prepare a query with the database. Return `{:ok, query, state}` where
`query` is a query to pass to `execute/4` or `close/3`,
`{:error, exception, state}` to return an error and continue or
`{:disconnect | :disconnect_and_retry, exception, state}` to error and disconnect
(and optionally retry).

This callback is intended for cases where the state of a connection is
needed to prepare a query and/or the query can be saved in the
database to call later.

This callback is called in the client process.

# `handle_rollback`

```elixir
@callback handle_rollback(opts :: Keyword.t(), state :: any()) ::
  {:ok, result(), new_state :: any()}
  | {status(), new_state :: any()}
  | {:disconnect, Exception.t(), new_state :: any()}
```

Handle rolling back a transaction. Return `{:ok, result, state}` on successfully
rolling back transaction, `{status, state}` to notify caller that the
transaction can not rollback due to the transaction status `status` or
`{:disconnect, exception, state}` to error and disconnect.

A callback implementation should only return `status` if it
can determine the database' transaction status without side effect.

This callback is called in the client and connection process.

# `handle_status`

```elixir
@callback handle_status(opts :: Keyword.t(), state :: any()) ::
  {status(), new_state :: any()}
  | {:disconnect | :disconnect_and_retry, Exception.t(), new_state :: any()}
```

Handle getting the transaction status. Return `{:idle, state}` if outside a
transaction, `{:transaction, state}` if inside a transaction,
`{:error, state}` if inside an aborted transaction, or
`{:disconnect | :disconnect_and_retry, exception, state}` to error and disconnect
(and optionally retry).

If the callback returns a `:disconnect` tuples then `status/2` will return
`:error`.

# `ping`

```elixir
@callback ping(state :: any()) ::
  {:ok, new_state :: any()} | {:disconnect, Exception.t(), new_state :: any()}
```

Called when the connection has been idle for a period of time. Return
`{:ok, state}` to continue or `{:disconnect, exception, state}` to
disconnect.

This callback is called if no callbacks have been called after the
idle timeout and a client process is not using the state. The idle
timeout can be configured by the `:idle_interval` and `:idle_limit`
options. This function can be called whether the connection is checked
in or checked out.

This callback is called in the connection process.

# `__using__`
*macro* 

Use `DBConnection` to set the behaviour.

# `available_connection_options`
*since 2.6.0* 

```elixir
@spec available_connection_options() :: [atom(), ...]
```

Returns the names of all possible options that you can pass to most functions
in this module.

This is mostly useful for library authors that base their library on top of
`DBConnection`, since they can use the return value of this function to perform
validation on options only passing down these options to DBConnection.

See also `t:connection_option/0`.

# `available_start_options`
*since 2.6.0* 

```elixir
@spec available_start_options() :: [atom(), ...]
```

Returns the names of all possible options that you can pass to `start_link/2`.

This is mostly useful for library authors that base their library on top of
`DBConnection`, since they can use the return value of this function to perform
validation on options only passing down these options to DBConnection.

See also `t:start_option/0`.

# `child_spec`

```elixir
@spec child_spec(module(), [start_option()] | Keyword.t()) :: :supervisor.child_spec()
```

Creates a supervisor child specification for a pool of connections.

See `start_link/2` for options.

# `close`

```elixir
@spec close(conn(), query(), [connection_option()] | Keyword.t()) ::
  {:ok, result()} | {:error, Exception.t()}
```

Close a prepared query on a database connection and return `{:ok, result}` on
success or `{:error, exception}` on error.

This function should be used to free resources held by the connection
process and/or the database server.

## Options

  * `:queue` - Whether to block waiting in an internal queue for the
  connection's state (boolean, default: `true`). See "Queue config" in
  `start_link/2` docs
  * `:timeout` - The maximum time that the caller is allowed to perform
  this operation (default: `15_000`)
  * `:deadline` - If set, overrides `:timeout` option and specifies absolute
  monotonic time in milliseconds by which caller must perform operation.
  See `System` module documentation for more information on monotonic time
  (default: `nil`)
  * `:log` - A function to log information about a call, either
  a 1-arity fun, `{module, function, args}` with `t:DBConnection.LogEntry.t/0`
  prepended to `args` or `nil`. See `DBConnection.LogEntry` (default: `nil`)

The pool and connection module may support other options. All options
are passed to `c:handle_close/3`.

See `prepare/3`.

# `close!`

```elixir
@spec close!(conn(), query(), [connection_option()] | Keyword.t()) :: result()
```

Close a prepared query on a database connection and return the result. Raises
an exception on error.

See `close/3`.

# `connection_module`

```elixir
@spec connection_module(conn()) :: {:ok, module()} | :error
```

Returns the connection module used by the given connection pool.

When given a process that is not a connection pool, returns an `:error`.

# `disconnect_all`

```elixir
@spec disconnect_all(conn(), non_neg_integer(), [connection_option()] | Keyword.t()) ::
  :ok
```

Forces all connections in the pool to disconnect within the given interval
in milliseconds.

Once this function is called, the pool will disconnect all of its connections
as they are checked in or as they are pinged. Checked in and idle connections
will be randomly disconnected within the given time interval.

If the connection has a backoff configured (which is the case by default),
disconnecting means an attempt at a new connection will be done immediately
after, without starting a new process for each connection. However, if backoff
has been disabled, the connection process will terminate. In such cases,
disconnecting all connections may cause the pool supervisor to restart
depending on the max_restarts/max_seconds configuration of the pool,
so you will want to set those carefully.

# `execute`

```elixir
@spec execute(conn(), query(), params(), [connection_option()] | Keyword.t()) ::
  {:ok, query(), result()} | {:error, Exception.t()}
```

Execute a prepared query with a database connection and return
`{:ok, query, result}` on success or `{:error, exception}` if there was an error.

If the query is not prepared on the connection an attempt may be made to
prepare it and then execute again.

### Options

  * `:queue` - Whether to block waiting in an internal queue for the
  connection's state (boolean, default: `true`). See "Queue config" in
  `start_link/2` docs
  * `:timeout` - The maximum time that the caller is allowed to perform
  this operation (default: `15_000`)
  * `:deadline` - If set, overrides `:timeout` option and specifies absolute
  monotonic time in milliseconds by which caller must perform operation.
  See `System` module documentation for more information on monotonic time
  (default: `nil`)
  * `:log` - A function to log information about a call, either
  a 1-arity fun, `{module, function, args}` with `t:DBConnection.LogEntry.t/0`
  prepended to `args` or `nil`. See `DBConnection.LogEntry` (default: `nil`)

The pool and connection module may support other options. All options
are passed to `handle_execute/4`.

See `prepare/3`.

# `execute!`

```elixir
@spec execute!(conn(), query(), params(), [connection_option()] | Keyword.t()) ::
  result()
```

Execute a prepared query with a database connection and return the
result. Raises an exception on error.

See `execute/4`

# `get_connection_metrics`

```elixir
@spec get_connection_metrics(conn(), Keyword.t()) :: [
  DBConnection.Pool.connection_metrics()
]
```

Returns connection metrics as a list in the shape of:

    [%{
      source: {:pool | :proxy, pid()},
      ready_conn_count: non_neg_integer(),
      checkout_queue_length: non_neg_integer()
    }]

# `prepare`

```elixir
@spec prepare(conn(), query(), [connection_option()] | Keyword.t()) ::
  {:ok, query()} | {:error, Exception.t()}
```

Prepare a query with a database connection for later execution.

It returns `{:ok, query}` on success or `{:error, exception}` if there was
an error.

The returned `query` can then be passed to `execute/4` and/or `close/3`

### Options

  * `:queue` - Whether to block waiting in an internal queue for the
  connection's state (boolean, default: `true`). See "Queue config" in
  `start_link/2` docs
  * `:timeout` - The maximum time that the caller is allowed to perform
  this operation (default: `15_000`)
  * `:deadline` - If set, overrides `:timeout` option and specifies absolute
  monotonic time in milliseconds by which caller must perform operation.
  See `System` module documentation for more information on monotonic time
  (default: `nil`)
  * `:log` - A function to log information about a call, either
  a 1-arity fun, `{module, function, args}` with `t:DBConnection.LogEntry.t/0`
  prepended to `args` or `nil`. See `DBConnection.LogEntry` (default: `nil`)

The pool and connection module may support other options. All options
are passed to `c:handle_prepare/3`.

### Example

    DBConnection.transaction(pool, fn conn ->
      query = %Query{statement: "SELECT * FROM table"}
      query = DBConnection.prepare!(conn, query)
      try do
        DBConnection.execute!(conn, query, [])
      after
        DBConnection.close(conn, query)
      end
    end)

# `prepare!`

```elixir
@spec prepare!(conn(), query(), [connection_option()] | Keyword.t()) :: query()
```

Prepare a query with a database connection and return the prepared
query. An exception is raised on error.

See `prepare/3`.

# `prepare_execute`

```elixir
@spec prepare_execute(conn(), query(), params(), [connection_option()] | Keyword.t()) ::
  {:ok, query(), result()} | {:error, Exception.t()}
```

Prepare a query and execute it with a database connection and return both the
prepared query and the result, `{:ok, query, result}` on success or
`{:error, exception}` if there was an error.

The returned `query` can be passed to `execute/4` and `close/3`.

### Options

  * `:queue` - Whether to block waiting in an internal queue for the
  connection's state (boolean, default: `true`). See "Queue config" in
  `start_link/2` docs
  * `:timeout` - The maximum time that the caller is allowed to perform
  this operation (default: `15_000`)
  * `:deadline` - If set, overrides `:timeout` option and specifies absolute
  monotonic time in milliseconds by which caller must perform operation.
  See `System` module documentation for more information on monotonic time
  (default: `nil`)
  * `:log` - A function to log information about a call, either
  a 1-arity fun, `{module, function, args}` with `t:DBConnection.LogEntry.t/0`
  prepended to `args` or `nil`. See `DBConnection.LogEntry` (default: `nil`)

### Example

    query                = %Query{statement: "SELECT id FROM table WHERE id=$1"}
    {:ok, query, result} = DBConnection.prepare_execute(conn, query, [1])
    {:ok, result2}       = DBConnection.execute(conn, query, [2])
    :ok                  = DBConnection.close(conn, query)

# `prepare_execute!`

Prepare a query and execute it with a database connection and return both the
prepared query and result. An exception is raised on error.

See `prepare_execute/4`.

# `prepare_stream`

```elixir
@spec prepare_stream(t(), query(), params(), [connection_option()] | Keyword.t()) ::
  DBConnection.PrepareStream.t()
```

Create a stream that will prepare a query, execute it and stream results
using a cursor.

### Options

  * `:queue` - Whether to block waiting in an internal queue for the
  connection's state (boolean, default: `true`). See "Queue config" in
  `start_link/2` docs
  * `:timeout` - The maximum time that the caller is allowed to perform
  this operation (default: `15_000`)
  * `:deadline` - If set, overrides `:timeout` option and specifies absolute
  monotonic time in milliseconds by which caller must perform operation.
  See `System` module documentation for more information on monotonic time
  (default: `nil`)
  * `:log` - A function to log information about a call, either
  a 1-arity fun, `{module, function, args}` with `t:DBConnection.LogEntry.t/0`
  prepended to `args` or `nil`. See `DBConnection.LogEntry` (default: `nil`)

The pool and connection module may support other options. All options
are passed to `c:handle_prepare/3`, `c:handle_close/3`, `c:handle_declare/4`,
and `c:handle_deallocate/4`.

### Example

    {:ok, results} = DBConnection.transaction(conn, fn conn ->
      query = %Query{statement: "SELECT id FROM table"}
      stream = DBConnection.prepare_stream(conn, query, [])
      Enum.to_list(stream)
    end)

# `reduce`

Reduces a previously built stream or prepared stream.

# `rollback`

```elixir
@spec rollback(t(), reason :: any()) :: no_return()
```

Rollback a database transaction and release lock on connection.

When inside of a `transaction/3` call does a non-local return, using a
`throw/1` to cause the transaction to enter a failed state and the
`transaction/3` call returns `{:error, reason}`. If `transaction/3` calls are
nested the connection is marked as failed until the outermost transaction call
does the database rollback.

### Example

    {:error, :oops} = DBConnection.transaction(pool, fun(conn) ->
      DBConnection.rollback(conn, :oops)
    end)

# `run`

```elixir
@spec run(conn(), (t() -&gt; result), [connection_option()] | Keyword.t()) :: result
when result: var
```

Acquire a lock on a connection and run a series of requests on it.

The return value of this function is the return value of `fun`.

To use the locked connection call the request with the connection
reference passed as the single argument to the `fun`. If the
connection disconnects all future calls using that connection
reference will fail.

`run/3` and `transaction/3` can be nested multiple times but a
`transaction/3` call inside another `transaction/3` will be treated
the same as `run/3`.

> #### Checkout failures {: .warning}
>
> If we cannot check out a connection from the pool, this function raises a
> `DBConnection.ConnectionError` exception.
> If you want to handle these cases, you should rescue
> `DBConnection.ConnectionError` exceptions when using `run/3`.

## Options

  * `:queue` - Whether to block waiting in an internal queue for the
  connection's state (boolean, default: `true`). See "Queue config" in
  `start_link/2` docs
  * `:timeout` - The maximum time that the caller is allowed to perform
  this operation (default: `15_000`)
  * `:deadline` - If set, overrides `:timeout` option and specifies absolute
  monotonic time in milliseconds by which caller must perform operation.
  See `System` module documentation for more information on monotonic time
  (default: `nil`)

The pool may support other options.

## Example

    {:ok, res} = DBConnection.run(conn, fn conn ->
      DBConnection.execute!(conn, query, [])
    end)

# `start_link`

```elixir
@spec start_link(module(), [start_option()] | Keyword.t()) :: GenServer.on_start()
```

Starts and links to a database connection process.

By default the `DBConnection` starts a pool with a single connection.
The size of the pool can be increased with `:pool_size`. A separate
pool can be given with the `:pool` option.

### Options

  * `:after_connect` - A function to run on connect using `run/3`, either
    a 1-arity fun, `{module, function, args}` with `t:DBConnection.t/0` prepended
    to `args` or `nil` (default: `nil`)

  * `:after_connect_timeout` - The maximum time allowed to perform
    function specified by `:after_connect` option (default: `15_000`)

  * `:backoff_min` - The minimum backoff interval (default: `1_000`)

  * `:backoff_max` - The maximum backoff interval (default: `30_000`)

  * `:backoff_type` - The backoff strategy, `:stop` for no backoff and
    to stop, `:exp` for exponential, `:rand` for random and `:rand_exp` for
    random exponential (default: `:rand_exp`)

  * `:checkout_retries` - The number of times to checkout a new connection
    whenever the operation fails because the database disconnected. Note
    not all operations can be retried and each adapter specifies which
    operations are safe to retry

  * `:configure` - A function to run before every connect attempt to
    dynamically configure the options, either a 1-arity fun,
    `{module, function, args}` or `nil`. This function is called *in the
    connection process*. For more details, see
    [Connection Configuration Callback](#start_link/2-connection-configuration-callback)

  * `:connection_listeners` - A list of process destinations to send
    notification messages whenever a connection is connected or disconnected.
    See "Connection listeners" below

  * `:idle_interval` - Controls the frequency we check for idle connections
    in the pool. We then notify each idle connection to ping the database.
    In practice, the ping happens within `idle_interval <= ping < 2 * idle_interval`.
    Defaults to 1000ms.

  * `:idle_limit` - The number of connections to ping on each `:idle_interval`.
    Defaults to the pool size (all connections).

  * `:max_restarts` and `:max_seconds` - Configures the `:max_restarts` and
    `:max_seconds` for the connection pool supervisor (see the `Supervisor` docs).
    Typically speaking the connection process doesn't terminate, except due to
    faults in DBConnection. However, if backoff has been disabled, then they
    also terminate whenever a connection is disconnected (for instance, due to
    client or server errors)

  * `:max_lifetime` - The number of ms the connection is allowed to live.
    It is a range so you can jitter/spread disconnections over some time period.
    For example, to have a max lifetime between 8 and 9 minutes, you can set it
    to `480_000..540_000`. Because the timer is started *after* the connection
    to the database is established, the connection may live for slightly longer.
    If the connection is idle, the worst case wait is of
    `540_000 + 2 * idle_interval`. If the connection is in use, it may last as
    long as the connection is checked out over the max period. Default is `nil`.
    Enabling this option requires a backoff to be set, so connections can properly
    reconnect.

  * `:name` - A name to register the started process (see the `:name` option
    in `GenServer.start_link/3`)

  * `:pool` - Chooses the pool to be started (default: `DBConnection.ConnectionPool`).
    See ["Connection pools"](#module-connection-pools).

  * `:pool_size` - Chooses the size of the pool. Must be greater or equal to 1. (default: `1`)

  * `:queue_target` and `:queue_interval` - See "Queue config" below

  * `:show_sensitive_data_on_connection_error` - By default, `DBConnection`
    hides all information during connection errors to avoid leaking credentials
    or other sensitive information. You can set this option if you wish to
    see complete errors and stacktraces during connection errors

### Example

    {:ok, conn} = DBConnection.start_link(mod, [idle_interval: 5_000])

## Queue config

Handling requests is done through a queue. When DBConnection is
started, there are two relevant options to control the queue:

  * `:queue_target` in milliseconds, defaults to 50ms
  * `:queue_interval` in milliseconds, defaults to 2000ms

Our goal is to wait at most `:queue_target` for a connection.
If all connections checked out during a `:queue_interval` takes
more than `:queue_target`, then we double the `:queue_target`.
If checking out connections take longer than the new target,
then we start dropping messages.

For example, by default our target is 50ms. If all connections
checkouts take longer than 50ms for a whole second, we double
the target to 100ms and we start dropping messages if the
time to checkout goes above the new limit.

This allows us to better plan for overloads as we can refuse
requests before they are sent to the database, which would
otherwise increase the burden on the database, making the
overload worse.

## Connection listeners

The `:connection_listeners` option allows one or more processes to be notified
whenever a connection is connected or disconnected. A listener may be a remote
or local PID, a locally registered name, or a tuple in the form of
`{registered_name, node}` for a registered name at another node.

Each listener process may receive the following messages where `pid`
identifies the connection process:

  * `{:connected, pid}`
  * `{:disconnected, pid}`

If the value of `:connection_listeners` is a tuple like `{listeners, term}`, then
the messages are these instead:

  * `{:connected, pid, term}`
  * `{:disconnected, pid, term}`

Note the disconnected messages are not guaranteed to be delivered if the
`pid` for connection crashes. So it is recommended to monitor the connected
`pid` if you want to track all disconnections.

Here is an example of a `:connection_listener` implementation:

    defmodule DBConnectionListener do
      use GenServer

      def start_link(opts) do
        GenServer.start_link(__MODULE__, [], opts)
      end

      def get_notifications(pid) do
        GenServer.call(pid, :read_state)
      end

      @impl true
      def init(stack) when is_list(stack) do
        {:ok, stack}
      end

      @impl true
      def handle_call(:read_state, _from, state) do
        {:reply, state, state}
      end

      @impl true
      def handle_info({:connected, _pid} = msg, state) do
        {:noreply, [msg | state]}
      end

      @impl true
      def handle_info({_other_states, _pid} = msg, state) do
        {:noreply, [msg | state]}
      end
    end

You can then start it, pass the PID in the `connection_listeners`
option on `DBConnection.start_link/2` and, when needed, can query the notifications:

    {:ok, pid} = DBConnectionListener.start_link([])
    {:ok, _conn} = DBConnection.start_link(SomeModule, [connection_listeners: [pid]])
    notifications = DBConnectionListener.get_notifications(pid)

### Tagging messages

If you pass `{listeners, tag}` as an option, you can specify an arbitrary `tag` term that will
be sent alongside all `:connected`/`:disconnected` messages. This is useful if you
want to track information about the pool a connection belongs to or any other information.

This feature is available since v2.6.0. Before this version `:connection_listeners` only
accepted a list of listener processes.

## Connection Configuration Callback

The `:configure` function will be called before each individual connection to the
database is made. It receives all of the options provided to `start_link/2` as well
as an additional generated value named `:pool_index`. The returned value will be
passed as the options into the appropriate `:connect` callback. This provides a way
for the user to dynamically configure the connection options.

`:pool_index` is an integer in `1..pool_size` that represents the current connection's
place in the enumeration of all of the pool's connections. It can be used, for example,
to configure a unique database per connection when asynchronous tests cannot be performed
on a single database.

The allowed callbacks are:

  * A 1-arity function that receives the options from `start_link/2` as well as
    `:pool_index`
  * `{module, function, args}` where the options from `start_link/2` as well as
    `:pool_index` are prepended to `args` before the function is called
  * `nil` if you do not want to modify the existing options

## Telemetry

A `[:db_connection, :connection_error]` event is published whenever a
connection checkout receives a `%DBConnection.ConnectionError{}`.
This event is emitted from the process that attempts to checkout the
connection.

Measurements:

  * `:count` - A fixed-value measurement which always measures 1.

Metadata

  * `:error` - The `DBConnection.ConnectionError` struct which triggered the event.

  * `:opts` - All options given to the pool operation

You may also consume `[:db_connection, :connected]` and `[:db_connection, :disconnected]`
events by spawning a `DBConnection.TelemetryListener` process that subscribes to the pool
and emits them in a robust manner.

# `status`

```elixir
@spec status(conn(), opts :: Keyword.t()) :: status()
```

Return the transaction status of a connection.

The callback implementation should return the transaction status according to
the database, and not make assumptions based on client-side state.

This function will raise a `DBConnection.ConnectionError` when called inside a
deprecated `transaction/3`.

### Options

See module documentation. The pool and connection module may support other
options. All options are passed to `c:handle_status/2`.

### Example

    # outside of the transaction, the status is `:idle`
    DBConnection.status(conn) #=> :idle

    DBConnection.transaction(conn, fn conn ->
      DBConnection.status(conn) #=> :transaction

      # run a query that will cause the transaction to rollback, e.g.
      # uniqueness constraint violation
      DBConnection.execute(conn, bad_query, [])

      DBConnection.status(conn) #=> :error
    end)

    DBConnection.status(conn) #=> :idle

# `stream`

```elixir
@spec stream(t(), query(), params(), [connection_option()] | Keyword.t()) ::
  DBConnection.Stream.t()
```

Create a stream that will execute a prepared query and stream results using a
cursor.

### Options

  * `:queue` - Whether to block waiting in an internal queue for the
  connection's state (boolean, default: `true`). See "Queue config" in
  `start_link/2` docs
  * `:timeout` - The maximum time that the caller is allowed to perform
  this operation (default: `15_000`)
  * `:deadline` - If set, overrides `:timeout` option and specifies absolute
  monotonic time in milliseconds by which caller must perform operation.
  See `System` module documentation for more information on monotonic time
  (default: `nil`)
  * `:log` - A function to log information about a call, either
  a 1-arity fun, `{module, function, args}` with `t:DBConnection.LogEntry.t/0`
  prepended to `args` or `nil`. See `DBConnection.LogEntry` (default: `nil`)

The pool and connection module may support other options. All options
are passed to `c:handle_declare/4` and `c:handle_deallocate/4`.

### Example

    DBConnection.transaction(pool, fn conn ->
      query = %Query{statement: "SELECT id FROM table"}
      query = DBConnection.prepare!(conn, query)
      try do
        stream = DBConnection.stream(conn, query, [])
        Enum.to_list(stream)
      after
        # Make sure query is closed!
        DBConnection.close(conn, query)
      end
    end)

# `transaction`

```elixir
@spec transaction(conn(), (t() -&gt; result), [connection_option()] | Keyword.t()) ::
  {:ok, result} | {:error, reason :: any()}
when result: var
```

Acquire a lock on a connection and run a series of requests inside a
transaction. The result of the transaction fun is return inside an `:ok`
tuple: `{:ok, result}`.

To use the locked connection call the request with the connection
reference passed as the single argument to the `fun`. If the
connection disconnects all future calls using that connection
reference will fail.

`run/3` and `transaction/3` can be nested multiple times. If a transaction is
rolled back or a nested transaction `fun` raises the transaction is marked as
failed. All calls except `run/3`, `transaction/3`, `rollback/2`, `close/3` and
`close!/3` will raise an exception inside a failed transaction until the outer
transaction call returns. All `transaction/3` calls will return
`{:error, :rollback}` if the transaction failed or connection closed and
`rollback/2` is not called for that `transaction/3`.

### Options

  * `:queue` - Whether to block waiting in an internal queue for the
  connection's state (boolean, default: `true`). See "Queue config" in
  `start_link/2` docs
  * `:timeout` - The maximum time that the caller is allowed to perform
  this operation (default: `15_000`)
  * `:deadline` - If set, overrides `:timeout` option and specifies absolute
  monotonic time in milliseconds by which caller must perform operation.
  See `System` module documentation for more information on monotonic time
  (default: `nil`)
  * `:log` - A function to log information about begin, commit and rollback
  calls made as part of the transaction, either a 1-arity fun,
  `{module, function, args}` with `t:DBConnection.LogEntry.t/0` prepended to
  `args` or `nil`. See `DBConnection.LogEntry` (default: `nil`)

The pool and connection module may support other options. All options
are passed to `c:handle_begin/2`, `c:handle_commit/2` and
`c:handle_rollback/2`.

### Example

    {:ok, res} = DBConnection.transaction(conn, fn conn ->
      DBConnection.execute!(conn, query, [])
    end)

---

*Consult [api-reference.md](api-reference.md) for complete listing*
