/**
 * @fileoverview Service für Umfragen: Erstellung, Abruf, Abstimmungen und Ergebnisse.
 * Beinhaltet Berechtigungsprüfungen, Paging, Fuse.js-Suche und Punktevergabe.
 * JSDoc-Kommentare in Deutsch.
 * @module lib/services/surveyService
 */

const db = require('../../config/db.js');
const pointsService = require('./pointsService');
const { isAdmin: hasAdminRole, isProjectLead } = require('../roleHelpers');

/**
 * canUserCreateSurvey — Funktion mit spezifischer Aufgabe, siehe Implementierung.
 *
 * @returns {*} Beschreibung des Rückgabewerts
 * @function canUserCreateSurvey
 */
function canUserCreateSurvey(user) {
    if (!user) return false;
    return hasAdminRole(user) || isProjectLead(user);
}

async function fetchSurveys({ userId, userRole, type = 'all', search = '', limit = 10, offset = 0 }) {
    let baseQuery = `
      SELECT 
        s.survey_id,
        s.title,
        s.description,
        s.image_url,
        s.is_private,
        s.access_code,
        s.created_at,
        s.user_id,
        u.username as creator_name,
        COALESCE((SELECT COUNT(DISTINCT sr.user_id) 
                  FROM survey_responses sr 
                  WHERE sr.survey_id = s.survey_id), 0) as response_count
      FROM surveys s
      LEFT JOIN users u ON s.user_id = u.user_id
      WHERE 1=1
    `;
    const baseParams = [];

    if (hasAdminRole(userRole)) {
        if (type === 'public') baseQuery += ' AND s.is_private = FALSE';
        else if (type === 'private') baseQuery += ' AND s.is_private = TRUE';
        else if (type === 'my') { baseQuery += ' AND s.user_id = ?'; baseParams.push(userId); }
    } else {
        if (type === 'public') baseQuery += ' AND s.is_private = FALSE';
        else if (type === 'private') { baseQuery += ' AND s.is_private = TRUE AND s.user_id = ?'; baseParams.push(userId); }
        else if (type === 'my') { baseQuery += ' AND s.user_id = ?'; baseParams.push(userId); }
        else { baseQuery += ' AND (s.is_private = FALSE OR s.user_id = ?)'; baseParams.push(userId); }
    }

    if (search && search.trim()) {
        const q = search.trim();
        const tokens = q.split(/[\s,.;:!?|/-]+/).filter(Boolean);
        const booleanQ = tokens.map(t => t.length > 2 ? `${t}*` : t).join(' ');
        baseQuery += ' AND (MATCH(s.title) AGAINST(? IN BOOLEAN MODE) OR (s.description IS NOT NULL AND s.description != \'\' AND MATCH(s.description) AGAINST(? IN BOOLEAN MODE)) OR (u.username IS NOT NULL AND LOWER(u.username) LIKE CONCAT(\'%\', LOWER(?), \'%\')))';
        baseParams.push(booleanQ, booleanQ, q);
    }

    baseQuery += ' ORDER BY s.created_at DESC';
    const allSurveys = await db.query(baseQuery, baseParams);
    const totalCount = allSurveys.length;
    const paginatedSurveys = allSurveys.slice(offset, offset + limit);

    return {
        surveys: paginatedSurveys,
        totalCount,
        totalPages: Math.ceil(totalCount / limit)
    };
}

async function createSurvey(userId, userRole, { title, description, surveyImage, questions, isPrivateForm }) {
    let isPrivate;
    if (hasAdminRole(userRole)) {
        isPrivate = isPrivateForm === 'true' || isPrivateForm === true;
    } else {
        isPrivate = true;
    }

    const { randomUUID } = require('crypto');
    const accessCode = isPrivate ? randomUUID().substring(0, 8) : null;

    const surveyResult = await db.query(
        'INSERT INTO surveys (title, description, image_url, is_private, access_code, user_id) VALUES (?, ?, ?, ?, ?, ?)',
        [
            title.trim(),
            description?.trim() || null,
            surveyImage?.trim() || null,
            isPrivate ? 1 : 0,
            accessCode,
            userId
        ]
    );

    const surveyId = surveyResult.insertId;

    // Verteile Punkte für das Erstellen einer Umfrage
    await pointsService.addPendingDelta({ userId, delta: pointsService.POINT_VALUES.SURVEY_CREATED_BASE, reason: 'survey-create', source: 'surveyService' });

    if (questions && Array.isArray(questions)) {
        for (let i = 0; i < questions.length; i++) {
            const question = questions[i];
            if (question.text && question.text.trim()) {
                            const questionResult = await db.query(
                                'INSERT INTO survey_questions (survey_id, question_text, image_url) VALUES (?, ?, ?)',
                                [surveyId, question.text.trim(), question.image?.trim() || null]
                            );

                const questionId = questionResult.insertId;

                if (question.options && Array.isArray(question.options)) {
                    for (let j = 0; j < question.options.length; j++) {
                        const option = question.options[j];
                        if (option.text && option.text.trim()) {
                            await db.query(
                                'INSERT INTO survey_options (question_id, option_text, image_url) VALUES (?, ?, ?)',
                                [questionId, option.text.trim(), option.imageUrl?.trim() || null]
                            );
                        }
                    }
                }
            }
        }
    }

    return { surveyId, accessCode, isPrivate, title };
}

