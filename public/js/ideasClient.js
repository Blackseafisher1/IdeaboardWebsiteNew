/**
 * @fileoverview Client-Logik für Ideen-Seite: Karten, Modals, Hash-Navigation und Interaktionen.
 * @module public/js/ideasClient
 */

// Ideen-Client - Hash-Navigation

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

let pageJustLoaded = true;
let reactionHandlersBound = false;

document.addEventListener('DOMContentLoaded', function() {
  if (!document.querySelector('.ideas-page')) return;

  setupCardHandlers();
  initCommentReactionPopovers();
  bindCreateAndDeleteHandlers();

  // Create-Idea-Modal öffnen (aus inline-Script in ideas.ejs migriert)
  const openCreateModalBtn = document.getElementById('openCreateModal');
  
  const createIdeaModal = document.getElementById('createIdeaModal');
  if (openCreateModalBtn && createIdeaModal) {
/**
 * Klick-Handler: Öffnet das "Neue Idee"-Modal und setzt den Fokus auf das Titel-Eingabefeld.
 * @param {Event} [event] - Das Klick-Ereignis.
 * @returns {void}
 */
   openCreateModalBtn.addEventListener('click', () => {
      try { createIdeaModal.showModal(); } catch (_) { createIdeaModal.style.display = 'block'; }
      document.getElementById('new-title')?.focus();
    });
  }

/**
 * Initialisierungs-Callback (verzögert): prüft Deep-Links, setzt `pageJustLoaded` und lädt ggf. eine einzelne Karte.
 * @returns {void}
 */
  setTimeout(() => {
    checkDeepLink();
    pageJustLoaded = false;

    // Defensiv: auch /ideas/<id>-Pfad als Deep-Link unterstützen (migriertes Verhalten)
    const m = location.pathname.match(/\/ideas\/(\d+)/);
    if (m) {
      const id = m[1];
      const card = document.querySelector(`#idea-${id}`) || document.querySelector(`.idea-card[data-id="${id}"]`);
      if (card) {
        if (!card.classList.contains('expanded')) expandCard(card, id);
      } else {
        // load remote single card if not present
        try { loadSingleIdeaCard(id); } catch (_) { /* ignorieren falls Funktion fehlt */ }
      }
    }

    // --- Filter Bar ---
    const filterBar = document.querySelector('.ideas-filters');
    // Hinweis: Selektor auf `.ideas-filters` aktualisiert, da die `sticky`-Klasse entfernt wurde.

    // --- Automatisches Scrollen nach oben bei Suche/Filter ENTFERNT ---
    // (Wird bei Bedarf von HTMX-Scroll-Einstellungen gehandhabt; manuelles Smooth-Scroll verursachte Sprünge)

    // Global scroll shortcut moved to `public/js/index.js` so it's available on all pages.
  }, 500);
});

/**
 * Bindet globale Karten-Handler (Expand-Links).
 * @returns {void}
 */
function setupCardHandlers() {
  // Beschreibungserweiterung durch CSS/Template (vollständiger Text)

  // Einfachklick-Verhalten für Erweitern-Buttons beibehalten
  document.addEventListener('click', function(e) {
    const btn = e.target.closest('.expand-card');
    if (!btn) return;
    const card = btn.closest('.idea-card');
    const ideaId = card.dataset.id;
    
    const isExpanded = card.classList.contains('expanded');
    
    if (!isExpanded) {
/**
 * Schließt andere aufgeklappte Karten bevor die angeklickte Karte geöffnet wird.
 * @param {Event} [event] - Das Klick-Ereignis, ausgelöst vom Expand-Button.
 * @returns {void}
 */
   document.querySelectorAll('.idea-card.expanded').forEach(c => {
        if (c.dataset.id !== ideaId) collapseCard(c);
      });
      expandCard(card, ideaId);
    } else {
      collapseCard(card, ideaId);
    }
  });

  // Doppelklick-Erweiterung wieder einführen, aber zeichenbasierte
  // Kürzung, sodass Beschreibungen standardmäßig nur die ersten N Zeichen zeigen
  // und per Doppelklick auf den vollständigen Inhalt umschalten.
  const TRUNCATE_CHARS = 140;

  function _getContentEl(desc) {
    return desc.querySelector('.idea-desc-text') || desc;
  }

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
    const truncated = fullText.trim().slice(0, TRUNCATE_CHARS).replace(/\s+$/, '') + '…';
    el.textContent = truncated;
    desc.dataset.truncated = 'true';
    desc.classList.remove('desc-expanded');
    desc.setAttribute('aria-expanded', 'false');
  }

  function expandDesc(desc) {
    const el = _getContentEl(desc);
    if (desc.dataset.fullHtml) el.innerHTML = desc.dataset.fullHtml;
    desc.dataset.truncated = 'false';
    desc.classList.add('desc-expanded');
    desc.setAttribute('aria-expanded', 'true');
  }

  // Alle Beschreibungen standardmäßig einklappen (nur erste N Zeichen)
  document.querySelectorAll('.idea-desc').forEach(d => collapseDesc(d));

  document.addEventListener('dblclick', function (e) {
    // Wenn der Benutzer im Aktionsbereich oder Erweitern-Button doppelgeklickt hat, ignorieren
    if (e.target.closest('.expand-card') || e.target.closest('.idea-actions')) return;
    const desc = e.target.closest('.idea-desc') || (e.target.closest('.idea-desc-text') && e.target.closest('.idea-desc-text').closest('.idea-desc'));
    if (!desc) return;
    e.stopPropagation();
    if (desc.classList.contains('desc-expanded')) collapseDesc(desc);
    else expandDesc(desc);
  });
}

