defmodule IdeaBoard.Repo do
  def query(sql, params \\ []) do
    DBConnection.run(pool(), fn conn ->
      MyXQL.query(conn, sql, List.wrap(params))
    end)
    |> case do
      {{:ok, result}, _status} -> {:ok, result}
      {{:error, reason}, _status} -> {:error, reason}
      other -> other
    end
  end

  def query!(sql, params \\ []) do
    {:ok, result} = query(sql, params)
    result
  end

  def child_spec(_opts) do
    host = Application.get_env(:newelixirideaboard, :db_host, "127.0.0.1")
    port = Application.get_env(:newelixirideaboard, :db_port, 3306)
    user = Application.get_env(:newelixirideaboard, :db_user, "ideaboard")
    password = Application.get_env(:newelixirideaboard, :db_password, "3629")
    database = Application.get_env(:newelixirideaboard, :db_database, "ideaboard")
    pool_size = Application.get_env(:newelixirideaboard, :db_pool_size, 10)

    DBConnection.child_spec(
      MyXQL.Connection,
      name: __MODULE__,
      pool_size: pool_size,
      show_sensitive_data_on_connection_error: true,
      disconnect_on_error_codes: [],
      hostname: host,
      port: port,
      username: user,
      password: password,
      database: database
    )
  end

  defp pool do
    Process.whereis(__MODULE__) ||
      raise("Database pool #{__MODULE__} not started")
  end
end
