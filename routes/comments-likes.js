/**
 * @fileoverview Routen zum Liken und Reagieren auf Kommentare (HTMX kompatible Partials).
 * Nutzt `ideasCommentsService` für die Geschäftslogik und `liveUpdates` zum Benachrichtigen.
 * @module routes/comments-likes
 */

const express = require('express');
const router = express.Router();
const asyncHandler = require('../lib/asyncHandler');
const { 
  toggleCommentLike, 
  toggleCommentReaction, 
  loadSingleCommentWithReactions 
} = require('../lib/services/ideasCommentsService');
const liveUpdates = require('../lib/liveUpdates');
const { errorHtml } = require('../lib/http');

const { isLoggedIn } = require('./middleware');
router.use(isLoggedIn);
const htmxDetector = require('../lib/htmxDetector');
router.use(htmxDetector.middleware);

// Serverseitige Emoji-Whitelist für Kommentar-Reaktionen
const ALLOWED_REACTION_EMOJIS = ['❤️','😂','😮','😢','😡','🎉','🙏','👀','🤔'];

/**
 * POST /comments-likes/:commentId/react
 * Führt eine Emoji-Reaktion auf einen Kommentar aus.
 * @name POST /:commentId/react
 * @function
 * @inner
 */
router.post('/:commentId/react', asyncHandler(async (req, res) => {
  const commentId = Number(req.params.commentId);
  const userId = req.session.user.id;
  
  // Akzeptiere Emoji aus Body oder Query; unterstütze camelCase und snake_case
  const emoji = req.body.emoji || req.query.emoji;
  const ideaId = Number(req.body.ideaId || req.body.idea_id || req.query.idea_id || req.query.ideaId);

  if (!emoji || !ideaId) {
    console.warn('Emoji-Reaktion: fehlende Parameter:', { emoji, ideaId, body: req.body, query: req.query });
    return res.status(400).send(req.isHtmx ? 'Ungültige Anfrage: emoji und idea_id erforderlich' : errorHtml('Ungültige Anfrage: emoji und idea_id erforderlich'));
  }

  // Emoji gegen Server-Whitelist validieren, um beliebige Werte in der DB zu verhindern
  if (!ALLOWED_REACTION_EMOJIS.includes(String(emoji))) {
    return res.status(400).send(req.isHtmx ? 'Ungültiges Emoji' : errorHtml('Ungültiges Emoji'));
  }

  const { removed, addedEmoji } = await toggleCommentReaction(commentId, userId, emoji);

  liveUpdates.recordChange(ideaId, 'comment_reacted', {
    comment_id: commentId,
    user: req.session.user.username
  });

  if (req.isHtmx) {
    const single = await loadSingleCommentWithReactions(commentId, userId);
    if (!single) return res.status(404).send(req.isHtmx ? 'Nicht gefunden' : errorHtml('Nicht gefunden'));

    return res.render('ideas/_comment-item', {
      comment: single.comment,
      user: req.session.user,
      layout: false
    });
  }

  res.redirect(`/ideas/${ideaId}`);
}));

/**
 * POST /comments-likes/:id/like
 * Toggelt das Like eines Kommentars (Binär-Like).
 * @name POST /:id/like
 * @function
 * @inner
 */
router.post('/:id/like', asyncHandler(async (req, res) => {
  const commentId = Number(req.params.id);
  const userId = req.session.user.id;
  const ideaId = Number(req.query.idea_id ?? req.body.idea_id);

  if (!ideaId) return res.status(400).send(req.isHtmx ? 'idea_id erforderlich' : errorHtml('idea_id erforderlich'));

  const liked = await toggleCommentLike(commentId, userId);

  // Sitzung für lokalen Zustand aktualisieren
  req.session.user.commentLikes = req.session.user.commentLikes || {};
  if (liked) req.session.user.commentLikes[commentId] = true;
  else delete req.session.user.commentLikes[commentId];

  liveUpdates.recordChange(ideaId, 'comment_reacted', {
    comment_id: commentId,
    user: req.session.user.username
  });

  if (req.isHtmx) {
    const single = await loadSingleCommentWithReactions(commentId, userId);
    if (!single) return res.status(404).send(req.isHtmx ? 'Nicht gefunden' : errorHtml('Nicht gefunden'));

    return res.render('ideas/_comment-item', {
      comment: single.comment,
      user: req.session.user,
      layout: false,
      liked
    });
  }

  res.redirect(`/ideas/${ideaId}`);
}));

module.exports = router;
