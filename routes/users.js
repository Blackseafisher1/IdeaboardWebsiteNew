/**
 * @fileoverview Benutzer- und Auth-Routen: Registrierung, Login, Account-Verwaltung
 * und Passwort- / Session-Utilities. Enthält Rate-Limiting-Hilfen und Admin-Setup.
 * JSDoc-Kommentare auf Deutsch.
 * @module routes/users
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const asyncHandler = require('../lib/asyncHandler');
const authService = require('../lib/services/authService');
const userService = require('../lib/services/userService');
const pointsService = require('../lib/services/pointsService');
const { errorHtml } = require('../lib/http');
const { isAdmin: hasAdminRole, normalizeUser } = require('../lib/roleHelpers');

const hashService = authService.hashService;

const router = express.Router();

// Lokale Helfer (hashService, queryWithLockRetry, updateUserPoints, ensureRoles,
// ensureDefaultAdmin) wurden entfernt — diese Aufgaben übernehmen jetzt
// `authService` und `userService`.

const DEFAULT_ADMIN_USERNAME = process.env.DEFAULT_ADMIN_USERNAME || 'admin';
const DEFAULT_ADMIN_EMAIL = process.env.DEFAULT_ADMIN_EMAIL || 'admin@ideenboard.de';

function getPointsMood(pendingDelta) {
  // Feiner abgestufte Emoji-Auswahl für verschiedene Delta-Magnitude
  if (pendingDelta >= 50) return { emoji: '🏆', label: 'Riesiger Punktezuwachs', tone: 'positive' };
  if (pendingDelta >= 25) return { emoji: '🚀', label: 'Sehr starker Punktezuwachs', tone: 'positive' };
  if (pendingDelta >= 15) return { emoji: '🔥', label: 'Starker Punktezuwachs', tone: 'positive' };
  if (pendingDelta >= 8) return { emoji: '✨', label: 'Guter Punktezuwachs', tone: 'positive' };
  if (pendingDelta >= 3) return { emoji: '🙂', label: 'Leichter Punktezuwachs', tone: 'positive' };
  if (pendingDelta >= 1) return { emoji: '👍', label: 'Kleiner Zuwachs', tone: 'positive' };

  if (pendingDelta === 0) return { emoji: '😐', label: 'Keine Punkteaenderung', tone: 'neutral' };

  if (pendingDelta <= -50) return { emoji: '💀', label: 'Starker Punkteverlust', tone: 'negative' };
  if (pendingDelta <= -25) return { emoji: '😵', label: 'Sehr starker Punkteverlust', tone: 'negative' };
  if (pendingDelta <= -15) return { emoji: '😬', label: 'Deutlicher Punkteverlust', tone: 'negative' };
  if (pendingDelta <= -8) return { emoji: '😖', label: 'Spürbarer Punkteverlust', tone: 'negative' };
  if (pendingDelta <= -3) return { emoji: '😕', label: 'Leichter Punkteverlust', tone: 'negative' };
  return { emoji: '👎', label: 'Kleiner Abzug', tone: 'negative' };
}

function renderPointsDisplay(currentPoints, pendingDelta) {
  const total = currentPoints + pendingDelta;
  const deltaText = pendingDelta > 0 ? `+${pendingDelta}` : pendingDelta.toString();
  const mood = getPointsMood(pendingDelta);

  return `
    <span class="account-points account-points--${mood.tone}">
      <span class="account-points__total">${total}</span>
      <span class="account-points__delta account-points__delta--${mood.tone}">${deltaText}</span>
      <span class="account-points__emoji" role="img" aria-label="${mood.label}" title="${mood.label}">${mood.emoji}</span>
    </span>
  `.trim();
}

// Ein einmaliges Admin-Passwort wird nur erzeugt, falls die DB keinen Admin
// enthält oder kein nutzbares Passwort vorhanden ist. Dadurch wird vermieden,
// dass ein temporäres Passwort ausgegeben wird, wenn bereits per UI ein Passwort
// gesetzt wurde. Verwaltung liegt jetzt in `authService`.

const { isLoggedIn, isAdmin } = require('./middleware');
const { pageCache } = require('../lib/cacheHelper');

// Öffentliche Auth-Routen
// Registrierung
/**
 * POST /register
 * Registriert einen neuen Benutzer. Validiert Daten und loggt den Nutzer sofort ein.
 * @name POST /register
 * @function
 * @inner
 */