let isSubmittingIdea = false;

/**
 * Bindet Erstellen- und Löschen-Handler für Ideen (Form-Interception).
 * @returns {void}
 */
function bindCreateAndDeleteHandlers() {
  // Create-Idea-Formular abfangen, per Fetch absenden und Karte einfügen
  const createForm = document.getElementById('createIdeaForm');
  if (createForm) {
    createForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      
      const submitBtn = createForm.querySelector('button[type="submit"]');
      if (submitBtn && (submitBtn.disabled || isSubmittingIdea)) {
        console.warn('Blocking duplicate submit attempt');
        return;
      }
      
      isSubmittingIdea = true;
      const fd = new FormData(createForm);

      try {
        // Modal sofort schließen und Submit-Button deaktivieren, um UI-Verzögerung zu vermeiden
        const modal = document.getElementById('createIdeaModal');
        try { if (modal && typeof modal.close === 'function') modal.close(); } catch(_) {}
        
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.dataset._orig = submitBtn.innerText;
          submitBtn.innerText = 'Erstelle...';
        }

        // Lokale Erstellung markieren, damit liveUpdates das eingehende SSE new_idea unterdrückt
        window.isLocalIdeaCreation = true;
        
        const resp = await fetch(createForm.action, {
          method: 'POST',
          headers: { 'hx-request': 'true' },
          body: fd
        });

        if (!resp.ok) {
          console.error('Failed to create idea', resp.status);
          const errorText = await resp.text();
          alert('Failed to create idea: ' + (errorText || 'Server error'));
          
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerText = submitBtn.dataset._orig || 'Erstellen';
          }
          return;
        }

        const html = await resp.text();

        // DOM aus zurückgegebenem HTML erstellen, um die Karte zu extrahieren
        const ideasGrid = document.querySelector('.ideas-grid');
        if (ideasGrid) {
          const temp = document.createElement('div');
          temp.innerHTML = html;
          const incoming = temp.querySelector('.idea-card');
          const newId = incoming ? (incoming.dataset.id || incoming.getAttribute('data-id')) : null;

          if (incoming && newId) {
            // Erfolg: Formular zurücksetzen für das nächste Mal
            createForm.reset();
            
            // Prüfen, ob die Karte bereits per SSE eingefügt wurde
            const existing = document.querySelector(`.idea-card[data-id="${newId}"]`);
            if (existing) {
              console.log('Local Create: Card already present (via SSE), skipping insert.');
            } else {
              // Leeren-Zustand-Platzhalter entfernen ("Keine Ergebnisse gefunden")
              document.querySelectorAll('.ideas-empty-state').forEach(n => n.remove());

              try { incoming.style.visibility = 'hidden'; } catch (e) {}
              
              const firstCard = ideasGrid.querySelector('.idea-card');
              if (firstCard) ideasGrid.insertBefore(incoming, firstCard);
              else ideasGrid.appendChild(incoming);

              // Browser Styles berechnen lassen, dann einblenden
              setTimeout(() => {
                try { incoming.style.visibility = 'visible'; } catch (e) {}
                try { if (window.htmx) htmx.process(incoming); } catch (e) {}
              }, 100);
            }
          } else {
            // Fallback: Serverseitiges HTML direkt einfügen
            // Leeren-Zustand-Platzhalter entfernen
            document.querySelectorAll('.ideas-empty-state').forEach(n => n.remove());
            ideasGrid.insertAdjacentHTML('afterbegin', html);
            const newCard = ideasGrid.querySelector('.idea-card');
            if (newCard && window.htmx) htmx.process(newCard);
          }
        }
      } catch (err) {
        console.error('Idea creation failed:', err);
        alert('An unexpected error occurred. Please try again.');
      } finally {
        isSubmittingIdea = false;

        // Reset the form
        createForm.reset();

        // Keep submit button disabled briefly to avoid accidental double submits
        try {
          if (submitBtn) {
            
            const restore = () => {
              submitBtn.disabled = false;
              if (submitBtn.dataset._orig) {
                submitBtn.innerText = submitBtn.dataset._orig;
                delete submitBtn.dataset._orig;
              }
            };
            // 2500ms Pause, um Server-Roundtrip bei langsamen Verbindungen zu ermöglichen
            setTimeout(restore, 2500);
          }
        } catch (_) {}

        // Lokalen Erstellungshinweis nach längerer Wartezeit (5s) zurücksetzen, damit SSE eintreffen oder fehlschlagen kann
/**
 * Zurücksetzen des lokalen Erstellungshinweises nach einer Wartezeit, damit eintreffende SSE nicht unterdrückt werden.
 * @returns {void}
 */
   setTimeout(() => { window.isLocalIdeaCreation = false; }, 5000);
      }
    });
  }

  // Lösch-Formulare für Ideen abfangen (Modal-Löschung oder inline)
  document.body.addEventListener('submit', async function (e) {
    const form = e.target.closest('form');
    if (!form) return;
    const m = (form.action || '').match(/\/ideas\/(\d+)\/delete$/);
    if (!m) return;
    e.preventDefault();
    const ideaId = m[1];
    // Wenn das Formular einen onsubmit-Handler definiert (inline confirm), ausführen
    if (typeof form.onsubmit === 'function') {
      try {
        const ok = form.onsubmit();
        if (ok === false) return;
      } catch (e) {
        // falls `onsubmit` eine Ausnahme wirft, auf `confirm` zurückfallen
        if (!confirm('Diese Idee wirklich löschen?')) return;
      }
    } else {
      if (!confirm('Diese Idee wirklich löschen?')) return;
    }
    try {
      const resp = await fetch(form.action, { method: 'POST', headers: { 'hx-request': 'true' } });
      if (!resp.ok) {
        console.error('Delete failed', resp.status);
        return;
      }
      // Wenn JSON eine Löschung anzeigt, Karte entfernen
      let removed = false;
      try {
        const j = await resp.json();
        if (j && j.deleted) removed = true;
      } catch (_) {
        // Falls kein JSON, Erfolg annehmen
        removed = true;
      }
      if (removed) {
/**
 * Entfernt lokal alle DOM-Karten mit der gegebenen `ideaId` nach erfolgreichem Löschen.
 * @param {string} ideaId - ID der gelöschten Idee.
 * @returns {void}
 */
   document.querySelectorAll(`.idea-card[data-id="${ideaId}"]`).forEach(c => c.remove());
        // Close modal if open
        const modal = document.getElementById('idea-edit-modal');
        if (modal && modal.style.display === 'flex') {
          closeIdeaEditModal();
        }
      }
    } catch (err) {
      console.error('Delete error:', err);
    }
  });
}

