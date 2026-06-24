# `Bandit.Trace`
[🔗](https://github.com/mtrudel/bandit/blob/main/lib/bandit/trace.ex#L1)

**THIS MODULE IS EXPERIMENTAL AND SUBJECT TO CHANGE**

Helper functions to provide visibility into runtime errors within a running Bandit instance

Can be used within an IEx session attached to a running Bandit instance, as follows:

```
iex> Bandit.Trace.start_tracing()
... # Wait for traces to show up whenever exceptions are raised
iex> Bandit.Trace.stop_tracing()
```

It can also be started within your application by adding `Bandit.Trace` to your process tree.

`Bandit.Trace` will emit a trace on every exception that Bandit sees (both those emitted from
within your Plug as well as internal ones due to protocol violations and the like). These traces
consist of a complete dump of all telemetry events that occur in the offending request's parent
connection.

Tracing imposes a modest but non-zero load; it *should* be safe to run in most production
environments, but it is not intended to run on an ongoing basis.

By default, `Bandit.Trace` maintains a FIFO log of the last 10000 telemetry events that Bandit
has emitted. Events which correlate to the parent connection which have been evicted from this
queue will not be included in this output.

**WARNING** The emitted logs contains a *complete* copy of your request's Plug data, as well as *all* data
sent and received on all requests which are contained in the output. It is therefore of the utmost
importance that you carefully redact the output before sharing it publicly.

# `child_spec`

Returns a specification to start this module under a supervisor.

See `Supervisor`.

# `get_events`

Return the complete queue of telemetry events that `Bandit.Trace` is currently tracking

# `handle_event`

# `start_tracing`

Start tracing of all Bandit requests

See module documentation for intended usage. Accepts the following options:

* `max_size`: The size of the telemetry event queue to maintain. By default, `Bandit.Trace` maintains a
  queue of the last 10000 telemetry events
* `trace_on_exception`: Whether or not to emit traces when an error is raised within
  Bandit. Defaults to `true`

# `stop_tracing`

Stop any active trace session

---

*Consult [api-reference.md](api-reference.md) for complete listing*
