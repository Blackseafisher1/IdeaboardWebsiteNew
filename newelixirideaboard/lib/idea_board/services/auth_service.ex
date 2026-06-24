defmodule IdeaBoard.AuthService do
  def authenticate(email, password) do
    try do
      case IdeaBoard.Repo.query_map("SELECT * FROM users WHERE LOWER(email) = LOWER(?)", [email]) do
        {:ok, %{password_hash: hash} = user} ->
          if Argon2.verify_pass(password, hash) do
            role = get_role_name(user.role_id)
            {:ok, %{user_id: user.user_id, username: user.username, email: user.email, role_id: user.role_id, role_name: role}}
          else
            {:error, "Falsches Passwort"}
          end

        _ ->
          {:error, "Konto nicht gefunden"}
      end
    rescue
      _e in [DBConnection.ConnectionError, ArgumentError, MyXQL.Error] -> {:error, "DB nicht verfügbar"}
    end
  end

  def register(username, email, password) when is_binary(password) and password != "" do
    with :ok <- validate_registration(username, email) do
      hash = Argon2.hash_pwd_salt(password)
      try do
        case IdeaBoard.Repo.query(
               "INSERT INTO users (username, email, password_hash, role_id) VALUES (?, ?, ?, 3)",
               [username, email, hash]
             ) do
          {:ok, %{last_insert_id: id}} ->
            {:ok, %{user_id: id, username: username, email: email, role_id: 3, role_name: "Mitarbeiter"}}

          {:error, reason} ->
            {:error, "Registrierung fehlgeschlagen: #{inspect(reason)}"}
        end
      rescue
        _e in [DBConnection.ConnectionError, ArgumentError, MyXQL.Error] -> {:error, "DB nicht verfügbar"}
      end
    end
  end

  def register(_, _, _), do: {:error, "Ungültige Eingabe"}

  defp validate_registration(username, email) do
    cond do
      String.length(username) < 2 -> {:error, "Benutzername zu kurz"}
      not String.contains?(email, "@") -> {:error, "Ungültige E-Mail"}
      true -> :ok
    end
  end

  def change_password(user_id, current_password, new_password) when is_binary(new_password) and new_password != "" do
    try do
      case IdeaBoard.Repo.query_map("SELECT password_hash FROM users WHERE user_id = ?", [user_id]) do
        {:ok, %{"password_hash" => hash}} ->
          if Argon2.verify_pass(current_password, hash) do
            new_hash = Argon2.hash_pwd_salt(new_password)
            IdeaBoard.Repo.query("UPDATE users SET password_hash = ? WHERE user_id = ?", [new_hash, user_id])
            :ok
          else
            {:error, "Aktuelles Passwort ist falsch"}
          end

        _ -> {:error, "Benutzer nicht gefunden"}
      end
    rescue
      _e in [DBConnection.ConnectionError, ArgumentError, MyXQL.Error] -> {:error, "DB nicht verfügbar"}
    end
  end

  def change_password(_, _, _), do: {:error, "Ungültige Eingabe"}

  defp get_role_name(1), do: "Admin"
  defp get_role_name(2), do: "Projektleiter"
  defp get_role_name(_), do: "Mitarbeiter"
end
