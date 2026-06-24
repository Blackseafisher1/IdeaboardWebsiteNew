const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const DIR = path.join(ROOT, 'public', 'js');

function walk(dir, cb) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, cb);
    else cb(full);
  }
}

function chooseComment(nextLine) {
  const l = nextLine || '';
  if (/addEventListener\(['\"]click['\"]/.test(l)) return 'Click-Handler: reagiert auf Benutzerklicks und führt die zugehörige Aktion aus.';
  if (/addEventListener\(['\"]change['\"]/.test(l)) return 'Change-Handler: reagiert auf Änderungen von Eingabefeldern.';
  if (/addEventListener\(['\"]keydown['\"]/.test(l) || /addEventListener\(['\"]keyup['\"]/.test(l)) return 'Tastatur-Handler: verarbeitet Tastaturereignisse (z. B. Enter/Space).';
  if (/forEach\(/.test(l)) return 'Iteriert über eine NodeList/Array und führt für jedes Element den Handler aus.';
  if (/setTimeout\(/.test(l)) return 'Verzögertes Ausführen eines kurzen Tasks mit `setTimeout`.';
  if (/EventSource/.test(l) || /onmessage/.test(l)) return 'Ereignishandler für Server-Sent-Events (SSE): verarbeitet eingehende Live-Updates.';
  if (/htmx:/.test(l)) return 'HTMX-Event-Handler: reagiert auf HTMX-Lifecycle-Ereignisse.';
  if (/document.addEventListener\(['\"]DOMContentLoaded['\"]/.test(l)) return 'Initialisiert UI-Handler nach DOMContentLoaded.';
  if (/querySelectorAll\(/.test(l)) return 'Wendet einen Handler auf eine Liste von DOM-Elementen an.';
  return 'Callback/Handler: verarbeitet das zugehörige Ereignis oder die Iteration.';
}

walk(DIR, (file) => {
  if (!file.endsWith('.js')) return;
  let src = fs.readFileSync(file, 'utf8');
  // Replace multi-line JSDoc blocks that mention anonymousArrowLine\d+
  const re = /\/\*\*[\s\S]*?anonymousArrowLine\d+[\s\S]*?\*\//g;
  let m;
  let changed = false;
  src = src.replace(re, (match, offset) => {
    // find next non-empty line after the match
    const after = src.slice(offset + match.length);
    const nextLine = after.split(/\r?\n/)[0] || '';
    const comment = chooseComment(nextLine);
    // construct JSDoc block
    const indentMatch = match.match(/^(\s*)/);
    const indent = (indentMatch && indentMatch[1]) || '';
    const block = `${indent}/**\n${indent} * ${comment}\n${indent} * @param {*} [event] - Ereignisobjekt\n${indent} * @returns {void}\n${indent} */`;
    changed = true;
    return block;
  });
  if (changed) {
    fs.writeFileSync(file, src, 'utf8');
    console.log('Replaced anonymous comments in', path.relative(ROOT, file));
  }
});
console.log('Done.');
