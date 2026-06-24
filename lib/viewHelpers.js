/**
 * @fileoverview Helfer für die Konsistente Aufbereitung von View-Daten.
 * @module lib/viewHelpers
 */

const { normalizeUser } = require('./roleHelpers');

/**
 * Baut ein angereichertes Benutzerobjekt für die Template-Ausgabe.
 * @param {Object} sessionUser - Das Benutzerobjekt aus der Session (`req.session.user`).
 * @param {Object} [stats={}] - Statistiken wie `remainingLikes` und `remainingDislikes`.
 * @returns {Object|null} Angereichertes Benutzerobjekt oder `null`, wenn kein Benutzer vorhanden ist.
 */
function userRender(sessionUser, stats = {}) {
  if (!sessionUser) return null;
  const normalizedUser = normalizeUser(sessionUser);
  return {
    ...normalizedUser,
    id: normalizedUser.id,
    role: normalizedUser.role,
    username: normalizedUser.username,
    remainingLikes: stats.remainingLikes ?? 0,
    remainingDislikes: stats.remainingDislikes ?? 0
  };
}

module.exports = {
  userRender
};
