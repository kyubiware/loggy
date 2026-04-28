/**
 * Post-build script that re-bundles devtools.mjs and panel/src/main.tsx as
 * classic (IIFE) scripts for Firefox compatibility.
 *
 * Firefox's DevTools page and panel context silently fail to load ES modules
 * via `<script type="module">`. This script uses esbuild (bundled with Vite)
 * to re-bundle both entries as self-contained IIFEs, then rewrites their HTML
 * files to use plain `<script>` tags.
 *
 * For devtools.js this also resolves a secondary issue where
 * fix-content-scripts.cjs strips the export from the shared console-bootstrap
 * chunk, which would break the CONSOLE_BOOTSTRAP_SCRIPT import.
 */

const { build } = require('esbuild');
const { existsSync, readFileSync, writeFileSync } = require('node:fs');
const { join, resolve } = require('node:path');

const distDir = join(__dirname, '..', 'dist-firefox');
const extensionDir = join(__dirname, '..');

/** esbuild plugin: resolve .js imports to .ts source files */
const resolveJsToTs = {
  name: 'resolve-js-to-ts',
  setup(build) {
    build.onResolve({ filter: /\.js$/ }, (args) => {
      if (!args.resolveDir) return null;
      const tsPath = args.path.replace(/\.js$/, '.ts');
      const fullPath = resolve(args.resolveDir, tsPath);
      if (existsSync(fullPath)) {
        return { path: fullPath };
      }
      return null;
    });
  },
};

/** esbuild plugin: ignore CSS imports (CSS is already linked in HTML) */
const ignoreCss = {
  name: 'ignore-css',
  setup(build) {
    build.onResolve({ filter: /\.css$/ }, (args) => ({
      path: args.path,
      namespace: 'ignore-css',
    }));
    build.onLoad({ filter: /.*/, namespace: 'ignore-css' }, () => ({
      contents: '',
    }));
  },
};

/**
 * Rewrite an HTML file to use a classic script instead of a module script.
 * Removes modulepreload links and crossorigin attributes.
 */
function rewriteHtmlToClassicScript(htmlRelativePath, scriptSrc) {
  const htmlPath = join(distDir, htmlRelativePath);
  let html = readFileSync(htmlPath, 'utf8');

  // Remove <link rel="modulepreload"> tags
  html = html.replace(/<link\s+rel="modulepreload"[^>]*>\n?/g, '');

  // Remove crossorigin attributes
  html = html.replace(/\s*crossorigin/g, '');

  // Replace <script type="module" ... src="..."> with plain <script defer src="...">
  // defer preserves module-script timing (runs after document is parsed)
  const escapedSrc = scriptSrc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  html = html.replace(
    new RegExp(`<script\\s+type="module"\\s+[^>]*src="${escapedSrc}"[^>]*><\\/script>`),
    `<script defer src="${scriptSrc}"></script>`,
  );

  writeFileSync(htmlPath, html);
  console.log(`Rewrote ${htmlRelativePath}: classic script, no modulepreload`);
}

async function main() {
  const sharedConfig = {
    bundle: true,
    format: 'iife',
    minify: true,
    define: { __BROWSER__: '"firefox"' },
    resolveExtensions: ['.tsx', '.ts', '.jsx', '.js', '.mjs', '.css', '.json'],
    plugins: [resolveJsToTs],
    logLevel: 'info',
  };

  // --- devtools.mjs → devtools.js (IIFE) ---

  await build({
    ...sharedConfig,
    entryPoints: [join(extensionDir, 'devtools.mjs')],
    outfile: join(distDir, 'devtools.js'),
  });
  console.log('Re-bundled devtools.js as IIFE for Firefox');

  rewriteHtmlToClassicScript('devtools.html', './devtools.js');

  // --- panel/src/main.tsx → panel.js (IIFE) ---

  await build({
    ...sharedConfig,
    entryPoints: [join(extensionDir, 'panel/src/main.tsx')],
    outfile: join(distDir, 'panel.js'),
    plugins: [resolveJsToTs, ignoreCss],
    loader: { '.tsx': 'tsx', '.ts': 'ts' },
  });
  console.log('Re-bundled panel.js as IIFE for Firefox');

  rewriteHtmlToClassicScript('panel/index.html', '../panel.js');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
