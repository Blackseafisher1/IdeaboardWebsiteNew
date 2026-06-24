defmodule Elixirideaboard.ErrorHTML do
  use Elixirideaboard.Web, :view

  def render("404.html", assigns) do
    ~H"""
    <div class="error-page">
      <h1>404</h1>
      <p>Seite nicht gefunden</p>
      <a href="/">Zurück zur Startseite</a>
    </div>
    """
  end

  def render("500.html", assigns) do
    ~H"""
    <div class="error-page">
      <h1>500</h1>
      <p>Interner Serverfehler</p>
      <a href="/">Zurück zur Startseite</a>
    </div>
    """
  end
end
