/**
 * @fileoverview Middleware-Fabrik zum Messen der Request-Dauer und Loggen der Zeit in ms.
 * @module lib/timing
 */
/**
 * Erzeugt eine Express-Middleware, die die Laufzeit eines Requests misst und beim `finish`-Event loggt.
 * @param {string} [label=''] - Optionales Label zur besseren Unterscheidung in Logs.
 * @returns {Function} Express-Middleware-Funktion.
 */
module.exports = function(label = '') {
  // Express-Middleware: misst die Request-Laufzeit (in ms) und loggt sie beim `finish`-Event.
  return (req, res, next) => {
    const start = process.hrtime.bigint();
    // Beim Abschluss der Response die verstrichene Zeit berechnen und loggen
    res.on('finish', () => {
      try {
        const diff = Number(process.hrtime.bigint() - start) / 1e6; // ms
        const routeLabel = label ? `[${label}]` : '';
        console.log(`${routeLabel} [TIMING] ${req.method} ${req.originalUrl} ${res.statusCode} - ${diff.toFixed(2)} ms`);
      } catch (e) {
        // falls Logging fehlschlägt, nicht die Anfrage stören
      }
    });
    next();
  };
};
