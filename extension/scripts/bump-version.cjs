const { readFileSync, writeFileSync } = require('node:fs');
const { resolve } = require('node:path');

const rootDir = resolve(__dirname, '..');

const FILES = [
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

function bump(version, type) {
  const parts = parseVersion(version);
  switch (type) {
    case 'major':
      return serializeVersion([parts[0] + 1, 0, 0]);
    case 'minor':
      return serializeVersion([parts[0], parts[1] + 1, 0]);
    case 'patch':
      return serializeVersion([parts[0], parts[1], parts[2] + 1]);
    default:
      throw new Error(`Unknown bump type: "${type}". Use major, minor, or patch.`);
  }
}

const type = process.argv[2];
if (!type) {
  console.error('Usage: node scripts/bump-version.cjs <major|minor|patch>');
  process.exit(1);
}

// Read current version from manifest.json
const manifestPath = resolve(rootDir, 'manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const oldVersion = manifest.version;
const newVersion = bump(oldVersion, type);

// Update all files
for (const file of FILES) {
  const filePath = resolve(rootDir, file);
  const content = readFileSync(filePath, 'utf8');
  const json = JSON.parse(content);

  if (json.version !== oldVersion) {
    throw new Error(`${file} has version "${json.version}", expected "${oldVersion}". Fix manually.`);
  }

  json.version = newVersion;
  writeFileSync(filePath, `${JSON.stringify(json, null, 2)}\n`);
  console.log(`  ${file}: ${oldVersion} → ${newVersion}`);
}

console.log(`\nBumped to ${newVersion}`);
