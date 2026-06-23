#!/usr/bin/env node
/**
 * Browser-APIs boundary lint gate.
 *
 * Enforces that no `chrome.*` API access (and no `import ... from 'chrome'`)
 * appears outside `extension/browser-apis/{chrome,firefox,types}.ts`. An allowlist
 * file (browser-apis-allowlist.json) records the current leak count per file;
 * CI mode fails when any file's actual count exceeds its allowed count.
 *
 * `browser-apis/types.ts` is a canonical home because it defines the unified
 * `BrowserAPI` interface and re-exports `@types/chrome` aliases per D11
 * ("@types/chrome is canonical"). Its chrome.* references are the type-level
 * contract, not leaks.
 *
 * Usage:
 *   node check-browser-apis-boundary.cjs              # CI mode: exit 0 / 1
 *   node check-browser-apis-boundary.cjs --audit      # print JSON of actual counts
 *   node check-browser-apis-boundary.cjs --update     # tighten allowlist (never loosen)
 *
 * Options:
 *   --root <path>   directory to scan (default: current working directory)
 *   --help          print usage
 *
 * Detection uses the TypeScript compiler API. Comments and string literals are
 * not flagged because the AST represents only code; the compiler strips
 * trivia before node creation.
 */

const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

// `types.ts` is part of the abstraction layer: it defines the unified
// `BrowserAPI` interface and re-exports `@types/chrome` aliases per D11.
// Type-position chrome.* references (QualifiedName) are the type-level
// contract by design and are not leaks.
const CANONICAL_HOMES = new Set([
  'browser-apis/chrome.ts',
  'browser-apis/firefox.ts',
  'browser-apis/types.ts',
]);
const SCRIPT_SELF = 'scripts/check-browser-apis-boundary.cjs';
const ALLOWLIST_REL = 'scripts/browser-apis-allowlist.json';
const TEST_FILE_RE = /\.(test|spec)\.[mc]?[jt]sx?$/i;
const SETUP_FILE_RE = /(^|\/)vitest\.setup\.[mc]?ts$/i;
const SCANNED_EXTS = new Set(['.ts', '.tsx', '.mjs', '.cjs']);
const SKIP_DIRS = new Set(['node_modules', 'dist', 'dist-chrome', 'dist-firefox', '.git']);

/**
 * Decide whether a file (path relative to the scan root) should be excluded
 * from leak scanning.
 *
 * @param {string} relPath - path with forward slashes, relative to scan root
 * @returns {boolean}
 */
function shouldSkipFile(relPath) {
  if (CANONICAL_HOMES.has(relPath)) return true;
  if (relPath === SCRIPT_SELF) return true;
  if (relPath === ALLOWLIST_REL) return true;
  if (TEST_FILE_RE.test(relPath)) return true;
  if (SETUP_FILE_RE.test(relPath)) return true;
  return false;
}

/**
 * Recursively collect file paths under `root` that match the scanned
 * extension set and are not inside a skipped directory.
 *
 * @param {string} root
 * @returns {string[]} absolute paths
 */
function findSourceFiles(root) {
  const out = [];
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        stack.push(full);
      } else if (entry.isFile() && SCANNED_EXTS.has(path.extname(entry.name))) {
        out.push(full);
      }
    }
  }
  out.sort();
  return out;
}

/**
 * Get the leftmost identifier of a value-side chain
 * (PropertyAccessExpression or ElementAccessExpression).
 *
 * @param {ts.Node} node
 * @returns {ts.Identifier | null}
 */
function leftmostValueIdentifier(node) {
  let current = node;
  while (current) {
    if (ts.isIdentifier(current)) return current;
    if (ts.isPropertyAccessExpression(current) || ts.isElementAccessExpression(current)) {
      current = current.expression;
      continue;
    }
    return null;
  }
  return null;
}

/**
 * Get the leftmost identifier of a type-side chain (QualifiedName).
 * Used for type-position references like `chrome.tabs.Tab`.
 *
 * @param {ts.Node} node
 * @returns {ts.Identifier | null}
 */
