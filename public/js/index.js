/**
 * @fileoverview Site-weite UI-Hilfen: Theme, Navigation, Mobile-Nav, Accessibility.
 * @module public/js/index
 */

(function initThemeToggle(){
  /**
   * Wendet ein Theme an und persistiert die Wahl.
   * @param {string} theme
   * @param {boolean} lock - true = Nutzer hat manuell gewählt.
   * @returns {void}
   */
  function applyTheme(theme, lock) {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.colorScheme = theme;
    if (lock) document.documentElement.setAttribute('data-theme-locked','1');
    else document.documentElement.removeAttribute('data-theme-locked');
    try { localStorage.setItem('theme', theme); } catch(e) {}
    try {
      var maxAge = 60*60*24*365; // 1 Jahr
      document.cookie = 'theme=' + encodeURIComponent(theme) + ';path=/;max-age=' + maxAge + ';SameSite=Lax';
    } catch (e) {}
  }

  /**
   * Globaler Theme-Toggle (wechsel zwischen dark/light und sperrt Wahl).
   * @returns {void}
   */
  window.toggleTheme = function toggleTheme(){
    const cur = document.documentElement.getAttribute('data-theme') || 'light';
    const next = (cur === 'dark') ? 'light' : 'dark';
    applyTheme(next, true); // manuell = lock
  };
})();

let navOriginalParent = null;
let navMovedOut = false;
let overlayOriginalParent = null;
let overlayMovedOut = false;
let hamburgerOriginalParent = null;
let hamburgerOriginalNextSibling = null;
let hamburgerMovedOut = false;

/**
 * Verschiebt Navigation/Overlay/Hamburger in den body (für mobiles Menü).
 * @returns {void}
 */
function moveElementsToBody() {
  const nav = document.getElementById('main-nav');
  const overlay = document.querySelector('.menu-overlay');
  const hamburger = document.querySelector('.hamburger');

  if (nav && !navMovedOut) {
    navOriginalParent = nav.parentNode;
    document.body.appendChild(nav);
    navMovedOut = true;
  }
  if (overlay && !overlayMovedOut) {
    overlayOriginalParent = overlay.parentNode;
    document.body.appendChild(overlay);
    overlayMovedOut = true;
  }
  if (hamburger && !hamburgerMovedOut) {
    hamburgerOriginalParent = hamburger.parentNode;
    hamburgerOriginalNextSibling = hamburger.nextSibling;
    document.body.appendChild(hamburger);
    hamburgerMovedOut = true;
    applyHamburgerFixed(true);
  }
}

/**
 * Verschiebt zuvor ausgelagerte Elemente zurück an ihren Ursprungsort (Desktop).
 * @returns {void}
 */
