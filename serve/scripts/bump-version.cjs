const { readFileSync, writeFileSync } = require('node:fs');
const { resolve } = require('node:path');

const rootDir = resolve(__dirname, '..');

const FILE = 'package.json';

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

const filePath = resolve(rootDir, FILE);
const json = JSON.parse(readFileSync(filePath, 'utf8'));
const oldVersion = json.version;
const newVersion = bump(oldVersion, type);

json.version = newVersion;
writeFileSync(filePath, `${JSON.stringify(json, null, 2)}\n`);
console.log(`  ${FILE}: ${oldVersion} → ${newVersion}`);

console.log(`\nBumped to ${newVersion}`);
