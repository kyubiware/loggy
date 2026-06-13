#!/usr/bin/env node
/**
 * Screenshot generator for Loggy Chrome extension Chrome Web Store listing.
 *
 * Launches Playwright Chromium, opens the built extension HTML files directly,
 * injects realistic mock data via browser APIs, and captures CWS-compliant screenshots.
 *
 * Usage:
 *   npm run screenshot:chrome    (add to package.json scripts:
 *     "screenshot:chrome": "node scripts/screenshot-chrome.cjs")
 *
 * Output: screenshots/ directory in the repo root (one level up from extension/).
 * Files: cws-panel-preview.png, cws-panel-routes.png, cws-panel-expanded.png,
 *        cws-popup-active.png, cws-preview-markdown.png
 *
 * CWS requirements:
 *   - Panel/preview: 1280×800 exactly (viewport crop, not fullPage)
 *   - Popup: 640×400 (fullPage since the popup is compact)
 *   - deviceScaleFactor: 1 (no 2x — CWS wants exact pixel dimensions)
 */

const { chromium } = require('playwright')
const http = require('http')
const path = require('path')
const fs = require('fs')

// ─── Paths ──────────────────────────────────────────────────────────────────
const EXTENSION_ROOT = path.resolve(__dirname, '..')
const DIST_CHROME = path.join(EXTENSION_ROOT, 'dist-chrome')
const SCREENSHOTS_DIR = path.join(EXTENSION_ROOT, '..', 'screenshots')

// ─── HTTP Server ────────────────────────────────────────────────────────────

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
}

/**
 * Starts a lightweight HTTP server serving static files from rootDir.
 * Auto-assigns a free port (port 0). No dependencies beyond Node.js http module.
 * Returns { server, port }.
 */
function startServer(rootDir) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      // CORS headers — prevent any file://-style CORS blocks
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Access-Control-Allow-Methods', 'GET')

      // Parse URL path, strip query string
      let urlPath = req.url.split('?')[0]
      if (urlPath === '/') urlPath = '/index.html'

      // Security: block directory traversal
      const safePath = path.normalize(urlPath).replace(/^(\.\.(\/|\\|$))+/, '')
      const filePath = path.join(rootDir, safePath)

      // Determine MIME type
      const ext = path.extname(filePath).toLowerCase()
      const contentType = MIME_TYPES[ext] || 'application/octet-stream'

      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(404)
          res.end('Not Found')
          return
        }
        res.writeHead(200, { 'Content-Type': contentType })
        res.end(data)
      })
    })

    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port
      resolve({ server, port })
    })

    server.on('error', reject)
  })
}

// ─── Mock Data ──────────────────────────────────────────────────────────────

const MOCK_CONSOLE_LOGS = [
  { timestamp: '2026-04-22T10:30:10.123Z', level: 'info', message: 'App initialized v2.4.1' },
  { timestamp: '2026-04-22T10:30:11.456Z', level: 'log', message: 'User session started: user_abc123' },
  { timestamp: '2026-04-22T10:30:12.789Z', level: 'info', message: 'Fetching user profile from /api/v2/users/me' },
  { timestamp: '2026-04-22T10:30:13.012Z', level: 'error', message: "TypeError: Cannot read properties of null (reading 'config')" },
  { timestamp: '2026-04-22T10:30:13.012Z', level: 'error', message: "TypeError: Cannot read properties of null (reading 'config')" },
  { timestamp: '2026-04-22T10:30:13.012Z', level: 'error', message: "TypeError: Cannot read properties of null (reading 'config')" },
  { timestamp: '2026-04-22T10:30:14.345Z', level: 'warn', message: 'Deprecated API usage detected: navigator.userAgent' },
  { timestamp: '2026-04-22T10:30:14.345Z', level: 'warn', message: 'Deprecated API usage detected: navigator.userAgent' },
  { timestamp: '2026-04-22T10:30:15.678Z', level: 'log', message: 'Component <Dashboard> mounted successfully' },
  { timestamp: '2026-04-22T10:30:16.901Z', level: 'info', message: 'WebSocket connection established' },
  { timestamp: '2026-04-22T10:30:17.234Z', level: 'log', message: 'Cache hit: /api/v2/config' },
  { timestamp: '2026-04-22T10:30:18.567Z', level: 'warn', message: 'Response time exceeded threshold: 2340ms for /api/v2/analytics' },
  { timestamp: '2026-04-22T10:30:19.890Z', level: 'debug', message: 'State update: { loading: false, data: [...] }' },
  { timestamp: '2026-04-22T10:30:20.123Z', level: 'log', message: 'User clicked "Export" button' },
  { timestamp: '2026-04-22T10:30:21.456Z', level: 'error', message: 'NetworkError: Failed to fetch /api/v2/export — CORS policy blocked' },
]