function leftmostTypeIdentifier(node) {
  let current = node;
  while (current) {
    if (ts.isIdentifier(current)) return current;
    if (ts.isQualifiedName(current)) {
      current = current.left;
      continue;
    }
    return null;
  }
  return null;
}

/**
 * Count leak sites in a single file using the TypeScript AST.
 *
 * A leak is:
 *   1. A PropertyAccessExpression or ElementAccessExpression whose leftmost
 *      identifier in the chain is `chrome`. Only the OUTERMOST access in a
 *      chain is counted (so `chrome.storage.local.get` counts as 1, not 3).
 *   2. An ImportDeclaration whose moduleSpecifier is the literal `"chrome"`.
 *
 * @param {string} absPath
 * @returns {number}
 */
function countLeaks(absPath) {
  const source = fs.readFileSync(absPath, 'utf8');
  const ext = path.extname(absPath);
  const scriptKind =
    ext === '.tsx'
      ? ts.ScriptKind.TSX
      : ext === '.ts'
        ? ts.ScriptKind.TS
        : ts.ScriptKind.JS;
  const sf = ts.createSourceFile(absPath, source, ts.ScriptTarget.Latest, true, scriptKind);

  let count = 0;

  /**
   * @param {ts.Node} node
   * @param {ts.Node | undefined} parent
   */
  function visit(node, parent) {
    // Value-side chain: outermost PropertyAccessExpression /
    // ElementAccessExpression whose leftmost is `chrome`. The parent
    // exclusion prevents double-counting when this node is the inner
    // expression of a continuing PAE/EAE.
    if (
      (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) &&
      !(parent &&
        (ts.isPropertyAccessExpression(parent) || ts.isElementAccessExpression(parent)) &&
        parent.expression === node)
    ) {
      const left = leftmostValueIdentifier(node);
      if (left && left.text === 'chrome') {
        count++;
      }
    }

    // Type-side chain: outermost QualifiedName whose leftmost is `chrome`.
    // The TS parser only emits QualifiedName in type contexts (e.g.
    // `chrome.tabs.Tab` as a type annotation), so this is safely
    // disjoint from the value-side detection above.
    if (
      ts.isQualifiedName(node) &&
      !(parent && ts.isQualifiedName(parent) && parent.left === node)
    ) {
      const left = leftmostTypeIdentifier(node);
      if (left && left.text === 'chrome') {
        count++;
      }
    }

    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      node.moduleSpecifier.text === 'chrome'
    ) {
      count++;
    }

    ts.forEachChild(node, (child) => visit(child, node));
  }

  visit(sf, undefined);
  return count;
}

/**
 * Build a `{ relPath: count }` map for every scanned file that has at least
 * one leak. Files with zero leaks are omitted.
 *
 * @param {string} root
 * @returns {Record<string, number>}
 */
function audit(root) {
  const counts = {};
  for (const abs of findSourceFiles(root)) {
    const rel = toRelPath(root, abs);
    if (shouldSkipFile(rel)) continue;
    const n = countLeaks(abs);
    if (n > 0) counts[rel] = n;
  }
  return counts;
}

function toRelPath(root, abs) {
  return path.relative(root, abs).split(path.sep).join('/');
}

function loadAllowlist(absPath) {
  if (!fs.existsSync(absPath)) return {};
  const raw = fs.readFileSync(absPath, 'utf8').trim();
  if (!raw) return {};
  const parsed = JSON.parse(raw);
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`Allowlist at ${absPath} must be a JSON object mapping file paths to counts.`);
  }
  for (const [k, v] of Object.entries(parsed)) {
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || !Number.isInteger(v)) {
      throw new Error(`Allowlist entry ${JSON.stringify(k)} must be a non-negative integer.`);
    }
  }
  return parsed;
}

function saveAllowlist(absPath, counts) {
  const keys = Object.keys(counts).sort();
  const sorted = {};
  for (const k of keys) sorted[k] = counts[k];
  const body = `${JSON.stringify(sorted, null, 2)}\n`;
  fs.writeFileSync(absPath, body, 'utf8');
}

/**
 * CI mode: returns the list of violators as
 * `[{ file, actual, allowed }, ...]`. Empty list = pass.
 */
