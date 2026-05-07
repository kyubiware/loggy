import { crx } from '@crxjs/vite-plugin'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type PluginOption } from 'vite'
import manifestChrome from './manifest-chrome.json'

export default defineConfig(({ mode, command }) => {
  const plugins: PluginOption[] = [react(), tailwindcss()]

  const useCrx = command === 'serve' && mode === 'chrome'

  // CRXJS for HMR in dev mode (chrome only)
  if (useCrx) {
    plugins.push(crx({ manifest: manifestChrome }))
  }

  // CRXJS manages background/content-relay/popup via manifest processing.
  // Including them in rollupOptions.input leaks them into CRXJS's internal
  // Rollup build (which only has crx:* plugins — no TypeScript transform),
  // causing PARSE_ERROR on `import type` syntax.
  const crxManagedEntries = ['background/index', 'content-relay', 'popup/popup']
  const allInput = {
    panel: 'panel/index.html',
    devtools: 'devtools.html',
    'background/index': 'background/index.ts',
    'content-relay': 'content-relay.ts',
    'fab-ui': 'fab-ui.tsx',
    'popup/popup': 'popup/popup.html',
    'preview/preview': 'preview/preview.html',
  }
  const input = useCrx
    ? Object.fromEntries(
        Object.entries(allInput).filter(([key]) => !crxManagedEntries.includes(key))
      )
    : allInput

  return {
    plugins,
    base: './',
    define: {
      __BROWSER__: JSON.stringify(mode),
    },
    build: {
      outDir: `dist-${mode}`,
      rollupOptions: {
        input,
        output: {
          entryFileNames: '[name].js',
          chunkFileNames: (chunkInfo) => {
            if (chunkInfo.name?.startsWith('console-bootstrap')) {
              return 'chunks/console-bootstrap.js'
            }
            return 'chunks/[name]-[hash].js'
          },
          assetFileNames: 'assets/[name]-[hash][extname]',
        },
      },
    },
  }
})