router.post('/register', asyncHandler(async (req, res) => {
  const { username, email, password } = req.body;
  const result = await authService.registerUser(username, email, password);

  if (!result.success) {
    if (req.headers.accept?.includes('application/json')) {
      return res.status(400).json({ success: false, error: result.error });
    }
    return res.status(400).send(errorHtml(result.error));
  }

  const user = normalizeUser(result.user);

  // Automatisches Einloggen des neu registrierten Nutzers: Session neu
  // erzeugen und Nutzer in die Session setzen (Session-Regeneration)
  return req.session.regenerate(err => {
    if (err) {
      console.error('Session regenerate error after registration:', err);
      if (req.headers.accept?.includes('application/json')) {
        return res.status(500).json({ success: false, error: 'Session-Fehler nach Registrierung' });
      }
      return res.status(500).send(errorHtml('Session-Fehler nach Registrierung'));
    }
    req.session.user = user;
    // Session speichern und dann entweder JSON oder Redirect zurückgeben
    return req.session.save(() => {
      // Wenn der Client explizit nach JSON fragt, sende JSON zurück
      if (req.headers.accept?.includes('application/json')) {
        return res.json({ success: true, ...user });
      }
      // Neu registrierte Benutzer auf ihre Account-Seite weiterleiten
      res.redirect('/users/account');
    });
  });
}));

// Speicher für Login-Versuche
class LoginAttemptStore {
  constructor() {
    this.attempts = new Map();
  }
  
  increment(key) {
    const now = Date.now();
    const record = this.attempts.get(key) || { count: 0, lockUntil: 0 };
    
    if (now < record.lockUntil) {
      return { totalHits: record.count, timeToExpire: record.lockUntil - now };
    }
    
    record.count++;
    let lockMs = 0;
    if (record.count >= 15) lockMs = 24 * 60 * 60 * 1000;  // 24h
    else if (record.count >= 10) lockMs = 2 * 60 * 60 * 1000;  // 2h  
    else if (record.count >= 3) lockMs = 30 * 60 * 1000;       // 30min
    
    if (lockMs > 0) record.lockUntil = now + lockMs;
    this.attempts.set(key, record);
    return { totalHits: record.count, timeToExpire: lockMs };
  }
  
  clear(key) {
    this.attempts.delete(key);
  }
}

const loginStore = new LoginAttemptStore();

// Login-Route
/**
 * POST /auth
 * Authentifiziert den Benutzer (Login). Beinhaltet Rate-Limiting gegen Brute-Force.
 * @name POST /auth
 * @function
 * @inner
 */
