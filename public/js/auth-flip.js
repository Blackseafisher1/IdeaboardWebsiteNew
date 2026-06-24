/**
 * @fileoverview Steuerung des Auth-Karten-Flip-Effekts (Frontend).
 * @module public/js/auth-flip
 */

/**
 * Toggle die Sichtbarkeit / Klasse der Auth-Karte.
 * @description Schaltet die CSS-Klasse `flipped` am Element mit der ID `auth-card` um.
 * @returns {void}
 */

function flipCard() {
  const card = document.getElementById('auth-card');
  if (!card) return;
  card.classList.toggle('flipped');
}

// Global verfügbar machen für inline `onclick`-Attribute
window.flipCard = flipCard;

// Robust click handling: support clicks on child elements and keyboard activation
/**
 * Klick-Handler für Auth-Toggle-Elemente.
 * @param {MouseEvent} e - Klick-Event.
 * @returns {void}
 */
document.addEventListener('click', (e) => {
	/**
	 * Prüft, ob das geklickte Element ein Auth-Toggle ist und führt ggf. den Flip aus.
	 * @param {MouseEvent} e - Das Klickereignis.
	 * @returns {void}
	 */
	const toggle = e.target && e.target.closest && e.target.closest('.auth-toggle');
	if (toggle) {
		e.preventDefault();
		flipCard();
	}
});

/**
 * Tastatur-Handler: aktiviert Flip bei Enter oder Leertaste auf einem fokussierten Toggle.
 * @param {KeyboardEvent} e - Tastatur-Event.
 * @returns {void}
 */
document.addEventListener('keydown', (e) => {
	if (e.key === 'Enter' || e.key === ' ') {
		/**
		 * Aktiviert den Flip, wenn ein fokussiertes Toggle per Enter/Space ausgelöst wird.
		 * @param {KeyboardEvent} e - Das Tastaturereignis.
		 * @returns {void}
		 */
		const active = document.activeElement;
		if (active && active.classList && active.classList.contains('auth-toggle')) {
			e.preventDefault();
			flipCard();
		}
	}
});

/**
 * Bei DOMContentLoaded: extra Listener für dynamisch hinzugefügte Toggles.
 * @returns {void}
 */
document.addEventListener('DOMContentLoaded', () => {
	/**
	 * Fügt allen `.auth-toggle`-Elementen beim Laden Click-Handler hinzu, die `flipCard()` auslösen.
	 * @returns {void}
	 */
	document.querySelectorAll('.auth-toggle').forEach(btn => {
		/**
		 * Click-Handler für einzelne Toggle-Buttons; verhindert Default und führt `flipCard` aus.
		 * @param {MouseEvent} e - Klickereignis.
		 * @returns {void}
		 */
		btn.addEventListener('click', (e) => { e.preventDefault(); flipCard(); });
	});
});