const MOCK_NETWORK_ENTRIES = [
  {
    startedDateTime: '2026-04-22T10:30:12.000Z',
    request: {
      url: 'https://api.example.com/v2/users/me',
      method: 'GET',
      headers: [
        { name: 'Authorization', value: 'Bearer ey***redacted' },
        { name: 'Accept', value: 'application/json' },
      ],
    },
    response: {
      status: 200,
      statusText: 'OK',
      headers: [
        { name: 'Content-Type', value: 'application/json' },
      ],
      content: {
        size: 256,
        mimeType: 'application/json',
        text: '{"id":42,"name":"Jane Doe","email":"jane@example.com","role":"admin"}',
      },
    },
    _resourceType: 'fetch',
    time: 142,
  },
  {
    startedDateTime: '2026-04-22T10:30:12.500Z',
    request: {
      url: 'https://api.example.com/v2/dashboard',
      method: 'GET',
      headers: [
        { name: 'Accept', value: 'application/json' },
      ],
    },
    response: {
      status: 200,
      statusText: 'OK',
      headers: [
        { name: 'Content-Type', value: 'application/json' },
      ],
      content: {
        size: 1024,
        mimeType: 'application/json',
        text: '{"widgets":["chart","table","stats"],"lastUpdated":"2026-04-22T10:30:00Z"}',
      },
    },
    _resourceType: 'fetch',
    time: 234,
  },
  {
    startedDateTime: '2026-04-22T10:30:14.000Z',
    request: {
      url: 'https://api.example.com/v2/analytics',
      method: 'POST',
      headers: [
        { name: 'Content-Type', value: 'application/json' },
      ],
      postData: {
        mimeType: 'application/json',
        text: '{"event":"page_view","page":"/dashboard","timestamp":"2026-04-22T10:30:14.000Z"}',
      },
    },
    response: {
      status: 202,
      statusText: 'Accepted',
      content: { size: 0, mimeType: 'text/plain' },
    },
    _resourceType: 'fetch',
    time: 2340,
  },
  {
    startedDateTime: '2026-04-22T10:30:15.000Z',
    request: {
      url: 'https://api.example.com/v2/config',
      method: 'GET',
      headers: [],
    },
    response: {
      status: 200,
      statusText: 'OK',
      headers: [],
      content: { size: 512, mimeType: 'application/json', text: '{"theme":"dark","pageSize":25}' },
    },
    _resourceType: 'fetch',
    time: 45,
  },
  {
    startedDateTime: '2026-04-22T10:30:17.000Z',
    request: {
      url: 'https://api.example.com/v2/export',
      method: 'POST',
      headers: [
        { name: 'Content-Type', value: 'application/json' },
      ],
      postData: {
        mimeType: 'application/json',
        text: '{"format":"csv","filters":{"dateRange":"7d"}}',
      },
    },
    response: {
      status: 500,
      statusText: 'Internal Server Error',
      headers: [],
      content: {
        size: 128,
        mimeType: 'application/json',
        text: '{"error":"INTERNAL_ERROR","message":"Database connection timeout"}',
      },
    },
    _resourceType: 'fetch',
    time: 5012,
  },
  {
    startedDateTime: '2026-04-22T10:30:18.000Z',
    request: {
      url: 'https://cdn.example.com/assets/main.bundle.js',
      method: 'GET',
      headers: [],
    },
    response: {
      status: 304,
      statusText: 'Not Modified',
      headers: [],
      content: { size: 0, mimeType: 'application/javascript' },
    },
    _resourceType: 'script',
    time: 12,
  },
  {
    startedDateTime: '2026-04-22T10:30:19.000Z',
    request: {
      url: 'https://api.example.com/v2/users?role=admin&limit=10',
      method: 'GET',
      headers: [],
    },
    response: {
      status: 200,
      statusText: 'OK',
      headers: [],
      content: { size: 2048, mimeType: 'application/json', text: '[{"id":1,"name":"Admin User"}]' },
    },
    _resourceType: 'fetch',
    time: 189,
  },
  {
    startedDateTime: '2026-04-22T10:30:20.000Z',
    request: {
      url: 'https://api.example.com/v2/notifications',
      method: 'GET',
      headers: [],
    },
    response: {
      status: 403,
      statusText: 'Forbidden',
      headers: [],
      content: { size: 64, mimeType: 'application/json', text: '{"error":"INSUFFICIENT_PERMISSIONS"}' },
    },
    _resourceType: 'fetch',
    time: 67,
  },
]

