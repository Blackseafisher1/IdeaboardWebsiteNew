/**
 * @fileoverview Umfragen-Routen: Erstellen, Liste, Abstimmungen, Ergebnisse und Zugangscode-Handling.
 * Beinhaltet HTMX-unterstützte Partials und serverseitige Zugriffskontrollen via `surveyService`.
 * @module routes/surveys
 */

const express = require('express');
const router = express.Router();
const asyncHandler = require('../lib/asyncHandler');
const surveyService = require('../lib/services/surveyService');
const { errorHtml } = require('../lib/http');
const { isAdmin: hasAdminRole, normalizeUser } = require('../lib/roleHelpers');

// Auth Guard - centralized
const { isLoggedIn } = require('./middleware');

router.use(isLoggedIn);
const htmxDetector = require('../lib/htmxDetector');
router.use(htmxDetector.middleware);


// POST /surveys/:id/delete - delete survey (HTMX aware)
/**
 * POST /:id/delete-survey
 * Löscht eine Umfrage. Berücksichtigt Berechtigungen des Nutzers/Admins.
 * @name POST /:id/delete-survey
 * @function
 * @inner
 */
router.post('/:id/delete-survey', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.session.user.id;
  const userRole = req.session.user.role;

  try {
    const result = await surveyService.deleteSurvey(id, userId, userRole);
    
    if (!result.success) {
      if (result.error === 'NOT_FOUND') {
        if (req.isHtmx) {
            return res.status(404).send('');
          }
        req.session.flash = { type: 'error', message: 'Umfrage nicht gefunden' };
        return res.redirect('/surveys');
      }
      
      if (result.error === 'FORBIDDEN') {
        if (req.isHtmx) {
          return res.status(403).send('<div class="error">Keine Berechtigung</div>');
        }
        return res.status(403).send(errorHtml('Keine Berechtigung zum Löschen dieser Umfrage'));
      }
    }

    // Falls kein HTMX, zur Hauptseite weiterleiten
    if (!req.isHtmx) {
      return res.redirect('/surveys');
    }
    
    // For HTMX: 200 OK with empty content to remove element
    return res.status(200).send('');
    
  } catch (error) {
    console.error('Fehler beim Löschen der Umfrage:', error);

    if (req.isHtmx) {
      return res.status(500).send('<div class="error">Fehler beim Löschen</div>');
    }

    req.session.flash = { 
      type: 'error', 
      message: 'Fehler beim Löschen der Umfrage' 
    };
    res.redirect('/surveys');
  }
}));


// GET /surveys - Main page (Shell, Liste via HTMX)
/**
 * GET /
 * Hauptseite für Umfragen. Zeigt Filter und die Liste der Umfragen an.
 * @name GET /
 * @function
 * @inner
 */
router.get('/', asyncHandler(async (req, res) => {
  const type = req.query.type || 'all';
  const search = req.query.search || '';
  const page = parseInt(req.query.page, 10) || 1;

  // Wenn HTMX die Hauptseite angefragt hat, gib nur die Liste (Partial) zurück
    if (req.isHtmx) {
    return await renderSurveysList(req, res);
  }

  const templateUser = normalizeUser({ ...req.session.user, user_id: req.session.user.id });

  return res.render('surveys/survey', {
    title: 'Umfragen',
    user: templateUser,
    currentType: type,
    search,
    currentPage: page
  });
}));

// Umfragen-Liste rendern (Partial) - extrahiert, damit sowohl / als auch /fragment es nutzen können
async function renderSurveysList(req, res) {
  if (!req.session?.user) {
    return res.status(200).send('<div class="no-surveys"><p>Bitte neu einloggen</p></div>');
  }

  const userId = req.session.user.id;
  const userRole = req.session.user.role;

  // Robustly handle duplicate query params (arrays)
  const typeRaw = req.query.type ?? 'all';
  const searchRaw = req.query.search ?? '';
  const pageRaw = req.query.page ?? '1';

  const type = Array.isArray(typeRaw) ? String(typeRaw[typeRaw.length - 1]) : String(typeRaw);
  const search = Array.isArray(searchRaw) ? String(searchRaw[searchRaw.length - 1]) : String(searchRaw);
  let currentPage = parseInt(Array.isArray(pageRaw) ? pageRaw[pageRaw.length - 1] : String(pageRaw), 10) || 1;

  const limit = 10;
  const offset = (currentPage - 1) * limit;

  const { surveys, totalPages, totalCount } = await surveyService.fetchSurveys({
    userId,
    userRole,
    type,
    search,
    limit,
    offset
  });

  const templateUser = normalizeUser({ ...req.session.user, user_id: req.session.user.id });

  const hasNext = currentPage < totalPages;
  // If this was an HTMX request, instruct HTMX to push the clean `/surveys?...` URL
  if (req.isHtmx) {
    const pushUrl = `/surveys?type=${encodeURIComponent(type)}&search=${encodeURIComponent(search)}&page=${currentPage}`;
    res.set('HX-Push', pushUrl);
  }

  return res.render('surveys/partials/surveys-list', {
    surveys,
    user: templateUser,
    currentType: type,
    search,
    currentPage,
    totalPages,
    totalResults: totalCount,
    hasPrevPage: currentPage > 1,
    hasNextPage: hasNext,
    prevPage: currentPage > 1 ? currentPage - 1 : null,
    nextPage: hasNext ? currentPage + 1 : null
  });
}

