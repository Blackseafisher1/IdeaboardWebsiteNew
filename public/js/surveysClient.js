/**
 * @fileoverview Client-Logik für Surveys/Projects Seite (Filter, Infinite Scroll, URL-Sync).
 * @module public/js/surveysClient
 */
  // Surveys page
/**
 * DOMContentLoaded-Initialisierung: synchronisiert URL-Parameter mit UI-Feldern (Status, Type, Search).
 * @returns {void}
 */
(function() {
  const surveyInput = document.getElementById('surveySearchInput');
  if (surveyInput) {
    surveyInput.value = '';
    const type = document.getElementById('currentType')?.value || 'all';
    htmx.ajax('GET', `/surveys?type=${encodeURIComponent(type)}&search=&page=1`, {
      target: '#surveysList',
      swap: 'innerHTML'
    });
    return;
  }

  // Projects page (legacy)
  const projectInput = document.getElementById('projectSearchInput');
  if (projectInput) {
    projectInput.value = '';
    const status = document.getElementById('currentStatus')?.value || 'all';
    htmx.ajax('GET', `/projects/fragment?status=${encodeURIComponent(status)}&search=&page=1`, {
      target: '#projectsList',
      swap: 'innerHTML'
    });
    return;
  }

  // Fallback: generische Eingabe mit Klasse `.input` zurücksetzen
  const generic = document.querySelector('input.input[type="text"]');
  if (generic) generic.value = '';
})();


document.addEventListener('DOMContentLoaded', () => {
  // URL Params → UI
  const urlParams = new URLSearchParams(window.location.search);
  const status = urlParams.get('status') || 'all';
  const search = urlParams.get('search') || '';

  // Surveys: type param
  
  const type = urlParams.get('type') || 'all';

  document.getElementById('currentStatus')?.setAttribute('value', status);
  document.getElementById('projectSearchInput')?.setAttribute('value', search);

  document.getElementById('currentType')?.setAttribute('value', type);

  // Active Filter Button
  document.querySelectorAll('.filter-btn').forEach(btn => {
    if (btn.dataset.status !== undefined) btn.classList.toggle('active', btn.dataset.status === status);
    if (btn.dataset.type !== undefined) btn.classList.toggle('active', btn.dataset.type === type);
  });

  // Filter Buttons (reset to page 1)
  // Project filter buttons (existing behavior)
  document.querySelectorAll('.filter-btn[data-status]').forEach(button => {
    button.addEventListener('click', function() {
      
      const newStatus = this.dataset.status || 'all';
/**
 * Klick-Handler für Status-Filter: setzt aktiven Button, aktualisiert `currentStatus` und lädt Fragment per HTMX.
 * @returns {void}
 */
   document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
   this.classList.add('active');
      document.getElementById('currentStatus').value = newStatus;
      const currentSearch = document.getElementById('projectSearchInput')?.value || '';
      htmx.ajax('GET', `/projects/fragment?status=${newStatus}&search=${encodeURIComponent(currentSearch)}&page=1`, {
        target: '#projectsList', 
        swap: 'innerHTML'
      });
    });
  });

  // No client-side interception for survey filter buttons — HTMX handles requests via button attributes.

  // Sicherstellen, dass angeklickter Survey-Filter den aktiven Zustand zeigt
  document.querySelectorAll('.filter-btn[data-type]').forEach(btn => {
    btn.addEventListener('click', function() {
/**
 * Klick-Handler für Survey-Type-Filter: entfernt aktive Markierung von allen Type-Buttons und markiert den aktuellen.
 * @returns {void}
 */
   document.querySelectorAll('.filter-btn[data-type]').forEach(b => b.classList.remove('active'));
   this.classList.add('active');
    });
  });

  // Prevent form submit via Enter key in the surveys search form
  const searchForm = document.getElementById('searchForm');
  if (searchForm) {
    searchForm.addEventListener('submit', function(e) {
      e.preventDefault();
    });
  }

  const surveyInput = document.getElementById('surveySearchInput');
  if (surveyInput) {
    surveyInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') e.preventDefault();
    });
  }
});

