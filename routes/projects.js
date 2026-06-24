/**
 * @fileoverview Projekt-Routen: Auflistung, Erstellung, Team-Management und HTMX-Fragmente.
 * Nutzt `ProjectService` für Geschäftslogik; alle JSDoc-Kommentare sind auf Deutsch.
 * @module routes/projects
 */

const express = require('express');
const router = express.Router();
const ProjectService = require('../lib/services/projectService');
const asyncHandler = require('../lib/asyncHandler');
const { isLoggedIn } = require('./middleware');
const { errorHtml } = require('../lib/http');

// Auth Guard - Schütze alle Routen
router.use(isLoggedIn);
const htmxDetector = require('../lib/htmxDetector');
router.use(htmxDetector.middleware);

// --- Helper Functions ---

/**
 * Gemeinsame Logik zum Rendern des Projekt-Fragmentes (für HTMX).
 * @async
 */
async function renderProjectsFragment(req, res) {
    const page = parseInt(req.query.page, 10) || 1;
    const { status, search, userOnly } = req.query;

    const result = await ProjectService.getProjectsList(req.session.user, {
        page,
        status: status || 'all',
        search: search || '',
        userOnly: userOnly || false
    });

    return res.render('projects/_list', {
        ...result,
        user: req.session.user
    });
}

// --- Routes ---

// GET /projects - Hauptseite
/**
 * GET /
 * Hauptseite der Projekte. Lädt die Projektliste und Filteroptionen.
 * Unterstützt HTMX-Partial-Requests für die Liste.
 * @name GET /
 * @function
 * @inner
 */
router.get('/', asyncHandler(async (req, res) => {
    // Wenn HTMX anfragt, gib nur das Fragment zurück
    if (req.isHtmx) {
        return await renderProjectsFragment(req, res);
    }

    // Query params for initial state
    const status = req.query.status || 'all';
    const search = req.query.search || '';
    const userOnly = req.query.userOnly === 'on' || req.query.userOnly === 'true';
    const page = parseInt(req.query.page, 10) || 1;

    const contactOptions = await ProjectService.getContactOptions(req.session.user);

    res.render('projects/projects', {
        title: 'Projekte',
        user: req.session.user,
        users: contactOptions,
        canCreate: ProjectService.canUserCreateProject(req.session.user),
        currentStatus: status,
        currentSearch: search,
        isUserOnly: userOnly,
        currentPage: page
    });
}));

// GET /projects/fragment - HTMX + Infinite Scroll
/**
 * GET /fragment
 * Liefert das Projekt-Listen-Fragment für Infinite Scroll oder Filter-Updates via HTMX.
 * @name GET /fragment
 * @function
 * @inner
 */
router.get('/fragment', asyncHandler(async (req, res) => {
    return await renderProjectsFragment(req, res);
}));

// GET /projects/contact-search - Ansprechpartner-Suche für Create-Modal
router.get('/contact-search', asyncHandler(async (req, res) => {
    if (!ProjectService.canUserCreateProject(req.session.user)) {
        return res.status(403).json([]);
    }
    const users = await ProjectService.searchContactCandidates(req.query.q);
    return res.json(users);
}));

// POST /projects - Projekt erstellen (nur Admin)
/**
 * POST /
 * Erstellt ein neues Projekt. Nur für berechtigte Nutzer (Admins).
 * @name POST /
 * @function
 * @inner
 */
router.post('/', asyncHandler(async (req, res) => {
    try {
        await ProjectService.createProject(req.session.user, req.body, {
            autoPromoteContact: req.body.autoPromoteContact !== 'off' && req.body.autoPromoteContact !== 'false'
        });
        res.redirect('/projects');
    } catch (err) {
        if (err.message.startsWith('FORBIDDEN')) {
            return res.status(403).send(errorHtml(err.message.replace('FORBIDDEN: ', '')));
        }
        if (err.message.startsWith('BAD_REQUEST')) {
            return res.status(400).send(errorHtml(err.message.replace('BAD_REQUEST: ', '')));
        }
        throw err;
    }
}));

// POST /projects/:id/edit - Projekt aktualisieren
/**
 * POST /:id/edit
 * Aktualisiert Projektdaten wie Status, Priorität oder Meta-Infos.
 * @name POST /:id/edit
 * @function
 * @inner
 */
