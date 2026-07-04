/**
 * @fileoverview Live-Update (SSE) Logik für die Ideen-Liste.
 * @module public/js/ideas/live.js
 */


let isRefreshing = false;
let currentVersion = Number(window.ideaLiveVersion || document.body?.dataset?.liveVersion || 0) || 0;
const COMMENT_ACTIONS = ['comment_added', 'comment_reacted'];
const CARD_REFRESH_ACTIONS = ['idea_edited', 'file_uploaded', 'file_deleted', 'tags_updated', 'status_changed'];
const STATS_ONLY_ACTIONS = ['idea_liked', 'idea_disliked', 'idea_unliked', 'idea_undisliked'];

/** @param {Element | null} value @returns {HTMLElement | null} */
function asHTMLElement(value) {
  return /** @type {HTMLElement | null} */ (value);
}

/** @param {Element | null} value @returns {HTMLInputElement | null} */
function asHTMLInputElement(value) {
  return /** @type {HTMLInputElement | null} */ (value);
}

document.addEventListener('DOMContentLoaded', function () {
  if (!document.querySelector('.ideas-page')) {
    return;
  }

  startSSE();
});

let eventSource = null;

/**
 * Startet die SSE-Verbindung für Ideen-Updates.
 * @returns {void}
 */
function startSSE() {
  stopAll();
  console.log('Attempting SSE connection for Ideas...');
  
  const url = `/ideas/updates?since=${encodeURIComponent(currentVersion)}`;
  eventSource = new EventSource(url);

  // EventSource geöffnet: Verbindung wurde hergestellt
  eventSource.onopen = () => {
    console.log('SSE connection established for Ideas.');
  };

  // Nachricht empfangen: verarbeite Incoming-Payload (Version, Änderungen)
  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (typeof data.version === 'number') currentVersion = data.version;
      // Jede Änderung individuell intelligent behandeln
      (data.changes || []).forEach(change => handleSmartUpdate(change || {}));
    } catch (e) {
      // Heartbeat-Ereignisse oder fehlerhafte Nachrichten ignorieren
    }
  };

  // Fehler-Handler: bei Fehlern Verbindung schließen und später neu verbinden
  eventSource.onerror = (err) => {
    console.warn('SSE error for Ideas, will retry shortly:', err);
    stopAll();
    setTimeout(startSSE, 5000); // Einfache Wiederverbindungslogik für SSE
  };
}

/**
 * Stoppt alle laufenden SSE-Verbindungen und räumt auf.
 * @returns {void}
 */
function stopAll() {
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
}

window.addEventListener('pagehide', stopAll);
window.addEventListener('beforeunload', stopAll);
// Sichtbarkeitswechsel: bei Verbergen Verbindungen schließen, beim Wieder-Anzeigen neu starten
document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopAll();
  else if (!eventSource) {
    startSSE();
  }
});

// ============================================
// INTELLIGENTE AKTUALISIERUNGS-LOGIK (erweitert)
// ============================================

/**
 * Intelligente Aktualisierungs-Logik: wertet SSE-Payloads aus und entscheidet, welche UI-Aktionen nötig sind.
 * @param {Object} [payload={}]
 * @returns {void}
 */
