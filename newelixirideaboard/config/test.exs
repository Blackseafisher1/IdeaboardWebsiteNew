import Config

config :newelixirideaboard,
  db_host: "127.0.0.1",
  db_port: 3306,
  db_user: "ideaboard",
  db_password: "3629",
  db_database: "ideaboard_test",
  session_salt: "test_salt_abcdefgh",
  session_secret: "test_secret_abcdefghijklmnopqrstuvwxyz1234",
  secret_key_base: "test_secret_key_base_64_chars_minimum_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