async function deleteSurvey(surveyId, userId, userRole) {
    let conn;
    try {
        conn = await db.getConnection();
        await conn.beginTransaction();

        const _surveyRows = await conn.query('SELECT * FROM surveys WHERE survey_id = ? FOR UPDATE', [surveyId]);
        const survey = _surveyRows[0];

        if (!survey) {
            await conn.rollback();
            return { success: false, error: 'NOT_FOUND' };
        }

        const isOwner = survey.user_id === userId;
        const isAdmin = hasAdminRole(userRole);

        if (!isOwner && !isAdmin) {
            await conn.rollback();
            return { success: false, error: 'FORBIDDEN' };
        }

        const lockedResponses = await conn.query('SELECT response_id FROM survey_responses WHERE survey_id = ? FOR UPDATE', [surveyId]);
        const participants = (lockedResponses || []).length;

        if (participants === 0) {
            await pointsService.addPendingDelta({ userId: survey.user_id, delta: -pointsService.POINT_VALUES.SURVEY_CREATED_BASE, reason: 'survey-delete-no-participants', source: 'surveyService', conn });
        } else {
            const bonus = participants * pointsService.POINT_VALUES.SURVEY_AUTHOR_BONUS;
            await pointsService.addPendingDelta({ userId: survey.user_id, delta: bonus, reason: 'survey-delete-bonus', source: 'surveyService', conn });
        }

        await conn.query('DELETE FROM surveys WHERE survey_id = ?', [surveyId]);

        await conn.commit();
        return { success: true };
    } catch (error) {
        if (conn) await conn.rollback();
        throw error;
    } finally {
        if (conn) conn.release();
    }
}

async function getSurveyWithQuestions(surveyId, userId) {
    const surveyRows = await db.query(
        `SELECT s.*, u.username as creator_name 
         FROM surveys s 
         LEFT JOIN users u ON s.user_id = u.user_id 
         WHERE s.survey_id = ?`,
        [surveyId]);
    const survey = surveyRows[0];

    if (!survey) return null;

    const questions = await db.query(
        'SELECT * FROM survey_questions WHERE survey_id = ? ORDER BY question_id ASC',
        [surveyId]);

    for (let q of questions) {
        q.options = await db.query(
            'SELECT * FROM survey_options WHERE question_id = ? ORDER BY option_id ASC',
            [q.question_id]);
    }

    const hasVoted = await db.query(
        'SELECT 1 FROM survey_responses WHERE survey_id = ? AND user_id = ? LIMIT 1',
        [surveyId, userId]).length > 0;

    return { ...survey, questions, hasVoted };
}

async function checkSurveyAccess(surveyId, userId, userRole) {
    const surveyRows = await db.query('SELECT user_id, is_private FROM surveys WHERE survey_id = ?', [surveyId]);
    const survey = surveyRows[0];
    if (!survey) return { allowed: false, error: 'NOT_FOUND' };

    if (hasAdminRole(userRole)) return { allowed: true };
    if (!survey.is_private) return { allowed: true };
    if (survey.user_id === userId) return { allowed: true };

    const hasVoted = await db.query(
        'SELECT 1 FROM survey_responses WHERE survey_id = ? AND user_id = ? LIMIT 1',
        [surveyId, userId]).length > 0;
    if (hasVoted) return { allowed: true };

    const hasAccess = await db.query(
        'SELECT 1 FROM survey_access WHERE survey_id = ? AND user_id = ? LIMIT 1',
        [surveyId, userId]).length > 0;
    if (hasAccess) return { allowed: true };

    return { allowed: false, error: 'FORBIDDEN' };
}

