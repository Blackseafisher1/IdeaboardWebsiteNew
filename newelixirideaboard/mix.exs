defmodule IdeaBoard.MixProject do
  use Mix.Project

  def project do
    [
      app: :newelixirideaboard,
      version: "0.1.0",
      elixir: "~> 1.20",
      elixirc_paths: elixirc_paths(Mix.env()),
      start_permanent: Mix.env() == :prod,
      aliases: aliases(),
      deps: deps()
    ]
  end

  def application do
    [
      extra_applications: [:logger, :crypto],
      mod: {IdeaBoard.Application, []}
    ]
  end

  defp elixirc_paths(:dev), do: ["lib"]
  defp elixirc_paths(:test), do: ["lib"]
  defp elixirc_paths(_), do: ["lib"]

  defp aliases do
    [
      setup: ["deps.get"],
      test: ["test --no-start"]
    ]
  end

  defp deps do
    [
      {:bandit, "~> 1.6"},
      {:plug, "~> 1.15"},
      {:plug_crypto, "~> 2.1"},
      {:phoenix_template, "~> 1.0"},
      {:phoenix_html, "~> 4.1"},
      {:myxql, "~> 0.9"},
      {:db_connection, "~> 2.10"},
      {:ayesql, github: "alexdesousa/ayesql"},
      {:argon2_elixir, "~> 4.1"},
      {:jason, "~> 1.4"},
      {:decimal, "~> 3.0"},
      {:telemetry, "~> 1.3"}
    ]
  end
end