function moveElementsBack() {
  const nav = document.getElementById('main-nav');
  const overlay = document.querySelector('.menu-overlay');
  const hamburger = document.querySelector('.hamburger');
  const headerRight = document.querySelector('.header-right');
  const header = document.querySelector('.page-header');
  
  if (nav && navMovedOut && headerRight) {
    if (window.innerWidth > 1024) {
      headerRight.appendChild(nav);
      try { nav.setAttribute('aria-hidden', 'false'); } catch (e) {}
      try {
        nav.style.position = '';
        nav.style.top = '';
        nav.style.right = '';
        nav.style.width = '';
        nav.style.height = '';
        nav.style.transition = '';
        nav.style.zIndex = '';
      } catch (e) {}
      try { restoreNavFocusableElements(); } catch (e) {}
      navMovedOut = false;
    }
  }
  if (overlay && overlayMovedOut && header) {
    header.appendChild(overlay);
    overlayMovedOut = false;
  }
  if (hamburger && hamburgerMovedOut && hamburgerOriginalParent) {
    if (window.innerWidth > 1024) {
      if (hamburgerOriginalNextSibling) {
        hamburgerOriginalParent.insertBefore(hamburger, hamburgerOriginalNextSibling);
      } else {
        hamburgerOriginalParent.appendChild(hamburger);
      }
      hamburgerMovedOut = false;
      applyHamburgerFixed(false);
    } else {
      applyHamburgerFixed(true);
    }
  }
}

 /**
  * Öffnet/Schließt das mobile Menü, verschiebt Elemente bei Bedarf und verwaltet Fokus.
  * @returns {void}
  */
 function toggleMenu() {
    const nav = document.getElementById('main-nav');
    const hamburger = document.querySelector('.hamburger');
    const overlay = document.querySelector('.menu-overlay');
    if (!nav || !overlay || !hamburger) return;

    if (window.innerWidth <= 1024) {
      moveElementsToBody();
    }

    const willOpen = !nav.classList.contains('active');
    nav.classList.toggle('active');
    hamburger.classList.toggle('active');
    overlay.classList.toggle('active');

    if (willOpen) {
      try { hamburger.setAttribute('aria-expanded', 'true'); } catch (e) {}
      try { nav.setAttribute('aria-hidden', 'false'); } catch (e) {}
      sanitizeNavFocusableElements();
      trapFocus(nav);
    } else {
      try { hamburger.setAttribute('aria-expanded', 'false'); } catch (e) {}
      try { nav.setAttribute('aria-hidden', 'true'); } catch (e) {}
      releaseFocus();
    }

    nav.style.position = 'fixed';
    const headerEl = document.querySelector('.page-header');
    const topOffset = (headerEl && !headerHidden) ? (headerEl.offsetHeight || 0) + 'px' : '0';
    nav.style.top = '0'; // Always start from top to avoid gaps when header is hidden
    nav.style.width = nav.style.width || '85%';
    nav.style.height = nav.style.height || '100vh';
    nav.style.transition = 'right 0.32s ease';
    // Sicherstellen, dass die Navigation über Header und Overlay liegt

    // Sicherstellen, dass das Hamburger-Icon über der Navigation liegt und stets anklickbar ist
    hamburger.style.position = hamburger.style.position || 'fixed';
    hamburger.style.zIndex = '10000005';
    const hbHeight = hamburger.offsetHeight || 40;
    const headerHeight = headerEl ? (headerEl.offsetHeight || 0) : 0;
    if (headerHidden || !headerHeight) {
      hamburger.style.top = '12px';
    } else {
      const centered = Math.max(6, Math.round((headerHeight - hbHeight) / 2));
      hamburger.style.top = centered + 'px';
    }

    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.right = '0';
    overlay.style.bottom = '0';
    overlay.style.zIndex = '1000001';

    if (willOpen) {
      overlay.style.display = 'block';

      requestAnimationFrame(() => { nav.style.right = '0'; });
    } else {
      nav.style.right = '-100%';
      overlay.style.display = 'none';
    }
}

/**
 * Setzt alle Inline-Stile der mobilen Navigation zurück.
 * @returns {void}
 */
function resetMobileNavStyles() {
  const nav = document.getElementById('main-nav');
  const overlay = document.querySelector('.menu-overlay');
  if (nav) {
    nav.style.position = '';
    nav.style.top = '';
    nav.style.right = '';
    nav.style.width = '';
    nav.style.height = '';
    nav.style.transition = '';
    nav.style.zIndex = '';
    nav.classList.remove('active');
  }
  if (overlay) {
    overlay.style.display = '';
    overlay.style.position = '';
    overlay.style.zIndex = '';
  }
  try { restoreNavFocusableElements(); } catch (e) {}
}

/**
 * Schließt das mobile Menü und stellt ARIA/Fokus wieder her.
 * @returns {void}
 */
function closeMenu() {
  const nav = document.getElementById('main-nav');
  const hamburger = document.querySelector('.hamburger');
  const overlay = document.querySelector('.menu-overlay');
  if (!nav || !overlay || !hamburger) return;

  nav.classList.remove('active');
  hamburger.classList.remove('active');
  overlay.classList.remove('active');

  nav.style.right = '-100%';

  setTimeout(() => { 
    overlay.style.display = 'none'; 
    if (!headerHidden) {
      moveElementsBack();
    }
    try { hamburger.setAttribute('aria-expanded', 'false'); } catch (e) {}
    try { nav.setAttribute('aria-hidden', 'true'); } catch (e) {}
    releaseFocus();
  }, 320);
}

