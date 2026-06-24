/**
 * @fileoverview Verwaltung des Master-Keys für Dateiverschlüsselung (Erzeugen, Laden, Wrapping).
 * @module lib/keyManager
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Verwaltung des Master-Keys für Dateiverschlüsselung.
 *
 * Ablauf:
 * 1. Prüft, ob `master_key.wrapped` im Projekt vorhanden ist.
 * 2. Falls nicht vorhanden: fordert ein Passwort an, generiert einen 32-Byte-Schlüssel,
 *    verschlüsselt (wrapt) ihn mit AES-256-GCM und speichert die Box.
 * 3. Falls vorhanden: versucht, den Schlüssel mit dem Passwort zu entpacken (unwrap).
 * 4. Bei falschem Passwort wird ein fataler Fehler ausgelöst.
 */

/** @constant {string} @readonly */
const KEY_FILE_PATH = path.join(__dirname, '..', 'master_key.wrapped');
/** @constant {string} @readonly */
const SALT = 'ideaboard-master-key-wrap-v1';

let masterKey = null;

/**
 * Interaktives Einlesen eines Passworts von stdin (maskiert).
 * @private
 * @param {string} promptText - Text, der als Eingabeaufforderung angezeigt wird.
 * @returns {Promise<string>} Eingegebenes Passwort.
 */
async function askPassword(promptText) {
  const readlineInterface = require('readline');
  const rl = readlineInterface.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  // Use the established _writeToOutput hook for masking
  rl._writeToOutput = function(stringToWrite) {
    if (this.stdoutMuted) {
      // Only mask characters, allow newline and prompt text
      if (stringToWrite === promptText) {
        process.stdout.write(stringToWrite);
      } else if (stringToWrite === '\r\n' || stringToWrite === '\n' || stringToWrite === '\r') {
        process.stdout.write(stringToWrite);
      } else {
        process.stdout.write('*');
      }
    } else {
      process.stdout.write(stringToWrite);
    }
  };
  // Promise, das die maskierte Passworteingabe asynchron liefert.
  // `rl.stdoutMuted` sorgt dafür, dass im Terminal Sterne (*) statt der tatsächlichen
  // Zeichen angezeigt werden. Bei Abschluss von `rl.question` wird das Promise
  // mit dem eingegebenen Passwort aufgelöst.
  return new Promise((resolve) => {
    rl.stdoutMuted = true;
    // `rl.question` liest die Benutzereingabe; nach Eingabe wird die Schnittstelle geschlossen
    // und das eingegebene Passwort zurückgegeben.
    rl.question(promptText, (password) => {
      rl.close();
      process.stdout.write('\n');
      resolve(password);
    });
  });
}

/**
 * Leitet aus einem Passwort den Wrap-Key ab (synchron).
 * @private
 * @param {string} password
 * @returns {Buffer} Ableiteter Schlüssel (32 Bytes).
 */
function deriveWrapKey(password) {
  return crypto.scryptSync(password, SALT, 32);
}

/**
 * Wrappt einen Schlüssel mit AES-256-GCM basierend auf einem Passwort.
 * @private
 * @param {Buffer} key - Rohschlüssel, der geschützt werden soll.
 * @param {string} password - Passwort zur Ableitung des Wrap-Keys.
 * @returns {string} JSON-kodierte, mit Base64 versehene Box (iv, authTag, data).
 */
function wrap(key, password) {
  const wrapKey = deriveWrapKey(password);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', wrapKey, iv);
  const encrypted = Buffer.concat([cipher.update(key), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return JSON.stringify({
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    data: encrypted.toString('base64')
  });
}

/**
 * Entwrappt einen zuvor mit `wrap` erzeugten JSON-String.
 * @private
 * @param {string} wrappedJson - JSON-String mit `iv`, `authTag` und `data`.
 * @param {string} password - Passwort zur Ableitung des Wrap-Keys.
 * @returns {Buffer|null} Entschlüsselter Schlüssel oder `null` bei Fehler.
 */
function unwrap(wrappedJson, password) {
  try {
    const { iv, authTag, data } = JSON.parse(wrappedJson);
    const wrapKey = deriveWrapKey(password);
    const decipher = crypto.createDecipheriv('aes-256-gcm', wrapKey, Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(authTag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]);
  } catch (e) {
    return null;
  }
}

/**
 * Initialisiert den Key-Manager: Lädt oder erstellt den `master_key.wrapped`.
 * @async
 * @returns {Promise<Buffer>} Den geladenen oder neu erzeugten Master-Key.
 * @throws {Error} Bei fatalen Fehlern (nicht genug Passwort-Länge, falsches Passwort).
 */
async function init() {
  const envPassword = process.env.UPLOAD_MASTER_PASSWORD;

  if (fs.existsSync(KEY_FILE_PATH)) {
  console.log('--- File Encryption Protection ---');
    let passwordCandidates = [];
    if (envPassword) {
      console.log('Using fixed password from environment to unlock master key.');
      // Try common variants: raw, trimmed, and unquoted
      passwordCandidates.push(envPassword);
      passwordCandidates.push(envPassword.trim());
      passwordCandidates.push(envPassword.replace(/^['\"]|['\"]$/g, '').trim());
    } else {
      const interactive = await askPassword('Enter UPLOAD PROTECTION PASSWORD: ');
      passwordCandidates.push(interactive);
    }

    const wrapped = fs.readFileSync(KEY_FILE_PATH, 'utf8');
    let unwrapped = null;
    let usedPassword = null;
    for (const candidate of passwordCandidates) {
      if (!candidate) continue;
      unwrapped = unwrap(wrapped, candidate);
      if (unwrapped) {
        usedPassword = candidate;
        break;
      }
    }

    if (!unwrapped) {
      console.error('FATAL: WRONG PASSWORD. Master key decryption failed. Tried variants:', passwordCandidates);
      process.exit(1);
    }
    masterKey = unwrapped;
    console.log('Master key erfolgreich geladen.');
  } else {
    console.log('--- Initializing File Encryption ---');
    console.log('No master key found. Creating a new one.');

    let password;
    if (envPassword) {
      password = envPassword;
      console.log('Using fixed password from environment to generate master key.');
    } else {
      password = await askPassword('Set a NEW UPLOAD PROTECTION PASSWORD: ');
      const confirm = await askPassword('Confirm NEW password: ');

      if (password !== confirm) {
        console.error('FATAL: Passwords do not match.');
        process.exit(1);
      }
    }

    if (password.length < 4) {
      console.error('FATAL: Password zu kurz.');
      process.exit(1);
    }

    const newKey = crypto.randomBytes(32);
    const wrapped = wrap(newKey, password);
    fs.writeFileSync(KEY_FILE_PATH, wrapped, { mode: 0o600 });
    masterKey = newKey;
    console.log(`Neuer Master key generiert und gespeichert unter ${path.basename(KEY_FILE_PATH)}`);
  }
  return masterKey;
}

/**
 * Liefert den aktuell geladenen Master-Key.
 * @returns {Buffer} Master-Key.
 * @throws {Error} Wenn `init()` zuvor nicht aufgerufen wurde.
 */
function getMasterKey() {
  if (!masterKey) {
    throw new Error('KeyManager not initialized. Call init() first.');
  }
  return masterKey;
}

module.exports = {
  init,
  getMasterKey
};