// URL sync after HTMX (like Surveys)
document.body.addEventListener('htmx:afterRequest', function(event) {
  // Sync URL for Projects
  if (event.target.id === 'projectsList' || event.target.closest('#projectsList')) {
    const status = document.getElementById('currentStatus')?.value || 'all';
    const search = document.getElementById('projectSearchInput')?.value || '';

    const url = new URL(window.location);
    url.searchParams.set('status', status);
    if (search) url.searchParams.set('search', search);
    else url.searchParams.delete('search');

    try {
      const reqUrl = new URL(event.detail.xhr.responseURL);
      const page = reqUrl.searchParams.get('page');
      if (page && page !== '1') url.searchParams.set('page', page);
      else url.searchParams.delete('page');
    } catch (_) {
      url.searchParams.delete('page');
    }

    window.history.replaceState({}, '', url);
  }

  // Sync URL for Surveys
  if (event.target.id === 'surveysList' || event.target.closest('#surveysList')) {
    const type = document.getElementById('currentType')?.value || 'all';
    const search = document.getElementById('surveySearchInput')?.value || '';

    const url = new URL(window.location);
    url.searchParams.set('type', type);
    if (search) url.searchParams.set('search', search);
    else url.searchParams.delete('search');

    // Server-seitigen `HX-Push`-Header bevorzugen, wenn vorhanden (verhindert, dass `/fragment` in die History gelangt)
    try {
      const hxPush = event.detail.xhr && event.detail.xhr.getResponseHeader && event.detail.xhr.getResponseHeader('HX-Push');
      if (hxPush) {
        window.history.replaceState({}, '', hxPush);
        return;
      }

      const reqUrl = new URL(event.detail.xhr.responseURL);
      const page = reqUrl.searchParams.get('page');
      if (page && page !== '1') url.searchParams.set('page', page);
      else url.searchParams.delete('page');
    } catch (_) {
      url.searchParams.delete('page');
    }

    window.history.replaceState({}, '', url);
  }
});


// Simple inactivity-based polling control for HTMX polling
(function() {
  const INACTIVITY_TIMEOUT = 120000; // 2 minutes
  let timeoutId = null;
  
  function setupInactivityStop(containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;

    // Ursprüngliches `hx-trigger` speichern
    if (!el.dataset.originalHxTrigger) el.dataset.originalHxTrigger = el.getAttribute('hx-trigger') || '';

    
    function disablePolling() {
      const orig = el.dataset.originalHxTrigger || '';
      
      const newTrig = orig.split(',').map(s => s.trim()).filter(t => !t.startsWith('every')).join(', ');
      el.setAttribute('hx-trigger', newTrig || 'load');
      if (window.htmx) htmx.process(el);
    }

    
    function enablePolling() {
      
      const orig = el.dataset.originalHxTrigger || '';
      el.setAttribute('hx-trigger', orig);
      if (window.htmx) htmx.process(el);
    }

/**
 * resetTimer steuert UI-Interaktionen im Frontend (DOM-Manipulation, Event-Handler).
 *
 * @returns {*} Beschreibung des Rückgabewerts
 * @function resetTimer
 */
    function resetTimer() {
      // reset HTMX 'every' timer by removing and re-adding the 'every' part
      try {
        disablePolling();
/**
 * Kurzer Re-Enable-Timeout innerhalb des Polling-Reset: aktiviert Polling wieder nach 50ms.
 * @returns {void}
 */
   setTimeout(() => { enablePolling && enablePolling(); }, 50);
      } catch (e) {}

      if (timeoutId) clearTimeout(timeoutId);
/**
 * Startet den Inaktivitäts-Timer, der nach `INACTIVITY_TIMEOUT` das Polling deaktiviert.
 * @returns {void}
 */
   timeoutId = setTimeout(() => { disablePolling(); }, INACTIVITY_TIMEOUT);
    }

/**
 * Bindet User-Aktivitäts-Listener (mousemove/keydown/click/touchstart), die den Inaktivitäts-Timer zurücksetzen.
 * @returns {void}
 */
   ['mousemove','keydown','click','touchstart'].forEach(ev => window.addEventListener(ev, resetTimer, { passive: true }));
/**
 * Visibility-Change-Handler: pausiert Polling, wenn die Seite verborgen ist; reaktiviert bei Sichtbarkeit.
 * @returns {void}
 */
   document.addEventListener('visibilitychange', () => { if (document.hidden) { if (timeoutId) clearTimeout(timeoutId); disablePolling(); } else resetTimer(); });
    window.addEventListener('focus', resetTimer);
    document.addEventListener('htmx:afterRequest', resetTimer);

    document.addEventListener('DOMContentLoaded', resetTimer);
  }

  setupInactivityStop('surveysList');
})();