const MOCK_SETTINGS = {
  consoleFilter: '',
  networkFilter: '',
  consoleVisible: true,
  networkVisible: true,
  includeAgentContext: true,
  includeResponseBodies: false,
  truncateConsoleLogs: true,
  redactSensitiveInfo: true,
  networkExportEnabled: false,
  autoServerSync: false,
  serverUrl: 'http://localhost:8743',
}

const MOCK_MARKDOWN = `## Debug Log Export

### Environment
- **URL**: https://example.com/dashboard
- **Time**: 2026-04-22T10:30:22.000Z
- **Console Logs**: 15
- **Network Requests**: 8

### Debug Signals
- **Errors**: 4 (3 unique)
- **Warnings**: 3 (2 unique)
- **Failure-like events**: 2

### Console Logs

| Timestamp | Level | Message |
|-----------|-------|---------|
| 10:30:10 | info | App initialized v2.4.1 |
| 10:30:11 | log | User session started: user_abc123 |
| 10:30:13 | error | TypeError: Cannot read properties of null (reading 'config') |
| 10:30:14 | warn | Deprecated API usage detected: navigator.userAgent |
| 10:30:18 | warn | Response time exceeded threshold: 2340ms |
| 10:30:21 | error | NetworkError: Failed to fetch — CORS policy blocked |

### Network Activity

| Method | Status | URL | Duration |
|--------|--------|-----|----------|
| GET | 200 | /v2/users/me | 142ms |
| GET | 200 | /v2/dashboard | 234ms |
| POST | 202 | /v2/analytics | 2340ms |
| POST | 500 | /v2/export | 5012ms |
| GET | 403 | /v2/notifications | 67ms |
`

// ─── Mock Scripts ───────────────────────────────────────────────────────────

/**
 * Chrome API mock for the popup page.
 * This runs BEFORE any page scripts (via page.addInitScript).
 */
