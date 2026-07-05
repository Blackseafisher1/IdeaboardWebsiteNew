/**
 * Verhindert doppeltes Absenden des Erstellungs-Formulars.
 * @type {boolean}
 */
let isSubmittingIdea = false;

/**
 * Bindet Erstellen- und Löschen-Handler für Ideen (Form-Interception via Fetch).
 * @returns {void}
 */
function bindCreateAndDeleteHandlers() {
  // === Create-Idea-Formular abfangen ===
  const createForm = document.getElementById('createIdeaForm');
  if (createForm) {
    createForm.addEventListener('submit', async function (e) {
      e.preventDefault();

      const submitBtn = createForm.querySelector('button[type="submit"]');
      if (submitBtn && (submitBtn.disabled || isSubmittingIdea)) {
        console.warn('Doppeltes Absenden blockiert');
        return;
      }

      isSubmittingIdea = true;
      const fd = new FormData(createForm);

      try {
        // Modal sofort schließen
        const modal = document.getElementById('createIdeaModal');
        try { if (modal && typeof modal.close === 'function') modal.close(); } catch(_) {}

        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.dataset._orig = submitBtn.innerText;
          submitBtn.innerText = 'Erstelle...';
        }

        // Lokale Erstellung markieren → SSE new_idea unterdrücken
        window.isLocalIdeaCreation = true;

        const resp = await fetch(createForm.action, {
          method: 'POST',
          headers: { 'hx-request': 'true' },
          body: fd
        });

        if (!resp.ok) {
          console.error('Fehler beim Erstellen der Idee', resp.status);
          const errorText = await resp.text();
          alert('Fehler beim Erstellen: ' + (errorText || 'Serverfehler'));

          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerText = submitBtn.dataset._orig || 'Erstellen';
          }
          return;
        }

        const html = await resp.text();

        // Karte aus der Antwort extrahieren und ins Grid einfügen
        const ideasGrid = document.querySelector('.ideas-grid');
        if (ideasGrid) {
          const temp = document.createElement('div');
          temp.innerHTML = html;
          const incoming = temp.querySelector('.idea-card');
          const newId = incoming ? (incoming.dataset.id || incoming.getAttribute('data-id')) : null;

          if (incoming && newId) {
            createForm.reset();

            // Prüfen, ob Karte bereits per SSE eingefügt wurde
            const existing = document.querySelector(`.idea-card[data-id="${newId}"]`);
            if (existing) {
              console.log('Lokales Erstellen: Karte bereits via SSE vorhanden, Überspringen.');
            } else {
              document.querySelectorAll('.empty-state').forEach(n => n.remove());

              try { incoming.style.visibility = 'hidden'; } catch (e) {}

              const firstCard = ideasGrid.querySelector('.idea-card');
              if (firstCard) ideasGrid.insertBefore(incoming, firstCard);
              else ideasGrid.appendChild(incoming);

              setTimeout(() => {
                try { incoming.style.visibility = 'visible'; } catch (e) {}
                try { if (window.htmx) htmx.process(incoming); } catch (e) {}
              }, 100);
            }
          } else {
            // Fallback: rohes HTML einfügen
            document.querySelectorAll('.ideas-empty-state').forEach(n => n.remove());
            ideasGrid.insertAdjacentHTML('afterbegin', html);
            const newCard = ideasGrid.querySelector('.idea-card');
            if (newCard && window.htmx) htmx.process(newCard);
          }
        }
      } catch (err) {
        console.error('Ideenerstellung fehlgeschlagen:', err);
        alert('Ein unerwarteter Fehler ist aufgetreten. Bitte versuchen Sie es erneut.');
      } finally {
        isSubmittingIdea = false;
        createForm.reset();

        // Submit-Button nach 2,5s wieder aktivieren
        try {
          if (submitBtn) {
            const restore = () => {
              submitBtn.disabled = false;
              if (submitBtn.dataset._orig) {
                submitBtn.innerText = submitBtn.dataset._orig;
                delete submitBtn.dataset._orig;
              }
            };
            setTimeout(restore, 2500);
          }
        } catch (_) {}

        // Lokalen Erstellungshinweis nach 5s zurücksetzen
        setTimeout(() => { window.isLocalIdeaCreation = false; }, 5000);
      }
    });
  }

  // === Lösch-Formulare abfangen ===
  document.body.addEventListener('submit', async function (e) {
    const form = e.target.closest('form');
    if (!form) return;
    const m = (form.action || '').match(/\/ideas\/(\d+)\/delete$/);
    if (!m) return;
    e.preventDefault();
    const ideaId = m[1];

    // Bestätigung einholen
    if (typeof form.onsubmit === 'function') {
      try {
        const ok = form.onsubmit();
        if (ok === false) return;
      } catch (e) {
        if (!confirm('Diese Idee wirklich löschen?')) return;
      }
    } else {
      if (!confirm('Diese Idee wirklich löschen?')) return;
    }

    try {
      const resp = await fetch(form.action, { method: 'POST', headers: { 'hx-request': 'true' } });
      if (!resp.ok) {
        console.error('Löschen fehlgeschlagen', resp.status);
        return;
      }
      let removed = false;
      try {
        const j = await resp.json();
        if (j && j.deleted) removed = true;
      } catch (_) {
        removed = true;
      }
      if (removed) {
        document.querySelectorAll(`.idea-card[data-id="${ideaId}"]`).forEach(c => c.remove());
        const modal = document.getElementById('idea-edit-modal');
        if (modal && modal.open) {
          closeIdeaEditModal();
        }
      }
    } catch (err) {
      console.error('Löschfehler:', err);
    }
  });
}