router.post('/auth', asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  
  // Prüfe Rate-Limit für Login-Versuche
  const resultLimit = loginStore.increment(email?.toLowerCase().trim() || '');
  if (resultLimit.timeToExpire > 0) {
    const waitMin = Math.ceil(resultLimit.timeToExpire / 60000);
    return res.status(429).render('users/auth', {
      isValid: false,
      validationMsg: `Konto gesperrt. Warte ${waitMin} Min. (${resultLimit.totalHits} Fehlversuche)`,
      title: 'Login'
    });
  }
  
  const authResult = await authService.authenticateUser(email, password);
  
  if (!authResult.success) {
    return res.status(400).render('users/auth', {
      isValid: false,
      validationMsg: authResult.error,
      title: 'Login'
    });
  }

  const user = normalizeUser(authResult.user);
  
  // Zähler nach erfolgreichem Login zurücksetzen (verwende dieselbe Normalisierung wie beim Increment)
  loginStore.clear(email?.toLowerCase().trim() || '');
  
  // Only rely on role for admin detection; avoid username/email-based checks
  const isDefaultAdmin = hasAdminRole(user);

  const hasAdminFlag = await authService.checkAdminFlag(user.id);

  // Nach erfolgreicher Auth: Session regenerieren und user-Daten setzen
  req.session.regenerate(err => {
    if (err) {
      console.error('Session regenerate error:', err);
      return res.status(500).render('users/auth', {
        isValid: false,
        validationMsg: 'Session-Fehler. Bitte versuche es erneut.',
        title: 'Login'
      });
    }

    req.session.user = normalizeUser({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      role_id: user.role_id,
      roleId: user.roleId
    });

    if ((isDefaultAdmin && user.usesDefaultPassword) || (hasAdminRole(user) && !hasAdminFlag)) {
      req.session.forcePasswordChange = true;
      // Admin-Setup erzwingen: Session speichern und zur Admin-Setup-Seite leiten
      return req.session.save(() => res.redirect('/users/admin-setup'));
    }

    // Normales Verhalten: Session speichern und zur Account-Seite leiten
    return req.session.save(() => res.redirect('/users/account'));
  });
}));

// GET-Route für Auth
/**
 * GET /auth
 * Zeigt die Login-Seite an oder leitet zur Account-Seite weiter, falls bereits eingeloggt.
 * @name GET /auth
 * @function
 * @inner
 */
router.get('/auth', asyncHandler(async (req, res) => {
  if (req.session.user) return res.redirect('/users/account');
  
  res.render('users/auth', { 
    title: 'Login',
    isValid: true,
    validationMsg: ''
  });
}));

// Session-Info für Client-Polling (wird genutzt, um sicherzustellen, dass das
// Session-Cookie angewendet wurde)
/**
 * GET /session-info
 * Liefert Informationen über den Login-Status der aktuellen Session für den Client.
 * @name GET /session-info
 * @function
 * @inner
 */
router.get('/session-info', asyncHandler(async (req, res) => {
  if (req.session && req.session.user && req.session.user.id) return res.json({ loggedIn: true, userId: Number(req.session.user.id) });
  res.json({ loggedIn: false });
}));


router.use(isLoggedIn);

// Admin-Setup: erfordert Passwortänderung
/**
 * GET /admin-setup
 * Zeigt die Seite für das initiale Admin-Setup (Passwortänderung) an.
 * @name GET /admin-setup
 * @function
 * @inner
 */
router.get('/admin-setup', isLoggedIn, isAdmin, asyncHandler(async (req, res) => {
  if (!req.session.forcePasswordChange) return res.redirect('/');
  res.render('users/admin-setup', { 
    title: 'Admin Setup', 
    validationMsg: '',
    user: req.session.user 
  });
}));

/**
 * POST /admin-setup
 * Verarbeitet die initiale Passwortänderung für den Admin-Account.
 * @name POST /admin-setup
 * @function
 * @inner
 */
router.post('/admin-setup', isLoggedIn, isAdmin, asyncHandler(async (req, res) => {
  if (!req.session.forcePasswordChange) return res.redirect('/');
  const { newPassword } = req.body;
  if (!newPassword || newPassword.trim().length < 6) {
    return res.render('users/admin-setup', { 
      title: 'Admin Setup', 
      validationMsg: 'Passwort zu kurz.',
      user: req.session.user
    });
  }
  
  await authService.resetPassword(req.session.user.id, newPassword.trim());
  await authService.setAdminFlag(req.session.user.id);

  req.session.forcePasswordChange = false;
  
  // Falls der Client JSON erwartet (fetch/XHR), JSON zurückgeben
  if (req.headers.accept && req.headers.accept.includes && req.headers.accept.includes('application/json')) {
    return res.json({ success: true, userId: Number(req.session.user.id), username: req.session.user.username });
  }
  // Nach dem Einrichten des Admin-Passworts, den Admin zur Account-Seite schicken
  res.redirect('/users/account');
}));