if (typeof globalThis.__menuOverlayEl === 'undefined') {
  globalThis.__menuOverlayEl = document.querySelector('.menu-overlay');
}
if (globalThis.__menuOverlayEl && !globalThis.__menuOverlayEl.__menuBound) {
  globalThis.__menuOverlayEl.addEventListener('click', closeMenu);
  globalThis.__menuOverlayEl.__menuBound = true;
}

let __prevFocusedElement = null;
let __focusTrapHandler = null;

/**
 * Trappt den Fokus innerhalb eines Containers für Accessibility.
 * @param {HTMLElement} container
 * @returns {void}
 */
function trapFocus(container) {
  if (!container) return;
  __prevFocusedElement = document.activeElement;

  const focusable = Array.from(container.querySelectorAll('a, button, input, [tabindex]:not([tabindex="-1"])')).filter(el => !el.hasAttribute('disabled'));
  const first = focusable[0] || container;
  const last = focusable[focusable.length - 1] || container;

  try { first.focus(); } catch (e) {}

  __focusTrapHandler = function(e) {
    if (e.key === 'Tab') {
      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    } else if (e.key === 'Escape' || e.key === 'Esc') {
      closeMenu();
    }
  };

  document.addEventListener('keydown', __focusTrapHandler);
}

/**
 * Hebt den Fokus-Trap auf und stellt den vorherigen Fokus wieder her.
 * @returns {void}
 */
function releaseFocus() {
  if (__focusTrapHandler) {
    document.removeEventListener('keydown', __focusTrapHandler);
    __focusTrapHandler = null;
  }
  try { if (__prevFocusedElement && typeof __prevFocusedElement.focus === 'function') __prevFocusedElement.focus(); } catch (e) {}
  __prevFocusedElement = null;
}

/**
 * Entfernt tabindex/ARIA von dekorativen Elementen in der Navigation.
 * @returns {void}
 */
function sanitizeNavFocusableElements() {
  const nav = document.getElementById('main-nav');
  if (!nav) return;
  const allowedTags = new Set(['A','BUTTON','INPUT','SELECT','TEXTAREA','SUMMARY','DETAILS']);
  
  const allowedRoles = new Set(['button','link','menuitem','tab','switch','checkbox','textbox','option']);


  nav.querySelectorAll('[tabindex]').forEach(el => {
    const tag = (el.tagName || '').toUpperCase();
    const role = (el.getAttribute && el.getAttribute('role')) || '';
    const hasHref = el.hasAttribute && el.hasAttribute('href');
    if (!allowedTags.has(tag) && !hasHref && !allowedRoles.has(role.toLowerCase())) {
      el.setAttribute('tabindex', '-1');
      try { el.dataset.__tabindexSanitized = '1'; } catch (e) {}
    }
  });


  nav.querySelectorAll('span[role="img"], span[aria-hidden="false"]').forEach(el => {
    try {
      el.dataset.__ariaSanitized = '1';
      el.setAttribute('aria-hidden','true');
    } catch (e) {}
  });
}

/**
 * Stellt zuvor geänderte tabindex/ARIA-Eigenschaften in der Navigation wieder her.
 * @returns {void}
 */
function restoreNavFocusableElements() {
  const nav = document.getElementById('main-nav');
  if (!nav) return;

  nav.querySelectorAll('[data-__tabindex-sanitized="1"]').forEach(el => {
    try {
      if (el.getAttribute && el.getAttribute('tabindex') === '-1') {
        el.removeAttribute('tabindex');
      }
      delete el.dataset.__tabindexSanitized;
    } catch (e) {}
  });


  nav.querySelectorAll('[data-__aria-sanitized="1"]').forEach(el => {
    try {
      el.removeAttribute('aria-hidden');
      delete el.dataset.__ariaSanitized;
    } catch (e) {}
  });
}

