/**
 * Extrahiert die Ideen-ID aus dem URL-Hash (#idea-123).
 * @returns {number|null}
 */
function getIdeaIdFromHash() {
  const h = (window.location.hash || '').trim();
  const m = h.match(/^#idea-(\d+)$/);
  return m ? Number(m[1]) : null;
}

/** @param {Element | null} value @returns {HTMLElement | null} */
function asHTMLElement(value) {
  return /** @type {HTMLElement | null} */ (value);
}

/** @param {Node | null} value @returns {HTMLElement | null} */
function asHTMLElementNode(value) {
  return /** @type {HTMLElement | null} */ (value);
}

/**
 * Öffnet beim Hash-Change die referenzierte Karte (falls vorhanden).
 * @returns {void}
 */
function expandCardFromHash() {
  const ideaId = getIdeaIdFromHash();
  if (!ideaId) return;

  const card = asHTMLElement(document.getElementById(`idea-${ideaId}`));
  if (!card) return;

  card.classList.add('expanded');
  const expanded = card.querySelector('.idea-expanded');
  if (expanded) expanded.classList.remove('hidden');

  const btn = card.querySelector('.expand-card');
  if (btn) btn.setAttribute('aria-expanded', 'true');

  ensureCommentsLoaded(ideaId);
}

/**
 * Prüft den URL-Hash beim Seitenstart und öffnet ggf. die referenzierte Idee.
 * @returns {void}
 */
function checkDeepLink() {
  const hash = window.location.hash;

  if (!hash || !hash.startsWith('#idea-')) {
    return;
  }

  const targetId = hash.replace('#idea-', '');

  // Prüfen, ob die Idee bereits im DOM vorhanden ist
  const existingCard = asHTMLElement(document.querySelector(`.idea-card[data-id="${targetId}"]`));

  if (existingCard) {
    if (!existingCard.classList.contains('expanded')) {
      expandCard(existingCard, targetId);
    }
    return;
  }

  // Idee nicht auf aktueller Seite → Einzelkarte laden
  loadSingleIdeaCard(targetId);
}

/**
 * Lädt eine einzelne Idee per Fetch und fügt sie oben ins Grid ein.
 * @async
 * @param {string|number} targetId
 * @returns {Promise<void>}
 */
async function loadSingleIdeaCard(targetId) {
  try {
    const response = await fetch(`/ideas/${targetId}/card`);

    if (!response.ok) {
      console.error('Idee ${targetId} nicht gefunden (${response.status})');
      return;
    }

    const html = await response.text();

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const newCardHtml = doc.querySelector('.ideas-grid')?.innerHTML ||
                       html.match(/<article class="idea-card[\s\S]*?<\/article>/)?.[0] ||
                       '';

    if (!newCardHtml) {
      console.error('Keine Karte in Antwort gefunden');
      return;
    }

    const ideasGrid = document.querySelector('.ideas-grid');
    if (ideasGrid) {
      const temp2 = document.createElement('div');
      temp2.innerHTML = newCardHtml.trim();
      const parsedCard = temp2.querySelector('.idea-card');

      // Klon-basierte Einfügung für korrekte Styles und HTMX-Bindungen
      const template = asHTMLElement(document.querySelector('.idea-card'));
      if (template && parsedCard) {
        const clone = /** @type {HTMLElement} */ (template.cloneNode(true));
        clone.id = `idea-${targetId}`;
        clone.setAttribute('data-id', String(targetId));
        try { clone.innerHTML = parsedCard.innerHTML; } catch (e) {}

        // Versteckt einfügen, dann einblenden für flüssige Animation
        try { clone.style.visibility = 'hidden'; } catch (e) {}

        const firstCard = asHTMLElement(ideasGrid.querySelector('.idea-card'));
        if (firstCard) ideasGrid.insertBefore(clone, firstCard);
        else ideasGrid.appendChild(clone);

        try { if (window.htmx) htmx.process(clone); } catch (e) {}

        // Einblend-Animation
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

      // Nach DOM-Update: expandieren, Kommentare laden
      setTimeout(() => {
        const card = asHTMLElement(document.querySelector(`.idea-card[data-id="${targetId}"]`));
        if (card) {
          expandCard(card, targetId);

          setTimeout(() => {
            try {
              card.scrollIntoView({ behavior: 'smooth', block: 'center' });
              // Kurzer grüner Highlight-Effekt
              try {
                card.style.transition = 'box-shadow 0.5s ease';
                card.style.boxShadow = '0 0 0 4px #4CAF50';

                setTimeout(() => card.style.boxShadow = '', 2000);
              } catch (_) {}
            } catch (_) {}
          }, 100);

          try { ensureCommentsLoaded(targetId); } catch (e) {}
        }
      }, 150);
    }

  } catch (error) {
    console.error('Fehler beim Laden der Einzelkarte:', error);
  }
}

/**
 * Lädt weitere Karten im Chunk/Infinite-Scroll-Modus via Fetch/JSON.
 * @async
 * @param {HTMLElement} btn - Auslöser-Button mit data-page und data-url.
 * @returns {Promise<void>}
 */
async function loadMoreChunk(btn) {
  if (!btn || btn.disabled) return;

  const origText = btn.innerText;
  btn.disabled = true;
  btn.innerText = 'Lade...';

  try {
    const page = parseInt(btn.getAttribute('data-page') || '1', 10);
    const baseUrl = btn.getAttribute('data-url') || '/ideas/chunk';

    // Aktuelle Filter-Parameter mitschicken
      const filterForm = /** @type {HTMLFormElement | null} */ (document.getElementById('filterForm'));
    const params = new URLSearchParams();
    if (filterForm) {
      const fd = new FormData(filterForm);
      for (const [k, v] of fd.entries()) {
          if (v) params.append(k, String(v));
      }
    }
    params.set('page', String(page));
    params.set('partial_json', '1');

    const url = `${baseUrl}?${params.toString()}`;

    const resp = await fetch(url);

    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

    const data = await resp.json();

    if (!data || typeof data.html !== 'string') throw new Error('Ungültige JSON-Antwort');

    const grid = document.querySelector('.ideas-grid');
    let insertedCount = 0;
    if (grid) {
      // Leeren-Zustand entfernen, falls vorhanden
      const empty = grid.querySelector('.ideas-empty-state');
      if (empty) empty.remove();

      const temp = document.createElement('div');
      temp.innerHTML = data.html;

      const newNodes = Array.from(temp.childNodes).filter(n => n.nodeType === 1).map(n => /** @type {HTMLElement} */ (n));
      insertedCount = newNodes.length;

      newNodes.forEach(node => {
        // Duplikate vermeiden
        const ideaId = node.dataset.id;
        if (ideaId && grid.querySelector(`.idea-card[data-id="${ideaId}"]`)) {
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
              } catch (e) { console.error('HTMX-Fehler:', e); }
            }, 20);
          } catch (e) { console.error('HTMX-Wrapper-Fehler:', e); }
        }
      });
    }

    // Heuristik: bei voller Chunk-Größe ohne nextPage trotzdem weitere Seiten annehmen
    const ASSUMED_CHUNK_SIZE = 50;
    if (!data.nextPage && insertedCount >= ASSUMED_CHUNK_SIZE) {
      data.nextPage = page + 1;
    }

    // Button-Status aktualisieren
    if (data.nextPage) {
      btn.setAttribute('data-page', data.nextPage);
      btn.disabled = false;
      btn.innerText = origText;
    } else {
      btn.disabled = true;
      btn.innerText = 'Keine weiteren Ideen';
    }

  } catch (err) {
    console.error('Chunk-Ladefehler:', err);
    btn.disabled = false;
    btn.innerText = 'Fehler - Erneut versuchen';
  }
}

