#!/usr/bin/env node

const { execSync } = require('node:child_process');
const { existsSync } = require('node:fs');
const { resolve, join } = require('node:path');

const rootDir = resolve(__dirname, '..');
const distDir = join(rootDir, 'dist-chrome');

function fail(msg) {
  console.error(`\n❌ ${msg}`);
  process.exit(1);
}

function logStep(step, msg) {
  console.log(`\n${step}  ${msg}`);
  console.log('─'.repeat(50));
}

// Find the Chrome/Chromium binary
function findChrome() {
  const candidates = [
    // Linux
    'google-chrome',
    'google-chrome-stable',
    'chromium-browser',
    'chromium',
    // macOS
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    // Windows (WSL)
    '/mnt/c/Program Files/Google/Chrome/Application/chrome.exe',
    '/mnt/c/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  ];

  for (const cmd of candidates) {
    try {
      execSync(`which "${cmd}" 2>/dev/null`, { encoding: 'utf8' });
      return cmd;
    } catch {}
    if (existsSync(cmd)) return cmd;
  }

  return null;
}

// --- Main ---

function main() {
  // Step 1: Build
  logStep('🔨', 'Building Chrome extension');
  try {
    execSync('npm run build:chrome', { stdio: 'inherit', cwd: rootDir });
  } catch {
    fail('Build failed');
  }

  if (!existsSync(join(distDir, 'manifest.json'))) {
    fail(`Build output not found: ${distDir}`);
  }

  // Step 2: Launch Chrome with the extension loaded
  const chrome = findChrome();
  if (!chrome) {
    console.log('\n  Chrome/Chromium not found on PATH.');
    console.log('  Open chrome://extensions, enable Developer mode, then:');
    console.log(`  Load unpacked → ${distDir}\n`);
    return;
  }

  logStep('🚀', 'Opening Chrome with extension loaded');
  const absDist = resolve(distDir);

  // Use a temp directory outside the extension to avoid polluting dist-chrome/
  const tmpDir = join(rootDir, '.tmp-chrome-profile');

  try {
    execSync(
      `"${chrome}" --load-extension="${absDist}" --user-data-dir="${tmpDir}"`,
      { stdio: 'ignore', detached: true },
    );
  } catch {
    // Chrome detaches immediately, so a non-zero exit is expected on some systems
  }

  console.log(`  Extension loaded from: ${absDist}`);
  console.log('  Go to chrome://extensions to manage and grant permissions.\n');
}

main();
