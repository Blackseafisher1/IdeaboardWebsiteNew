defmodule Elixirideaboard.PageHTML do
  use Phoenix.View,
    root: "lib/elixirideaboard/controllers",
    namespace: Elixirideaboard

  import Phoenix.Component

  @doc false
  def render("layout.html", assigns) do
    ~H"""
    <!DOCTYPE html>
    <html lang="de" data-theme="light">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title><%= assigns[:title] || "Ideenboard" %></title>
      <link rel="icon" href="/favicon.ico" type="image/x-icon" />
      <link rel="stylesheet" href="/css/style.css" />
    </head>
    <body>
      <main class="main-content"><%= @inner_content %></main>
      <footer class="footer"><div class="footer-inner"><a href="/impressum">Impressum</a><a href="/datenschutz">Datenschutz</a><a href="/agb">AGB</a></div></footer>
    </body>
    </html>
    """
  end
end