/**
 * Öffnet eine Idea-Karte (UI expandieren, Hash setzen, ggf. scrollen).
 * @param {HTMLElement} card - Karten-DOM-Element.
 * @param {string|number} ideaId - ID der Idee.
 * @returns {void}
 */
function expandCard(card, ideaId) {
  card.classList.add('expanded');
  card.querySelector('.expand-card').setAttribute('aria-expanded', 'true');
  window.currentlyExpandedCardId = ideaId;

  // Hash für Lesezeichen setzen
  history.replaceState(null, null, `#idea-${ideaId}`);

  // Avoid forced scroll jumps: only adjust scroll if the card is not fully visible
/**
 * Sichtbarkeits-/Scroll-Adjustment: prüft nach dem Expand, ob die Karte vollständig sichtbar ist, und passt das Scrollen an.
 * @returns {void}
 */
  setTimeout(() => {
    try {
      const rect = card.getBoundingClientRect();
      const margin = 12; // small visual margin
      if (rect.top < margin || rect.bottom > (window.innerHeight - margin)) {
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    } catch (e) {
      // Fallback: nichts tun
    }
  }, 60);


}

/**
 * Schließt eine Idea-Karte und entfernt Hash/aktuelle Auswahl.
 * @param {HTMLElement} card
 * @param {string|number|null} [ideaId]
 * @returns {void}
 */
function collapseCard(card, ideaId = null) {
  if (!ideaId) ideaId = card.dataset.id;
  const pageScroll = window.scrollY;
  card.classList.remove('expanded');
  card.querySelector('.expand-card').setAttribute('aria-expanded', 'false');
  if (window.currentlyExpandedCardId === ideaId) {
    window.currentlyExpandedCardId = null;
    history.replaceState(null, null, ' ');
  }


}
/**
 * Initialisiert Popover-Logik für Kommentar-Reaktionen (Portal, Positionierung, Long-press).
 * @returns {void}
 */
function initCommentReactionPopovers() {
  if (reactionHandlersBound) return;
  reactionHandlersBound = true;

  const PORTAL_ATTR = 'data-portal-parent';

  
  const closeAllPopovers = () => {

    document.querySelectorAll('.emoji-popover.open').forEach(p => {
      p.classList.remove('open');

      // Vom Body zurück zum ursprünglichen Elternelement verschieben (falls portiert)
      const parentSelector = p.getAttribute(PORTAL_ATTR);
      if (parentSelector) {
        const originalParent = document.querySelector(parentSelector);
        if (originalParent) originalParent.appendChild(p);
        p.removeAttribute(PORTAL_ATTR);
      }

      // Inline-Positionierung zurücksetzen
      p.style.position = '';
      p.style.top = '';
      p.style.left = '';
      p.style.right = '';
    });

    document
      .querySelectorAll('.comment-reaction-btn[aria-expanded="true"]')

      .forEach(btn => btn.setAttribute('aria-expanded', 'false'));
  };

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

    // Popover nach <body> portieren, damit es nicht von transformierten/overflow-Vorfahren eingeschränkt wird.
    // Transformierte Vorfahren verändern das Verhalten von position:fixed. [web:267]
    const originalParent = popover.parentElement;
    if (originalParent) {
      // Stabile Selektor-Referenz für spätere Wiederherstellung speichern
      if (!originalParent.id) originalParent.id = `emoji-popover-host-${commentId}`;
      popover.setAttribute(PORTAL_ATTR, `#${originalParent.id}`);
      document.body.appendChild(popover);
      // Sicherstellen, dass es im DOM ist, wo es gerendert wird (z. B. nach `appendChild` in `body`)
popover.classList.remove('open');   // sicherstellen, dass das Popover geschlossen ist
void popover.offsetWidth;           // erzwungener Reflow, damit der geschlossene Stil angewendet wird [web:304]
popover.classList.add('open');      

    }

    popover.classList.add('open');
    btn.setAttribute('aria-expanded', 'true');

    // Position relativ zum Viewport
    // getBoundingClientRect() liefert viewport-relative Koordinaten. [web:171]
    try {
      const btnRect = btn.getBoundingClientRect();
      const popRect = popover.getBoundingClientRect();

      const GAP = 10; // increase for more left
      let top = Math.round(btnRect.top);
      let left = Math.round(btnRect.left - popRect.width - GAP);

      // Innerhalb des Viewports begrenzen
      left = Math.max(8, left);
      top = Math.max(8, top);
      if (top + popRect.height > window.innerHeight - 8) {
        top = Math.max(8, window.innerHeight - popRect.height - 8);
      }

      popover.style.position = 'fixed';
      popover.style.top = `${top}px`;
      popover.style.left = `${left}px`;
      popover.style.right = 'auto';
    } catch (_) {
      // Positionierungsfehler ignorieren
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeAllPopovers();
  });

  document.body.addEventListener('htmx:beforeRequest', function (evt) {
    if (evt.detail?.elt?.closest('.emoji-popover')) closeAllPopovers();
  });

  document.body.addEventListener('htmx:afterSwap', function () {
    closeAllPopovers();
  });
}




