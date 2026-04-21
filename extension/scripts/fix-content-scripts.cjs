/**
 * Post-build script that fixes content scripts for Firefox compatibility.
 *
 * Firefox loads content_scripts as classic (non-module) scripts, but Vite
 * produces ES module output with import/export statements. This script:
 *
 * 1. Strips `export{...}` from the console-bootstrap content script chunk
 * 2. Strips any remaining `import`/`export` from content-relay.js
 * 3. Removes `crossorigin` attributes from HTML files (can cause module
 *    loading failures in Firefox extension context)
 */

const { readdirSync, readFileSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');

const distDir = join(__dirname, '..', 'dist-firefox');

// --- Step 1: Fix console-bootstrap content script chunk ---

const chunksDir = join(distDir, 'chunks');
const chunkFiles = readdirSync(chunksDir);
const bootstrapChunk = chunkFiles.find(
  (f) => f.startsWith('console-bootstrap-') && f.endsWith('.js'),
);

if (!bootstrapChunk) {
  console.error('ERROR: Could not find console-bootstrap chunk');
  process.exit(1);
}

const bootstrapPath = join(chunksDir, bootstrapChunk);
let bootstrapSource = readFileSync(bootstrapPath, 'utf8');

// Strip export statements (e.g., export{$ as C};)
const strippedBootstrap = bootstrapSource.replace(/export\{[^}]*\};?/g, '');

if (strippedBootstrap !== bootstrapSource) {
  writeFileSync(bootstrapPath, strippedBootstrap);
  console.log(`Stripped export from chunks/${bootstrapChunk}`);
} else {
  console.log(`No export found in chunks/${bootstrapChunk} (already clean)`);
}

// --- Step 2: Fix content-relay.js ---

const relayPath = join(distDir, 'content-relay.js');
let relaySource = readFileSync(relayPath, 'utf8');

// Strip import statements (e.g., import{L as a}from"./chunks/messages-XXX.js";)
let fixedRelay = relaySource.replace(/import\{[^}]*\}from"[^"]*";?/g, '');

// Strip any remaining export statements
fixedRelay = fixedRelay.replace(/export\{[^}]*\};?/g, '');

if (fixedRelay !== relaySource) {
  writeFileSync(relayPath, fixedRelay);
  console.log('Stripped import/export from content-relay.js');
} else {
  console.log('content-relay.js already clean');
}

// --- Step 3: Remove crossorigin from HTML files ---

const htmlFiles = ['devtools.html', join('panel', 'index.html'), join('popup', 'popup.html')];

for (const htmlFile of htmlFiles) {
  const htmlPath = join(distDir, htmlFile);

  let htmlSource;
  try {
    htmlSource = readFileSync(htmlPath, 'utf8');
  } catch {
    continue;
  }

  const fixedHtml = htmlSource.replace(/\s*crossorigin/g, '');

  if (fixedHtml !== htmlSource) {
    writeFileSync(htmlPath, fixedHtml);
    console.log(`Removed crossorigin from ${htmlFile}`);
  }
}

console.log('Content script fixes applied');