function handleSmartUpdate(payload = {}) {
  if (isRefreshing) return;

  const action = payload.action || payload.reason;
  const idea_id = payload.idea_id;

  if (!idea_id) return;

  // SSE-Aktualisierungen für lokal ausgeführte Aktionen ignorieren, um Race-Conditions zu vermeiden
  if (window.localActionCooldowns && window.localActionCooldowns.has(String(idea_id))) {
    console.log('SSE: Ignoring local action to prevent race condition:', action, idea_id);
    return;
  }

  // Defensive Prüfung: Sicherstellen, dass die Idea-Karte im DOM vorhanden ist.
  // Ausnahme: Bei `new_idea` wird die Karte geladen und eingefügt, auch wenn sie fehlt.
  if (action !== 'new_idea' && !document.querySelector(`.idea-card[data-id="${idea_id}"]`)) {
    return;
  }

  const currentlyExpandedCardId = window.getCurrentlyExpandedCard
    ? window.getCurrentlyExpandedCard()
    : null;

  const isExpandedCard =
    currentlyExpandedCardId !== null &&
    String(currentlyExpandedCardId) === String(idea_id);

  if (action === 'idea_deleted') {
    if (!idea_id) return;
    handleIdeaDeletion(idea_id, currentlyExpandedCardId);
    return;
  }

  if (action === 'new_idea') {
    console.log('SSE: Received new_idea event for idea_id:', idea_id);
    if (window.isLocalIdeaCreation) {
      window.isLocalIdeaCreation = false;
      return;
    }
    // Bevorzugt die exakte Idee per ID abrufen, um Rennen zu vermeiden, bei denen `/latest-card`
    // eine andere (ältere/neue) Idee zurückliefern könnte, wenn Erstellungen zeitnah stattfinden.
    if (idea_id) fetchNewIdeaAndPrepend(idea_id);
    return;
  }

  // Comment-Aktionen:
  // - Wenn Kommentarbereich offen: einzelnen Kommentar aktualisieren.
  // - Immer: Stats refreshen, damit comment_count auch für zugeklappte Karten aktuell ist.
  if (idea_id && COMMENT_ACTIONS.includes(action)) {
    if (payload && payload.comment_id) {
      updateSingleComment(idea_id, payload.comment_id, action === 'comment_added');
    }

    // Stats refreshen (comment_count / like_count / dislike_count etc.),
    // da nicht-expandierte Karten kein #comment-list-... im DOM haben.
    if (window.htmx) {
      htmx.trigger(document.body, `idea_updated_${idea_id}`, payload);
    }

    return;
  }

  if (idea_id && CARD_REFRESH_ACTIONS.includes(action)) {
    updateSingleCard(idea_id, isExpandedCard);
    return;
  }

  if (idea_id && STATS_ONLY_ACTIONS.includes(action)) {
    if (window.htmx) htmx.trigger(document.body, `idea_updated_${idea_id}`, payload);
    return;
  }

  if (currentlyExpandedCardId) {
    updateNonExpandedCards();
  } else {
    refreshAllCards();
  }
}


// ============================================================================
// Hilfsfunktionen für UI-Aktualisierungen
// ============================================================================

/**
 * Entfernt eine Idee aus der UI (mit sanftem Fade-Out).
 * @param {string|number} ideaId
 * @param {string|number|null} currentlyExpandedCardId
 * @returns {void}
 */
