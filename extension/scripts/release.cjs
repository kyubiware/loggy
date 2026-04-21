#!/usr/bin/env node

const { execSync } = require('node:child_process');
const { readFileSync, writeFileSync } = require('node:fs');
const { resolve } = require('node:path');
const readline = require('node:readline');

const rootDir = resolve(__dirname, '..');

// --- Helpers ---

function run(cmd, opts = {}) {
  console.log(`\n  > ${cmd}\n`);
  try {
    execSync(cmd, { stdio: 'inherit', cwd: rootDir, ...opts });
  } catch {
    fail(`Command failed: ${cmd}`);
  }
}

function runQuiet(cmd, opts = {}) {
  return execSync(cmd, { encoding: 'utf8', cwd: rootDir, ...opts }).trim();
}

function fail(msg) {
  console.error(`\n❌ ${msg}`);
  process.exit(1);
}

function logStep(step, msg) {
  console.log(`\n${step}  ${msg}`);
  console.log('─'.repeat(50));
}

async function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

// --- Version bump logic (inlined to avoid separate script dependency) ---

const VERSION_FILES = [
  'manifest.json',
  'manifest-chrome.json',
  'manifest-firefox.json',
  'package.json',
];

function parseVersion(v) {
  const parts = v.split('.').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) {
    throw new Error(`Invalid semver: "${v}"`);
  }
  return parts;
}

function serializeVersion([major, minor, patch]) {
  return `${major}.${minor}.${patch}`;
}

function computeBump(version, type) {
  const parts = parseVersion(version);
  switch (type) {
    case 'major':
      return serializeVersion([parts[0] + 1, 0, 0]);
    case 'minor':
      return serializeVersion([parts[0], parts[1] + 1, 0]);
    case 'patch':
      return serializeVersion([parts[0], parts[1], parts[2] + 1]);
    default:
      throw new Error(`Unknown bump type: "${type}"`);
  }
}

function bumpVersions(oldVersion, newVersion) {
  for (const file of VERSION_FILES) {
    const filePath = resolve(rootDir, file);
    const json = JSON.parse(readFileSync(filePath, 'utf8'));
    if (json.version !== oldVersion) {
      fail(`${file} has version "${json.version}", expected "${oldVersion}". Fix manually.`);
    }
    json.version = newVersion;
    writeFileSync(filePath, `${JSON.stringify(json, null, 2)}\n`);
    console.log(`  ${file}: ${oldVersion} → ${newVersion}`);
  }
}

// --- Main release flow ---

async function main() {
  // Read current version
  const manifest = JSON.parse(readFileSync(resolve(rootDir, 'manifest.json'), 'utf8'));
  const currentVersion = manifest.version;

  console.log(`\n🚀  Loggy Release\n`);
  console.log(`  Current version: ${currentVersion}\n`);

  // Step 0: Check for uncommitted changes
  const status = runQuiet('git status --porcelain');
  if (status) {
    fail('Working tree has uncommitted changes. Commit or stash first.');
  }

  // Step 1: Prompt for bump type
  const answer = await prompt('  Bump type? (patch / minor / major) [patch]: ');
  const bumpType = answer || 'patch';

  if (!['patch', 'minor', 'major'].includes(bumpType)) {
    fail(`Invalid bump type: "${bumpType}". Use patch, minor, or major.`);
  }

  const newVersion = computeBump(currentVersion, bumpType);

  const confirmed = await prompt(`  Release ${currentVersion} → ${newVersion}? (y/N) `);
  if (confirmed !== 'y' && confirmed !== 'yes') {
    console.log('\n  Cancelled.');
    process.exit(0);
  }

  // Step 2: Lint
  logStep('①', 'Linting');
  run('biome check .');

  // Step 3: Type check
  logStep('②', 'Type checking');
  run('npx tsc --noEmit');

  // Step 4: Tests
  logStep('③', 'Running tests');
  run('npx vitest run');

  // Step 5: Bump version
  logStep('④', `Bumping version: ${currentVersion} → ${newVersion}`);
  bumpVersions(currentVersion, newVersion);

  // Step 6: Build Firefox
  logStep('⑤', 'Building Firefox extension');
  run('npm run build:firefox');

  // Step 7: Lint with web-ext
  logStep('⑥', 'Validating with web-ext lint');
  run('npx web-ext lint --source-dir dist-firefox');

  // Step 8: Package XPI
  logStep('⑦', 'Packaging XPI');
  run('rm -f loggy-firefox.xpi && (cd dist-firefox && zip -r ../loggy-firefox.xpi .)');

  // Step 9: Sign / Publish
  logStep('⑧', 'Signing and publishing to AMO');
  run('dotenv -- web-ext sign --source-dir dist-firefox --channel unlisted');

  // Done
  console.log('\n' + '═'.repeat(50));
  console.log(`\n  ✅  Released v${newVersion}\n`);
  console.log(`  XPI: extension/loggy-firefox.xpi`);
  console.log(`  Next: git add . && git commit -m "release: v${newVersion}"\n`);
}

main().catch((err) => {
  fail(err.message);
});
