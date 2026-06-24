const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TARGET_DIRS = ['lib', 'routes', 'public/js'];

function walk(dir, cb) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (['node_modules', 'dokumentation', 'tools', '.git'].includes(e.name)) continue;
      walk(full, cb);
    } else {
      cb(full);
    }
  }
}

function isPlaceholderLine(line) {
  return /Beschreibung auf Deutsch|Anonyme Arrow-Funktion|Anonyme Arrow-Funktion;|Anonyme Arrow-Funktion —|Anonyme Arrow-Funktion;|Anonyme Arrow-Funktion/.test(line) || /Führt die Funktion `?\w+`? aus\.|Anonyme Arrow-Funktion; siehe Implementierung/.test(line);
}

function makeDetailedDesc(name, rel) {
  if (!name) {
    return 'Anonyme Funktion, üblicherweise als Callback verwendet; siehe Implementierung für Details.';
  }
  const lower = name.toLowerCase();
  if (lower.startsWith('get') || lower.startsWith('fetch') || lower.startsWith('load')) return `${name} lädt Daten oder liefert einen Wert zurück.`;
  if (lower.startsWith('set') || lower.startsWith('save') || lower.startsWith('update')) return `${name} speichert oder aktualisiert Daten.`;
  if (lower.startsWith('create') || lower.startsWith('add') || lower.startsWith('insert')) return `${name} erstellt einen neuen Eintrag oder fügt ein Element hinzu.`;
  if (lower.startsWith('delete') || lower.startsWith('remove') || lower.startsWith('clear')) return `${name} entfernt einen Eintrag oder setzt einen Zustand zurück.`;
  if (lower.startsWith('handle') || lower.startsWith('on') || lower.startsWith('handle')) return `${name} verarbeitet ein Ereignis oder eine Benutzerinteraktion.`;
  if (lower.startsWith('init') || lower.startsWith('setup') || lower.startsWith('start')) return `${name} initialisiert Zustand oder startet einen Prozess.`;
  if (rel.startsWith('public/js')) return `${name} steuert UI-Interaktionen im Frontend (DOM-Manipulation, Event-Handler).`;
  if (rel.startsWith('routes')) return `${name} ist ein Express-Route-Handler und verarbeitet Anfragen für diese Route.`;
  return `${name} — Funktion mit spezifischer Aufgabe, siehe Implementierung.`;
}

function processFile(file) {
  if (!file.endsWith('.js')) return;
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  if (rel.startsWith('node_modules') || rel.startsWith('dokumentation') || rel.startsWith('tools')) return;

  let src = fs.readFileSync(file, 'utf8');
  const lines = src.split(/\r?\n/);
  let changed = false;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith('/**')) {
      let j = i;
      while (j < lines.length && !lines[j].trim().endsWith('*/')) j++;
      if (j >= lines.length) break;
      const block = lines.slice(i, j + 1);
      // find first non-star content line after '/**'
      let descLineIdx = null;
      for (let k = i + 1; k <= j; k++) {
        const t = lines[k].replace(/^\s*\*\s?/, '');
        if (t.trim() === '') continue;
        // skip @ tags
        if (t.trim().startsWith('@')) continue;
        descLineIdx = k;
        break;
      }
      if (descLineIdx === null) continue;
      const descLine = lines[descLineIdx];
      if (!isPlaceholderLine(descLine)) continue;

      // try to get function name
      let fnName = null;
      for (let k = i; k <= j; k++) {
        const m = lines[k].match(/@function\s+([\w$]+)/);
        if (m) { fnName = m[1]; break; }
      }
      if (!fnName) {
        const nextLine = (lines[j + 1] || '').trim();
        const m2 = nextLine.match(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/);
        if (m2) fnName = m2[1];
        else {
          const m3 = nextLine.match(/function\s+([A-Za-z_$][\w$]*)\s*\(/);
          if (m3) fnName = m3[1];
        }
      }

      const newDesc = makeDetailedDesc(fnName, rel);
      // replace description line
      const indentMatch = lines[descLineIdx].match(/^(\s*\*)/);
      const indent = indentMatch ? indentMatch[1] + ' ' : '* ';
      lines[descLineIdx] = (indent.replace(/^\s*/, '') === '*' ? ' * ' : indent) + newDesc;
      changed = true;
      i = j;
    }
  }

  if (changed) {
    fs.writeFileSync(file, lines.join('\n'), 'utf8');
    console.log('Expanded descriptions in:', rel);
  }
}

function main() {
  for (const d of TARGET_DIRS) {
    const dir = path.join(ROOT, d);
    if (!fs.existsSync(dir)) continue;
    walk(dir, (file) => processFile(file));
  }
  console.log('Done.');
}

main();
