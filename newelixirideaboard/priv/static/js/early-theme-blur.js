/**
 * @fileoverview Früh-Initialisierung von Theme- und Blur-Präferenzen, um Flash zu vermeiden.
 * @module public/js/early-theme-blur
 */
(function(){
  // Früh ausgeführtes Skript: Theme- und Blur-Präferenz anwenden, bevor CSS gerendert wird.
  try {
    var theme = null;
    try { theme = localStorage.getItem('theme'); } catch(e) { theme = null; }
    if (!theme) {
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) theme = 'dark';
      else theme = 'light';
    }

    // Theme-Attribute anwenden
    try {
      document.documentElement.setAttribute('data-theme', theme);
      document.documentElement.style.colorScheme = theme;
      // Genau die in CSS verwendeten Hintergrundfarben setzen, um Flackern zu vermeiden
      document.documentElement.style.backgroundColor = (theme === 'dark' ? '#1e1e1e' : '#f2f4f7');
    } catch (e) {}

    // Blur preference key used by blur-toggle.js
    var blurKey = 'site:blurEnabled';
    var blurSaved = null;
    try { blurSaved = localStorage.getItem(blurKey); } catch (e) { blurSaved = null; }

    // Wendet die gespeicherte Blur-Einstellung an: '1' = Blur aktiviert (remove 'no-blur'), sonst 'no-blur' setzen
    try {
      if (blurSaved === '1') document.documentElement.classList.remove('no-blur');
      else document.documentElement.classList.add('no-blur');
    } catch (e) {}

    // Falls Cookies als Fallback gewünscht sind, hier optional Cookie-Werte setzen.
    try {
      var maxAge = 60*60*24*365; // 1 Jahr
      document.cookie = 'theme=' + encodeURIComponent(theme) + ';path=/;max-age=' + maxAge + ';SameSite=Lax';
      document.cookie = 'site:blurEnabled=' + (blurSaved === '1' ? '1' : '0') + ';path=/;max-age=' + maxAge + ';SameSite=Lax';
    } catch (e) {}
    } catch (e) {
    /* stillschweigend fehlschlagen - Rendering nicht blockieren */
  }
})();
