import Config

config :newelixirideaboard,
  dev_routes: false,
  db_host: System.get_env("DB_HOST", "127.0.0.1"),
  db_port: String.to_integer(System.get_env("DB_PORT", "3306")),
  db_user: System.get_env("DB_USER", "ideaboard"),
  db_password: System.get_env("DB_PASSWORD", "3629"),
  db_database: System.get_env("DB_DATABASE", "ideaboard"),
  session_salt: System.get_env("SESSION_SALT"),
  session_secret: System.get_env("SESSION_SECRET"),
  secret_key_base: System.get_env("SECRET_KEY_BASE"),
  public_gate_password: System.get_env("PUBLIC_GATE_PASSWORD", ""),
  master_key_wrapped_path: System.get_env("MASTER_KEY_PATH", "./data/master_key.wrapped")
