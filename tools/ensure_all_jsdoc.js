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

function hasJsDocAbove(lines, idx) {
  for (let i = idx - 1; i >= Math.max(0, idx - 8); i--) {
    const t = lines[i].trim();
    if (t === '') continue;
    if (t.endsWith('*/')) return true;
    if (!t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/')) return false;
  }
  return false;
}

function paramListFrom(paramsStr) {
  const s = (paramsStr || '').trim();
  if (!s) return [];
  let inner = s;
  if (inner.startsWith('(') && inner.endsWith(')')) inner = inner.slice(1, -1);
  const parts = inner.split(',').map(p => p.trim()).filter(Boolean);
  return parts.map(p => {
    let name = p.replace(/=.*$/, '').trim();
    name = name.replace(/[{}\[\]]/g, '').trim();
    return name || 'param';
  });
}

function makeJsDocFor(name, params, indent, isAnon) {
  const jsdoc = [];
  jsdoc.push(indent + '/**');
  if (isAnon) jsdoc.push(indent + ' * Anonyme Arrow-Funktion — Beschreibung auf Deutsch.');
  else jsdoc.push(indent + ` * ${name} — Beschreibung auf Deutsch.`);
  jsdoc.push(indent + ' *');
  if (params && params.length) {
    for (const p of params) {
      jsdoc.push(indent + ` * @param {*} ${p} - Beschreibung von ${p}`);
    }
  } else {
    jsdoc.push(indent + ' * @param {*} [args] - Parameter (siehe Implementierung)');
  }
  jsdoc.push(indent + ' * @returns {*} Beschreibung des Rückgabewerts');
  if (!isAnon && name) jsdoc.push(indent + ` * @function ${name}`);
  jsdoc.push(indent + ' */');
  return jsdoc;
}

function processFile(file) {
  if (!file.endsWith('.js')) return;
  const rel = path.relative(ROOT, file);
  if (rel.startsWith('node_modules') || rel.startsWith('dokumentation') || rel.startsWith('tools')) return;

  let src = fs.readFileSync(file, 'utf8');
  const lines = src.split(/\r?\n/);
  let changed = false;

  // If file has no JSDoc at all, prepend a module header
  const hasAnyJsDoc = src.includes('/**');
  if (!hasAnyJsDoc) {
    const relPath = rel.replace(/\\/g, '/');
    const header = [
      '/**',
      ` * Modul: ${relPath} — Beschreibung auf Deutsch.`,
      ' *',
      ' * Allgemeine Hinweise zum Modul.',
      ' */',
      ''
    ];
    lines.unshift(...header);
    changed = true;
  }

  // patterns
  const funcDeclRegex = /^(\s*)function\s+([A-Za-z_$][\w$]*)\s*\(/;
  const arrowAssignRegex = /^(\s*)(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/;
  const arrowInlineRegex = /^(\s*).*=>.*(\{|\))/; // line containing =>

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let m = line.match(funcDeclRegex);
    if (m) {
      if (hasJsDocAbove(lines, i)) continue;
      const indent = m[1] || '';
      const name = m[2];
      // try to get params
      const pm = line.match(/\(([^)]*)\)/);
      const params = pm ? paramListFrom(pm[0]) : [];
      const jsdoc = makeJsDocFor(name, params, indent, false);
      lines.splice(i, 0, ...jsdoc);
      i += jsdoc.length;
      changed = true;
      continue;
    }

    m = line.match(arrowAssignRegex);
    if (m) {
      if (hasJsDocAbove(lines, i)) continue;
      const indent = m[1] || '';
      const name = m[2];
      const paramsStr = m[3];
      const params = paramListFrom(paramsStr);
      const jsdoc = makeJsDocFor(name, params, indent, false);
      lines.splice(i, 0, ...jsdoc);
      i += jsdoc.length;
      changed = true;
      continue;
    }

    m = line.match(arrowInlineRegex);
    if (m) {
      if (hasJsDocAbove(lines, i)) continue;
      const indent = m[1] || '';
      // try to extract params from nearby chars
      const pm = line.match(/\(([^)]*)\)\s*=>/);
      const params = pm ? paramListFrom(`(${pm[1]})`) : [];
      const jsdoc = makeJsDocFor(null, params, indent, true);
      lines.splice(i, 0, ...jsdoc);
      i += jsdoc.length;
      changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(file, lines.join('\n'), 'utf8');
    console.log('Ensured JSDoc:', rel);
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
