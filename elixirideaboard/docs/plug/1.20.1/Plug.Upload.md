# `Plug.Upload`
[🔗](https://github.com/elixir-plug/plug/blob/v1.20.1/lib/plug/upload.ex#L5)

A server (a `GenServer` specifically) that manages uploaded files.

Uploaded files are stored in a temporary directory
and removed from that directory after the process that
requested the file dies.

During the request, files are represented with
a `Plug.Upload` struct that contains three fields:

  * `:path` - the path to the uploaded file on the filesystem
  * `:content_type` - the content type of the uploaded file
  * `:filename` - the filename of the uploaded file given in the request

**Note**: as mentioned in the documentation for `Plug.Parsers`, the `:plug`
application has to be started in order to upload files and use the
`Plug.Upload` module.

## Security

The `:content_type` and `:filename` fields in the `Plug.Upload` struct are
client-controlled. These values should be validated, via file content
inspection or similar, before being trusted.

# `t`

```elixir
@type t() :: %Plug.Upload{
  content_type: binary() | nil,
  filename: binary(),
  path: Path.t()
}
```

# `child_spec`

Returns a specification to start this module under a supervisor.

See `Supervisor`.

# `delete`

```elixir
@spec delete(t() | binary()) :: :ok | {:error, term()}
```

Deletes the given upload file.

Uploads are automatically removed when the current process terminates,
but you may invoke this to request the file to be removed sooner.

# `give_away`

```elixir
@spec give_away(t() | binary(), pid(), pid()) :: :ok | {:error, :unknown_path}
```

Assign ownership of the given upload file to another process.

Useful if you want to do some work on an uploaded file in another process
since it means that the file will survive the end of the request.

# `random_file`

```elixir
@spec random_file(binary()) ::
  {:ok, binary()}
  | {:too_many_attempts, binary(), pos_integer()}
  | {:no_tmp, [binary()]}
```

Requests a random file to be created in the upload directory
with the given prefix.

# `random_file!`

```elixir
@spec random_file!(binary()) :: binary() | no_return()
```

Requests a random file to be created in the upload directory
with the given prefix. Raises on failure.

---

*Consult [api-reference.md](api-reference.md) for complete listing*