async function getSurveyResults(surveyId, userId) {
    // Prüfe, ob die Umfrage existiert
    const survey = await getSurveyWithQuestions(surveyId, userId);
    if (!survey) return null;

    // Lade die eigenen Stimmen des Benutzers
        const userVotes = await db.query(`-- sql
      SELECT sr.question_id, sr.option_id, so.option_text
      FROM survey_responses sr
      JOIN survey_options so ON sr.option_id = so.option_id
      WHERE sr.survey_id = ? AND sr.user_id = ?
                `, [surveyId, userId]);

    // Hole Gesamtergebnisse inkl. `total_voters`
        const questions = await db.query(`-- sql
      SELECT 
        sq.question_id, 
        sq.question_text, 
        so.option_id, 
        so.option_text, 
        so.image_url,
                COUNT(sr.option_id) as votes,
        (SELECT COUNT(DISTINCT user_id) FROM survey_responses WHERE survey_id = ?) as total_voters
      FROM survey_questions sq
      LEFT JOIN survey_options so ON sq.question_id = so.question_id
      LEFT JOIN survey_responses sr ON so.option_id = sr.option_id AND sr.survey_id = ?
      WHERE sq.survey_id = ?
      GROUP BY sq.question_id, so.option_id
      ORDER BY sq.question_id, so.option_id
                `, [surveyId, surveyId, surveyId]);

    // Gruppiere Daten pro Frage
    const questionsMap = {};
    // Gruppiere die Abfrageergebnisse pro Frage-ID und sammle Optionen
    questions.forEach(row => {
        if (!questionsMap[row.question_id]) {
            questionsMap[row.question_id] = {
                question_id: row.question_id,
                question_text: row.question_text,
                options: [],
                total_voters: row.total_voters
            };
        }

        if (row.option_id) {
            questionsMap[row.question_id].options.push({
                option_id: row.option_id,
                option_text: row.option_text,
                image_url: row.image_url,
                votes: row.votes || 0
            });
        }
    });

    // Berechne Prozentwerte und markiere eigene Stimme
    const questionsData = Object.values(questionsMap).map(question => {
        // Gesamtanzahl Stimmen pro Frage
        const totalVotes = question.options.reduce((sum, opt) => sum + (opt.votes || 0), 0);
        // Eigene Stimme des Nutzers für diese Frage (falls vorhanden)
        const userVote = userVotes.find(v => v.question_id === question.question_id);

        return {
            ...question,
            // Rechne pro Option den Prozentanteil und markiere, ob der Nutzer diese Option gewählt hat
            options: question.options.map(option => {
                const isUserVote = userVote && userVote.option_id === option.option_id;
                return {
                    ...option,
                    percentage: totalVotes > 0 ? Math.round((option.votes / totalVotes) * 100) : 0,
                    isUserVote: isUserVote
                };
            }),
            total_votes: totalVotes,
            user_vote: userVote
        };
    });

    return {
        survey,
        questions: questionsData
    };
}

async function validatePrivateAccess(code, surveyId, userId) {
    let query = 'SELECT survey_id FROM surveys WHERE access_code = ?';
    const params = [code.trim()];
    
    if (surveyId) {
        query += ' AND survey_id = ?';
        params.push(surveyId);
    }
    
    const surveys = await db.query(query, params);
    
    if (surveys.length > 0) {
        const grantedSurveyId = surveys[0].survey_id;
        await db.query(
            'INSERT IGNORE INTO survey_access (user_id, survey_id) VALUES (?, ?)',
            [userId, grantedSurveyId]
        );
        return { success: true, surveyId: grantedSurveyId };
    }
    return { success: false, error: 'Ungültiger Zugangscode' };
}

async function checkUserHasExplicitAccess(surveyId, userId) {
    const accessRows = await db.query(
        'SELECT 1 FROM survey_access WHERE survey_id = ? AND user_id = ? LIMIT 1',
        [surveyId, userId]);
    const accessCheck = accessRows[0];
    return !!accessCheck;
}

async function submitVote(surveyId, userId, questionResponses) {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        // 1. Prüfe, ob Umfrage existiert und ermittle Besitzer
        const _surveyArows = await conn.query('SELECT user_id FROM surveys WHERE survey_id = ? FOR UPDATE', [surveyId]);
        const [survey] = _surveyArows;
        if (!survey) {
            await conn.rollback();
            return { success: false, error: 'NOT_FOUND' };
        }

        // 2. Prüfe, ob bereits abgestimmt wurde
        const _alreadyRows = await conn.query('SELECT 1 FROM survey_responses WHERE survey_id = ? AND user_id = ? LIMIT 1', [surveyId, userId]);
        const [alreadyVoted] = _alreadyRows;
        if (alreadyVoted) {
            await conn.rollback();
            return { success: false, error: 'ALREADY_VOTED' };
        }

        // 3. Speichere Antworten
        for (const resp of questionResponses) {
            await conn.query('INSERT INTO survey_responses (survey_id, question_id, option_id, user_id) VALUES (?, ?, ?, ?)', [surveyId, resp.questionId, resp.optionId, userId]);
        }

        // 4. Vergib Punkte an den Autor (wenn nicht selbst)
        if (String(survey.user_id) !== String(userId)) {
            await pointsService.addPendingDelta({
                userId: survey.user_id,
                delta: pointsService.POINT_VALUES.SURVEY_AUTHOR_BONUS,
                reason: 'survey_response_author_bonus',
                source: surveyId,
                conn
            });
        }

        // 5. Vergib Punkte an den Teilnehmer
        await pointsService.addPendingDelta({
            userId,
            delta: pointsService.POINT_VALUES.SURVEY_PARTICIPATION,
            reason: 'survey_participation',
            source: surveyId,
            conn
        });

        await conn.commit();
        return { success: true };
    } catch (err) {
        if (conn) await conn.rollback();
        throw err;
    } finally {
        if (conn) conn.release();
    }
}

module.exports = {
    canUserCreateSurvey,
    fetchSurveys,
    createSurvey,
    deleteSurvey,
    getSurveyWithQuestions,
    checkSurveyAccess,
    getSurveyResults,
    submitVote,
    validatePrivateAccess,
    checkUserHasExplicitAccess
};


