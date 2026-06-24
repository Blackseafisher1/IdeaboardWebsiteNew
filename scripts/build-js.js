// scripts/build-js.js
// Bundles and minifies client JS files from public/js into public/dist using esbuild

const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const SRC_DIR = path.join(__dirname, '..', 'public', 'js');
const OUT_DIR = path.join(__dirname, '..', 'public', 'dist');

function collectEntryFiles(dir) {
  const entries = [];
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const it of items) {
    const full = path.join(dir, it.name);
    if (it.isDirectory()) {
      entries.push(...collectEntryFiles(full));
    } else if (it.isFile() && it.name.endsWith('.js')) {
      // exclude already-built bundles
      if (full.includes(path.sep + 'dist' + path.sep)) continue;
      entries.push(full);
    }
  }
  return entries;
}

(async () => {
  try {
    if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

    const entries = collectEntryFiles(SRC_DIR);
    // Only build top-level files to limit duplicate bundles
    const toBuild = entries.filter(p => {
      const rel = path.relative(SRC_DIR, p);
      // keep only files at root of public/js
      return !rel.includes(path.sep);
    });

    for (const entry of toBuild) {
      const rel = path.relative(SRC_DIR, entry);
      const outFile = path.join(OUT_DIR, rel);
      const outDir = path.dirname(outFile);
      if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

      console.log('Building', rel, '→', path.relative(process.cwd(), outFile));
      await esbuild.build({
        entryPoints: [entry],
        bundle: true,
        minify: true,
        sourcemap: false,
        target: ['es2019'],
        format: 'iife',
        platform: 'browser',
        outfile: outFile,
        define: { 'process.env.NODE_ENV': '"production"' }
      });
    }

    console.log('Build complete.');
  } catch (e) {
    console.error('Build failed:', e);
    process.exit(1);
  }
})();
