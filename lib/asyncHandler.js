/**
 * @fileoverview Wrapper für asynchrone Route-Handler, leitet Fehler an den Express-Error-Handler weiter.
 * @module lib/asyncHandler
 */

/**
 * Wrappt einen asynchronen Express-Handler und leitet auftretende Fehler an `next` weiter.
 * Entfernt die Notwendigkeit für wiederkehrende try/catch-Blöcke in Routen.
 * @param {Function} fn - Asynchroner Express-Handler (req, res, next).
 * @returns {Function} Express-kompatible Middleware-Funktion.
 * @throws {Error} Leitet alle Fehler an `next` weiter, sodass der zentrale Error-Handler sie verarbeitet.
 */
function asyncHandler(fn) {
  /**
   * Express-kompatible Middleware, die den übergebenen asynchronen Handler ausführt
   * und auftretende Fehler an `next` weitergibt, damit der zentrale Error-Handler
   * sie verarbeiten kann. Dadurch entfallen try/catch-Blöcke in Routen.
   * @param {Object} req - Express Request
   * @param {Object} res - Express Response
   * @param {Function} next - Express Next-Funktion
   * @returns {void}
   */
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = asyncHandler;
