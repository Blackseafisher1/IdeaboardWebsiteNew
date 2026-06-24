const fs = require('fs');
const path = require('path');

function walk(dir) {
  const res = [];
  const list = fs.readdirSync(dir, { withFileTypes: true });
  list.forEach(item => {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) res.push(...walk(full));
    else if (item.isFile() && full.endsWith('.js')) res.push(full);
  });
  return res;
}

function hasJSDocBefore(content, idx) {
  // look back up to 300 chars and see if a /** exists after last \n\n
  const start = Math.max(0, idx - 300);
  const snippet = content.slice(start, idx);
  const lastClose = snippet.lastIndexOf('*/');
  const lastOpen = snippet.lastIndexOf('/**');
  if (lastOpen !== -1 && lastOpen > lastClose) return true;
  return false;
}

function insertJSDocForFile(file) {
  let content = fs.readFileSync(file, 'utf8');
  let modified = false;

  // regex matches common function declarations and arrow functions assigned to const/let/var
  const regex = /(^|\n)([ \t]*)(function\s+([A-Za-z0-9_$]+)\s*\(|(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=\s*(?:function\s*\(|\(?[^=>]*\)?\s*=>))/g;
  let out = '';
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const matchIdx = match.index + match[1].length;
    if (hasJSDocBefore(content, matchIdx)) continue;

    const indent = match[2] || '';
    const name = match[4] || match[5] || 'funktion';
    const jsdoc = `${indent}/**\n${indent} * Beschreibung: ${name}.\n${indent} * @returns {void}\n${indent} */\n`;

    out += content.slice(lastIndex, matchIdx) + jsdoc;
    lastIndex = matchIdx;
    modified = true;
  }
  if (!modified) return { file, modified: false };
  out += content.slice(lastIndex);

  // backup if not exists
  const bak = file + '.bak';
  try {
    if (!fs.existsSync(bak)) fs.writeFileSync(bak, content, 'utf8');
  } catch (e) {}

  fs.writeFileSync(file, out, 'utf8');
  return { file, modified: true };
}

function main() {
  const dir = path.join(__dirname, '..', 'public', 'js');
  const files = walk(dir);
  const results = [];
  files.forEach(f => {
    try {
      results.push(insertJSDocForFile(f));
    } catch (e) {
      results.push({ file: f, error: String(e) });
    }
  });
  console.log('Processed', results.length, 'files');
  results.forEach(r => console.log(r.file, r.modified ? 'JSDoc added' : 'no change', r.error ? r.error : ''));
}

main();