// Keep /fragment for backward compatibility
/**
 * GET /fragment
 * Liefert das Listen-Fragment der Umfragen via HTMX für Infinite Scroll oder Filter.
 * @name GET /fragment
 * @function
 * @inner
 */
router.get('/fragment', asyncHandler(async (req, res) => {
  return await renderSurveysList(req, res);
}));






// POST /surveys - Create new survey (updated with images & role logic)
/**
 * POST /
 * Erstellt eine neue Umfrage mit Fragen und Optionen.
 * @name POST /
 * @function
 * @inner
 */
router.post('/', asyncHandler(async (req, res) => {
  if (!surveyService.canUserCreateSurvey(req.session.user)) {
    return res.status(403).send(req.isHtmx ? 'Zugriff verweigert - Keine Berechtigung zum Erstellen von Umfragen' : errorHtml('Zugriff verweigert - Keine Berechtigung zum Erstellen von Umfragen'));
  }

  const userId = req.session.user.id;
  const userRole = req.session.user.role;
  const { title, description, surveyImage, questions } = req.body;
  const isPrivateForm = req.body.isPrivate;

  if (!title || !title.trim()) {
    return res.status(400).send(req.isHtmx ? 'Titel ist erforderlich' : errorHtml('Titel ist erforderlich'));
  }

  const { accessCode, isPrivate } = await surveyService.createSurvey(userId, userRole, {
    title,
    description,
    surveyImage,
    questions,
    isPrivateForm
  });

  // Erfolgsmeldung inkl. Zugangscode für private Umfragen erstellen
  let successMessage = `Umfrage "${title.trim()}" erfolgreich erstellt!`;
  
  if (isPrivate) {
    successMessage += ` Zugangscode: ${accessCode}`;
    if (!hasAdminRole(userRole)) {
      successMessage += ' (automatisch privat für Nicht-Admins)';
    }
  } else {
    successMessage += ' (öffentlich für alle)';
  }

  req.session.flash = { 
    type: 'success', 
    message: successMessage
  };
  
  res.redirect('/surveys');
}));

// GET /surveys/new - Show create form
/**
 * GET /new
 * Zeigt das Formular zum Erstellen einer neuen Umfrage an.
 * @name GET /new
 * @function
 * @inner
 */
router.get('/new', asyncHandler(async (req, res) => {
  if (!surveyService.canUserCreateSurvey(req.session.user)) {
    return res.status(403).send(req.isHtmx ? 'Zugriff verweigert - Keine Berechtigung zum Erstellen von Umfragen' : errorHtml('Zugriff verweigert - Keine Berechtigung zum Erstellen von Umfragen'));
  }

  res.render('surveys/create-survey', {
    user: normalizeUser(req.session.user),
    title: 'Neue Umfrage erstellen'
  });
}));

// POST /surveys/private - validate access code
/**
 * POST /private
 * Validiert den Zugangscode für eine private Umfrage.
 * @name POST /private
 * @function
 * @inner
 */
router.post('/private', asyncHandler(async (req, res) => {
  const { code, surveyId } = req.body;
  
  if (!code) {
    return res.render('surveys/private-access', {
      user: normalizeUser(req.session.user),
      title: 'Private Umfrage',
      surveyId: surveyId || '',
      error: 'Zugangscode ist erforderlich'
    });
  }

  const userId = req.session.user.id;
  const result = await surveyService.validatePrivateAccess(code, surveyId, userId);
  
  if (result.success) {
    res.redirect(`/surveys/${result.surveyId}`);
  } else {
    return res.render('surveys/private-access', {
      user: normalizeUser(req.session.user),
      title: 'Private Umfrage',
      surveyId: surveyId || '',
      error: result.error
    });
  }
}));

// POST /surveys/:id/vote - Submit vote (updated with survey_access)
/**
 * POST /:id/vote
 * Speichert die Antworten eines Nutzers für eine bestimmte Umfrage.
 * @name POST /:id/vote
 * @function
 * @inner
 */
