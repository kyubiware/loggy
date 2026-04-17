const { execSync } = require('node:child_process');
const { existsSync, mkdirSync, writeFileSync, rmSync, cpSync, statSync, readdirSync } = require('node:fs');
const { join, resolve, basename } = require('node:path');

const rootDir = resolve(__dirname, '..');
const stagingDir = join(rootDir, 'dist-source');
const outputFile = join(rootDir, 'loggy-source.zip');

// Directories and files to exclude from the source zip
const EXCLUDE = new Set([
  'node_modules',
  'dist-chrome',
  'dist-firefox',
  'dist-source',
  '.git',
  '.opencode',
  '.playwright-cli',
  '.playwright-cli-output',
  '.sisyphus',
  'loggy-source.zip',
  'loggy-firefox.xpi',
  'AGENTS.md',
]);

try {
  // 1. Prepare clean staging directory
  if (existsSync(stagingDir)) {
    rmSync(stagingDir, { recursive: true, force: true });
  }
  mkdirSync(stagingDir, { recursive: true });

  // 2. Copy everything except excluded paths (no manual file lists)
  // Iterate entries individually to avoid cpSync parent-into-child error
  const entries = readdirSync(rootDir, { withFileTypes: true });
  for (const entry of entries) {
    if (EXCLUDE.has(entry.name)) continue;
    const src = join(rootDir, entry.name);
    const dest = join(stagingDir, entry.name);
    if (entry.isDirectory()) {
      cpSync(src, dest, { recursive: true });
    } else {
      cpSync(src, dest);
    }
  }

  // 3. Regenerate lockfile for standalone install (workspace lockfile is not standalone)
  const lockfile = join(stagingDir, 'package-lock.json');
  if (existsSync(lockfile)) {
    rmSync(lockfile, { force: true });
  }
  execSync('npm install --ignore-scripts --package-lock-only', {
    cwd: stagingDir,
    stdio: 'pipe',
  });
  console.log('Regenerated standalone package-lock.json');

  // 4. Write AMO build instructions
    writeFileSync(
    join(stagingDir, 'BUILD_INSTRUCTIONS.md'),
    `# Loggy — Source Code Build Instructions

## Prerequisites

| Program | Version | How to Install |
|---------|---------|----------------|
| **Node.js** | 24 or later | Download from [nodejs.org](https://nodejs.org) or use [nvm](https://github.com/nvm-sh/nvm) |
| **npm** | Included with Node.js | Installed automatically with Node.js |
| **zip** | Any recent version | Linux: \`sudo apt install zip\` · macOS: pre-installed · Windows: [7-Zip](https://7-zip.org) or WSL |

All other build dependencies (Vite, TypeScript, React, Tailwind CSS, Biome, etc.) are installed automatically via \`npm ci\` below — no separate installation needed.

**Supported operating systems:** Linux, macOS, Windows (WSL recommended for the packaging step).

## Build Steps

\`\`\`bash
npm ci --ignore-scripts
npm run build:firefox
\`\`\`

> **Note:** \`--ignore-scripts\` skips Husky git hooks which require a git repository.

The build script (\`npm run build:firefox\`) performs these steps automatically:
1. Runs \`vite build --mode firefox\` to compile TypeScript, bundle React/JSX, and process Tailwind CSS
2. Copies \`manifest-firefox.json\` → \`dist-firefox/manifest.json\`
3. Copies extension icons to \`dist-firefox/icons/\`
4. Rewrites content script paths in the manifest to match Vite's hashed chunk filenames
5. Sanitizes the bundle (replaces \`innerHTML\` assignments with \`textContent\` for Firefox compliance)

The built extension will be in \`dist-firefox/\`.

## Verify

\`\`\`bash
ls dist-firefox/manifest.json
\`\`\`

## Package for Submission

\`\`\`bash
npm run package:firefox
\`\`\`

This rebuilds Firefox, then creates \`loggy-firefox.xpi\` (a ZIP file containing the built extension).

## Notes

- This extension is a DevTools panel built with TypeScript + React + Vite.
- All processing happens client-side. No external servers or analytics.
- The \`browser-apis/\` directory provides cross-browser API abstractions.
- Build-time browser selection via Vite's \`define\` (\`__BROWSER__\`).
`,
  );

  // 5. Create the ZIP (use cwd option to avoid shell injection)
  if (existsSync(outputFile)) {
    rmSync(outputFile, { force: true });
  }

  execSync('zip -r "${OUTPUT_FILE}" .', {
    cwd: stagingDir,
    stdio: 'inherit',
    env: { ...process.env, OUTPUT_FILE: outputFile },
  });

  // 6. Report success
  const sizeKB = Math.round(statSync(outputFile).size / 1024);
  console.log(`\nCreated ${outputFile} (${sizeKB} KB)`);
} finally {
  // 7. Guaranteed cleanup even if script fails
  if (existsSync(stagingDir)) {
    rmSync(stagingDir, { recursive: true, force: true });
  }
}
