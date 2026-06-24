/**
 * @fileoverview HTMX-Erkennungs-Utilities und Express-Middleware.
 * @module lib/htmxDetector
 * @alias module:lib/htmxDetector
 * @description
 * Dieses Modul stellt die Funktion `isHtmx(req)` zum Prüfen von HTMX/XHR-Anfragen
 * sowie die Middleware `middleware` bereit. Die Middleware setzt `req.isHtmx`
 * und `res.locals.isHtmx` entsprechend dem Request.
 */

/**
 * Prüft, ob die Anfrage von HTMX oder als XHR gesendet wurde.
 * @param {Object} req - Express-Request-Objekt (vereinfachter Typ für JSDoc).
 * @returns {boolean} `true`, wenn die Anfrage als HTMX/XHR identifiziert wird.
 */
function isHtmx(req) {
  if (!req) return false;
  try {
    return (
      (typeof req.get === 'function' && req.get('HX-Request') === 'true') ||
      (req.headers && req.headers['hx-request'] === 'true') ||
      (req.headers && req.headers['x-requested-with'] === 'XMLHttpRequest')
    );
  } catch (err) {
    return false;
  }
}

/**
 * Express-Middleware: Annotiert `req` und `res.locals` mit `isHtmx`.
 * @param {Object} req
 * @param {Object} res
 * @param {Function} next
 * @returns {void}
 */
function middleware(req, res, next) {
  try {
    req.isHtmx = !!isHtmx(req);
    if (res && res.locals) res.locals.isHtmx = req.isHtmx;
  } catch (err) {
    req.isHtmx = false;
    if (res && res.locals) res.locals.isHtmx = false;
  }
  if (typeof next === 'function') next();
}

module.exports = {
  isHtmx,
  middleware
};