window.addEventListener('resize', function() {
  if (window.innerWidth > 1024) {
    closeMenu();
    moveElementsBack();
  } else {
    // Bei Änderung der mobilen Größe: Sicherstellen, dass mobile Elemente sich in der Schiebemenü-Navigation befinden
    moveElementsToBody();
  }
});

/**
 * Toggle für Auth-Karte (sichtbar/versteckt).
 * @returns {void}
 */
function flipCard() {
  const card = document.getElementById("auth-card");
  const section = document.querySelector(".auth-section");
  if (card) card.classList.toggle("flipped");
  if (section) section.classList.toggle("flipped");
}

// Öffnen/Schließen des Idea-Modals
const openCreateModalBtn = document.getElementById('openCreateModal');

const createIdeaModal = document.getElementById('createIdeaModal');
if (openCreateModalBtn && createIdeaModal) {

  openCreateModalBtn.addEventListener('click', () => createIdeaModal.showModal());
}

let lastScrollTop = 0;
const header = document.querySelector('.page-header');
const hamburgerEl = document.querySelector('.hamburger');
let headerHidden = false;
window.__suppressHeaderHide = false;

/**
 * Blendet die Header-Leiste mobil ein/aus (mit Transition).
 * @param {boolean} hide
 * @returns {void}
 */
function setHeaderHidden(hide) {
  if (!header) return;
  const transitionMs = 280;
  if (hide) {
    if (window.innerWidth <= 1024) {
      moveElementsToBody();
    }
    header.style.position = 'fixed';
    header.style.left = '0';
    header.style.right = '0';
    header.style.transition = `top ${transitionMs}ms ease`;
    header.style.top = `-${header.offsetHeight || 80}px`;
    headerHidden = true;
  } else {
    header.style.transition = `top ${transitionMs}ms ease`;
    header.style.top = '';

    setTimeout(() => {
      header.style.position = '';
      header.style.left = '';
      header.style.right = '';
      header.style.transition = '';
      const nav = document.getElementById('main-nav');
      const menuOpen = nav && nav.classList.contains('active');
      if (!menuOpen) {
        moveElementsBack();
      }
    }, transitionMs + 30);
    headerHidden = false;
  }
}

/**
 * Positioniert das Hamburger-Icon fest oder löst die Fixierung.
 * @param {boolean} enable
 * @returns {void}
 */
function applyHamburgerFixed(enable) {
  if (!hamburgerEl) return;
  if (enable) {
    hamburgerEl.style.position = 'fixed';
    hamburgerEl.style.top = '20px';
    hamburgerEl.style.right = '10px';
    hamburgerEl.style.zIndex = '10000005';
    hamburgerEl.classList.add('hamburger--fixed');
  } else {
    hamburgerEl.style.position = '';
    hamburgerEl.style.top = '';
    hamburgerEl.style.right = '';
    hamburgerEl.style.zIndex = '';
    hamburgerEl.classList.remove('hamburger--fixed');
  }
}



document.addEventListener('DOMContentLoaded', () => {
  if (window.innerWidth <= 1024) moveElementsToBody();
  sanitizeNavFocusableElements();



  (function initGlobalScrollShortcut() {
    
    function onKeydown(e) {
      try {
        const key = (e.key || '').toLowerCase();
        if (key !== 'y' || !(e.ctrlKey || e.metaKey)) return;
        const target = e.target;
        const tag = target && target.tagName;
        if (target && (target.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT')) return;

        try { window.__suppressHeaderHide = true; } catch (_) {}

        window.scrollTo({ top: 0, behavior: 'auto' });
        try { document.documentElement.scrollTop = 0; } catch (_) {}
        try { document.body.scrollTop = 0; } catch (_) {}
        e.preventDefault();


        setTimeout(() => { try { window.__suppressHeaderHide = false; } catch (_) {} }, 50);
      } catch (err) {
        console.error('Global scroll shortcut error:', err);
      }
    }
    document.addEventListener('keydown', onKeydown);
  })();
});