function handleIdeaDeletion(ideaId, currentlyExpandedCardId) {
  const cardToRemove = asHTMLElement(document.querySelector(`.idea-card[data-id="${ideaId}"]`));
  if (!cardToRemove) return;

  if (ideaId === currentlyExpandedCardId) {
    window.currentlyExpandedCardId = null;
    if (window.location.hash === `#idea-${ideaId}`) {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }

  // Sanft ausblenden vor dem Entfernen
  cardToRemove.style.opacity = '0.5';
  cardToRemove.style.transition = 'opacity 0.3s ease';

  setTimeout(() => {
    if (cardToRemove.parentElement) {
      cardToRemove.parentElement.removeChild(cardToRemove);
    }
  }, 300);
}
/**
 * Holt eine neue Idee per Fetch und fügt sie oben ein.
 * @async
 * @param {string|number} ideaId
 * @returns {Promise<void>}
 */
async function fetchNewIdeaAndPrepend(ideaId) {
  if (isRefreshing) {
    console.log('SSE: Already refreshing, skipping fetch/prepend for idea:', ideaId);
    return;
  }
  // Doppelte Karten vermeiden, wenn lokale Erstellung und SSE gleichzeitig auslösen
  if (document.querySelector(`.idea-card[data-id="${ideaId}"]`)) {
    console.log('SSE: Idea card already exists, skipping prepend:', ideaId);
    return;
  }
  isRefreshing = true;

  try {
    if (!ideaId) return;
    const response = await fetch(`/ideas/${encodeURIComponent(ideaId)}/card?_=${Date.now()}`);
    if (response.status === 404 || !response.ok) return;

    const html = await response.text();
    const temp = document.createElement('div');
    temp.innerHTML = html;
    const newCard = asHTMLElement(temp.querySelector('.idea-card'));

    if (newCard) {
      const newId = newCard.dataset.id || newCard.getAttribute('data-id');
      // Endprüfung, um Rennen mit der POST-Antwort oder anderen SSE-Ereignissen zu vermeiden
      if (newId && document.querySelector(`.idea-card[data-id="${newId}"]`)) {
        console.log('SSE: Idea card appeared during fetch, skipping insert:', newId);
        return;
      }

      // Prüfen, ob die neue Idee zum aktuellen Suchfilter passt
      const searchInput = asHTMLInputElement(document.querySelector('input[name="q"]'));
      const currentQuery = searchInput ? searchInput.value.toLowerCase() : "";
      const cardText = newCard.textContent.toLowerCase();

      if (currentQuery && !cardText.includes(currentQuery)) return;

      const ideasGrid = document.querySelector('#ideas-content .ideas-grid');
      if (!ideasGrid) return;

      // Leeren-Zustand-Platzhalter entfernen, wenn die erste Idee per Live-Update eintrifft
      const emptyState = ideasGrid.querySelector('.ideas-empty-state');
      if (emptyState) emptyState.remove();

      if (newId) {
        // Ungewollte Duplikate durch schnelle SSE-Ereignisse verhindern
        if (window.ensureSingleCard) window.ensureSingleCard(String(newId));

        // Versteckt einfügen, kurz warten und dann anzeigen, damit CSS und Pseudo-Zustände greifen
        newCard.style.visibility = 'hidden';
        
        const firstCard = ideasGrid.querySelector('.idea-card');
        if (firstCard) ideasGrid.insertBefore(newCard, firstCard);
        else ideasGrid.appendChild(newCard);

        // HTMX-Verarbeitung aktivieren (für hx-*-Attribute)
        try { if (window.htmx) window.htmx.process(newCard); } catch (e) {}


        setTimeout(() => {
          newCard.style.visibility = 'visible';

          // Einblend-Animation: einblenden / verschieben
          newCard.style.opacity = '0';
          newCard.style.transform = 'translateY(-20px)';
          newCard.style.transition = 'opacity 0.5s ease, transform 0.5s ease';


          requestAnimationFrame(() => requestAnimationFrame(() => {
            newCard.style.opacity = '1';
            newCard.style.transform = 'translateY(0)';
          }));

          // Inline-Styles nach der Animation entfernen

          setTimeout(() => {
            newCard.style.opacity = '';
            newCard.style.transform = '';
            newCard.style.transition = '';
          }, 600);
        }, 50);

      } else {
          // Fallback: Falls `dataset.id` aus irgendeinem Grund fehlt
        const firstCard = ideasGrid.querySelector('.idea-card');
        if (firstCard) ideasGrid.insertBefore(newCard, firstCard);
        else ideasGrid.appendChild(newCard);

        try { if (window.htmx) window.htmx.process(newCard); } catch (e) {}
      }
    }
    } catch (error) {
    // Fehler beim Abrufen der neuen Karte
  } finally {
    isRefreshing = false;
  }
}

/**
 * Aktualisiert eine einzelne Idee (HTML-Karte ersetzen).
 * @async
 * @param {string|number} ideaId
 * @param {boolean} [keepExpanded=false]
 * @returns {Promise<void>}
 */
async function updateSingleCard(ideaId, keepExpanded = false) {
  if (isRefreshing) return;
  isRefreshing = true;

  try {
    const response = await fetch(`/ideas/${ideaId}/card?_=${Date.now()}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const html = await response.text();
    const temp = document.createElement('div');
    temp.innerHTML = html;
    const newCard = asHTMLElement(temp.querySelector('.idea-card'));
    const existingCard = asHTMLElement(document.querySelector(`.idea-card[data-id="${ideaId}"]`));

    if (!newCard || !existingCard) return;

    const wasExpanded = existingCard.classList.contains('expanded');
    const scrollTop = wasExpanded ? document.documentElement.scrollTop : null;

    existingCard.outerHTML = newCard.outerHTML;

    const updatedCard = document.querySelector(`.idea-card[data-id="${ideaId}"]`);
    if (!updatedCard) return;

    // Expandierten Zustand nach Refresh wiederherstellen
    if (keepExpanded && wasExpanded) {
      updatedCard.classList.add('expanded');
      const expandedArea = asHTMLElement(updatedCard.querySelector('.idea-expanded'));
      if (expandedArea) expandedArea.hidden = false;

      const expandBtn = updatedCard.querySelector('.expand-card');
      if (expandBtn) expandBtn.setAttribute('aria-expanded', 'true');

      window.currentlyExpandedCardId = ideaId;

      if (scrollTop !== null) {

        setTimeout(() => {
          document.documentElement.scrollTop = scrollTop;
        }, 50);
      }
    }

    if (window.htmx) htmx.process(updatedCard);
  } catch (error) {
    // Fehler bei der Einzelkarten-Aktualisierung
  } finally {

    setTimeout(() => { isRefreshing = false; }, 100);
  }
}

/**
 * Löst ein komplettes Refresh der Karten aus (HTMX oder Page-Navigate).
 * @returns {void}
 */
function refreshAllCards() {
  if (isRefreshing) return;
  isRefreshing = true;

  const form = document.getElementById('filterForm');
  if (form && window.htmx) {
    htmx.trigger(form, 'submit');
  } else {
    const urlParams = new URLSearchParams(window.location.search);
    urlParams.set('page', urlParams.get('page') || '1');
    urlParams.set('refresh', String(Date.now()));
    window.location.href = `/ideas?${urlParams.toString()}`;
  }


  setTimeout(() => { isRefreshing = false; }, 1000);
}

/**
 * Aktualisiert alle nicht-expandierten Karten via Partial-Request.
 * @async
 * @returns {Promise<void>}
 */
async function updateNonExpandedCards() {
  if (isRefreshing) return;
  isRefreshing = true;

  try {
    const urlParams = new URLSearchParams(window.location.search);
    const page = urlParams.get('page') || '1';
    const q = urlParams.get('q') || '';
    const category_id = urlParams.get('category_id') || '';
    const tags = urlParams.get('tags') || '';
    const globalFlag = urlParams.get('global') || '';
    const search_scope = urlParams.get('search_scope') || '';

    const currentlyExpandedCardId = window.getCurrentlyExpandedCard ? window.getCurrentlyExpandedCard() : null;

    const parts = [];
    parts.push(`page=${page}`);
    parts.push(`q=${encodeURIComponent(q)}`);
    parts.push(`category_id=${category_id}`);
    parts.push(`tags=${encodeURIComponent(tags)}`);
    if (search_scope) parts.push(`search_scope=${encodeURIComponent(search_scope)}`);
    if (globalFlag === 'on') parts.push(`global=on`);
    parts.push(`_=${Date.now()}`);
    const url = `/ideas/partial?${parts.join('&')}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const html = await response.text();
    const temp = document.createElement('div');
    temp.innerHTML = html;

    const newCards = /** @type {HTMLElement[]} */ (Array.from(temp.querySelectorAll('.idea-card')));
    
    let updatedCount = 0;


    newCards.forEach(newCard => {
      const ideaId = newCard.dataset.id;
      if (!ideaId || ideaId === currentlyExpandedCardId) return;

      const existingCard = document.querySelector(`.idea-card[data-id="${ideaId}"]`);
      // Nur Karten aktualisieren, die gerade nicht vom Benutzer bearbeitet werden
      if (existingCard && !existingCard.classList.contains('expanded')) {
        existingCard.outerHTML = newCard.outerHTML;
        updatedCount++;
      }
    });

    if (window.htmx) htmx.process(document.body);
  
  } catch (error) {
    // Error during partial update
  } finally {
    isRefreshing = false;
  }
}

/**
 * Aktualisiert einen einzelnen Kommentar innerhalb einer Idee.
 * @async
 * @param {string|number} ideaId
 * @param {string|number} commentId
 * @param {boolean} [isNew=false]
 * @returns {Promise<void>}
 */
async function updateSingleComment(ideaId, commentId, isNew = false) {
  const list = document.getElementById(`comment-list-${ideaId}`);
  if (!list) return;

  try {
    const response = await fetch(`/ideas/${ideaId}/comments/${commentId}?_=${Date.now()}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const html = await response.text();
    const temp = document.createElement('div');
    temp.innerHTML = html.trim();
    const newItem = temp.firstElementChild;
    if (!newItem) return;

    const existing = document.getElementById(`comment-${commentId}`);
    if (existing) {
      existing.replaceWith(newItem);
    } else {
      list.insertBefore(newItem, list.firstChild);
    }

    if (isNew) {
      list.scrollTop = 0;
      const section = document.getElementById(`comments-section-${ideaId}`);
      if (section) section.scrollTop = 0;
    }

    if (window.htmx) htmx.process(newItem);
  } catch (error) {
    // Einzelne Kommentar-Aktualisierungsfehler ignorieren
  }
}

// ============================================================================
// Lokale HTMX-Trigger
// ============================================================================

window.localActionCooldowns = new Set();

// Sofort zur Cooldown-Liste hinzufügen, sobald eine Anfrage startet (SSE-Race-Conditions vermeiden)
document.addEventListener('htmx:beforeRequest', function (event) {
  const htmxEvent = /** @type {HtmxRequestEvent} */ (event);
  if (!htmxEvent.detail || !htmxEvent.detail.elt) return;
  const card = asHTMLElement(htmxEvent.detail.elt.closest('.idea-card'));
  if (card && card.dataset.id) {
    window.localActionCooldowns.add(String(card.dataset.id));
  }
});

document.addEventListener('htmx:afterRequest', function (event) {
  const htmxEvent = /** @type {HtmxRequestEvent} */ (event);
  if (!htmxEvent.detail || !htmxEvent.detail.elt) return;
  
  const card = asHTMLElement(htmxEvent.detail.elt.closest('.idea-card'));
  if (card && card.dataset.id) {
    
    const ideaId = String(card.dataset.id);
    
    // Kurz in Cooldown lassen, damit HTMX den Swap abschließen kann

    setTimeout(() => window.localActionCooldowns.delete(ideaId), 100);

    if (!htmxEvent.detail.successful) return;

    const config = htmxEvent.detail.requestConfig;
    const path = config ? (config.path || "") : "";
    const verb = config ? (config.verb || "").toLowerCase() : "";

    // Nur bei POST-Requests triggern (Aktionen), um Endlosschleifen bei GET-Updates zu vermeiden
    if (verb !== 'post') return;
    
    // Bei Like/Dislike/Kommentar wurde das UI bereits durch die POST-Antwort aktualisiert
    if (path.includes('/like') || path.includes('/dislike') || path.includes('/comments') || path.includes('/stats')) {
      return;
    }

    if (window.htmx) {
      // Stats sofort lokal für andere Aktionen aktualisieren
      htmx.trigger(document.body, `idea_updated_${ideaId}`, {
        idea_id: ideaId,
        action: 'local_update'
      });
    }
  }
});

// Globale APIs für Debugging oder manuelle Aufrufe bereitstellen
window.refreshAllCards = refreshAllCards;
window.updateNonExpandedCards = updateNonExpandedCards;
window.updateSingleCard = updateSingleCard;
window.phoenixIntegration = { handleSmartUpdate, fetchNewIdeaAndPrepend, updateSingleCard };