// --- HASH NAVIGATION (INITIAL LOAD ONLY) ---
/**
 * Prüft den URL-Hash und öffnet ggf. die referenzierte Idee.
 * @returns {void}
 */
function checkDeepLink() {
  const hash = window.location.hash;
  
  
  if (!hash || !hash.startsWith('#idea-')) {
 
    return;
  }
  
  const targetId = hash.replace('#idea-', '');


  
  // 1. Prüfen, ob die Idee bereits auf Seite 1 vorhanden ist
  const existingCard = document.querySelector(`.idea-card[data-id="${targetId}"]`);
  
  if (existingCard) {
   
    // Nur erweitern, wenn nicht bereits expandiert
    if (!existingCard.classList.contains('expanded')) {
   
      expandCard(existingCard, targetId);
    }
    return;
  }

  // 2. Idee nicht auf Seite 1 → Einzelkarte laden
  loadSingleIdeaCard(targetId);
}

/**
 * Lädt eine einzelne Idee per Fetch und fügt die Karte oben in das Grid ein.
 * @async
 * @param {string|number} targetId
 * @returns {Promise<void>}
 */
async function loadSingleIdeaCard(targetId) {
  try {
 
    
    // Server-Endpunkt für Einzelkarte
    const response = await fetch(`/ideas/${targetId}/card`);
    
    if (!response.ok) {
      console.error(`❌ Idee ${targetId} nicht gefunden (${response.status})`);
      return;
    }
    
    const html = await response.text();
    
    // Antwort parsen
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // Die Ideen-Karte in der Antwort finden
    const newCardHtml = doc.querySelector('.ideas-grid')?.innerHTML || 
                       html.match(/<article class="idea-card[\s\S]*?<\/article>/)?.[0] ||
                       '';
    
    if (!newCardHtml) {
      console.error('❌ Keine Karte in Antwort gefunden');
      return;
    }
    
  
    
    // Karte ganz oben ins Grid einfügen
    const ideasGrid = document.querySelector('.ideas-grid');
    if (ideasGrid) {
      const temp2 = document.createElement('div');
      temp2.innerHTML = newCardHtml.trim();
      const parsedCard = temp2.querySelector('.idea-card');

      // Klon-basierte Einfügung versuchen, damit berechnete Styles, Pseudozustände und
      // HTMX-Bindungen wie bei Live-Updates initialisiert werden.
      const template = document.querySelector('.idea-card');
      if (template && parsedCard) {
        const clone = template.cloneNode(true);
        clone.id = `idea-${targetId}`;
        clone.setAttribute('data-id', String(targetId));
        try { clone.innerHTML = parsedCard.innerHTML; } catch (e) {}

        // Versteckt einfügen, dann einblenden, damit CSS/Pseudozustände greifen
        try { clone.style.visibility = 'hidden'; } catch (e) {}
        
        const firstCard = ideasGrid.querySelector('.idea-card');
        if (firstCard) ideasGrid.insertBefore(clone, firstCard);
        else ideasGrid.appendChild(clone);

        try { if (window.htmx) htmx.process(clone); } catch (e) {}

        // Mit kleiner Einblend-Animation anzeigen

        setTimeout(() => {
          try { clone.style.visibility = 'visible'; } catch (e) {}
          try {
            clone.style.opacity = '0';
            clone.style.transform = 'translateY(-20px)';
            clone.style.transition = 'opacity 0.5s ease, transform 0.5s ease';

            requestAnimationFrame(() => requestAnimationFrame(() => {
              clone.style.opacity = '1';
              clone.style.transform = 'translateY(0)';
            }));


            setTimeout(() => {
              try {
                clone.style.opacity = '';
                clone.style.transform = '';
                clone.style.transition = '';
              } catch (e) {}
            }, 600);
          } catch (e) {}
        }, 50);

        ensureSingleCard(targetId);
      } else if (parsedCard) {
        // Fallback: rohes HTML einsetzen
        ideasGrid.insertAdjacentHTML('afterbegin', newCardHtml);
        ensureSingleCard(targetId);
        try {
          const inserted = ideasGrid.querySelector(`.idea-card[data-id="${targetId}"]`);
          if (window.htmx && inserted) htmx.process(inserted);
        } catch (e) {}
      }

      // Auf DOM-Update warten, dann erweitern und Kommentare laden

      setTimeout(() => {
        const card = document.querySelector(`.idea-card[data-id="${targetId}"]`);
        if (card) {
          expandCard(card, targetId);


          setTimeout(() => {
            try {
              card.scrollIntoView({ behavior: 'smooth', block: 'center' });
              try {
                card.style.transition = 'box-shadow 0.5s ease';
                card.style.boxShadow = '0 0 0 4px #4CAF50';

                setTimeout(() => card.style.boxShadow = '', 2000);
              } catch (_) {}
            } catch (_) {}
          }, 100);

          try { ensureCommentsLoaded(targetId); } catch (e) { /* ignorieren */ }
        }
      }, 150);
    }
    
  } catch (error) {
    console.error('💥 Fehler beim Laden der Einzelkarte:', error);
  }
}

/**
 * Stellt sicher, dass nur eine Karte pro `ideaId` im DOM existiert.
 * @param {string|number} ideaId
 * @returns {void}
 */
function ensureSingleCard(ideaId) {
  if (!ideaId) return;
  const cards = Array.from(document.querySelectorAll(`.idea-card[data-id="${ideaId}"]`));
  if (cards.length <= 1) return;

  // Diejenige behalten, die bereits 'revealed' (sichtbar) ist, oder einfach die erste

  cards.slice(1).forEach(c => c.remove());
}

// Übernehme aufgelöste/abgeleitete Styles von einer existierenden `.idea-card` und wende sie
// als Inline-Styles auf `card` an. Dadurch erhalten neu eingefügte Karten sofort
// dieselben Transition/Transform/Border-Werte, ohne auf die Style-Anwendung des Stylesheets
// warten zu müssen, was Zustandssprünge bei Hover oder anderen Transitionen vermeidet.
// Entfernt: computed-style-initializer; stattdessen wird der Klon-Ansatz verwendet.

  // Global modal functions
  /**
  * Öffnet das Edit-/Detail-Modal für eine Idee über das serverseitig gerenderte Modal-Partial.
   * @param {string|number} ideaId
   * @returns {void}
   */
   window.openIdeaModal = async function(ideaId) {
    const modal = document.getElementById('idea-edit-modal');
    const container = document.getElementById('idea-edit-modal-content');
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    try {
      container.innerHTML = '<p>Lade...</p>';
      const response = await fetch(`/ideas/${encodeURIComponent(ideaId)}/modal?_=${Date.now()}`, {
        headers: {
          'X-Requested-With': 'XMLHttpRequest'
        }
      });

      if (!response.ok) {
        throw new Error(`Modal request failed with status ${response.status}`);
      }

      container.innerHTML = await response.text();
      if (window.htmx) htmx.process(container);
    } catch (e) {
      console.error(e);
      container.innerHTML = 'Fehler beim Laden.';
    }
  };
  window.closeIdeaEditModal = function() {
  
    
    const modal = document.getElementById('idea-edit-modal');
    modal.style.display = 'none';
    document.getElementById('idea-edit-modal-content').innerHTML = '';
    
    // Body-Scroll wiederherstellen
    document.body.style.overflow = '';
  };

  // Modal bei ESC-Taste schließen
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      const modal = document.getElementById('idea-edit-modal');
      if (modal.style.display === 'flex') {
        closeIdeaEditModal();
      }
    }
  });

  // Modal bei Klick außerhalb schließen
  document.getElementById('idea-edit-modal').addEventListener('click', function(e) {
    if (e.target === this) {
      closeIdeaEditModal();
    }
  });

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

  // Wenn HTMX den Ideen-Inhalt austauscht (Suche/Filter), Load-More-Button zurücksetzen
  document.body.addEventListener('htmx:afterSwap', function(event) {
    try {
      const target = event.detail?.target;
      if (!target) return;

      // Wenn der Swap #ideas-content betroffen hat (outerHTML), Button zurücksetzen
      if (target.id === 'ideas-content' || target.closest && target.closest('#ideas-content')) {
        const btn = document.getElementById('load-more-chunk');
        if (!btn) return;

        // Auf die erste Folgeseite zurücksetzen
        btn.setAttribute('data-page', '2');
        btn.disabled = false;
        btn.innerText = 'Mehr laden';

        // Wenn es gar keine Ideen-Karten gibt, deaktivieren und passenden Text anzeigen
        const grid = document.querySelector('.ideas-grid');
        const any = grid && grid.querySelector('.idea-card');
        if (!any) {
          btn.disabled = true;
          btn.innerText = 'Keine Ergebnisse';
        }
      }
    } catch (e) {
      console.error('Fehler beim Zurücksetzen des Load-More-Buttons nach HTMX-Swap:', e);
    }
  });

  
  function getIdeaIdFromHash() {
  const h = (window.location.hash || '').trim();
  const m = h.match(/^#idea-(\d+)$/);
  return m ? Number(m[1]) : null;
}

/**
 * Lädt Kommentare für eine Idee, falls noch nicht vorhanden.
 * @param {string|number} ideaId
 * @returns {void}
 */
function ensureCommentsLoaded(ideaId) {
  const placeholder = document.getElementById(`comments-section-${ideaId}`);
  const list = document.getElementById(`comment-list-${ideaId}`);
  if (!placeholder || list) return; // already loaded or no target

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

/**
 * Öffnet beim Hash-Change die referenzierte Karte (falls vorhanden).
 * @returns {void}
 */
function expandCardFromHash() {
  const ideaId = getIdeaIdFromHash();
  if (!ideaId) return;

  const card = document.getElementById(`idea-${ideaId}`);
  if (!card) return;

  // Karten-UI mit vorhandenen Klassen/Verhalten erweitern
  card.classList.add('expanded');
  const expanded = card.querySelector('.idea-expanded');
  if (expanded) expanded.classList.remove('hidden');

  const btn = card.querySelector('.expand-card');
  if (btn) btn.setAttribute('aria-expanded', 'true');

  // Kommentare laden
  ensureCommentsLoaded(ideaId);
}

document.addEventListener('DOMContentLoaded', expandCardFromHash);
window.addEventListener('hashchange', expandCardFromHash);

// HTMX History-Cache-Fehlerbehandlung: loggen und hx-push-url am Filter-Formular deaktivieren,
// um wiederholte History-Snapshot-Fehler nach dynamischen OOB-Swaps zu vermeiden.
document.addEventListener('htmx:historyCacheError', function (evt) {
  try {
    console.warn('htmx historyCacheError:', evt && evt.detail ? evt.detail : evt);
    const filterForm = document.getElementById('filterForm');
    if (filterForm && filterForm.hasAttribute('hx-push-url')) {
      // push-url deaktivieren, um zukünftige History-Snapshot-Versuche zu vermeiden
      filterForm.removeAttribute('hx-push-url');
      console.info('Disabled hx-push-url on #filterForm to avoid history cache errors.');
    }
  } catch (e) {
    console.error('Error handling htmx:historyCacheError:', e);
  }
});


// --- CHUNK LOADING (Option B: JSON + Manual Insertion) ---
/**
 * Lädt weitere Karten im Chunk/Infinite-Scroll-Modus via Fetch/JSON.
 * @async
 * @param {HTMLElement} btn - Auslöser-Button mit `data-page` und `data-url`.
 * @returns {Promise<void>}
 */
async function loadMoreChunk(btn) {
  console.log('[DEBUG] loadMoreChunk called', btn);
  if (!btn || btn.disabled) return;
  
  const origText = btn.innerText;
  btn.disabled = true;
  btn.innerText = 'Lade...';

  try {
    const page = parseInt(btn.getAttribute('data-page') || '1', 10);
    const baseUrl = btn.getAttribute('data-url') || '/ideas/chunk';
    
    console.log('[DEBUG] Loading page', page, 'from', baseUrl);
    
    // Filter-Formular-Daten sammeln
    const filterForm = document.getElementById('filterForm');
    const params = new URLSearchParams();
    if (filterForm) {
      const fd = new FormData(filterForm);
      for (const [k, v] of fd.entries()) {
        if (v) params.append(k, v);
      }
    }
    params.set('page', page);
    params.set('partial_json', '1');

    const url = `${baseUrl}?${params.toString()}`;
    console.log('[DEBUG] Fetching:', url);
    
    const resp = await fetch(url);
    console.log('[DEBUG] Response status:', resp.status);
    
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    
    const data = await resp.json();
    console.log('[DEBUG] Received data.nextPage:', data.nextPage);
    console.log('[DEBUG] Full response:', data);
    
    if (!data || typeof data.html !== 'string') throw new Error('Invalid JSON response');

    // HTML einfügen
    const grid = document.querySelector('.ideas-grid');
    let insertedCount = 0;
    if (grid) {
      // Leeren-Zustand entfernen, falls vorhanden
      const empty = grid.querySelector('.ideas-empty-state');
      if (empty) empty.remove();

      const temp = document.createElement('div');
      temp.innerHTML = data.html;
      
      const newNodes = Array.from(temp.childNodes).filter(n => n.nodeType === 1);
      insertedCount = newNodes.length;
      console.log('[DEBUG] Nodes to insert:', insertedCount);
      
      newNodes.forEach(node => {
        const ideaId = node.dataset.id;
        if (ideaId && grid.querySelector(`.idea-card[data-id="${ideaId}"]`)) {
          console.log('[DEBUG] Skipping duplicate:', ideaId);
          return;
        }

        grid.appendChild(node);
        if (window.htmx) {
          try {
            setTimeout(() => {
              try {
                if (document.contains(node)) {
                  htmx.process(node);
                }
              } catch (e) { console.error('[DEBUG] HTMX error:', e); }
            }, 20);
          } catch (e) { console.error('[DEBUG] HTMX wrapper error:', e); }
        }
      });
    }

    // Heuristischer Workaround: Wenn der Server kein `nextPage` liefert,
    // aber wir eine volle Chunk-Größe eingefügt haben, nehmen wir an,
    // es gibt weitere Seiten und erhöhen lokal die `data-page`.
    const ASSUMED_CHUNK_SIZE = 50; // entspricht serverseitigem Default
    if (!data.nextPage && insertedCount >= ASSUMED_CHUNK_SIZE) {
      // Es gibt vermutlich weitere Seiten
      data.nextPage = page + 1;
      console.warn('[DEBUG] Server returned no nextPage but inserted full chunk — assuming more pages');
    }

      // Button aktualisieren - NIE AUSBLENDEN, nur deaktivieren wenn keine weitere Seite
      if (data.nextPage) {
        btn.setAttribute('data-page', data.nextPage);
        btn.disabled = false;
        btn.innerText = origText;
        console.log('[DEBUG] Next page:', data.nextPage);
      } else {
        // Statt auszublenden: deaktivieren und Text ändern
        btn.disabled = true;
        btn.innerText = 'Keine weiteren Ideen';
        console.log('[DEBUG] No more pages, button disabled');
      }

  } catch (err) {
    console.error('[DEBUG] Error:', err);
    btn.disabled = false;
    btn.innerText = 'Fehler - Erneut versuchen';
  }
}


// --- Tag Long-Press Deletion ---
(function() {
  const HOLD_MS = 700;
  let timer = null;

  
  function attachTagHandlers(el) {
    let startX, startY;

    
    function start(e) {
      if (timer) clearTimeout(timer);
      
      // Visuelles Feedback
      el.classList.add('tag-press');
      
      const touch = (e.touches && e.touches[0]) || e;
      startX = touch.clientX; startY = touch.clientY;
      

      timer = setTimeout(() => {
        const tagName = el.dataset.tag || el.textContent.replace(/^#/, '').trim();
        const modalContent = document.querySelector('.idea-modal-content');
        const ideaId = el.dataset.ideaId || modalContent?.querySelector('[name="idea_id"]')?.value;
        
        if (!ideaId) {
          console.warn('Could not find ideaId for tag deletion');
          return;
        }
        
        if (window.htmx) {
          // HTMX zum Löschen und Aktualisieren des Modal-Inhalts verwenden
          htmx.ajax('POST', `/ideas/${ideaId}/tags/delete-single`, {
            values: { tagName: tagName },
            target: '#idea-edit-modal-content',
            swap: 'innerHTML'
          });
          
          // Auch die Hintergrundkarte aktualisieren
          htmx.ajax('GET', `/ideas/${ideaId}/card`, {
            target: `#idea-${ideaId}`,
            swap: 'outerHTML'
          });
        }
      }, HOLD_MS);
    }

    
    function cancel() {
      if (timer) { clearTimeout(timer); timer = null; }
      el.classList.remove('tag-press');
    }

    el.addEventListener('mousedown', start);
    el.addEventListener('touchstart', start, { passive: true });
    el.addEventListener('mouseup', cancel);
    el.addEventListener('mouseleave', cancel);
    el.addEventListener('touchend', cancel);

    el.addEventListener('touchmove', (e) => {
      const touch = e.touches && e.touches[0];
      if (!touch) return;
      if (Math.hypot(touch.clientX - startX, touch.clientY - startY) > 10) cancel();
    }, { passive: true });
  }

  /**
   * Bindet Long-Press-Handler für Tag-Elemente im Modal (zum Löschen).
   * @returns {void}
   */
  function initModalTags() {
    const container = document.getElementById('idea-edit-modal-content');
    if (!container) return;
    
    const tags = container.querySelectorAll('.tag');

    tags.forEach(t => {
      if (!t.dataset.tag) t.dataset.tag = t.textContent.replace(/^#/, '').trim();
      // Nur anhängen, wenn nicht bereits geschehen (einfache Prüfung)
      if (!t.dataset.longPressBound) {
        t.dataset.longPressBound = 'true';
        t.style.cursor = 'pointer';
        t.style.userSelect = 'none';
        attachTagHandlers(t);
      }
    });
  }

  // Beim Laden und nach jedem HTMX-Swap ausführen
  document.addEventListener('DOMContentLoaded', initModalTags);
  document.addEventListener('htmx:afterSwap', initModalTags);
  
  // Auch ausführen, wenn das Modal manuell per Fetch geöffnet wird
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'childList' && mutation.target.id === 'idea-edit-modal-content') {
        initModalTags();
      }
    }
  });
  

  document.addEventListener('DOMContentLoaded', () => {
    const target = document.getElementById('idea-edit-modal-content');
    if (target) observer.observe(target, { childList: true });
  });

})();


