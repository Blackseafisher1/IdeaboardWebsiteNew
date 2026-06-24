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
  const start = Math.max(0, idx - 400);
  const snippet = content.slice(start, idx);
  const lastClose = snippet.lastIndexOf('*/');
  const lastOpen = snippet.lastIndexOf('/**');
  if (lastOpen !== -1 && lastOpen > lastClose) return true;
  return false;
}

function processFile(file) {
  let content = fs.readFileSync(file, 'utf8');
  let modified = false;

  // matches router.get('/...', ...), router.post etc.
  // Group 2 is indent, Group 3 is the full router line for matching but we care about inserting BEFORE it
  const regex = /(^|\n)([ \t]*)(router\.(?:get|post|put|delete|patch|all)\(['"`]([^'"`]+)['"`])/g;
  let out = '';
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(content)) !== null) {
    const matchIdx = match.index + match[1].length;
    if (hasJSDocBefore(content, matchIdx)) continue;

    const indent = match[2] || '';
    const method = match[3].split('.')[1].split('(')[0].toUpperCase();
    const routePath = match[4];
    
    const jsdoc = `${indent}/**\n${indent} * ${method} ${routePath}\n${indent} * Beschreibung: Endpunkt für ${routePath}.\n${indent} * @name ${method} ${routePath}\n${indent} * @function\n${indent} * @inner\n${indent} */\n`;

    out += content.slice(lastIndex, matchIdx) + jsdoc;
    lastIndex = matchIdx;
    modified = true;
  }

  if (!modified) return { file, modified: false };
  out += content.slice(lastIndex);

  // backup
  const bak = file + '.bak_routes';
  if (!fs.existsSync(bak)) fs.writeFileSync(bak, content, 'utf8');

  fs.writeFileSync(file, out, 'utf8');
  return { file, modified: true };
}

function main() {
  const dir = path.join(__dirname, '..', 'routes');
  const files = walk(dir);
  const results = [];
  files.forEach(f => {
    try {
      results.push(processFile(f));
    } catch (e) {
      results.push({ file: f, error: String(e) });
    }
  });
  console.log('Processed', results.length, 'route files');
  results.forEach(r => console.log(r.file, r.modified ? 'JSDoc added' : 'no change', r.error ? r.error : ''));
}

main();
