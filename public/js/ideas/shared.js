/**
 * Escaped HTML-Entities in einem String.
 * @param {string|null|undefined} str
 * @returns {string}
 */
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Liefert die aktuell aufgeklappte Karten-ID (falls vorhanden).
 * @returns {string|null}
 */
window.getCurrentlyExpandedCard = function () {
  const open = document.querySelector('.idea-card.expanded');
  return open ? open.dataset.id : (window.currentlyExpandedCardId || null);
};

/**
 * Stellt sicher, dass nur eine Karte pro Idee im DOM existiert.
 * @param {string|number} ideaId
 * @returns {void}
 */
function ensureSingleCard(ideaId) {
  if (!ideaId) return;
  const cards = Array.from(document.querySelectorAll(`.idea-card[data-id="${ideaId}"]`));
  if (cards.length <= 1) return;
  cards.slice(1).forEach(c => c.remove());
}

/**
 * Lädt Kommentare für eine Idee, falls noch nicht vorhanden.
 * @param {string|number} ideaId
 * @returns {void}
 */
function ensureCommentsLoaded(ideaId) {
  const placeholder = document.getElementById(`comments-section-${ideaId}`);
  const list = document.getElementById(`comment-list-${ideaId}`);
  if (!placeholder || list) return;

  if (window.htmx) {
    htmx.ajax('GET', `/ideas/${ideaId}/comments?_=${Date.now()}`, {
      target: `#comments-section-${ideaId}`,
      swap: 'outerHTML'
    });
  } else {
    fetch(`/ideas/${ideaId}/comments?_=${Date.now()}`)
      .then(r => r.text())
      .then(html => { placeholder.outerHTML = html; });
  }
}

// Karten-pro-Reihe-Einstellung anwenden
(function() {
  try {
    var cols = localStorage.getItem('settings:cardsPerRow');
    if (cols) {
      var grid = document.querySelector('.ideas-grid');
      if (grid) grid.style.setProperty('--cards-per-row', cols);
    }
  } catch (e) {}
})();

/**
 * Bereitet neu eingefügte Karten für CSS-Transitionen vor.
 * @param {HTMLElement} card
 * @returns {void}
 */
window.copyIdeaCardComputedStyles = function (card) {
  if (!card || card.nodeType !== 1) return;

  try {
    card.classList.add('fresh-card');
    void card.offsetWidth;
    card.classList.add('visible');

    setTimeout(() => {
      try {
        card.classList.remove('fresh-card');
        card.classList.remove('visible');
      } catch (e) {}
    }, 800);
  } catch (e) {
    console.error('copyIdeaCardComputedStyles fehlgeschlagen:', e);
  }
};
