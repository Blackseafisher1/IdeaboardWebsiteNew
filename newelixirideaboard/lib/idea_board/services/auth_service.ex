defmodule IdeaBoard.AuthService do
  def authenticate(email, password) do
    case IdeaBoard.Repo.query("SELECT * FROM users WHERE LOWER(email) = LOWER(?)", [email]) do
      {:ok, %{rows: [user | _]}} ->
        if Argon2.verify_pass(password, user.password_hash) do
          role = get_role_name(user.role_id)
          {:ok, Map.put(user, :role_name, role)}
        else
          {:error, "Falsches Passwort"}
        end

      _ ->
        {:error, "Konto nicht gefunden"}
    end
  end

  def register(username, email, password) when is_binary(password) do
    with :ok <- validate_registration(username, email) do
      hash = Argon2.hash_pwd_salt(password)
      case IdeaBoard.Repo.query("INSERT INTO users (username, email, password_hash, role_id) VALUES (?, ?, ?, 3)", [username, email, hash]) do
        {:ok, _} -> {:ok, %{username: username, email: email, role_name: "Mitarbeiter"}}
        {:error, reason} -> {:error, "Registrierung fehlgeschlagen: #{inspect(reason)}"}
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

  defp get_role_name(1), do: "Admin"
  defp get_role_name(2), do: "Projektleiter"
  defp get_role_name(_), do: "Mitarbeiter"
end
