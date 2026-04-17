const { execSync } = require('node:child_process');
const { existsSync, mkdirSync, writeFileSync, rmSync, cpSync, readdirSync, statSync: statS } = require('node:fs');
const { join, resolve } = require('node:path');

const rootDir = resolve(__dirname, '..');
const stagingDir = join(rootDir, 'dist-source');
const outputFile = join(rootDir, 'loggy-source.zip');

// Individual files to include
const files = [
  'package.json',
  'package-lock.json',
  'manifest.json',
  'manifest-chrome.json',
  'manifest-firefox.json',
  'vite.config.ts',
  'tsconfig.json',
  'tsconfig.app.json',
  'biome.json',
  'vitest.config.ts',
  'vitest.setup.ts',
  'devtools.html',
  'devtools.mjs',
  'devtools.mjs.d.ts',
  'content-relay.ts',
];

// Directories to include (all contents recursively)
const dirs = [
  'background',
  'browser-apis',
  'capture',
  'icons',
  'panel',
  'popup',
  'scripts',
  'shared',
  'types',
  'utils',
];

// Exclude test files from source package (not needed for build)
const excludeExtensions = ['.test.', '.spec.'];

if (existsSync(stagingDir)) {
  rmSync(stagingDir, { recursive: true });
}
mkdirSync(stagingDir, { recursive: true });

// Copy individual files
for (const file of files) {
  const src = join(rootDir, file);
  if (existsSync(src)) {
    cpSync(src, join(stagingDir, file));
  }
}

// Copy directories (excluding test files)
function copyDirRecursive(src, dest) {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    // Skip excluded patterns
    if (excludeExtensions.some((ext) => entry.name.includes(ext))) continue;

    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      cpSync(srcPath, destPath);
    }
  }
}

for (const dir of dirs) {
  const src = join(rootDir, dir);
  if (existsSync(src)) {
    copyDirRecursive(src, join(stagingDir, dir));
  }
}

// Write AMO build instructions
writeFileSync(
  join(stagingDir, 'BUILD_INSTRUCTIONS.md'),
  `# Loggy — Source Code Build Instructions

## Prerequisites

- **Node.js** 24 or later
- **npm** (included with Node.js)
- **zip** (standard on Linux/macOS)

## Build Steps

\`\`\`bash
npm install
npm run build:firefox
\`\`\`

The built extension will be in \`dist-firefox/\`.

## Verify

\`\`\`bash
ls dist-firefox/manifest.json
\`\`\`

## Package for Submission

\`\`\`bash
npm run package:firefox
\`\`\`

This produces \`loggy-firefox.xpi\` (a ZIP file with the built extension).

## Notes

- This extension is a DevTools panel built with TypeScript + React + Vite.
- All processing happens client-side. No external servers or analytics.
- The \`browser-apis/\` directory provides cross-browser API abstractions.
- Build-time browser selection via Vite's \`define\` (\`__BROWSER__\`).
`,
);

// Create the ZIP
if (existsSync(outputFile)) {
  rmSync(outputFile);
}

execSync(`cd ${stagingDir} && zip -r ${outputFile} .`, { stdio: 'inherit' });

// Cleanup staging
rmSync(stagingDir, { recursive: true });

// Report
const sizeKB = Math.round(statS(outputFile).size / 1024);
console.log(`\nCreated ${outputFile} (${sizeKB} KB)`);
