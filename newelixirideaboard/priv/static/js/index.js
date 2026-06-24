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

// Globale Variablen zur Nachverfolgung ausgelagerter Elemente
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
      // restore ARIA and remove mobile inline styles now that nav is back in header
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
      // restore any tabindex/aria adjustments we made for mobile
      try { restoreNavFocusableElements(); } catch (e) {}
      navMovedOut = false;
    }
  }
  if (overlay && overlayMovedOut && header) {
    header.appendChild(overlay);
    overlayMovedOut = false;
  }
  if (hamburger && hamburgerMovedOut && hamburgerOriginalParent) {
    // Only move the hamburger back into the header on desktop; keep it in body on mobile
    if (window.innerWidth > 1024) {
      if (hamburgerOriginalNextSibling) {
        hamburgerOriginalParent.insertBefore(hamburger, hamburgerOriginalNextSibling);
      } else {
        hamburgerOriginalParent.appendChild(hamburger);
      }
      hamburgerMovedOut = false;
      applyHamburgerFixed(false);
    } else {
      // Keep hamburger fixed in body for mobile to avoid flicker/containment issues
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

    // Move elements to body on mobile to avoid containing block issues from header filters
    if (window.innerWidth <= 1024) {
      moveElementsToBody();
    }

    const willOpen = !nav.classList.contains('active');
    nav.classList.toggle('active');
    hamburger.classList.toggle('active');
    overlay.classList.toggle('active');

    // ARIA and focus handling
    if (willOpen) {
      try { hamburger.setAttribute('aria-expanded', 'true'); } catch (e) {}
      try { nav.setAttribute('aria-hidden', 'false'); } catch (e) {}
      // sanitize decorative elements and trap focus
      sanitizeNavFocusableElements();
      trapFocus(nav);
    } else {
      try { hamburger.setAttribute('aria-expanded', 'false'); } catch (e) {}
      try { nav.setAttribute('aria-hidden', 'true'); } catch (e) {}
      releaseFocus();
    }

    // Force inline positioning so menu opens even if header/top changed
    nav.style.position = 'fixed';
    // Vorzugsweise das Seitenheader-Element per Klasse verwenden, um andere Header zu vermeiden
    const headerEl = document.querySelector('.page-header');
    // If the header is hidden, align nav to the viewport top; otherwise place below header
    const topOffset = (headerEl && !headerHidden) ? (headerEl.offsetHeight || 0) + 'px' : '0';
    nav.style.top = '0'; // Always start from top to avoid gaps when header is hidden
    nav.style.width = nav.style.width || '85%';
    nav.style.height = nav.style.height || '100vh';
    nav.style.transition = 'right 0.32s ease';
    // Sicherstellen, dass die Navigation über Header und Overlay liegt
    // nav.style.zIndex = '1000002'; // Handled by CSS !important

    // Sicherstellen, dass das Hamburger-Icon über der Navigation liegt und stets anklickbar ist
    hamburger.style.position = hamburger.style.position || 'fixed';
    hamburger.style.zIndex = '10000005';
    // Center hamburger vertically inside the header when header is visible
    const hbHeight = hamburger.offsetHeight || 40;
    const headerHeight = headerEl ? (headerEl.offsetHeight || 0) : 0;
    if (headerHidden || !headerHeight) {
      hamburger.style.top = '12px';
    } else {
      const centered = Math.max(6, Math.round((headerHeight - hbHeight) / 2));
      hamburger.style.top = centered + 'px';
    }

    // Overlay zwischen Navigation und Inhalt platzieren
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.right = '0';
    overlay.style.bottom = '0';
    // Put overlay below nav but above the rest of the page
    overlay.style.zIndex = '1000001';

    if (willOpen) {
      // sichtbar machen und einblenden
      overlay.style.display = 'block';
      // small timeout to allow display/block then transition

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

  // slide out then hide overlay
  nav.style.right = '-100%';
  // delay hiding overlay a bit to match nav transition

  setTimeout(() => { 
    overlay.style.display = 'none'; 
    // If header is visible, move elements back to their original place
    if (!headerHidden) {
      moveElementsBack();
    }
    // ARIA and focus restore
    try { hamburger.setAttribute('aria-expanded', 'false'); } catch (e) {}
    try { nav.setAttribute('aria-hidden', 'true'); } catch (e) {}
    releaseFocus();
  }, 320);
}

// Close menu on overlay click
if (typeof globalThis.__menuOverlayEl === 'undefined') {
  globalThis.__menuOverlayEl = document.querySelector('.menu-overlay');
}
if (globalThis.__menuOverlayEl && !globalThis.__menuOverlayEl.__menuBound) {
  globalThis.__menuOverlayEl.addEventListener('click', closeMenu);
  globalThis.__menuOverlayEl.__menuBound = true;
}

// Accessibility: focus trap variables
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

  // focus the first focusable element in the nav
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
      // close on escape
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

// Remove tabindex from decorative/non-interactive elements inside the nav
/**
 * Entfernt tabindex/ARIA von dekorativen Elementen in der Navigation.
 * @returns {void}
 */
function sanitizeNavFocusableElements() {
  const nav = document.getElementById('main-nav');
  if (!nav) return;
  const allowedTags = new Set(['A','BUTTON','INPUT','SELECT','TEXTAREA','SUMMARY','DETAILS']);
  
  const allowedRoles = new Set(['button','link','menuitem','tab','switch','checkbox','textbox','option']);

  // Remove tabindex on elements that are not interactive and don't declare an interactive role

  nav.querySelectorAll('[tabindex]').forEach(el => {
    const tag = (el.tagName || '').toUpperCase();
    const role = (el.getAttribute && el.getAttribute('role')) || '';
    const hasHref = el.hasAttribute && el.hasAttribute('href');
    if (!allowedTags.has(tag) && !hasHref && !allowedRoles.has(role.toLowerCase())) {
      el.setAttribute('tabindex', '-1');
      try { el.dataset.__tabindexSanitized = '1'; } catch (e) {}
    }
  });

  // Ebenso sicherstellen, dass rein dekorative `span`/`img` vor Hilfstechnologien verborgen werden, falls sie `role` oder `tabindex` gesetzt haben

  nav.querySelectorAll('span[role="img"], span[aria-hidden="false"]').forEach(el => {
    try {
      // mark that we changed aria-hidden so we can restore it later
      el.dataset.__ariaSanitized = '1';
      el.setAttribute('aria-hidden','true');
    } catch (e) {}
  });
}

// Restore any tabindex/aria adjustments previously applied by sanitizeNavFocusableElements
/**
 * Stellt zuvor geänderte tabindex/ARIA-Eigenschaften in der Navigation wieder her.
 * @returns {void}
 */
function restoreNavFocusableElements() {
  const nav = document.getElementById('main-nav');
  if (!nav) return;
  // Restore tabindex for elements we sanitized

  nav.querySelectorAll('[data-__tabindex-sanitized="1"]').forEach(el => {
    try {
      if (el.getAttribute && el.getAttribute('tabindex') === '-1') {
        el.removeAttribute('tabindex');
      }
      delete el.dataset.__tabindexSanitized;
    } catch (e) {}
  });

  // Restore aria-hidden for elements we adjusted

  nav.querySelectorAll('[data-__aria-sanitized="1"]').forEach(el => {
    try {
      // remove the aria-hidden we added; if it had a previous explicit value we can't recover it reliably
      el.removeAttribute('aria-hidden');
      delete el.dataset.__ariaSanitized;
    } catch (e) {}
  });
}

// Close menu on window resize to desktop
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

// Header hide on scroll for mobile (JS-only; no CSS changes required)
let lastScrollTop = 0;
const header = document.querySelector('.page-header');
const hamburgerEl = document.querySelector('.hamburger');
let headerHidden = false;
// Kennzeichen zum Ignorieren programmgesteuerter Scrolls (von anderen Modulen gesetzt)
window.__suppressHeaderHide = false;

/**
 * Blendet die Header-Leiste mobil ein/aus (mit Transition).
 * @param {boolean} hide
 * @returns {void}
 */
function setHeaderHidden(hide) {
  if (!header) return;
  // Hide header by moving it out of the viewport using `top` and `position: fixed`.
  // Avoid `transform` because transformed ancestors cause `position: fixed` children
  // (like the hamburger) to be positioned relative to the ancestor instead of the viewport.
  const transitionMs = 280;
  if (hide) {
    // Move hamburger, nav, and overlay out of header if not already moved so they stay visible/functional
    if (window.innerWidth <= 1024) {
      moveElementsToBody();
    }
    // set fixed positioning so the header can be moved without affecting document flow
    header.style.position = 'fixed';
    header.style.left = '0';
    header.style.right = '0';
    header.style.transition = `top ${transitionMs}ms ease`;
    header.style.top = `-${header.offsetHeight || 80}px`;
    headerHidden = true;
    // Footer reveal/hide is handled separately by a dedicated footer reveal handler.
  } else {
    header.style.transition = `top ${transitionMs}ms ease`;
    header.style.top = '';
    // after the transition, restore positioning to its original state

    setTimeout(() => {
      header.style.position = '';
      header.style.left = '';
      header.style.right = '';
      header.style.transition = '';
      // Move nav, overlay, and hamburger back into header if the menu is not currently open
      const nav = document.getElementById('main-nav');
      const menuOpen = nav && nav.classList.contains('active');
      if (!menuOpen) {
        moveElementsBack();
      }
    }, transitionMs + 30);
    headerHidden = false;
    // Footer reveal/hide is handled separately by a dedicated footer reveal handler.
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
    // Use CSS class for box-shadow so it respects theme changes immediately
    hamburgerEl.classList.add('hamburger--fixed');
  } else {
    hamburgerEl.style.position = '';
    hamburgerEl.style.top = '';
    hamburgerEl.style.right = '';
    hamburgerEl.style.zIndex = '';
    hamburgerEl.classList.remove('hamburger--fixed');
  }
}


// Sicherstellen, dass Konto/Logo bei Bedarf beim Initialisieren in die mobile Navigation verschoben werden

document.addEventListener('DOMContentLoaded', () => {
  if (window.innerWidth <= 1024) moveElementsToBody();
  // sanitize nav to avoid focusing decorative elements
  sanitizeNavFocusableElements();

  // Footer reveal/auto-hide removed — footer remains visible at all times.
  // No JavaScript is required for footer visibility; control it with CSS/HTML if needed.


  // Global keyboard shortcut: Ctrl+Y or Cmd+Y -> teleport to top (site-wide)
  (function initGlobalScrollShortcut() {
    
    function onKeydown(e) {
      try {
        const key = (e.key || '').toLowerCase();
        if (key !== 'y' || !(e.ctrlKey || e.metaKey)) return;
        const target = e.target;
        const tag = target && target.tagName;
        // Ignorieren, wenn Fokus auf Formularsteuerelementen oder editierbaren Inhalten liegt
        if (target && (target.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT')) return;

        // Prevent header-hide reactions during our programmatic scrolls if other modules listen
        try { window.__suppressHeaderHide = true; } catch (_) {}

        // Instant teleport to top
        window.scrollTo({ top: 0, behavior: 'auto' });
        try { document.documentElement.scrollTop = 0; } catch (_) {}
        try { document.body.scrollTop = 0; } catch (_) {}
        e.preventDefault();

        // Short delay before re-enabling header hide logic

        setTimeout(() => { try { window.__suppressHeaderHide = false; } catch (_) {} }, 50);
      } catch (err) {
        console.error('Global scroll shortcut error:', err);
      }
    }
    document.addEventListener('keydown', onKeydown);
  })();
});

// Desktop header open/close behavior removed — header remains static on desktop.


