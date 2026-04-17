const { readdirSync, readFileSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');

const distDir = join(__dirname, '..', 'dist-firefox');
const manifestPath = join(distDir, 'manifest.json');

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

// Find the hashed console-bootstrap chunk produced by Vite
const chunksDir = join(distDir, 'chunks');
const chunkFiles = readdirSync(chunksDir);
const bootstrapChunk = chunkFiles.find((f) => f.startsWith('console-bootstrap-') && f.endsWith('.js'));

if (!bootstrapChunk) {
  console.error('ERROR: Could not find console-bootstrap chunk in dist-firefox/chunks/');
  process.exit(1);
}

// Rewrite the content_scripts placeholder to the actual hashed path
for (const script of manifest.content_scripts) {
  script.js = script.js.map((entry) => {
    if (entry === 'chunks/console-bootstrap.mjs') {
      return `chunks/${bootstrapChunk}`;
    }
    return entry;
  });
}

writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
console.log(`Rewrote manifest: console-bootstrap → chunks/${bootstrapChunk}`);
