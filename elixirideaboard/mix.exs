defmodule Elixirideaboard.MixProject do
  use Mix.Project

  def project do
    [
      app: :elixirideaboard,
      version: "0.1.0",
      elixir: "~> 1.17",
      elixirc_paths: elixirc_paths(Mix.env()),
      start_permanent: Mix.env() == :prod,
      aliases: aliases(),
      deps: deps()
    ]
  end

  def application do
    [
      extra_applications: [:logger, :crypto],
      mod: {Elixirideaboard.Application, []}
    ]
  end

  defp elixirc_paths(:dev), do: ["lib"]
  defp elixirc_paths(:test), do: ["lib"]
  defp elixirc_paths(_), do: ["lib"]

  defp aliases do
    [
      setup: ["deps.get"],
      "assets.deploy": ["cmd --exit-code rm -rf priv/static/assets"]
    ]
  end

  defp deps do
    [
      {:phoenix, "~> 1.7.0"},
      {:phoenix_live_view, "~> 1.0.0"},
      {:phoenix_html, "~> 4.1"},
      {:phoenix_view, "~> 2.0"},
      {:phoenix_pubsub, "~> 2.1"},
      {:bandit, "~> 1.6"},
      {:myxql, "~> 0.9.0"},
      {:ayesql, github: "alexdesousa/ayesql", override: true},
      {:argon2_elixir, "~> 4.1"},
      {:jason, "~> 1.4"},
      {:plug_crypto, "~> 2.1"},
      {:telemetry, "~> 1.3"},
      {:telemetry_poller, "~> 1.1"},
      {:decimal, "~> 3.0"},
      {:gettext, "~> 0.26"}
    ]
  end
end
