defmodule IdeaBoard.KeyManager do
  use GenServer

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  def get_master_key do
    GenServer.call(__MODULE__, :get_master_key)
  end

  def encrypt(plaintext) do
    key = get_master_key()
    iv = :crypto.strong_rand_bytes(12)
    {ciphertext, tag} = :crypto.crypto_one_time(:aes_256_gcm, key, iv, plaintext, true)
    {iv, ciphertext, tag}
  end

  def decrypt(iv, ciphertext, tag) do
    key = get_master_key()
    :crypto.crypto_one_time_aead(:aes_256_gcm, key, iv, ciphertext, <<>>, tag, false)
  end

  @impl true
  def init(_opts) do
    path = Application.get_env(:newelixirideaboard, :master_key_wrapped_path, "./data/master_key.wrapped")

    key = if File.exists?(path) do
      wrapped = File.read!(path)
      passphrase = get_passphrase_interactive("Enter master key passphrase: ")
      unwrap(wrapped, passphrase)
    else
      passphrase = get_passphrase_interactive("No master key found. Create a passphrase: ")
      verify = get_passphrase_interactive("Verify passphrase: ")
      if passphrase != verify, do: raise("Passphrases do not match")
      key = :crypto.strong_rand_bytes(32)
      wrapped = wrap(key, passphrase)
      File.write!(path, wrapped)
      key
    end

    {:ok, %{key: key}}
  end

  @impl true
  def handle_call(:get_master_key, _from, state) do
    {:reply, state.key, state}
  end

  defp get_passphrase_interactive(prompt) do
    IO.gets(prompt) |> String.trim()
  end

  defp wrap(key, passphrase) do
    salt = :crypto.strong_rand_bytes(16)
    derived = derive_key(passphrase, salt)
    iv = :crypto.strong_rand_bytes(12)
    {ciphertext, tag} = :crypto.crypto_one_time(:aes_256_gcm, derived, iv, key, true)
    salt <> iv <> tag <> ciphertext
  end

  defp unwrap(data, passphrase) do
    <<salt::16-binary, iv::12-binary, tag::16-binary, ciphertext::32-binary>> = data
    derived = derive_key(passphrase, salt)
    {:ok, plain} = :crypto.crypto_one_time_aead(:aes_256_gcm, derived, iv, ciphertext, <<>>, tag, false)
    plain
  rescue
    _ -> raise("Invalid passphrase or corrupted key file")
  end

  defp derive_key(passphrase, salt) do
    Argon2.Base.hash_password(passphrase, salt,
      t_cost: 2, m_cost: 19, parallelism: 1, hashlen: 32, format: :raw_hash, argon2_type: 2
    )
  end
end
