/**
 * @fileoverview Kommentar-Routen für Ideen: Erstellen, Laden und Partials.
 * Exportiert einen Router mit `mergeParams:true` zur Nutzung innerhalb von `/ideas/:id`.
 * @module routes/comments
 */

const express = require('express');
const router = express.Router({ mergeParams: true });
const asyncHandler = require('../lib/asyncHandler');
const { 
  createComment, 
  loadSingleCommentWithReactions, 
  loadCommentsWithReactions 
} = require('../lib/services/ideasCommentsService');
const liveUpdates = require('../lib/liveUpdates');

const { isLoggedIn } = require('./middleware');
router.use(isLoggedIn);
const htmxDetector = require('../lib/htmxDetector');
router.use(htmxDetector.middleware);

/**
 * POST /comments (innerhalb /ideas/:id)
 * Erstellt einen neuen Kommentar zu einer Idee.
 * @name POST /
 * @function
 * @inner
 */
router.post('/', asyncHandler(async (req, res) => {
  const { id: ideaId } = req.params;
  const userId = req.session.user.id;
  const { text } = req.body;

  try {
    const commentId = await createComment(ideaId, userId, text);
    const single = await loadSingleCommentWithReactions(commentId, userId);
    
    if (!single) return res.status(500).send('Fehler beim Laden des Kommentars');

    // Sitzung für lokale Like-Zustände aktualisieren
    req.session.user.commentLikes = {
      ...(req.session.user.commentLikes || {}),
      ...(single.commentLikes || {})
    };

    liveUpdates.recordChange(ideaId, 'comment_added', { 
      comment_id: commentId, 
      user: req.session.user.username 
    });

    if (req.isHtmx) {
      try {
        res.setHeader('HX-Trigger', JSON.stringify({ [`idea_updated_${ideaId}`]: true }));
      } catch (e) {}
      
      return res.render('ideas/_comment-item', {
        comment: single.comment,
        user: { ...req.session.user },
        layout: false
      });
    }

    res.redirect(`/ideas/${ideaId}`);
  } catch (err) {
    if (err.message === 'Text fehlt' || err.message === 'Kommentar zu lang') {
      return res.status(400).send(err.message);
    }
    throw err;
  }
}));

/**
 * GET /comments/:commentId (innerhalb /ideas/:id)
 * Liefert das HTML-Fragment eines einzelnen Kommentars.
 * @name GET /:commentId
 * @function
 * @inner
 */
router.get('/:commentId', asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  const userId = req.session.user.id;

  const single = await loadSingleCommentWithReactions(commentId, userId);
  if (!single) return res.status(404).send('Kommentar nicht gefunden');

  res.render('ideas/_comment-item', {
    comment: single.comment,
    user: req.session.user,
    layout: false
  });
}));

/**
 * GET /comments (innerhalb /ideas/:id)
 * Liefert die Liste aller Kommentare zu einer Idee.
 * @name GET /
 * @function
 * @inner
 */
router.get('/', asyncHandler(async (req, res) => {
  const { id: ideaId } = req.params;
  const userId = req.session.user.id;

  const { comments, commentLikes } = await loadCommentsWithReactions(ideaId, userId);
  
  res.render('ideas/_comments-section', {
    idea: { idea_id: ideaId, comments },
    user: { ...req.session.user, commentLikes },
    layout: false
  });
}));

module.exports = router;
