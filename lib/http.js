/**
 * @fileoverview HTTP-Hilfsfunktionen (Erkennung von HTMX/AJAX, Antwortpräferenzen).
 * @module lib/http
 */

/**
 * Ermittelt robust, ob die Anfrage von HTMX oder als AJAX gesendet wurde.
 * @param {Object} req - Express-Request-Objekt (vereinfachter Typ für JSDoc).
 * @returns {boolean} `true`, wenn die Anfrage als HTMX/XHR identifiziert wird.
 */
function isHtmx(req) {
  return (
    (req.get && req.get('HX-Request') === 'true') ||
    req.headers['hx-request'] === 'true' ||
    req.headers['x-requested-with'] === 'XMLHttpRequest'
  );
}

/**
 * Prüft, ob der Client bevorzugt JSON als Antwort erwartet (Accept-Header).
 * @param {Object} req - Express-Request-Objekt (vereinfachter Typ für JSDoc).
 * @returns {boolean} `true`, wenn `application/json` im `Accept`-Header enthalten ist.
 */
function wantsJson(req) {
  const accept = req.get('Accept') || '';
  return accept.includes('application/json');
}

/**
 * Erstellt ein HTML-Snippet für Fehlermeldungen mit einem "Zurück"-Button.
 * @param {string} message - Die anzuzeigende Fehlermeldung.
 * @returns {string} Das HTML-Snippet.
 */
function errorHtml(message) {
    return `
        <!DOCTYPE html>
        <html lang="de">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Hinweis</title>
            <style>
                :root {
                    --bg-color: #f8fafc;
                    --card-bg: white;
                    --text-main: #1e293b;
                    --text-sub: #475569;
                    --border-color: #e2e8f0;
                    --btn-bg: #3b82f6;
                    --btn-hover: #2563eb;
                    --btn-shadow: rgba(59, 130, 246, 0.3);
                }

                html.dark {
                    --bg-color: #0f172a;
                    --card-bg: #1e293b;
                    --text-main: #f1f5f9;
                    --text-sub: #94a3b8;
                    --border-color: #334155;
                    --btn-bg: #3b82f6;
                    --btn-hover: #60a5fa;
                }

                body { 
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; 
                    display: flex; 
                    align-items: center; 
                    justify-content: center; 
                    height: 100vh; 
                    margin: 0; 
                    background-color: var(--bg-color); 
                    color: var(--text-main); 
                    transition: background-color 0.3s ease;
                }
                .error-card { 
                    background: var(--card-bg); 
                    padding: 2.5rem; 
                    border-radius: 16px; 
                    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1); 
                    text-align: center; 
                    max-width: 450px; 
                    width: 90%; 
                    border: 1px solid var(--border-color);
                }
                h1 { font-size: 1.25rem; margin-top: 0; margin-bottom: 1rem; color: #ef4444; font-weight: 600; }
                p { margin-bottom: 2rem; line-height: 1.6; color: var(--text-sub); font-size: 1.1rem; }
                button { 
                    background-color: var(--btn-bg); 
                    color: white; 
                    border: none; 
                    padding: 12px 24px; 
                    border-radius: 10px; 
                    cursor: pointer; 
                    font-size: 1rem; 
                    font-weight: 500;
                    transition: all 0.2s; 
                    box-shadow: 0 4px 6px -1px var(--btn-shadow);
                }
                button:hover { 
                    background-color: var(--btn-hover); 
                    transform: translateY(-1px);
                }
                button:active { transform: translateY(0); }
            </style>
            <script>
                (function() {
                    const theme = localStorage.getItem('theme');
                    if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                        document.documentElement.classList.add('dark');
                    }
                })();
            </script>
        </head>
        <body>
            <div class="error-card">
                <h1>Hinweis</h1>
                <p>${message}</p>
                <button onclick="history.back()">Zurück zur letzten Seite</button>
            </div>
        </body>
        </html>
    `;
}

/**
 * Sendet eine standardisierte Fehlerseite direkt als HTTP-Antwort.
 * @param {Object} res - Express-Response-Objekt.
 * @param {string} message - Fehlermeldung für die Seite.
 * @param {number} [status=400] - HTTP-Statuscode.
 * @returns {Object} Die Response-Instanz.
 */
function sendErrorPage(res, message, status = 400) {
    return res.status(status).send(errorHtml(message));
}

module.exports = {
  isHtmx,
  wantsJson,
    errorHtml,
    sendErrorPage
};
