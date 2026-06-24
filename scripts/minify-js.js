#!/usr/bin/env node
const path = require('path');
const fs = require('fs').promises;
const esbuild = require('esbuild');

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'dist') continue;
      files.push(...await walk(fullPath));
      continue;
    }

    if (!entry.isFile()) continue;
    if (!entry.name.endsWith('.js')) continue;
    if (entry.name.endsWith('.min.js')) continue;
    files.push(fullPath);
  }

  return files;
}

async function main() {
  const sourceDir = path.join(__dirname, '..', 'public', 'js');
  const distDir = path.join(sourceDir, 'dist');
  let files;
  try {
    files = await walk(sourceDir);
    await fs.mkdir(distDir, { recursive: true });
  } catch (err) {
    console.error('Failed to prepare JS minification', sourceDir, err);
    process.exit(1);
  }

  for (const inPath of files) {
    const relPath = path.relative(sourceDir, inPath);
    const outPath = path.join(distDir, relPath.replace(/\.js$/, '.min.js'));

    try {
      await fs.mkdir(path.dirname(outPath), { recursive: true });
      await esbuild.build({
        entryPoints: [inPath],
        outfile: outPath,
        bundle: false,
        minify: true,
        sourcemap: false,
        target: ['es2017'],
        platform: 'browser'
      });
      console.log('minified', relPath, '→', path.relative(sourceDir, outPath));
    } catch (err) {
      console.error('esbuild failed for', relPath, err);
    }
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
