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

function isPlaceholderBlock(block) {
  const joined = block.join('\n');
  return /Beschreibung auf Deutsch|TODO: Dokumentation|Anonyme Arrow-Funktion|anonymousArrowLine|Anonyme Arrow-Funktion/.test(joined);
}

function parseParams(block) {
  const params = [];
  for (const l of block) {
    const m = l.match(/@param\s+\{[^}]+\}\s+\[?([\w$]+)\]?/);
    if (m) params.push(m[1]);
  }
  return params;
}

function parseFunctionName(block) {
  for (const l of block) {
    const m = l.match(/@function\s+([\w$]+)/);
    if (m) return m[1];
  }
  return null;
}

function inferNameFromNextLine(nextLine) {
  const m = nextLine.match(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/);
  if (m) return m[1];
  const n = nextLine.match(/function\s+([A-Za-z_$][\w$]*)\s*\(/);
  if (n) return n[1];
  const prop = nextLine.match(/([A-Za-z_$][\w$]*?)\s*[:=]\s*\(?[^)]*\)?\s*=>/);
  if (prop) return prop[1];
  return null;
}

function makeGermanDescriptionForFunction(name, params) {
  if (name) {
    const short = `Führt die Funktion \`${name}\` aus.`;
    const detail = params.length ? ` Nimmt ${params.length} Parameter entgegen: ${params.join(', ')}.` : '';
    return short + detail;
  }
  return 'Anonyme Arrow-Funktion; siehe Implementierung für Details.';
}

function makeModuleDescription(relPath) {
  // heuristics
  if (relPath.startsWith('public/js')) return `Frontend-Skript für die Benutzeroberfläche (${path.basename(relPath)}). Enthält DOM-Interaktionen und Event-Handler.`;
  if (relPath.startsWith('routes')) return `Express Route-Handler für \`${path.basename(relPath)}\`. Regelt Anfrage-/Antwortlogik.`;
  if (relPath.startsWith('lib')) return `Hilfsfunktionen und Services in \`${path.basename(relPath)}\`.`;
  return `Modul ${relPath}.`;
}

function refineBlock(block, nextLine, relPath) {
  const params = parseParams(block);
  let name = parseFunctionName(block);
  if (!name) name = inferNameFromNextLine(nextLine);

  const newBlock = [];
  newBlock.push('/**');
  // module header detection
  if (block[0] && /Modul:/.test(block[0])) {
    newBlock.push(` * ${makeModuleDescription(relPath)}`);
    newBlock.push(' *');
    newBlock.push(' * Detaillierte Beschreibung und Hinweise zur Verwendung dieses Moduls.');
    newBlock.push(' */');
    return newBlock;
  }

  // function description
  const desc = makeGermanDescriptionForFunction(name, params);
  newBlock.push(` * ${desc}`);
  newBlock.push(' *');
  if (params.length) {
    for (const p of params) {
      newBlock.push(` * @param {*} ${p} - Beschreibung von ${p}`);
    }
  } else {
    // attempt to infer params from nextLine
    const m = nextLine.match(/\(([^)]*)\)\s*=>|function[^(]*\(([^)]*)\)/);
    const plist = m ? (m[1] || m[2] || '').split(',').map(s => s.trim()).filter(Boolean) : [];
    if (plist.length) for (const p of plist) newBlock.push(` * @param {*} ${p} - Beschreibung von ${p}`);
  }
  newBlock.push(' * @returns {*} Beschreibung des Rückgabewerts');
  if (name) newBlock.push(` * @function ${name}`);
  newBlock.push(' */');
  return newBlock;
}

function processFile(file) {
  if (!file.endsWith('.js')) return;
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  if (rel.startsWith('node_modules') || rel.startsWith('dokumentation') || rel.startsWith('tools')) return;

  const src = fs.readFileSync(file, 'utf8');
  const lines = src.split(/\r?\n/);
  let changed = false;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith('/**')) {
      let j = i;
      while (j < lines.length && !lines[j].trim().endsWith('*/')) j++;
      if (j >= lines.length) break;
      const block = lines.slice(i, j + 1);
      if (isPlaceholderBlock(block)) {
        const nextLine = (lines[j + 1] || '').trim();
        const refined = refineBlock(block, nextLine, rel);
        lines.splice(i, block.length, ...refined);
        i += refined.length - 1;
        changed = true;
      }
    }
  }

  if (changed) {
    fs.writeFileSync(file, lines.join('\n'), 'utf8');
    console.log('Filled placeholders in:', rel);
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