// Account page (protected)
/**
 * GET /account
 * Zeigt die Profilseite des aktuell angemeldeten Benutzers an.
 * @name GET /account
 * @function
 * @inner
 */
router.get('/account', pageCache(10), asyncHandler(async (req, res) => {
  res.render('users/account', {
    title: 'Mein Account',
    user: normalizeUser(req.session.user)
  });
}));

// Lazy-geladene Engagement-Punkte (keine zusätzlichen Schreibzugriffe während
// kritischer Interaktionen)
/**
 * GET /points
 * Liefert die aktuellen Engagement-Punkte als HTML-Snippet (lazy load).
 * @name GET /points
 * @function
 * @inner
 */
router.get('/points', asyncHandler(async (req, res) => {
  const userId = req.session.user.id;
  // Verhindere gecachte Werte in der Account-Ansicht
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');

  // Lese und zeige Punkte (inkl. ausstehender Delta) ANZEIGE bevor Commit
  const userProfile = await userService.getUserProfile(userId);
  const current = Number(userProfile?.current_points) || 0;
  const pending = Number(userProfile?.pending_delta) || 0;

  const display = renderPointsDisplay(current, pending);

  // Sende zuerst die Anzeige, damit die UI das ausstehende Delta sieht
  res.type('text/html').send(display);

  // Anschließend asynchron das ausstehende Delta in `current_points` übernehmen
  if (pending !== 0) {
    // Asynchrones Commit der ausstehenden Punkte im Hintergrund (Fehler werden geloggt)
    userService.updateUserPoints(userId).catch(err => console.error('Async commit error:', err));
  }
}));

// Logout
/**
 * GET /logout
 * Loggt den Benutzer aus und zerstört die aktuelle Session.
 * @name GET /logout
 * @function
 * @inner
 */
router.get('/logout', asyncHandler(async (req, res) => {
  // Ausstehende Punkte beim Logout speichern
  await userService.updateUserPoints(req.session.user.id);

  // Session zerstören und anschließend zum Start weiterleiten
  req.session.destroy(err => {
    if (err) {
      console.error(err);
      return res.status(500).send(req.isHtmx ? 'Fehler beim Logout' : errorHtml('Fehler beim Logout'));
    }
    res.redirect('/');
  });
}));

// Update username
/**
 * POST /account/update-username
 * Ermöglicht dem Benutzer, seinen eigenen Benutzernamen zu ändern.
 * @name POST /account/update-username
 * @function
 * @inner
 */
router.post('/account/update-username', asyncHandler(async (req, res) => {
  const newUsername = req.body.username.trim();
  if (!newUsername) return res.redirect('/users/account');

  await userService.updateUsername(req.session.user.id, newUsername);
  req.session.user.username = newUsername;
  res.redirect('/users/account');
}));

// Update password
/**
 * POST /account/update-password
 * Ermöglicht dem Benutzer, sein eigenes Passwort nach Validierung des aktuellen Passworts zu ändern.
 * @name POST /account/update-password
 * @function
 * @inner
 */
router.post('/account/update-password', asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const isJson = req.headers.accept?.includes('application/json') || req.headers['content-type']?.includes('application/json');

  const result = await authService.changePassword(req.session.user.id, currentPassword, newPassword);
  
  if (!result.success) {
    if (isJson) return res.status(400).json({ success: false, message: result.error });
    return res.status(400).send(errorHtml(result.error));
  }

  if (isJson) return res.json({ success: true });
  res.redirect('/users/account');
}));

module.exports = router;
module.exports.ensureDefaultAdmin = authService.ensureDefaultAdmin;
