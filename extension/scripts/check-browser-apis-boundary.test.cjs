/**
 * Tests for check-browser-apis-boundary.cjs
 *
 * Run with: node --test extension/scripts/check-browser-apis-boundary.test.cjs
 *
 * Covers the four QA scenarios from .omo/plans/cross-browser-isolation.md T1:
 *  - Happy: gate exits 0 on clean state, no stderr
 *  - Failure: gate exits 1 when a non-allowlisted file leaks
 *  - Shrink: --update decrements allowlist counts; never increments
 *  - String exclusion: chrome.* inside string literals / comments is not flagged
 */

const { describe, test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const SCRIPT = path.join(__dirname, 'check-browser-apis-boundary.cjs');
const SCRIPT_REL = 'scripts/check-browser-apis-boundary.cjs';
const ALLOWLIST_REL = 'scripts/browser-apis-allowlist.json';

const tempRoots = [];

function makeTree(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bapi-test-'));
  tempRoots.push(root);
  for (const [relPath, content] of Object.entries(files)) {
    const fullPath = path.join(root, relPath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content);
  }
  return root;
}

function writeFile(root, relPath, content) {
  const fullPath = path.join(root, relPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content);
}

function runCli(args, cwd) {
  return spawnSync('node', [SCRIPT, ...args], { cwd, encoding: 'utf8' });
}

after(() => {
  for (const r of tempRoots) {
    fs.rmSync(r, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Unit tests: countLeaks accuracy
// ---------------------------------------------------------------------------

describe('countLeaks: detection', () => {
  const { countLeaks } = require(SCRIPT);

  test('counts single chrome.surface member access', () => {
    const root = makeTree({ 'a.ts': 'const x = chrome.storage.local.get("k", () => {});\n' });
    assert.equal(countLeaks(path.join(root, 'a.ts')), 1);
  });

  test('counts outermost chain once for nested access', () => {
    const root = makeTree({ 'a.ts': 'const e = chrome.runtime.lastError;\n' });
    assert.equal(countLeaks(path.join(root, 'a.ts')), 1);
  });

  test('counts multiple independent chrome accesses', () => {
    const root = makeTree({
      'a.ts': [
        'const a = chrome.storage.local.get("k");',
        'const b = chrome.runtime.id;',
        'const c = chrome.tabs.query({});',
        '',
      ].join('\n'),
    });
    assert.equal(countLeaks(path.join(root, 'a.ts')), 3);
  });

  test('counts ImportDeclaration from "chrome"', () => {
    const root = makeTree({ 'a.ts': 'import type { Storage } from "chrome";\n' });
    assert.equal(countLeaks(path.join(root, 'a.ts')), 1);
  });

  test('counts ImportDeclaration with single quotes', () => {
    const root = makeTree({ 'a.ts': "import { Storage } from 'chrome';\n" });
    assert.equal(countLeaks(path.join(root, 'a.ts')), 1);
  });

  test('counts ElementAccessExpression like chrome["storage"]', () => {
    const root = makeTree({ 'a.ts': 'const x = chrome["storage"].local.get("k");\n' });
    assert.equal(countLeaks(path.join(root, 'a.ts')), 1);
  });

  test('counts type-side references like chrome.tabs.Tab (QualifiedName)', () => {
    const root = makeTree({
      'a.ts': [
        'function getActiveTab(): chrome.tabs.Tab {',
        '  return { id: 0 } as chrome.tabs.Tab;',
        '}',
        '',
      ].join('\n'),
    });
    // Two type-side leaks: the return type and the cast.
    assert.equal(countLeaks(path.join(root, 'a.ts')), 2);
  });

  test('counts a chrome.* type in a generic argument', () => {
    const root = makeTree({
      'a.ts': 'const m = new Map<string, chrome.tabs.Tab>();\n',
    });
    assert.equal(countLeaks(path.join(root, 'a.ts')), 1);
  });
});

describe('countLeaks: string/comment exclusion', () => {
  const { countLeaks } = require(SCRIPT);

  test('does NOT count chrome.* inside a template literal (handle-capture.ts:64 case)', () => {
    const root = makeTree({
      'handle-capture.ts':
        'debugLog("capture", "background", `Auto-sync SKIPPED (autoServerSync=false in chrome.storage.local)`, {})\n',
    });
    assert.equal(countLeaks(path.join(root, 'handle-capture.ts')), 0);
  });

  test('does NOT count chrome.* inside a double-quoted string', () => {
    const root = makeTree({ 'a.ts': 'const msg = "chrome.storage.local";\n' });
    assert.equal(countLeaks(path.join(root, 'a.ts')), 0);
  });

  test('does NOT count chrome.* inside a single-quoted string', () => {
    const root = makeTree({ "a.ts": "const msg = 'chrome.tabs.query';\n" });
    assert.equal(countLeaks(path.join(root, 'a.ts')), 0);
  });

  test('does NOT count chrome.* in a line comment', () => {
    const root = makeTree({ 'a.ts': '// chrome.storage.local\nconst x = 1;\n' });
    assert.equal(countLeaks(path.join(root, 'a.ts')), 0);
  });

  test('does NOT count chrome.* in a block comment', () => {
    const root = makeTree({ 'a.ts': '/* chrome.storage.local */ const x = 1;\n' });
    assert.equal(countLeaks(path.join(root, 'a.ts')), 0);
  });

  test('does NOT count manifestChrome variable name (vite.config.ts case)', () => {
    const root = makeTree({
      'vite.config.ts': [
        "import { defineConfig } from 'vite';",
        "import manifestChrome from './manifest-chrome.json';",
        'export default defineConfig({});',
        '',
      ].join('\n'),
    });
    assert.equal(countLeaks(path.join(root, 'vite.config.ts')), 0);
  });

  test('does NOT count bare chrome identifier (typeof check)', () => {
    const root = makeTree({ 'a.ts': 'if (typeof chrome !== "undefined") {}\n' });
    assert.equal(countLeaks(path.join(root, 'a.ts')), 0);
  });

  test('does NOT count an identifier that merely starts with "chrome"', () => {
    const root = makeTree({ 'a.ts': 'const chromeFlag = true; const x = chromeFlag;\n' });
    assert.equal(countLeaks(path.join(root, 'a.ts')), 0);
  });
});

// ---------------------------------------------------------------------------
// shouldSkipFile
// ---------------------------------------------------------------------------

describe('shouldSkipFile', () => {
  const { shouldSkipFile } = require(SCRIPT);

  test('skips canonical homes', () => {
    assert.equal(shouldSkipFile('browser-apis/chrome.ts'), true);
    assert.equal(shouldSkipFile('browser-apis/firefox.ts'), true);
    // types.ts is part of the abstraction layer (re-exports @types/chrome per D11)
    assert.equal(shouldSkipFile('browser-apis/types.ts'), true);
  });

  test('skips gate script and allowlist JSON', () => {
    assert.equal(shouldSkipFile(SCRIPT_REL), true);
    assert.equal(shouldSkipFile(ALLOWLIST_REL), true);
  });

  test('skips test files', () => {
    assert.equal(shouldSkipFile('background/foo.test.ts'), true);
    assert.equal(shouldSkipFile('panel/server-probe.test.ts'), true);
    assert.equal(shouldSkipFile('popup/hooks/useFoo.test.tsx'), true);
  });

  test('skips vitest setup', () => {
    assert.equal(shouldSkipFile('vitest.setup.ts'), true);
  });

  test('does not skip normal source files', () => {
    assert.equal(shouldSkipFile('background/index.ts'), false);
    assert.equal(shouldSkipFile('utils/formatter.ts'), false);
    assert.equal(shouldSkipFile('content-relay.ts'), false);
  });
});

// ---------------------------------------------------------------------------
// CLI: default (CI) mode
// ---------------------------------------------------------------------------

describe('CLI: default (CI) mode', () => {
  test('Happy: exits 0 with empty stderr when actual <= allowed for all files', () => {
    const root = makeTree({
      [SCRIPT_REL]: '// gate',
      [ALLOWLIST_REL]: JSON.stringify({ 'background/index.ts': 2 }, null, 2) + '\n',
      'background/index.ts': 'const a = chrome.storage.local.get("k");\nconst b = chrome.runtime.id;\n',
    });
    const result = runCli([], root);
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    assert.equal(result.stderr.trim(), '');
  });

  test('Failure: exits 1 and prints violator when file not in allowlist has leaks', () => {
    const root = makeTree({
      [SCRIPT_REL]: '// gate',
      [ALLOWLIST_REL]: '{}\n',
      'utils/formatter.ts': 'const x = chrome.storage.local.get("test");\n',
    });
    const result = runCli([], root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /utils\/formatter\.ts: 1\/0/);
  });

  test('exits 1 when actual exceeds allowed', () => {
    const root = makeTree({
      [SCRIPT_REL]: '// gate',
      [ALLOWLIST_REL]: JSON.stringify({ 'background/index.ts': 1 }, null, 2) + '\n',
      'background/index.ts':
        'const a = chrome.storage.local.get("k");\nconst b = chrome.runtime.id;\n',
    });
    const result = runCli([], root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /background\/index\.ts: 2\/1/);
  });

  test('exits 0 when actual exactly equals allowed', () => {
    const root = makeTree({
      [SCRIPT_REL]: '// gate',
      [ALLOWLIST_REL]: JSON.stringify({ 'background/index.ts': 2 }, null, 2) + '\n',
      'background/index.ts':
        'const a = chrome.storage.local.get("k");\nconst b = chrome.runtime.id;\n',
    });
    const result = runCli([], root);
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
  });

  test('exits 1 listing multiple violators', () => {
    const root = makeTree({
      [SCRIPT_REL]: '// gate',
      [ALLOWLIST_REL]: '{}\n',
      'utils/a.ts': 'chrome.runtime.id;\n',
      'utils/b.ts': 'chrome.tabs.query({});\n',
    });
    const result = runCli([], root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /utils\/a\.ts: 1\/0/);
    assert.match(result.stderr, /utils\/b\.ts: 1\/0/);
  });
});

// ---------------------------------------------------------------------------
// CLI: --audit mode
// ---------------------------------------------------------------------------

describe('CLI: --audit mode', () => {
  test('prints JSON with actual counts per file', () => {
    const root = makeTree({
      [SCRIPT_REL]: '// gate',
      'background/index.ts': 'const a = chrome.storage.local.get("k");\n',
      'panel/server-probe.ts': 'const b = chrome.runtime.id;\nconst c = chrome.runtime.sendMessage({});\n',
    });
    const result = runCli(['--audit'], root);
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    const data = JSON.parse(result.stdout);
    assert.equal(data['background/index.ts'], 1);
    assert.equal(data['panel/server-probe.ts'], 2);
  });

  test('omits files with 0 leaks', () => {
    const root = makeTree({
      [SCRIPT_REL]: '// gate',
      'background/index.ts': 'const a = chrome.storage.local.get("k");\n',
      'utils/formatter.ts': 'export const noop = 1;\n',
    });
    const result = runCli(['--audit'], root);
    assert.equal(result.status, 0);
    const data = JSON.parse(result.stdout);
    assert.ok(!('utils/formatter.ts' in data), 'should not include files with 0 leaks');
  });

  test('output is valid JSON with sorted keys for deterministic diffs', () => {
    const root = makeTree({
      [SCRIPT_REL]: '// gate',
      'z/file.ts': 'chrome.runtime.id;\n',
      'a/file.ts': 'chrome.tabs.query({});\n',
    });
    const result = runCli(['--audit'], root);
    const data = JSON.parse(result.stdout);
    const keys = Object.keys(data);
    assert.deepEqual(keys, [...keys].sort());
  });
});

// ---------------------------------------------------------------------------
// CLI: --update mode (shrink-enforced)
// ---------------------------------------------------------------------------

describe('CLI: --update mode (shrink-enforced)', () => {
  test('decreases allowlist count when leaks are removed', () => {
    const root = makeTree({
      [SCRIPT_REL]: '// gate',
      [ALLOWLIST_REL]: JSON.stringify({ 'background/index.ts': 5 }, null, 2) + '\n',
      'background/index.ts': 'const a = chrome.storage.local.get("k");\nconst b = chrome.runtime.id;\n',
    });
    const result = runCli(['--update'], root);
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    const updated = JSON.parse(fs.readFileSync(path.join(root, ALLOWLIST_REL), 'utf8'));
    assert.equal(updated['background/index.ts'], 2);
  });

  test('does not increase allowlist count when leaks are added', () => {
    const root = makeTree({
      [SCRIPT_REL]: '// gate',
      [ALLOWLIST_REL]: JSON.stringify({ 'background/index.ts': 2 }, null, 2) + '\n',
      'background/index.ts':
        'const a = chrome.storage.local.get("k");\nconst b = chrome.runtime.id;\n' +
        'const c = chrome.tabs.query({});\nconst d = chrome.runtime.connect({});\n',
    });
    const result = runCli(['--update'], root);
    assert.equal(result.status, 0);
    const updated = JSON.parse(fs.readFileSync(path.join(root, ALLOWLIST_REL), 'utf8'));
    assert.equal(updated['background/index.ts'], 2, 'count must not increase');
  });

  test('removes allowlist entries when file no longer leaks', () => {
    const root = makeTree({
      [SCRIPT_REL]: '// gate',
      [ALLOWLIST_REL]: JSON.stringify({ 'background/index.ts': 3, 'utils/gone.ts': 5 }, null, 2) + '\n',
      'background/index.ts': 'const a = chrome.runtime.id;\n',
    });
    const result = runCli(['--update'], root);
    assert.equal(result.status, 0);
    const updated = JSON.parse(fs.readFileSync(path.join(root, ALLOWLIST_REL), 'utf8'));
    assert.equal(updated['background/index.ts'], 1);
    assert.ok(!('utils/gone.ts' in updated), 'unused allowlist entry should be removed');
  });

  test('adds new allowlist entries for files that newly leak', () => {
    const root = makeTree({
      [SCRIPT_REL]: '// gate',
      [ALLOWLIST_REL]: '{}\n',
      'utils/new.ts': 'chrome.runtime.id;\nchrome.tabs.query({});\n',
    });
    const result = runCli(['--update'], root);
    assert.equal(result.status, 0);
    const updated = JSON.parse(fs.readFileSync(path.join(root, ALLOWLIST_REL), 'utf8'));
    assert.equal(updated['utils/new.ts'], 2);
  });
});

// ---------------------------------------------------------------------------
// CLI: file skip semantics
// ---------------------------------------------------------------------------

describe('CLI: skip semantics', () => {
  test('does not flag the gate script itself', () => {
    const root = makeTree({
      [SCRIPT_REL]: 'const a = chrome.storage.local.get("k");\n',
      'background/index.ts': 'export const x = 1;\n',
    });
    const result = runCli(['--audit'], root);
    assert.equal(result.status, 0);
    const data = JSON.parse(result.stdout);
    assert.ok(!(SCRIPT_REL in data));
  });

  test('does not flag the allowlist JSON file', () => {
    const root = makeTree({
      [SCRIPT_REL]: '// gate',
      [ALLOWLIST_REL]: '{}\n',
      'background/index.ts': 'export const x = 1;\n',
    });
    const result = runCli(['--audit'], root);
    const data = JSON.parse(result.stdout);
    assert.ok(!(ALLOWLIST_REL in data));
  });

  test('does not flag browser-apis canonical homes', () => {
    const root = makeTree({
      [SCRIPT_REL]: '// gate',
      'browser-apis/chrome.ts': 'const a = chrome.storage.local.get("k");\n',
      'browser-apis/firefox.ts': 'const a = chrome.storage.local.get("k");\n',
    });
    const result = runCli(['--audit'], root);
    const data = JSON.parse(result.stdout);
    assert.ok(!('browser-apis/chrome.ts' in data));
    assert.ok(!('browser-apis/firefox.ts' in data));
  });

  test('does not flag test files or vitest.setup.ts', () => {
    const root = makeTree({
      [SCRIPT_REL]: '// gate',
      'background/foo.test.ts': 'const a = chrome.storage.local.get("k");\n',
      'panel/server-probe.test.ts': 'chrome.tabs.query({});\n',
      'vitest.setup.ts': 'chrome.runtime.id;\n',
    });
    const result = runCli(['--audit'], root);
    const data = JSON.parse(result.stdout);
    assert.ok(!('background/foo.test.ts' in data));
    assert.ok(!('panel/server-probe.test.ts' in data));
    assert.ok(!('vitest.setup.ts' in data));
  });
});

// ---------------------------------------------------------------------------
// Real extension: smoke test against the seeded allowlist
// ---------------------------------------------------------------------------

describe('Real extension: allowlist consistency (smoke)', () => {
  const extRoot = path.resolve(__dirname, '..');
  const allowlistPath = path.join(extRoot, ALLOWLIST_REL);

  test('default mode exits 0 when allowlist is seeded and consistent', { skip: !fs.existsSync(allowlistPath) }, () => {
    const result = runCli([], extRoot);
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    assert.equal(result.stderr.trim(), '', 'no stderr expected on clean state');
  });
});