function popupMockScript(statusMode, settings) {
  return `
    (function() {
      const MOCK_STATUS = ${JSON.stringify({
        mode: statusMode,
        tabId: 123,
        logCount: 42,
        connected: true,
      })};

      const MOCK_SETTINGS = ${JSON.stringify(settings)};

      const MOCK_EXPORT_DATA = {
        tokenCount: 5432,
        markdown: ${JSON.stringify(MOCK_MARKDOWN)},
        hasData: true,
        logCount: 42,
      };

      // Mock data for useFirefoxDirectCapture (used when chrome.debugger is undefined)
      const MOCK_FIREFOX_CONSOLE = ${JSON.stringify(MOCK_CONSOLE_LOGS)};
      const MOCK_FIREFOX_NETWORK = ${JSON.stringify(
        MOCK_NETWORK_ENTRIES.map(e => ({
          timestamp: e.startedDateTime,
          url: e.request.url,
          method: e.request.method,
          status: e.response.status,
          responseBody: e.response.content?.text,
          contentType: e.response.content?.mimeType,
          duration: e.time,
        }))
      )};

      const noop = () => {};

      window.chrome = {
        tabs: {
          query: (queryInfo, callback) => {
            const tabs = [{ id: 123, url: 'https://example.com/dashboard', windowId: 1, active: true }];
            if (typeof callback === 'function') {
              setTimeout(() => callback(tabs), 10);
            }
            return Promise.resolve(tabs);
          },
          create: (options, callback) => {
            if (typeof callback === 'function') callback({ id: 456 });
            return Promise.resolve({ id: 456 });
          },
        },
        runtime: {
          lastError: undefined,
          sendMessage: (message, callback) => {
            setTimeout(() => {
              if (!callback) return;
              if (message.type === 'get-status') {
                callback(MOCK_STATUS);
              } else if (message.type === 'get-tab-export-data') {
                callback(MOCK_EXPORT_DATA);
              } else if (message.type === 'get-always-log-hosts') {
                callback({ type: 'always-log-hosts-response', hosts: [] });
              } else if (message.type === 'cache-preview') {
                callback({ id: 'preview-mock-123' });
              } else if (message.type === 'toggle-debugger') {
                callback(MOCK_STATUS);
              } else if (message.type === 'start-logging' || message.type === 'stop-logging') {
                callback(undefined);
              } else if (message.type === 'add-always-log' || message.type === 'remove-always-log') {
                callback(undefined);
              } else {
                callback({});
              }
            }, 10);
          },
          getURL: (path) => 'moz-extension://fake-extension-id/' + path,
          onMessage: {
            addListener: noop,
            removeListener: noop,
          },
        },
        storage: {
          local: {
            get: (keys, callback) => {
              const result = {};
              if (Array.isArray(keys)) {
                keys.forEach(key => {
                  if (key === 'loggyPanelSettings') result[key] = MOCK_SETTINGS;
                });
              } else if (typeof keys === 'string') {
                if (keys === 'loggyPanelSettings') result[keys] = MOCK_SETTINGS;
              }
              // Support both callback and Promise-based usage
              if (typeof callback === 'function') callback(result);
              return Promise.resolve(result);
            },
            set: (items, callback) => {
              if (typeof callback === 'function') callback();
              return Promise.resolve();
            },
          },
          onChanged: {
            addListener: noop,
            removeListener: noop,
          },
        },
        // Firefox has no chrome.debugger — triggers useFirefoxDirectCapture
        debugger: undefined,
        scripting: {
          executeScript: (options) => {
            // useFirefoxDirectCapture reads __loggyConsoleLogs and __loggyNetworkLogs
            return Promise.resolve([{
              result: {
                consoleLogs: MOCK_FIREFOX_CONSOLE,
                networkLogs: MOCK_FIREFOX_NETWORK,
              }
            }]);
          },
        },
      };
    })();
  `
}

/**
 * Chrome API mock for the DevTools panel page.
 * This is more complex because it needs to mock chrome.devtools.* APIs.
 */
function panelMockScript(consoleLogs, networkEntries, settings) {
  return `
    (function() {
      const MOCK_CONSOLE_LOGS = ${JSON.stringify(consoleLogs)};
      const MOCK_NETWORK_ENTRIES = ${JSON.stringify(networkEntries)};
      const MOCK_SETTINGS = ${JSON.stringify(settings)};

      const noop = () => {};
      let evalCallIndex = 0;

      window.chrome = {
        devtools: {
          inspectedWindow: {
            tabId: 12345,
            eval: (code, callback) => {
              setTimeout(() => {
                if (typeof code === 'string' && code.includes('document.location.hostname')) {
                  // useConsentCheck: get hostname
                  callback('example.com', { isException: false });
                } else if (typeof code === 'string' && code.includes('__loggyConsoleLogs')) {
                  // captureConsoleLogs: read captured logs
                  callback(MOCK_CONSOLE_LOGS, false);
                } else if (typeof code === 'string' && code.includes('__loggyConsoleLogs = []')) {
                  // clearCapturedConsoleLogs
                  callback(null, false);
                } else {
                  // Console bootstrap script injection - success
                  callback(undefined, false);
                }
              }, 10);
            },
          },
          network: {
            getHAR: (callback) => {
              setTimeout(() => {
                callback({ entries: MOCK_NETWORK_ENTRIES });
              }, 10);
            },
            onRequestFinished: {
              addListener: noop,
              removeListener: noop,
            },
            onNavigated: {
              addListener: noop,
              removeListener: noop,
            },
          },
          panels: {
            create: noop,
          },
        },
        runtime: {
          sendMessage: (message, callback) => {
            setTimeout(() => {
              if (!callback) return;
              if (message.type === 'request-consent') {
                callback({ hasConsent: true, captureMode: 'content-script' });
              } else if (message.type === 'get-status') {
                callback({ mode: 'content-script', tabId: 12345, logCount: ${consoleLogs.length}, connected: true });
              } else if (message.type === 'panel-opened' || message.type === 'panel-closed') {
                // Fire-and-forget, no callback expected
              } else {
                callback({});
              }
            }, 10);
          },
          getURL: (path) => 'moz-extension://fake-id/' + path,
          onMessage: {
            addListener: noop,
            removeListener: noop,
          },
        },
        storage: {
          local: {
            get: (keys, callback) => {
              const result = {};
              if (Array.isArray(keys)) {
                keys.forEach(key => {
                  if (key === 'loggyPanelSettings') {
                    result[key] = MOCK_SETTINGS;
                  }
                });
              }
              setTimeout(() => callback(result), 10);
            },
            set: (items, callback) => {
              if (callback) callback();
            },
          },
          onChanged: {
            addListener: noop,
            removeListener: noop,
          },
        },
        tabs: {
          query: (queryInfo, callback) => {
            setTimeout(() => callback([{ id: 12345, url: 'https://example.com/dashboard' }]), 10);
            return Promise.resolve([{ id: 12345, url: 'https://example.com/dashboard' }]);
          },
        },
        debugger: undefined,
        scripting: {
          executeScript: () => Promise.resolve([{ result: [] }]),
        },
      };
    })();
  `
}