// Veraltet: globaler Toggle entfernt — zugehörige Client-Logik verworfen.


// Export: Helfer für SSE / dynamische Einfügungen
// Diese Funktion bereitet neu eingefügte Karten kurz vor und macht sie dann sichtbar,
// damit CSS-Transitionen zuverlässig greifen.

/**
 * Bereitet neu eingefügte Karten für CSS-Transitionen vor.
 * @param {HTMLElement} card
 * @returns {void}
 */
window.copyIdeaCardComputedStyles = function (card) {
  // Akzeptiert nur echte DOM-Elemente.
  if (!card || card.nodeType !== 1) return;

  try {
    // Vorhandene CSS-Hooks `.fresh-card` / `.fresh-card.visible` verwenden.
    // Die Klasse `.fresh-card` blendet das Element kurz aus und aktiviert `will-change`.
    card.classList.add('fresh-card');

    // Reflow auslösen, damit Styles angewendet werden
    void card.offsetWidth;

    card.classList.add('visible');

    // Temporäre Klassen nach Abschluss entfernen

    setTimeout(() => {
      try {
        card.classList.remove('fresh-card');
        card.classList.remove('visible');
      } catch (e) {}
    }, 800);
  } catch (e) {
    console.error('copyIdeaCardComputedStyles failed:', e);
  }
};








