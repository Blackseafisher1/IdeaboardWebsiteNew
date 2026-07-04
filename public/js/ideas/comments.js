/**
 * Verhindert mehrfaches Binden der Popover-Handler.
 * @type {boolean}
 */
let reactionHandlersBound = false;

/**
 * Initialisiert Popover-Logik für Kommentar-Reaktionen (Portal, Positionierung).
 * @returns {void}
 */
function initCommentReactionPopovers() {
  if (reactionHandlersBound) return;
  reactionHandlersBound = true;

  const PORTAL_ATTR = 'data-portal-parent';

  /**
   * Schließt alle offenen Emoji-Popover.
   * @returns {void}
   */
  const closeAllPopovers = () => {
    document.querySelectorAll('.emoji-popover.open').forEach(p => {
      p.classList.remove('open');

      // Zurück zum ursprünglichen Elternelement verschieben
      const parentSelector = p.getAttribute(PORTAL_ATTR);
      if (parentSelector) {
        const originalParent = document.querySelector(parentSelector);
        if (originalParent) originalParent.appendChild(p);
        p.removeAttribute(PORTAL_ATTR);
      }

      p.style.position = '';
      p.style.top = '';
      p.style.left = '';
      p.style.right = '';
    });

    document
      .querySelectorAll('.comment-reaction-btn[aria-expanded="true"]')
      .forEach(btn => btn.setAttribute('aria-expanded', 'false'));
  };

  // Klick auf Reaktions-Button → Popover öffnen
  document.addEventListener('click', function (e) {
    const btn = e.target.closest('.comment-reaction-btn');

    if (!btn) {
      if (!e.target.closest('.emoji-popover')) closeAllPopovers();
      return;
    }

    e.preventDefault();

    const commentId = btn.dataset.commentId;
    const popover = document.querySelector(`.emoji-popover[data-comment-id="${commentId}"]`);
    if (!popover) return;

    const wasOpen = popover.classList.contains('open');
    closeAllPopovers();
    if (wasOpen) return;

    // Popover nach <body> portieren (umgeht transformierte Vorfahren)
    const originalParent = popover.parentElement;
    if (originalParent) {
      if (!originalParent.id) originalParent.id = `emoji-popover-host-${commentId}`;
      popover.setAttribute(PORTAL_ATTR, `#${originalParent.id}`);
      document.body.appendChild(popover);
popover.classList.remove('open');
void popover.offsetWidth;
popover.classList.add('open');

    }

    popover.classList.add('open');
    btn.setAttribute('aria-expanded', 'true');

    // Viewport-relative Positionierung
    try {
      const btnRect = btn.getBoundingClientRect();
      const popRect = popover.getBoundingClientRect();

      const GAP = 10;
      let top = Math.round(btnRect.top);
      let left = Math.round(btnRect.left - popRect.width - GAP);

      left = Math.max(8, left);
      top = Math.max(8, top);
      if (top + popRect.height > window.innerHeight - 8) {
        top = Math.max(8, window.innerHeight - popRect.height - 8);
      }

      popover.style.position = 'fixed';
      popover.style.top = `${top}px`;
      popover.style.left = `${left}px`;
      popover.style.right = 'auto';
    } catch (_) {}
  });

  // ESC schließt Popover
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeAllPopovers();
  });

  // HTMX-Requests schließen Popover
  document.body.addEventListener('htmx:beforeRequest', function (evt) {
    if (evt.detail?.elt?.closest('.emoji-popover')) closeAllPopovers();
  });

  document.body.addEventListener('htmx:afterSwap', function () {
    closeAllPopovers();
  });
}

document.addEventListener('DOMContentLoaded', function() {
  if (!document.querySelector('.ideas-page')) return;
  initCommentReactionPopovers();
});

// Kommentar-Formular nach HTMX-Swap zurücksetzen
document.addEventListener('htmx:afterSwap', function(event) {
  const elt = event.detail?.elt;
  if (elt && elt.classList.contains('comment-form')) {
    const ideaId = elt.getAttribute('data-idea-id');
    const list = ideaId ? document.getElementById(`comment-list-${ideaId}`) : null;
    if (list) list.scrollTop = 0;
    const textarea = elt.querySelector('textarea');
    if (textarea) textarea.value = '';
  }
});
