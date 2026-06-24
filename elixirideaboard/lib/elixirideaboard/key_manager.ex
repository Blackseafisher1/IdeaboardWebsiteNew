defmodule Elixirideaboard.KeyManager do
  @moduledoc """
  Manages the wrapped master key for file encryption/decryption.
  Ported from lib/keyManager.js

  On init():
  1. If no wrapped key file exists, prompt user to enter a passphrase.
  2. Derive AES-256 key from passphrase via Argon2.
  3. Generate a random master key, encrypt it with the derived key, write to disk.
  4. On subsequent starts, read the wrapped key, prompt for passphrase, unwrap.
  5. Hold unwrapped master key in memory for encrypt/decrypt operations.
  """

  use GenServer

  # Public API

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  def get_master_key do
    GenServer.call(__MODULE__, :get_master_key)
  end

  def encrypt(plaintext) do
    key = get_master_key()
    # AES-256-GCM encrypt
    iv = :crypto.strong_rand_bytes(12)
    {ciphertext, tag} = :crypto.crypto_one_time(:aes_256_gcm, key, iv, plaintext, true)
    {iv, ciphertext, tag}
  end

  def decrypt(iv, ciphertext, tag) do
    key = get_master_key()
    :crypto.crypto_one_time_aead(:aes_256_gcm, key, iv, ciphertext, <<>>, tag, false)
  end

  # GenServer callbacks

  @impl true
  def init(_opts) do
    path = Application.get_env(:elixirideaboard, :master_key_wrapped_path, "./data/master_key.wrapped")

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
    # Format: salt(16) + iv(12) + tag(16) + ciphertext(32)
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
    # Use Argon2id for key derivation (same as JS argon2 lib)
    Argon2.Base.hash_password(passphrase, salt,
      t_cost: 2, m_cost: 19, parallelism: 1, hashlen: 32, format: :raw_hash, argon2_type: 2
    )
  end
end