/**
 * Öffnet das Edit-/Detail-Modal für eine Idee (serverseitig gerendertes Partial).
 * @param {string|number} ideaId
 * @returns {Promise<void>}
 */
window.openIdeaModal = async function(ideaId) {
  const modal = document.getElementById('idea-edit-modal');
  const container = document.getElementById('idea-edit-modal-content');
  modal.showModal();

  try {
    container.innerHTML = '<p>Lade...</p>';
    const response = await fetch(`/ideas/${encodeURIComponent(ideaId)}/modal?_=${Date.now()}`, {
      headers: {
        'X-Requested-With': 'XMLHttpRequest'
      }
    });

    if (!response.ok) {
      throw new Error(`Modal-Anfrage fehlgeschlagen mit Status ${response.status}`);
    }

    container.innerHTML = await response.text();
    if (window.htmx) htmx.process(container);
  } catch (e) {
    console.error(e);
    container.innerHTML = 'Fehler beim Laden.';
  }
};

/**
 * Schließt das Edit-/Detail-Modal.
 * @returns {void}
 */
window.closeIdeaEditModal = function() {
  const modal = document.getElementById('idea-edit-modal');
  modal.close();
  document.getElementById('idea-edit-modal-content').innerHTML = '';
};

// Initialisierung nach DOM-Ready
document.addEventListener('DOMContentLoaded', function() {
  if (!document.querySelector('.ideas-page')) return;

  bindCreateAndDeleteHandlers();

  // "Neue Idee"-Button im Header
  const openCreateModalBtn = document.getElementById('openCreateModal');
  const createIdeaModal = document.getElementById('createIdeaModal');
  if (openCreateModalBtn && createIdeaModal) {
    openCreateModalBtn.addEventListener('click', () => {
      try { createIdeaModal.showModal(); } catch (_) { createIdeaModal.style.display = 'block'; }
      document.getElementById('new-title')?.focus();
    });
  }
});

// ================================================
// Tag Long-Press Deletion (im Edit-Modal)
// ================================================
(function() {
  const HOLD_MS = 700;
  let timer = null;

  /**
   * Bindet Long-Press-Handler an ein Tag-Element.
   * @param {HTMLElement} el
   */
  function attachTagHandlers(el) {
    let startX, startY;

    function start(e) {
      if (timer) clearTimeout(timer);
      el.classList.add('tag-press');

      const touch = (e.touches && e.touches[0]) || e;
      startX = touch.clientX; startY = touch.clientY;

      timer = setTimeout(() => {
        const tagName = el.dataset.tag || el.textContent.replace(/^#/, '').trim();
        const modalContent = document.querySelector('.idea-modal-content');
        const ideaId = el.dataset.ideaId || modalContent?.querySelector('[name="idea_id"]')?.value;

        if (!ideaId) {
          console.warn('Keine ideaId für Tag-Löschung gefunden');
          return;
        }

        if (window.htmx) {
          htmx.ajax('POST', `/ideas/${ideaId}/tags/delete-single`, {
            values: { tagName: tagName },
            target: '#idea-edit-modal-content',
            swap: 'innerHTML'
          });

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
   * Initialisiert Tag-Long-Press im Modal nach jedem DOM-Update.
   */
  function initModalTags() {
    const container = document.getElementById('idea-edit-modal-content');
    if (!container) return;

    const tags = container.querySelectorAll('.tag');

    tags.forEach(t => {
      if (!t.dataset.tag) t.dataset.tag = t.textContent.replace(/^#/, '').trim();
      if (!t.dataset.longPressBound) {
        t.dataset.longPressBound = 'true';
        t.style.cursor = 'pointer';
        t.style.userSelect = 'none';
        attachTagHandlers(t);
      }
    });
  }

  document.addEventListener('DOMContentLoaded', initModalTags);
  document.addEventListener('htmx:afterSwap', initModalTags);

  // MutationObserver für manuell geöffnete Modals
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
