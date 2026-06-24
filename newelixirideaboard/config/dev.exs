import Config

config :plug, :secret_key_base, "dev_secret_key_base_64_chars_minimum_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

config :newelixirideaboard,
  dev_routes: true,
  db_host: "127.0.0.1",
  db_port: 3306,
  db_user: "ideaboard",
  db_password: "3629",
  db_database: "ideaboard",
  session_salt: "dev_salt_abcdefgh",
  session_secret: "dev_secret_abcdefghijklmnopqrstuvwxyz1234",
  secret_key_base: "dev_secret_key_base_64_chars_minimum_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
