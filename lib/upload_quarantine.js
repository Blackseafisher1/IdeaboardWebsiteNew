/**
 * @fileoverview Hilfsfunktionen zum Quarantänisieren von hochgeladenen Dateien.
 * @module lib/upload_quarantine
 */

const fs = require('fs');
const path = require('path');

/**
 * Stellt sicher, dass ein Verzeichnis existiert (rekursiv).
 * @private
 * @param {string} dir
 * @returns {void}
 */
function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

/**
 * Verschiebt eine verschlüsselte Datei in das Quarantäne-Verzeichnis und schreibt ein Log.
 * @param {string} encPath - Pfad zur zu verschiebenden Datei.
 * @param {string} [reason] - Optionaler Grund für die Quarantäne.
 * @returns {boolean} `true` bei Erfolg, sonst `false`.
 */
function quarantineFile(encPath, reason) {
  try {
    const uploadsRoot = path.join(__dirname, '..', 'data', 'uploads');
    const qDir = path.join(uploadsRoot, 'quarantine');
    ensureDir(qDir);
    const base = path.basename(encPath);
    const ts = Date.now();
    const dest = path.join(qDir, `${ts}-${base}`);
    fs.renameSync(encPath, dest);
    const meta = encPath + '.meta';
    if (fs.existsSync(meta)) fs.renameSync(meta, dest + '.meta');
    const log = {
      original: encPath,
      movedTo: dest,
      reason: reason || '',
      at: new Date().toISOString()
    };
    fs.writeFileSync(dest + '.log.json', JSON.stringify(log, null, 2), { encoding: 'utf8', mode: 0o600 });
    return true;
  } catch (e) {
    console.error('Failed to quarantine file', encPath, e && e.message ? e.message : e);
    return false;
  }
}

module.exports = { quarantineFile };
