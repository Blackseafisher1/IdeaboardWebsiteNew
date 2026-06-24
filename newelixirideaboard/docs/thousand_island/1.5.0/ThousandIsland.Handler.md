# `ThousandIsland.Handler`
[🔗](https://github.com/mtrudel/thousand_island/blob/main/lib/thousand_island/handler.ex#L1)

`ThousandIsland.Handler` defines the behaviour required of the application layer of a Thousand Island server. When starting a
Thousand Island server, you must pass the name of a module implementing this behaviour as the `handler_module` parameter.
Thousand Island will then use the specified module to handle each connection that is made to the server.

The lifecycle of a Handler instance is as follows:

1. After a client connection to a Thousand Island server is made, Thousand Island will complete the initial setup of the
connection (performing a TLS handshake, for example), and then call `c:handle_connection/2`.

2. A handler implementation may choose to process a client connection within the `c:handle_connection/2` callback by
calling functions against the passed `ThousandIsland.Socket`. In many cases, this may be all that may be required of
an implementation & the value `{:close, state}` can be returned which will cause Thousand Island to close the connection
to the client.

3. In cases where the server wishes to keep the connection open and wait for subsequent requests from the client on the
same socket, it may elect to return `{:continue, state}`. This will cause Thousand Island to wait for client data
asynchronously; `c:handle_data/3` will be invoked when the client sends more data.

4. In the meantime, the process which is hosting the connection is idle & able to receive messages sent from elsewhere in your
application as needed. The implementation included in the `use ThousandIsland.Handler` macro uses a `GenServer` structure,
so you may implement such behaviour via standard `GenServer` patterns. Note that in these cases that state is provided (and
must be returned) in a `{socket, state}` format, where the second tuple is the same state value that is passed to the various `handle_*` callbacks
defined on this behaviour. This is illustrated in the following example:

    ```elixir
    defmodule ExampleHandler do
      use ThousandIsland.Handler

      # ...handle_data and other Handler callbacks

      @impl GenServer
      def handle_call(msg, from, {socket, state}) do
        # Do whatever you'd like with msg & from
        {:reply, :ok, {socket, state}}
      end

      @impl GenServer
      def handle_cast(msg, {socket, state}) do
        # Do whatever you'd like with msg
        {:noreply, {socket, state}}
      end

      @impl GenServer
      def handle_info(msg, {socket, state}) do
        # Do whatever you'd like with msg
        {:noreply, {socket, state}}
      end
    end
    ```

Note that previous versions of Thousand Island required you to return the value of
socket.read_timeout as the third element in the callback tuple. As of Thousand Island 1.5.0,
network-related timeouts are handled entirely internally and as such this option retains its
OTP-native semantic of representing an option timeout between *any* message received by this
Handler, either network or local. In short, unless you specifically care about timeouts between
local mailbox messages, you can safely omit a timeout from your return tuples and the network
facing aspects of Thousand Island will continue to have correct timeout behaviour.

It is fully supported to intermix synchronous `ThousandIsland.Socket.recv` calls with async return values from `c:handle_connection/2`
and `c:handle_data/3` callbacks, however it is critical to note that the timeouts between the two
are completely separate. The `read_timeout` parameter only applies to reads
as observed by `handle_data/3` callbacks, and only applies to the duration *between*
ThousandIsland.Handler callbacks.

# Example

A simple example of a Hello World server is as follows:

```elixir
defmodule HelloWorld do
  use ThousandIsland.Handler

  @impl ThousandIsland.Handler
  def handle_connection(socket, state) do
    ThousandIsland.Socket.send(socket, "Hello, World")
    {:close, state}
  end
end
```

Another example of a server that echoes back all data sent to it is as follows:

```elixir
defmodule Echo do
  use ThousandIsland.Handler

  @impl ThousandIsland.Handler
  def handle_data(data, socket, state) do
    ThousandIsland.Socket.send(socket, data)
    {:continue, state}
  end
end
```

Note that in this example there is no `c:handle_connection/2` callback defined. The default implementation of this
callback will simply return `{:continue, state}`, which is appropriate for cases where the client is the first
party to communicate.

Another example of a server which can send and receive messages asynchronously is as follows:

```elixir
defmodule Messenger do
  use ThousandIsland.Handler

  @impl ThousandIsland.Handler
  def handle_data(msg, _socket, state) do
    IO.puts(msg)
    {:continue, state}
  end

  def handle_info({:send, msg}, {socket, state}) do
    ThousandIsland.Socket.send(socket, msg)
    {:noreply, {socket, state}}
  end
end
```

Note that in this example we make use of the fact that the handler process is really just a GenServer to send it messages
which are able to make use of the underlying socket. This allows for bidirectional sending and receiving of messages in
an asynchronous manner.

You can pass options to the default handler underlying `GenServer` by passing a `genserver_options` key to `ThousandIsland.start_link/1`
containing `t:GenServer.options/0` to be passed to the last argument of `GenServer.start_link/3`.

Please note that you should not pass the `name` `t:GenServer.option/0`. If you need to register handler processes for
later lookup and use, you should perform process registration in `handle_connection/2`, ensuring the handler process is
registered only after the underlying connection is established and you have access to the connection socket and metadata
via `ThousandIsland.Socket.peername/1`.

For example, using a custom process registry via `Registry`:

```elixir

defmodule Messenger do
  use ThousandIsland.Handler

  @impl ThousandIsland.Handler
  def handle_connection(socket, state) do
    {:ok, {ip, port}} = ThousandIsland.Socket.peername(socket)
    {:ok, _pid} = Registry.register(MessengerRegistry, {state[:my_key], address}, nil)
    {:continue, state}
  end

  @impl ThousandIsland.Handler
  def handle_data(data, socket, state) do
    ThousandIsland.Socket.send(socket, data)
    {:continue, state}
  end
end
```

This example assumes you have started a `Registry` and registered it under the name `MessengerRegistry`.

# When Handler Isn't Enough

The `use ThousandIsland.Handler` implementation should be flexible enough to power just about any handler, however if
this should not be the case for you, there is an escape hatch available. If you require more flexibility than the
`ThousandIsland.Handler` behaviour provides, you are free to specify any module which implements `start_link/1` as the
`handler_module` parameter. The process of getting from this new process to a ready-to-use socket is somewhat
delicate, however. The steps required are as follows:

1. Thousand Island calls `start_link/1` on the configured `handler_module`, passing in a tuple
consisting of the configured handler and genserver opts. This function is expected to return a
conventional `GenServer.on_start()` style tuple. Note that this newly created process is not
passed the connection socket immediately.
2. The raw `t:ThousandIsland.Transport.socket()` socket will be passed to the new process via a
message of the form `{:thousand_island_ready, raw_socket, handler_config, acceptor_span,
start_time}`.
3. Your implementation must turn this into a `to:ThousandIsland.Socket.t()` socket by using the
`ThousandIsland.Socket.new/3` call.
4. Your implementation must then call `ThousandIsland.Socket.handshake/1` with the socket as the
sole argument in order to finalize the setup of the socket.
5. The socket is now ready to use.

In addition to this process, there are several other considerations to be aware of:

* The underlying socket is closed automatically when the handler process ends.

* Handler processes should have a restart strategy of `:temporary` to ensure that Thousand Island does not attempt to
restart crashed handlers.

* Handler processes should trap exit if possible so that existing connections can be given a chance to cleanly shut
down when shutting down a Thousand Island server instance.

* Some of the `:connection` family of telemetry span events are emitted by the
`ThousandIsland.Handler` implementation. If you use your own implementation in its place it is
likely that such spans will not behave as expected.

# `handler_result`

```elixir
@type handler_result() ::
  {:continue, state :: term()}
  | {:continue, state :: term(), timeout_options() | {:continue, term()}}
  | {:switch_transport, {module(), upgrade_opts :: [term()]}, state :: term()}
  | {:switch_transport, {module(), upgrade_opts :: [term()]}, state :: term(),
     timeout_options() | {:continue, term()}}
  | {:close, state :: term()}
  | {:error, term(), state :: term()}
```

The value returned by `c:handle_connection/2` and `c:handle_data/3`

# `timeout_options`

```elixir
@type timeout_options() :: timeout() | {:persistent, timeout()}
```

The possible ways to indicate a timeout when returning values to Thousand Island

# `handle_close`
*optional* 

```elixir
@callback handle_close(socket :: ThousandIsland.Socket.t(), state :: term()) :: term()
```

This callback is called when the underlying socket is closed by the remote end; it should perform any cleanup required
as it is the last callback called before the process backing this connection is terminated. The underlying socket
has already been closed by the time this callback is called. The return value is ignored.

This callback is not called if the connection is explicitly closed via `ThousandIsland.Socket.close/1`, however it
will be called in cases where `handle_connection/2` or `handle_data/3` return a `{:close, state}` tuple.

# `handle_connection`
*optional* 

```elixir
@callback handle_connection(socket :: ThousandIsland.Socket.t(), state :: term()) ::
  handler_result()
```

This callback is called shortly after a client connection has been made, immediately after the socket handshake process has
completed. It is called with the server's configured `handler_options` value as initial state. Handlers may choose to
interact synchronously with the socket in this callback via calls to various `ThousandIsland.Socket` functions.

The value returned by this callback causes Thousand Island to proceed in one of several ways:

* Returning `{:close, state}` will cause Thousand Island to close the socket & call the `c:handle_close/2` callback to
allow final cleanup to be done.
* Returning `{:continue, state}` will cause Thousand Island to switch the socket to an asynchronous mode. When the
client subsequently sends data (or if there is already unread data waiting from the client), Thousand Island will call
`c:handle_data/3` to allow this data to be processed.
* Returning `{:continue, state, timeout}` is identical to the previous case with the
addition of a timeout. If `timeout` milliseconds passes with no data being received or messages
being sent to the process, the socket will be closed and `c:handle_timeout/2` will be called.
Note that this timeout is not persistent; it applies only to the interval until the next message
is received. In order to set a persistent timeout for all future messages (essentially
overwriting the value of `read_timeout` that was set at server startup), a value of
`{:persistent, timeout}` may be returned.
* Returning `{:continue, state, {:continue, continue}}` is identical to the previous case with the
addition of a `c:GenServer.handle_continue/2` callback being made immediately after, in line with
similar behaviour on `GenServer` callbacks.
* Returning `{:switch_transport, {module, opts}, state}` will cause Thousand Island to try switching the transport of the
current socket. The `module` should be an Elixir module that implements the `ThousandIsland.Transport` behaviour.
Thousand Island will call `c:ThousandIsland.Transport.upgrade/2` for the given module to upgrade the transport in-place.
After a successful upgrade Thousand Island will switch the socket to an asynchronous mode, as if `{:continue, state}`
was returned. As with `:continue` return values, there are also timeout-specifying variants of
this return value.
* Returning `{:error, reason, state}` will cause Thousand Island to close the socket & call the `c:handle_error/3` callback to
allow final cleanup to be done.

# `handle_data`
*optional* 

```elixir
@callback handle_data(
  data :: binary(),
  socket :: ThousandIsland.Socket.t(),
  state :: term()
) ::
  handler_result()
```

This callback is called whenever client data is received after `c:handle_connection/2` or `c:handle_data/3` have returned an
`{:continue, state}` tuple. The data received is passed as the first argument, and handlers may choose to interact
synchronously with the socket in this callback via calls to various `ThousandIsland.Socket` functions.

The value returned by this callback causes Thousand Island to proceed in one of several ways:

* Returning `{:close, state}` will cause Thousand Island to close the socket & call the `c:handle_close/2` callback to
allow final cleanup to be done.
* Returning `{:continue, state}` will cause Thousand Island to switch the socket to an asynchronous mode. When the
client subsequently sends data (or if there is already unread data waiting from the client), Thousand Island will call
`c:handle_data/3` to allow this data to be processed.
* Returning `{:continue, state, timeout}` is identical to the previous case with the
addition of a timeout. If `timeout` milliseconds passes with no data being received or messages
being sent to the process, the socket will be closed and `c:handle_timeout/2` will be called.
Note that this timeout is not persistent; it applies only to the interval until the next message
is received. In order to set a persistent timeout for all future messages (essentially
overwriting the value of `read_timeout` that was set at server startup), a value of
`{:persistent, timeout}` may be returned.
* Returning `{:continue, state, {:continue, continue}}` is identical to the previous case with the
addition of a `c:GenServer.handle_continue/2` callback being made immediately after, in line with
similar behaviour on `GenServer` callbacks.
* Returning `{:error, reason, state}` will cause Thousand Island to close the socket & call the `c:handle_error/3` callback to
allow final cleanup to be done.

# `handle_error`
*optional* 

```elixir
@callback handle_error(
  reason :: any(),
  socket :: ThousandIsland.Socket.t(),
  state :: term()
) :: term()
```

This callback is called when the underlying socket encounters an error; it should perform any cleanup required
as it is the last callback called before the process backing this connection is terminated. The underlying socket
has already been closed by the time this callback is called. The return value is ignored.

In addition to socket level errors, this callback is also called in cases where `handle_connection/2` or `handle_data/3`
return a `{:error, reason, state}` tuple, or when connection handshaking (typically TLS
negotiation) fails.

# `handle_shutdown`
*optional* 

```elixir
@callback handle_shutdown(socket :: ThousandIsland.Socket.t(), state :: term()) :: term()
```

This callback is called when the server process itself is being shut down; it should perform any cleanup required
as it is the last callback called before the process backing this connection is terminated. The underlying socket
has NOT been closed by the time this callback is called. The return value is ignored.

This callback is only called when the shutdown reason is `:normal`, and is subject to the same caveats described
in `c:GenServer.terminate/2`.

# `handle_timeout`
*optional* 

```elixir
@callback handle_timeout(socket :: ThousandIsland.Socket.t(), state :: term()) :: term()
```

This callback is called when a handler process has gone more than `timeout` ms without receiving
remote data from the client. The value used for `timeout` defaults to the `read_timeout` value
specified at server startup, and may be overridden on a one-shot or persistent basis based on
values returned from `c:handle_connection/2` or `c:handle_data/3` calls. Note that it is NOT
called on explicit `ThousandIsland.Socket.recv/3` calls as they have their own timeout
semantics. This callback is triggered only by absence of incoming client data; local messages
sent to the handler process do not reset the clock, and any GenServer-native timeouts will NOT
cause this callback to be called (if you wish to handle GenServer-native timeouts, you can do so
using the [upstream GenServer pattern](https://hexdocs.pm/elixir/GenServer.html#module-timeouts)
for this purpose). The underlying socket has NOT been closed by the time this callback is
called. The return value is ignored.

# `genserver_impl`

# `handler_impl`

---

*Consult [api-reference.md](api-reference.md) for complete listing*
