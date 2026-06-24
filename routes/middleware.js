/**
 * @fileoverview Gemeinsame Middleware-Funktionen für Route-Guards (`isLoggedIn`, `isAdmin`).
 * Kurze, synchron ausführende Guards — JSDoc-Kommentare auf Deutsch.
 * @module routes/middleware
 */
const { isAdmin: hasAdminRole } = require('../lib/roleHelpers');

module.exports = {
  isLoggedIn: function (req, res, next) {
    if (!req.session || !req.session.user) return res.redirect('/users/auth');
    next();
  },

  isAdmin: function (req, res, next) {
    const user = req.session.user;

    if (!user || typeof user !== 'object') {
      return res.redirect('/users/auth');
    }

    if (hasAdminRole(user)) {
      next();
    } else {
      console.warn(`Zugriff verweigert für Admin-Seite: ${user.username} (Rolle: ${user.role})`);
      return res.redirect('/users/account');
    }
  }
};
