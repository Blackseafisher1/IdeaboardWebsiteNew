/**
 * Globaler Zustand: ID der aktuell expandierten Karte (null = keine).
 * @type {string|null}
 */
window.currentlyExpandedCardId = null;

/**
 * Bindet globale Karten-Handler: Expand-Buttons und Beschreibungs-Doppelklick.
 * @returns {void}
 */
function setupCardHandlers() {
  // Einfachklick auf Erweitern-Button
  document.addEventListener('click', function(e) {
    const btn = e.target.closest('.expand-card');
    if (!btn) return;
    const card = btn.closest('.idea-card');
    const ideaId = card.dataset.id;

    const isExpanded = card.classList.contains('expanded');

    if (!isExpanded) {
      // Andere offene Karten schließen, dann diese öffnen
   document.querySelectorAll('.idea-card.expanded').forEach(c => {
        if (c.dataset.id !== ideaId) collapseCard(c);
      });
      expandCard(card, ideaId);
    } else {
      collapseCard(card, ideaId);
    }
  });

  // Zeichenbasierte Beschreibungskürzung
  const TRUNCATE_CHARS = 140;

  /** @param {HTMLElement} desc */
  function _getContentEl(desc) {
    return desc.querySelector('.idea-desc-text') || desc;
  }

  /** Klappt eine Beschreibung auf die ersten N Zeichen ein. */
  function collapseDesc(desc) {
    const el = _getContentEl(desc);
    if (!desc.dataset.fullHtml) desc.dataset.fullHtml = el.innerHTML;
    const fullText = el.textContent || '';
    if (fullText.length <= TRUNCATE_CHARS) {
      desc.dataset.truncated = 'false';
      desc.classList.remove('desc-expanded');
      desc.setAttribute('aria-expanded', 'false');
      return;
    }
    const truncated = fullText.trim().slice(0, TRUNCATE_CHARS).replace(/\s+$/, '') + '\u2026';
    el.textContent = truncated;
    desc.dataset.truncated = 'true';
    desc.classList.remove('desc-expanded');
    desc.setAttribute('aria-expanded', 'false');
  }

  /** Zeigt die vollständige Beschreibung an. */
  function expandDesc(desc) {
    const el = _getContentEl(desc);
    if (desc.dataset.fullHtml) el.innerHTML = desc.dataset.fullHtml;
    desc.dataset.truncated = 'false';
    desc.classList.add('desc-expanded');
    desc.setAttribute('aria-expanded', 'true');
  }

  // Alle Beschreibungen initial einklappen
  document.querySelectorAll('.idea-desc').forEach(d => collapseDesc(d));

  // Doppelklick auf Beschreibung zum Expandieren/Einklappen
  document.addEventListener('dblclick', function (e) {
    if (e.target.closest('.expand-card') || e.target.closest('.idea-actions')) return;
    const desc = e.target.closest('.idea-desc') || (e.target.closest('.idea-desc-text') && e.target.closest('.idea-desc-text').closest('.idea-desc'));
    if (!desc) return;
    e.stopPropagation();
    if (desc.classList.contains('desc-expanded')) collapseDesc(desc);
    else expandDesc(desc);
  });
}

/**
 * Öffnet eine Idea-Karte (expandieren, Hash setzen, ggf. scrollen).
 * @param {HTMLElement} card
 * @param {string|number} ideaId
 * @returns {void}
 */
function expandCard(card, ideaId) {
  card.classList.add('expanded');
  card.querySelector('.expand-card').setAttribute('aria-expanded', 'true');
  window.currentlyExpandedCardId = ideaId;

  history.replaceState(null, null, `#idea-${ideaId}`);

  // Sanftes Scrollen nur wenn Karte nicht voll sichtbar
  setTimeout(() => {
    try {
      const rect = card.getBoundingClientRect();
      const margin = 12;
      if (rect.top < margin || rect.bottom > (window.innerHeight - margin)) {
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    } catch (e) {}
  }, 60);
}

/**
 * Schließt eine Idea-Karte und entfernt Hash/Auswahl.
 * @param {HTMLElement} card
 * @param {string|number|null} [ideaId]
 * @returns {void}
 */
function collapseCard(card, ideaId = null) {
  if (!ideaId) ideaId = card.dataset.id;
  card.classList.remove('expanded');
  card.querySelector('.expand-card').setAttribute('aria-expanded', 'false');
  if (window.currentlyExpandedCardId === ideaId) {
    window.currentlyExpandedCardId = null;
    history.replaceState(null, null, ' ');
  }
}

// Initialisierung nach DOM-Ready
document.addEventListener('DOMContentLoaded', function() {
  if (!document.querySelector('.ideas-page')) return;
  setupCardHandlers();
});
