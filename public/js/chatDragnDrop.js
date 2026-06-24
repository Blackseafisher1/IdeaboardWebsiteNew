/**
 * @fileoverview Drag & Drop / Datei-Upload UI für den Chat.
 * @module public/js/chatDragnDrop
 */
document.addEventListener('DOMContentLoaded', () => {
  const bar = document.getElementById('chatInputBar');
  const fileInput = document.getElementById('chatFileInput');
  const previewBar = document.getElementById('chatUploadPreview');
  const fileBtn = document.getElementById('chatFileButton');
  const sendBtn = document.getElementById('messageSendBtn');

  if (!bar || !fileInput || !previewBar) return;

  /**
   * Zeigt eine einfache Dateivorschau (Namen) im Upload-Preview-Bereich an.
   * @param {File[]} files - Array von File-Objekten.
   * @returns {void}
   */
  function showPreview(files) {
    /**
     * Erzeugt eine durch Komma getrennte Liste der Dateinamen für die Anzeige.
     * @returns {void}
     */
    const names = files.map(f => f.name).join(', ');
    previewBar.textContent = names;
    previewBar.hidden = false;
  }

  /**
   * Versteckt die Vorschau, ohne Input zu löschen.
   * @returns {void}
   */
  function clearPreview() {
    previewBar.hidden = true;
    previewBar.textContent = '';
    // Datei-Input hier nicht löschen; Dateien vor dem Absenden zu leeren verhindert Uploads.
  }

  /**
   * Versteckt Vorschau und versucht, das File-Input zu leeren.
   * @returns {void}
   */
  function clearPreviewAndFiles() {
    previewBar.hidden = true;
    previewBar.textContent = '';
    try { fileInput.value = ''; } catch (e) {}
  }

  ['dragenter','dragover','dragleave','drop'].forEach(ev => {
    /**
     * Verhindert Standardverhalten für Drag&Drop-Ereignisse innerhalb der Input-Bar.
     * @param {DragEvent} e - Drag-Event.
     * @returns {void}
     */
    bar.addEventListener(ev, e => { e.preventDefault(); e.stopPropagation(); });
  });

  // Visual feedback während Drag&Drop
  ['dragenter','dragover'].forEach(ev => bar.addEventListener(ev, () => bar.classList.add('drag-over')));
  ['dragleave','drop'].forEach(ev => bar.addEventListener(ev, () => bar.classList.remove('drag-over')));

  /**
   * Drop-Handler: übernimmt Dateien in das Input-Element.
   * @param {DragEvent} e
   */
  bar.addEventListener('drop', e => {
    const files = Array.from(e.dataTransfer.files || []);
    if (!files.length) return;
    // DataTransfer verwenden, um das FileInput programmgesteuert zu befüllen
    const dt = new DataTransfer();
    files.forEach(f => dt.items.add(f));
    try { fileInput.files = dt.files; } catch (err) {}
    showPreview(files);
  });

  // Klick öffnet den Dateidialog
  /**
   * Klick auf die Input-Bar öffnet den Dateidialog, sofern nicht auf ein Eingabefeld oder Button geklickt wurde.
   * @param {MouseEvent} e - Klickereignis.
   * @returns {void}
   */
  bar.addEventListener('click', e => {
    if (!e.target.closest('input[name="message"]') && !e.target.closest('button')) fileInput.click();
  });

  // Dateibutton öffnet den Dateidialog
  if (fileBtn) fileBtn.addEventListener('click', () => fileInput.click());

  /**
   * Change-Handler für das versteckte File-Input: zeigt Vorschau an, falls Dateien gewählt wurden.
   * @returns {void}
   */
  fileInput.addEventListener('change', () => {
    const files = Array.from(fileInput.files || []);
    if (files.length) showPreview(files);
    else clearPreview();
  });

  // HTMX-Hook: Vorschau und Dateien nach einer Anfrage, die das Message-Formular betraf, löschen
  /**
   * HTMX `afterRequest` Hook: löscht Vorschau/Dateien, wenn das Message-Formular betroffen war.
   * @param {CustomEvent} evt - HTMX-Ereignis.
   * @returns {void}
   */
  document.body.addEventListener('htmx:afterRequest', evt => {
    const detail = evt.detail || {};
    const elt = detail.elt || evt.target;
    if (!elt) return;
    const form = (elt.id === 'messageForm') ? elt : (elt.closest ? elt.closest('#messageForm') : null);
    if (form) clearPreviewAndFiles();
  });

    /**
     * Referenz zum Message-Formular, falls vorhanden.
     * @type {HTMLFormElement|null}
     */
  const formEl = document.getElementById('messageForm');
  if (formEl) {
    // Dateien beim Absenden NICHT löschen (Absenden kann asynchron erfolgen; Dateien dürfen vor dem Senden nicht entfernt werden).
  // Reset-Handler: Vorschau & Dateiauswahl bei Formular-Reset löschen.
  formEl.addEventListener('reset', () => clearPreviewAndFiles());
  }


  /**
   * HTMX `confirm` Hook: Verhindert das Absenden, wenn sowohl Textnachricht (getrimmt) als auch Dateien leer sind.
   */
  document.body.addEventListener('htmx:confirm', (e) => {
    const elt = e.detail.elt || e.target;
    if (elt && elt.id === 'messageForm') {
      const msgInput = elt.querySelector('input[name="message"]');
      const fInput = elt.querySelector('input[type="file"]');
      
      const text = (msgInput ? msgInput.value : '').trim();
      const hasFiles = (fInput && fInput.files && fInput.files.length > 0);

      if (!text && !hasFiles) {
        e.preventDefault(); // Stoppt die HTMX-Anfrage
      }
    }
  });
});