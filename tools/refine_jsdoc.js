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

function refineBlock(blockLines, nextLine) {
  // blockLines includes /** .. */
  // try to find @function tag
  let fnName = null;
  const params = [];
  for (const l of blockLines) {
    const m = l.match(/@function\s+([\w$]+)/);
    if (m) fnName = m[1];
    const p = l.match(/@param\s+\{[^}]+\}\s+\[?([\w$]+)\]?\s*-?\s*(.*)/);
    if (p) params.push(p[1]);
  }

  // Try to infer name from nextLine if none
  if (!fnName) {
    const m = nextLine.match(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/);
    if (m) fnName = m[1];
  }

  const refined = [];
  refined.push('/**');
  if (fnName) {
    refined.push(` * ${fnName} — Beschreibung auf Deutsch.`);
  } else {
    refined.push(' * Anonyme Arrow-Funktion — Beschreibung auf Deutsch.');
  }
  refined.push(' *');
  if (params.length) {
    for (const p of params) {
      refined.push(` * @param {*} ${p} - Beschreibung von ${p}`);
    }
  } else {
    // try to extract params from nextLine
    const pm = nextLine.match(/\(([^)]*)\)/);
    if (pm) {
      const parts = pm[1].split(',').map(s => s.trim()).filter(Boolean);
      for (let p of parts) {
        p = p.replace(/=.*$/, '').replace(/[{}\[\]]/g, '').trim();
        if (!p) p = 'param';
        refined.push(` * @param {*} ${p} - Beschreibung von ${p}`);
      }
    }
  }
  refined.push(' * @returns {*} Beschreibung des Rückgabewerts');
  if (fnName) refined.push(` * @function ${fnName}`);
  refined.push(' */');
  return refined;
}

function processFile(file) {
  if (!file.endsWith('.js')) return;
  const rel = path.relative(ROOT, file);
  if (rel.startsWith('node_modules') || rel.startsWith('dokumentation') || rel.startsWith('tools')) return;

  let src = fs.readFileSync(file, 'utf8');
  const lines = src.split(/\r?\n/);
  let changed = false;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith('/**')) {
      // find end
      let j = i;
      while (j < lines.length && !lines[j].trim().endsWith('*/')) j++;
      if (j >= lines.length) break;
      const block = lines.slice(i, j + 1);
      const joined = block.join('\n');
      if (/TODO: Dokumentation|anonyme Arrow-Funktion|Anonyme Arrow-Funktion/.test(joined)) {
        const nextLine = (lines[j + 1] || '').trim();
        const refined = refineBlock(block, nextLine);
        lines.splice(i, block.length, ...refined);
        i += refined.length - 1;
        changed = true;
      }
    }
  }

  if (changed) {
    fs.writeFileSync(file, lines.join('\n'), 'utf8');
    console.log('Refined:', rel);
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
