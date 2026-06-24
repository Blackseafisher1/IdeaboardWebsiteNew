/**
 * @fileoverview Site-weite Blur-Umschaltung mit LocalStorage-Persistenz.
 * @module public/js/blur-toggle
 */

// Site-weite Blur-Umschaltung (Checkbox-basiert mit LocalStorage-Persistenz)
(function(){
  /** @constant {string} */
  const KEY = 'site:blurEnabled';
  /** @constant {string} */
  const CLS = 'no-blur'; // `no-blur` als Fallback-Klasse für ältere CSS-Regeln verwenden

  // Gespeicherten Zustand so früh wie möglich anwenden, um Flackern zu vermeiden
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === '1') document.documentElement.classList.remove(CLS);
    else document.documentElement.classList.add(CLS);
  } catch (e) {}

  /**
   * Liefert das Haupt-Toggle-Element (Checkbox) zurück.
   * @returns {HTMLInputElement|null}
   */
  function getToggle() {
    return document.querySelector('.site-blur-toggle');
  }

  /**
   * Wendet den Blur-Status an (DOM-Klassen, Toggle-UI, Cookie-Fallback).
   * @param {boolean} enabled - true = Blur aktiviert.
   * @returns {void}
   */
  function applyState(enabled) {
    const toggle = getToggle();
    if (toggle) toggle.checked = enabled;

    // HTML-Klasse ebenfalls für ältere CSS-Regeln synchronisieren
    if (enabled) {
      document.documentElement.classList.remove(CLS);
    } else {
      document.documentElement.classList.add(CLS);
    }

    // Aktualisiert alle sichtbaren Toggle-Buttons (Labels/Buttons) entsprechend dem aktuellen Zustand
    document.querySelectorAll('.blur-toggle').forEach(btn => {
      btn.setAttribute('aria-pressed', enabled ? 'true' : 'false');
      btn.textContent = enabled ? 'Glas' : 'Deckend';
      if (!enabled) {
        btn.classList.add('is-solid');
      } else {
        btn.classList.remove('is-solid');
      }
    });
    // Cookie-Fallback schreiben für serverseitige oder CSP-eingeschränkte Umgebungen
    try {
      var maxAge = 60*60*24*365; // 1 Jahr
      document.cookie = 'site:blurEnabled=' + (enabled ? '1' : '0') + ';path=/;max-age=' + maxAge + ';SameSite=Lax';
    } catch (e) {}
  }

  /**
   * Schaltet den aktuellen Zustand um und persistiert ihn in LocalStorage.
   * @returns {void}
   */
  function toggle() {
    const current = localStorage.getItem(KEY) === '1';
    /**
     * Bestimmt den neuen Zustand (invertiert) und persistiert diesen.
     * @returns {void}
     */
    const newState = !current;
    localStorage.setItem(KEY, newState ? '1' : '0');
    applyState(newState);
  }


  document.addEventListener('DOMContentLoaded', () => {
    const saved = localStorage.getItem(KEY);
    // Standard ist deaktiviert ('0'), falls nie gesetzt (Vorgabe: kein Blur)
    const isEnabled = saved === '1';
    applyState(isEnabled);

    // Auf Änderungen der Checkbox lauschen
    const mainToggle = getToggle();
    if (mainToggle) {
      /**
       * Change-Handler für die Haupt-Checkbox.
       * @param {Event} e - Change-Event.
       */
      mainToggle.addEventListener('change', (e) => {
        
        const enabled = e.target.checked;
        localStorage.setItem(KEY, enabled ? '1' : '0');
        applyState(enabled);
      });
    }

    // Listener an alle Toggle-Elemente (Labels oder Buttons) hängen
    /**
     * Initialisiert die Toggle-Buttons nach DOMContentLoaded: stellt UI-Zustand her und hängt Listener an.
     * @returns {void}
     */
    document.querySelectorAll('.blur-toggle').forEach(btn => {
      /**
       * Klick-Handler auf einem Toggle-Element: verhindert Default und schaltet Zustand um.
       * @param {MouseEvent} e - Klickereignis.
       * @returns {void}
       */
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        toggle();
      });

      /**
       * Tastatur-Handler: löst Toggle bei Enter/Space aus, wenn das Element fokussiert ist.
       * @param {KeyboardEvent} e - Tastaturereignis.
       * @returns {void}
       */
      btn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggle();
        }
      });
    });
  });
})();