/**
 * Chrome API mock for the preview page.
 */
function previewMockScript(markdown) {
  return `
    (function() {
      const MOCK_MARKDOWN = ${JSON.stringify(markdown)};

      const noop = () => {};

      window.chrome = {
        runtime: {
          sendMessage: (message, callback) => {
            setTimeout(() => {
              if (!callback) return;
              if (message.type === 'get-cached-preview') {
                callback({ markdown: MOCK_MARKDOWN });
              } else {
                callback({});
              }
            }, 10);
          },
          getURL: (path) => 'moz-extension://fake-id/' + path,
          onMessage: {
            addListener: noop,
            removeListener: noop,
          },
        },
        storage: {
          local: {
            get: (keys, callback) => { callback({}); },
            set: (items, callback) => { if (callback) callback(); },
          },
          onChanged: { addListener: noop, removeListener: noop },
        },
      };
    })();
  `
}

// ─── Screenshot Functions ───────────────────────────────────────────────────

/**
 * CWS popup screenshot: 360px-wide viewport matching actual browser popup width.
 * fullPage capture so the full popup height is captured.
 */
async function screenshotPopup(browser, baseUrl) {
  console.log('📸 Screenshotting popup (active state)...')

  const context = await browser.newContext({
    viewport: { width: 360, height: 600 },
    deviceScaleFactor: 2,
  })

  const page = await context.newPage()
  await page.addInitScript(popupMockScript('content-script', MOCK_SETTINGS))

  await page.goto(`${baseUrl}/popup/popup.html`)

  // Wait for React to mount and data to load
  await page.waitForSelector('#root > div', { timeout: 15000 })
  await page.waitForTimeout(500) // Let animations settle

  // Full-page screenshot — popup content fits within 640×400
  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, 'cws-popup-active.png'),
    fullPage: true,
    type: 'png',
  })

  console.log('  ✓ cws-popup-active.png')
  await context.close()
}

/**
 * CWS panel screenshots: 1280×800 viewport, viewport-only crop (fullPage: false).
 * CWS requires exactly 1280×800 — no full-page scrolling.
 */
