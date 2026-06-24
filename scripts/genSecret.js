#!/usr/bin/env node
// scripts/genSecret.js
// Usage: node scripts/genSecret.js [--write]
// Prints a secure SESSION_SECRET. With --write it appends to .env if SESSION_SECRET not present.

/**
 * Modul: scripts/genSecret.js — Hilfs-Skript zum Erzeugen eines sicheren `SESSION_SECRET`.
 *
 * Dieses Skript generiert einen kryptographisch sicheren zufälligen Schlüssel, der
 * als `SESSION_SECRET` in einer `.env`-Datei verwendet werden kann. Ohne Parameter
 * wird der Schlüssel auf STDOUT ausgegeben; mit `--write` wird er an `.env` angehängt,
 * sofern dort noch kein `SESSION_SECRET` vorhanden ist.
 *
 * Verwendung:
 *   node scripts/genSecret.js [--write]
 *
 * @module scripts/genSecret
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function genSecret() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Generiert ein hex-codiertes, 32-Byte langes Secret für Sessions.
 *
 * @returns {string} Hex-codierter Secret-String (64 Zeichen).
 */

const envPath = path.join(process.cwd(), '.env');
let envContent = '';
if (fs.existsSync(envPath)) {
  try {
    envContent = fs.readFileSync(envPath, 'utf8');
  } catch (e) {
    console.error('Konnte .env nicht lesen:', e.message);
  }
}

const hasSecretInEnv = /^\s*SESSION_SECRET\s*=.*$/m.test(envContent);

const args = process.argv.slice(2);
const shouldWrite = args.includes('--write') || args.includes('--save') || args.includes('-w');

if (hasSecretInEnv) {
  if (shouldWrite) {
    console.log('SESSION_SECRET bereits in .env vorhanden. Überspringe Generierung.');
  } else {
    console.log('SESSION_SECRET bereits in .env vorhanden.');
  }
} else {
  const secret = genSecret();
  console.log(secret);

  if (shouldWrite) {
    const line = `\nSESSION_SECRET=${secret}\n`;
    try {
      fs.appendFileSync(envPath, line, { encoding: 'utf8' });
      console.log('SESSION_SECRET an .env angehängt');
    } catch (e) {
      console.error('Konnte SESSION_SECRET nicht in .env anhängen:', e.message);
      process.exit(3);
    }
  }
}