router.post('/:id/vote', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.session.user.id;
  const userRole = req.session.user.role;

  // Zugriffsprüfung über den Service
  const access = await surveyService.checkSurveyAccess(id, userId, userRole);
  if (!access.allowed) {
    if (access.error === 'NOT_FOUND') return res.status(404).send(req.isHtmx ? 'Umfrage nicht gefunden' : errorHtml('Umfrage nicht gefunden'));
    return res.status(403).send(req.isHtmx ? 'Sie haben keine Berechtigung für diese Umfrage. Bitte geben Sie zuerst den Zugangscode ein.' : errorHtml('Sie haben keine Berechtigung für diese Umfrage. Bitte geben Sie zuerst den Zugangscode ein.'));
  }

  const survey = await surveyService.getSurveyWithQuestions(id, userId);
  if (!survey) return res.status(404).send(req.isHtmx ? 'Umfrage nicht gefunden' : errorHtml('Umfrage nicht gefunden'));

  if (survey.hasVoted) {
    return res.status(400).send(req.isHtmx ? 'Sie haben bereits an dieser Umfrage teilgenommen' : errorHtml('Sie haben bereits an dieser Umfrage teilgenommen'));
  }

  const responses = [];
  let hatFehlendeAntwort = false;
  // Prüfe jede Frage auf eine Antwort; sammle Option-Ids und markiere fehlende Antworten
  survey.questions.forEach(question => {
    const answer = req.body[`question_${question.question_id}`];
    if (!answer) {
      hatFehlendeAntwort = true;
      return;
    }
    responses.push({
      questionId: question.question_id,
      optionId: parseInt(answer)
    });
  });

  if (hatFehlendeAntwort) {
    return res.status(400).send(req.isHtmx ? 'Bitte beantworten Sie alle Fragen' : errorHtml('Bitte beantworten Sie alle Fragen'));
  }

  const result = await surveyService.submitVote(id, userId, responses);
  if (!result.success) {
    if (result.error === 'ALREADY_VOTED') return res.status(400).send(req.isHtmx ? 'Sie haben bereits an dieser Umfrage teilgenommen' : errorHtml('Sie haben bereits an dieser Umfrage teilgenommen'));
    if (result.error === 'NOT_FOUND') return res.status(404).send(req.isHtmx ? 'Umfrage nicht gefunden' : errorHtml('Umfrage nicht gefunden'));
    return res.status(500).send(req.isHtmx ? 'Fehler beim Speichern der Stimme' : errorHtml('Fehler beim Speichern der Stimme'));
  }
  
  res.redirect(`/surveys/${id}/results`);
}));

// GET /surveys/:id/results - show survey results
/**
 * GET /:id/results
 * Zeigt die Ergebnisse einer Umfrage (Diagramme/Statistiken).
 * @name GET /:id/results
 * @function
 * @inner
 */
router.get('/:id/results', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.session.user.id;
  const userRole = req.session.user.role;

  const access = await surveyService.checkSurveyAccess(id, userId, userRole);
  if (!access.allowed) {
    if (access.error === 'NOT_FOUND') return res.status(404).send(req.isHtmx ? 'Umfrage nicht gefunden' : errorHtml('Umfrage nicht gefunden'));
    return res.status(403).send(req.isHtmx ? 'Sie haben keine Berechtigung für diese Ergebnisse' : errorHtml('Sie haben keine Berechtigung für diese Ergebnisse'));
  }

  const result = await surveyService.getSurveyResults(id, userId);
  if (!result) return res.status(404).send(req.isHtmx ? 'Umfrage nicht gefunden' : errorHtml('Umfrage nicht gefunden'));

  const { survey, questions } = result;
  const isOwner = survey.user_id === userId;
  const isAdmin = hasAdminRole(userRole);
  const canEdit = isOwner || isAdmin;

  res.render('surveys/survey-results', {
    survey,
    questions,
    user: normalizeUser(req.session.user),
    title: `Ergebnisse: ${survey.title}`,
    hasVoted: survey.hasVoted,
    canEdit,
    isOwner,
    accessCode: survey.access_code
  });
}));

// GET /surveys/:id - show survey details (with images)
/**
 * GET /:id
 * Zeigt die Detailseite einer Umfrage oder das Abstimmungsformular an.
 * @name GET /:id
 * @function
 * @inner
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.session.user.id;
  const userRole = req.session.user.role;

  const access = await surveyService.checkSurveyAccess(id, userId, userRole);
  if (!access.allowed) {
    if (access.error === 'NOT_FOUND') return res.status(404).send(req.isHtmx ? 'Umfrage nicht gefunden' : errorHtml('Umfrage nicht gefunden'));
    return res.render('surveys/private-access', {
      user: normalizeUser(req.session.user),
      title: 'Private Umfrage',
      surveyId: id,
      error: null
    });
  }

  const survey = await surveyService.getSurveyWithQuestions(id, userId);
  
  if (!survey) {
    return res.status(404).send(req.isHtmx ? 'Umfrage nicht gefunden' : errorHtml('Umfrage nicht gefunden'));
  }

  // Prüfen, ob der Benutzer bereits abgestimmt hat
  if (survey.hasVoted) {
    return res.redirect(`/surveys/${id}/results`);
  }

  res.render('surveys/survey-form', {
    survey,
    questions: survey.questions,
    user: normalizeUser(req.session.user),
    title: survey.title,
    hasVoted: false
  });
}));


module.exports = router;