async function screenshotPanel(browser, baseUrl) {
  console.log('📸 Screenshotting DevTools panel (preview tab)...')

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
  })

  const page = await context.newPage()
  await page.addInitScript(panelMockScript(MOCK_CONSOLE_LOGS, MOCK_NETWORK_ENTRIES, MOCK_SETTINGS))

  await page.goto(`${baseUrl}/panel/index.html`)

  // Wait for React to mount, consent check, and data capture
  await page.waitForSelector('#root > div', { timeout: 15000 })
  await page.waitForTimeout(2000) // Wait for initial capture + render

  // Try to expand the filters panel for a richer screenshot
  try {
    const filterToggle = await page.$('[data-testid="filters-panel-toggle"]')
    if (filterToggle) {
      await filterToggle.click()
      await page.waitForTimeout(300)
    }
  } catch {
    // Filter toggle might not be present
  }

  // CWS: viewport-only crop at exactly 1280×800
  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, 'cws-panel-preview.png'),
    fullPage: false,
    type: 'png',
  })

  console.log('  ✓ cws-panel-preview.png')

  // Screenshot the routes tab
  console.log('📸 Screenshotting DevTools panel (routes tab)...')
  try {
    const routesTab = await page.$('[data-testid="tab-routes"]')
    if (routesTab) {
      await routesTab.click()
      await page.waitForTimeout(500)
    }
  } catch {
    console.log('  ⚠ Could not switch to Routes tab')
  }

  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, 'cws-panel-routes.png'),
    fullPage: false,
    type: 'png',
  })

  console.log('  ✓ cws-panel-routes.png')

  // Go back to preview tab
  try {
    const previewTab = await page.$('[data-testid="tab-preview"]')
    if (previewTab) {
      await previewTab.click()
      await page.waitForTimeout(300)
    }
  } catch {
    // Ignore
  }

  // Try expanding a network entry to show response body
  try {
    // Find a network entry button (they have ▶ indicators)
    const expandButtons = await page.$$('button:has-text("▶")')
    if (expandButtons.length > 0) {
      await expandButtons[0].click()
      await page.waitForTimeout(300)
    }
  } catch {
    // Ignore
  }

  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, 'cws-panel-expanded.png'),
    fullPage: false,
    type: 'png',
  })

  console.log('  ✓ cws-panel-expanded.png')
  await context.close()
}

/**
 * CWS preview screenshot: 1280×800 viewport, viewport-only crop.
 */
async function screenshotPreview(browser, baseUrl) {
  console.log('📸 Screenshotting preview pane...')

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
  })

  const page = await context.newPage()
  await page.addInitScript(previewMockScript(MOCK_MARKDOWN))

  // The preview reads an `id` param from URL
  await page.goto(`${baseUrl}/preview/preview.html?id=preview-mock-123`)

  await page.waitForSelector('#root', { timeout: 15000 })
  await page.waitForTimeout(1500)

  // CWS: viewport-only crop at exactly 1280×800
  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, 'cws-preview-markdown.png'),
    fullPage: false,
    type: 'png',
  })

  console.log('  ✓ cws-preview-markdown.png')
  await context.close()
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('Loggy Chrome Extension — CWS Screenshot Generator')
  console.log('='.repeat(55))
  console.log()

  // Create output directory
  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true })
  }

  // Verify dist-chrome exists
  if (!fs.existsSync(DIST_CHROME)) {
    console.error('ERROR: dist-chrome not found at', DIST_CHROME)
    console.error('Run "npm run build:chrome" first.')
    process.exit(1)
  }

  // Start HTTP server to serve dist-chrome/ — Chromium blocks file:// for ES modules
  console.log('🌐 Starting HTTP server for dist-chrome/...')
  const { server, port } = await startServer(DIST_CHROME)
  const baseUrl = `http://127.0.0.1:${port}`
  console.log(`   Serving at ${baseUrl}`)
  console.log()

  const browser = await chromium.launch({
    headless: true,
  })

  try {
    await screenshotPopup(browser, baseUrl)
    await screenshotPanel(browser, baseUrl)
    await screenshotPreview(browser, baseUrl)

    console.log()
    console.log('✅ All screenshots saved to:', SCREENSHOTS_DIR)
    console.log()
    console.log('Generated files:')
    fs.readdirSync(SCREENSHOTS_DIR)
      .filter(f => f.startsWith('cws-') && f.endsWith('.png'))
      .forEach(f => {
        const stat = fs.statSync(path.join(SCREENSHOTS_DIR, f))
        const sizeKB = (stat.size / 1024).toFixed(1)
        console.log(`  ${f} (${sizeKB} KB)`)
      })
  } finally {
    await browser.close()
    server.close()
  }
}

main().catch(err => {
  console.error('Screenshot generation failed:', err)
  process.exit(1)
})
