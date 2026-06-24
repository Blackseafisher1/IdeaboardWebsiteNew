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
  // check up to 5 lines above for closing */
  for (let i = idx - 1; i >= Math.max(0, idx - 8); i--) {
    const t = lines[i].trim();
    if (t === '') continue;
    if (t.endsWith('*/')) return true;
    if (!t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/')) return false;
  }
  return false;
}

function paramListFrom(paramsStr) {
  const s = paramsStr.trim();
  if (!s) return [];
  let inner = s;
  if (inner.startsWith('(') && inner.endsWith(')')) inner = inner.slice(1, -1);
  // split by comma not inside braces
  const parts = inner.split(',').map(p => p.trim()).filter(Boolean);
  return parts.map(p => {
    // remove default values and destructuring braces
    let name = p.replace(/=.*$/, '').trim();
    name = name.replace(/[{}\[\]]/g, '').trim();
    return name || 'param';
  });
}

function processFile(file) {
  if (!file.endsWith('.js')) return;
  const rel = path.relative(ROOT, file);
  // skip some folders
  if (rel.startsWith('node_modules') || rel.startsWith('dokumentation') || rel.startsWith('tools')) return;

  let src = fs.readFileSync(file, 'utf8');
  const lines = src.split(/\r?\n/);
  let changed = false;

  // regex for const/let/var name = async? (params) => or name = async? param =>
  const arrowAssignRegex = /^(\s*)(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(async\s*)?(\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/;
  // regex for inline arrow callbacks (e.g., addEventListener(() => {}), forEach(x => {}))
  const arrowInlineRegex = /^(\s*).*(=>).*/;

  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(arrowAssignRegex);
    if (m) {
      if (hasJsDocAbove(lines, i)) continue;
      const indent = m[1] || '';
      const name = m[2];
      const paramsStr = m[4];
      const params = paramListFrom(paramsStr);
      const jsdoc = [];
      jsdoc.push(indent + '/**');
      jsdoc.push(indent + ' * TODO: Dokumentation für ' + name + '.');
      jsdoc.push(indent + ' *');
      for (const p of params) {
        jsdoc.push(indent + ` * @param {*} ${p} - Beschreibung`);
      }
      jsdoc.push(indent + ' * @returns {*} Beschreibung des Rückgabewerts');
      jsdoc.push(indent + ` * @function ${name}`);
      jsdoc.push(indent + ' */');

      lines.splice(i, 0, ...jsdoc);
      i += jsdoc.length; // skip inserted
      changed = true;
      continue;
    }

    // handle inline anonymous arrow callbacks (event listeners, forEach, map, etc.)
    const mi = lines[i].match(arrowInlineRegex);
    if (mi) {
      if (hasJsDocAbove(lines, i)) continue;
      const indent = mi[1] || '';
      const anonName = 'anonymousArrowLine' + (i + 1);
      const jsdoc = [];
      jsdoc.push(indent + '/**');
      jsdoc.push(indent + ' * TODO: Dokumentation für anonyme Arrow-Funktion.');
      jsdoc.push(indent + ' *');
      jsdoc.push(indent + ' * @param {*} [args] - Parameter (siehe Implementierung)');
      jsdoc.push(indent + ' * @returns {*} Beschreibung des Rückgabewerts');
      jsdoc.push(indent + ` * @function ${anonName}`);
      jsdoc.push(indent + ' */');

      lines.splice(i, 0, ...jsdoc);
      i += jsdoc.length; // skip inserted
      changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(file, lines.join('\n'), 'utf8');
    console.log('Updated:', rel);
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