document.addEventListener('DOMContentLoaded', function() {
  if (!document.querySelector('.ideas-page')) return;

  // Verzögerte Initialisierung für Deep-Links
  setTimeout(() => {
    checkDeepLink();

    // Auch /ideas/<id>-Pfad als Deep-Link unterstützen
    const m = location.pathname.match(/\/ideas\/(\d+)/);
    if (m) {
      const id = m[1];
      const card = asHTMLElement(document.querySelector(`#idea-${id}`) || document.querySelector(`.idea-card[data-id="${id}"]`));
      if (card) {
        if (!card.classList.contains('expanded')) expandCard(card, id);
      } else {
        try { loadSingleIdeaCard(id); } catch (_) {}
      }
    }
  }, 500);
});

// Hash-Änderungen abfangen
document.addEventListener('DOMContentLoaded', expandCardFromHash);
window.addEventListener('hashchange', expandCardFromHash);

// HTMX History-Cache-Fehler abfangen und hx-push-url deaktivieren
document.addEventListener('htmx:historyCacheError', function (evt) {
  try {
    console.warn('htmx historyCacheError:', evt && evt.detail ? evt.detail : evt);
    const filterForm = document.getElementById('filterForm');
    if (filterForm && filterForm.hasAttribute('hx-push-url')) {
      filterForm.removeAttribute('hx-push-url');
      console.info('hx-push-url auf #filterForm deaktiviert (History-Cache-Fehler).');
    }
  } catch (e) {
    console.error('Fehler bei htmx:historyCacheError:', e);
  }
});

// Load-More-Button nach HTMX-Swap zurücksetzen (Suche/Filter)
document.body.addEventListener('htmx:afterSwap', function(event) {
  try {
    const target = /** @type {HTMLElement | null | undefined} */ (event.detail?.target);
    if (!target) return;

    if (target.id === 'ideas-content' || target.closest && target.closest('#ideas-content')) {
      const btn = document.getElementById('load-more-chunk');
      if (!btn) return;

      btn.setAttribute('data-page', '2');
      btn.disabled = false;
      btn.innerText = 'Mehr laden';

      const grid = document.querySelector('.ideas-grid');
      const any = grid && grid.querySelector('.idea-card');
      if (!any) {
        btn.disabled = true;
        btn.innerText = 'Keine Ergebnisse';
      }
    }
  } catch (e) {
    console.error('Fehler beim Zurücksetzen des Load-More-Buttons:', e);
  }
});