router.post('/:id/edit', asyncHandler(async (req, res) => {
    try {
        await ProjectService.updateProject(req.session.user, req.params.id, req.body);
        res.redirect('/projects');
    } catch (err) {
        if (err.message.startsWith('NOT_FOUND')) {
            return res.status(404).send(errorHtml('Projekt nicht gefunden'));
        }
        if (err.message.startsWith('FORBIDDEN')) {
            return res.status(403).send(errorHtml('Zugriff verweigert'));
        }
        if (err.message.startsWith('BAD_REQUEST')) {
            return res.status(400).send(errorHtml(err.message.replace('BAD_REQUEST: ', '')));
        }
        throw err;
    }
}));

// POST /projects/:id/delete - Projekt löschen
/**
 * POST /:id/delete
 * Löscht ein Projekt. Unterstützt HTMX für UI-Updates ohne Reload.
 * @name POST /:id/delete
 * @function
 * @inner
 */
router.post('/:id/delete', asyncHandler(async (req, res) => {
    try {
        await ProjectService.deleteProject(req.session.user, req.params.id);

        // If this was an HTMX request, return an empty body
        if (req.isHtmx) {
            return res.status(200).send('');
        }
        res.redirect('/projects');
    } catch (err) {
        if (err.message.startsWith('NOT_FOUND')) {
            return res.status(404).send(req.isHtmx ? 'Projekt nicht gefunden' : errorHtml('Projekt nicht gefunden'));
        }
        if (err.message.startsWith('FORBIDDEN')) {
            return res.status(403).send(req.isHtmx ? 'Zugriff verweigert' : errorHtml('Zugriff verweigert'));
        }
        throw err;
    }
}));

// --- Team Management Routes ---

// GET /projects/:id/team - Members list
/**
 * GET /:id/team
 * Liefert eine Liste aller Teammitglieder für ein bestimmtes Projekt als JSON.
 * @name GET /:id/team
 * @function
 * @inner
 */
router.get('/:id/team', asyncHandler(async (req, res) => {
    try {
        const result = await ProjectService.getProjectTeam(req.session.user, req.params.id);
        res.json(result);
    } catch (err) {
        if (err.message.startsWith('NOT_FOUND')) {
            return res.status(404).send(req.isHtmx ? 'Projekt nicht gefunden' : errorHtml('Projekt nicht gefunden'));
        }
        throw err;
    }
}));

// GET /projects/users/search - User search for team
/**
 * GET /users/search
 * Sucht nach Benutzern für das Hinzufügen zum Projektteam.
 * @name GET /users/search
 * @function
 * @inner
 */
router.get('/users/search', asyncHandler(async (req, res) => {
    const users = await ProjectService.searchUsers(req.query.q);
    res.json(users);
}));

// POST /projects/:id/team/add - Add member
/**
 * POST /:id/team/add
 * Fügt einem Projekt ein neues Teammitglied mit spezifischer Rolle hinzu.
 * @name POST /:id/team/add
 * @function
 * @inner
 */
router.post('/:id/team/add', asyncHandler(async (req, res) => {
    const { userId, role } = req.body;
    try {
        await ProjectService.addTeamMember(req.session.user, req.params.id, userId, role);
        res.json({ success: true });
    } catch (err) {
        if (err.message.startsWith('NOT_FOUND')) {
            return res.status(404).send(req.isHtmx ? 'Projekt nicht gefunden' : errorHtml('Projekt nicht gefunden'));
        }
        if (err.message.startsWith('FORBIDDEN')) {
            return res.status(403).send(req.isHtmx ? 'Zugriff verweigert' : errorHtml('Zugriff verweigert'));
        }
        throw err;
    }
}));

// POST /projects/:id/team/remove/:userId - Remove member
/**
 * POST /:id/team/remove/:userId
 * Entfernt ein Mitglied aus dem Projektteam.
 * @name POST /:id/team/remove/:userId
 * @function
 * @inner
 */
router.post('/:id/team/remove/:userId', asyncHandler(async (req, res) => {
    try {
        await ProjectService.removeTeamMember(req.session.user, req.params.id, req.params.userId);
        res.json({ success: true });
    } catch (err) {
        if (err.message.startsWith('NOT_FOUND')) {
            return res.status(404).send(req.isHtmx ? 'Projekt nicht gefunden' : errorHtml('Projekt nicht gefunden'));
        }
        if (err.message.startsWith('FORBIDDEN')) {
            // Sende spezifische Fehlermeldung, falls vorhanden (z. B. Ansprechpartner-Schutz)
            const msg = err.message.replace('FORBIDDEN: ', '') || 'Zugriff verweigert';
            return res.status(403).send(req.isHtmx ? msg : errorHtml(msg));
        }
        throw err;
    }
}));

module.exports = router;