function check(root, allowed) {
  const actual = audit(root);
  const violators = [];
  // Files that actually leak but aren't in the allowlist are violations.
  for (const [file, n] of Object.entries(actual)) {
    const cap = Object.prototype.hasOwnProperty.call(allowed, file) ? allowed[file] : 0;
    if (n > cap) {
      violators.push({ file, actual: n, allowed: cap });
    }
  }
  violators.sort((a, b) => a.file.localeCompare(b.file));
  return violators;
}

/**
 * --update mode: shrink-enforced.
 *   - For files already in the allowlist: cap tightens to actual, but NEVER
 *     loosens. If actual > cap, the cap is left unchanged (the gate will
 *     then fail on that file until the leaks are removed).
 *   - For files no longer leaking at all: drop the allowlist entry.
 *   - For files that are leaking but were not previously allowlisted: add
 *     them with their current actual count.
 */
function computeUpdatedAllowlist(current, actual) {
  const next = { ...current };
  for (const [file, cap] of Object.entries(current)) {
    if (Object.prototype.hasOwnProperty.call(actual, file)) {
      next[file] = Math.min(cap, actual[file]);
    } else {
      delete next[file];
    }
  }
  for (const [file, n] of Object.entries(actual)) {
    if (!Object.prototype.hasOwnProperty.call(current, file)) {
      next[file] = n;
    }
  }
  return next;
}

function printHelp() {
  process.stdout.write(
    [
      'Usage: node check-browser-apis-boundary.cjs [options]',
      '',
      'Modes:',
      '  (default)       CI mode — exit 0 if all files within their allowlist cap, else 1',
      '  --audit         Print JSON of current actual leak counts per file',
      '  --update        Tighten the allowlist file in-place (decrement or remove entries)',
      '',
      'Options:',
      '  --root <path>   Directory to scan (default: current working directory)',
      '  --help          Show this help',
      '',
    ].join('\n')
  );
}

function parseArgs(argv) {
  const opts = { mode: 'check', root: process.cwd() };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--audit') opts.mode = 'audit';
    else if (a === '--update') opts.mode = 'update';
    else if (a === '--help' || a === '-h') opts.mode = 'help';
    else if (a === '--root') {
      opts.root = path.resolve(argv[++i]);
    } else if (a.startsWith('--root=')) {
      opts.root = path.resolve(a.slice('--root='.length));
    } else {
      throw new Error(`Unknown argument: ${a}`);
    }
  }
  return opts;
}

function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (err) {
    process.stderr.write(`Error: ${err.message}\n`);
    process.exit(2);
  }

  if (opts.mode === 'help') {
    printHelp();
    return;
  }

  if (!fs.existsSync(opts.root) || !fs.statSync(opts.root).isDirectory()) {
    process.stderr.write(`Error: --root ${opts.root} is not an existing directory.\n`);
    process.exit(2);
  }

  const allowlistAbs = path.join(opts.root, ALLOWLIST_REL);

  if (opts.mode === 'audit') {
    const counts = audit(opts.root);
    const sorted = {};
    for (const k of Object.keys(counts).sort()) sorted[k] = counts[k];
    process.stdout.write(`${JSON.stringify(sorted, null, 2)}\n`);
    return;
  }

  if (opts.mode === 'update') {
    const current = loadAllowlist(allowlistAbs);
    const actual = audit(opts.root);
    const next = computeUpdatedAllowlist(current, actual);
    saveAllowlist(allowlistAbs, next);
    return;
  }

  // CI mode (default)
  const allowed = loadAllowlist(allowlistAbs);
  const violators = check(opts.root, allowed);
  if (violators.length === 0) {
    return;
  }
  for (const v of violators) {
    process.stderr.write(`${v.file}: ${v.actual}/${v.allowed}\n`);
  }
  process.exit(1);
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    process.stderr.write(`Error: ${err && err.message ? err.message : err}\n`);
    process.exit(2);
  }
}

module.exports = {
  shouldSkipFile,
  findSourceFiles,
  countLeaks,
  audit,
  loadAllowlist,
  saveAllowlist,
  check,
  computeUpdatedAllowlist,
  leftmostValueIdentifier,
  leftmostTypeIdentifier,
};
