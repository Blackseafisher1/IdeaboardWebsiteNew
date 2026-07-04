/**
 * @fileoverview Admin-Routen für Benutzerverwaltung, Rollen und Audit-Logs.
 * Alle Routen sind geschützt und verwenden das `isLoggedIn` + `isAdmin` Middleware-Setup.
 * JSDoc-Kommentare in diesem Projekt sind auf Deutsch verfasst.
 * @module routes/adminPage
 */

const express = require('express');
const router = express.Router();
const asyncHandler = require('../lib/asyncHandler');
const adminService = require('../lib/services/adminService');
const authService = require('../lib/services/authService');
const { errorHtml } = require('../lib/http');
const { isLoggedIn, isAdmin } = require('./middleware');
const { isAdmin: hasAdminRole } = require('../lib/roleHelpers');

const hashService = authService.hashService;

router.use(isLoggedIn);
router.use(isAdmin);
const htmxDetector = require('../lib/htmxDetector');
router.use(htmxDetector.middleware);

/**
 * GET /admin
 * Zeigt die Benutzerverwaltung an (Liste von Benutzern und Rollen).
 * @name GET /
 * @function
 * @inner
 */
router.get('/', asyncHandler(async (req, res) => {
    const usersWithRoles = await adminService.getUsersWithRoles();
    const availableRoles = await adminService.getAvailableRoles();
    
    res.render('adminPage/adminPage', {
        pageTitle: 'Benutzerverwaltung',
        users: usersWithRoles,
        availableRoles: availableRoles
    });
}));

/**
 * GET /admin/logs
 * Zeigt die Audit-Logs (Aktivitätenprotokoll) an.
 * @name GET /logs
 * @function
 * @inner
 */
router.get('/logs', asyncHandler(async (req, res) => {
    const logs = await adminService.getAdminLogs(200);
    res.render('adminPage/adminLogs', { logs });
}));

/**
 * POST /admin/change-role
 * Ändert die Rolle eines Benutzers und loggt die Aktion.
 * @name POST /change-role
 * @function
 * @inner
 */
router.post('/change-role', asyncHandler(async (req, res) => {
    const { user_id, new_role_id } = req.body;
    const actorId = req.session.user.id;

    const targetUser = await adminService.getUserForAdmin(user_id);

    if (!targetUser) {
        return res.status(404).send(req.isHtmx ? 'Zielbenutzer nicht gefunden.' : errorHtml('Zielbenutzer nicht gefunden.'));
    }

    try {
        await adminService.updateUserRole(actorId, user_id, new_role_id);
    } catch (err) {
        const msg = String(err && err.message ? err.message : 'Fehler beim Ändern der Rolle');
        if (msg.indexOf('FORBIDDEN') === 0) {
            const userMsg = msg.replace(/^FORBIDDEN:\s*/, '') || 'Aktion nicht erlaubt.';
            return res.status(403).send(req.isHtmx ? userMsg : errorHtml(userMsg));
        }
        if (msg.indexOf('BAD_REQUEST') === 0) {
            const userMsg = msg.replace(/^BAD_REQUEST:\s*/,'') || 'Ungültige Anfrage.';
            const statusCode = userMsg.includes('Ansprechpartner') && userMsg.includes('Mitarbeiter') ? 409 : 400;
            return res.status(statusCode).send(req.isHtmx ? userMsg : errorHtml(userMsg));
        }
        throw err;
    }

    if (req.isHtmx) {
        const updatedUser = await adminService.getUserForAdmin(user_id);
        const availableRoles = await adminService.getAvailableRoles();
        return res.render('adminPage/_userRow', { user: updatedUser, availableRoles });
    }

    res.redirect('/adminPage');
}));

/**
 * POST /admin/delete-user
 * Löscht einen Benutzer dauerhaft und loggt die Aktion.
 * @name POST /delete-user
 * @function
 * @inner
 */
router.post('/delete-user', asyncHandler(async (req, res) => {
    const { user_id_to_delete } = req.body;
    const idToDelete = Number(user_id_to_delete);
    const actorId = req.session.user.id;

    const targetUser = await adminService.getUserForAdmin(idToDelete);

    if (!targetUser) {
        return res.status(404).send(req.isHtmx ? 'Zielbenutzer nicht gefunden.' : errorHtml('Zielbenutzer nicht gefunden.'));
    }

    // Primär-Admin und Nutzer mit Rolle 'Admin' dürfen nicht gelöscht werden
    if (idToDelete === 1 || hasAdminRole(targetUser)) {
        return res.status(403).send(req.isHtmx ? 'Administratoren können nicht gelöscht werden.' : errorHtml('Administratoren können nicht gelöscht werden.'));
    }

    await adminService.deleteUser(actorId, idToDelete);

    if (req.isHtmx) {
        return res.send('');
    }

    res.redirect('/adminPage');
}));

/**
 * POST /admin/manual-points
 * Vergibt manuell Punkte an einen Benutzer durch einen Admin.
 * @name POST /manual-points
 * @function
 * @inner
 */
router.post('/manual-points', asyncHandler(async (req, res) => {
    const { user_id, points, reason } = req.body;
    const actorId = req.session.user.id;
    const pointsNum = Number(points);

    if (isNaN(pointsNum) || pointsNum < -50 || pointsNum > 50) {
        return res.status(400).send(req.isHtmx ? 'Punkte müssen zwischen -50 und +50 liegen.' : errorHtml('Punkte müssen zwischen -50 und +50 liegen.'));
    }

    await adminService.assignManualPoints(actorId, user_id, pointsNum, reason);

    if (req.isHtmx) {
        return res.send('<div class="hx-message">Punkte erfolgreich vergeben.</div>');
    }
    res.redirect('/adminPage');
}));

/**
 * POST /admin/reset-password
 * Setzt das Passwort eines Benutzers auf einen zufälligen Wert zurück.
 * @name POST /reset-password
 * @function
 * @inner
 */
router.post('/reset-password', asyncHandler(async (req, res) => {
    const { user_id } = req.body;
    const actorId = req.session.user.id;
    const targetId = Number(user_id);

    if (!targetId || isNaN(targetId)) return res.status(400).send(req.isHtmx ? 'Ungültiger Benutzer.' : errorHtml('Ungültiger Benutzer.'));

    const targetUser = await adminService.getUserForAdmin(targetId);
    if (!targetUser) return res.status(404).send(req.isHtmx ? 'Benutzer nicht gefunden.' : errorHtml('Benutzer nicht gefunden.'));

    // Generiere ein 8-stelliges alphanumerisches Passwort
    const genPassword = Math.random().toString(36).slice(-8).padStart(8, '0');

    const hash = await hashService.hash(genPassword);
    await adminService.resetUserPassword(actorId, targetId, hash);

    if (req.isHtmx) {
        return res.send(`<div class="generated-pw">Passwort: <strong>${genPassword}</strong></div>`);
    }

    res.redirect('/adminPage');
}));

module.exports = router;
