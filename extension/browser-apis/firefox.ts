/**
 * Firefox implementation of the `BrowserAPI` interface.
 *
 * T4 scope: full implementation mirroring the chrome.ts pattern. Differences
 *  vs. chrome.ts:
 *  - `runtime.sendMessage` / `tabs.sendMessage`: same D13 lastError callback
 *    wrapper as chrome.ts, but using the native `browser.*` API (the
 *    Firefox shim accepts the callback form and populates `lastError`).
 *  - `chrome.debugger` is unsupported on Firefox. `attach` / `detach` /
 *    `sendCommand` return rejected Promises (so `await`-based callers see a
 *    runtime failure with the correct type contract), while the
 *    EventSink-shaped `onEvent` / `onDetach` addListener surfaces throw
 *    synchronously (D14: addListener returns void, not a Promise).
 *  - Most other surfaces use `browser.*` directly (the native Firefox
 *    WebExtensions API) for symmetry with the Firefox DevTools panel
 *    context where `chrome.tabs` is undefined (moz-extension:// origin).
 *  - D10 hybrid Promise + callback overloads on `storage.local.get/set`
 *    and `devtools.inspectedWindow.eval`.
 */
import type { HARLog } from '../types/har';
import type { BrowserAPI, DevToolsNetworkRequest } from './types';

// `browser.*` is the native Firefox WebExtensions API. Typed via the same
// @types/chrome surface (Firefox's WebExtensions API is shape-compatible with
// chrome.* for the surfaces this abstraction exposes).
declare const browser: typeof chrome;

/**
 * Send a single message and surface `browser.runtime.lastError` (D13) as a
 * Promise rejection. Mirrors chrome.ts's `sendMessageWithLastError`:
 * uses the callback form internally so that `lastError` is observed
 * synchronously inside the callback (the only point at which the shim
 * populates it). Once the callback returns, the shim clears `lastError`,
 * so reading it after `await` on the native Promise form is unreliable.
 */
function sendMessageWithLastError<TResponse>(
  sender: (message: unknown, callback: (response: TResponse) => void) => void,
  message: unknown,
): Promise<TResponse> {
  return new Promise<TResponse>((resolve, reject) => {
    sender(message, (response: TResponse) => {
      if (browser.runtime.lastError) {
        reject(browser.runtime.lastError);
      } else {
        resolve(response);
      }
    });
  });
}

/**
 * Rejected-Promise stub for `chrome.debugger.*` surfaces that return
 * `Promise<void>` / `Promise<object>` per the `DebuggerAPI` contract.
 * Await-based callers see a runtime failure with the correct type shape.
 */
function rejectUnsupported(reason: string): Promise<never> {
  return Promise.reject(new Error(`[loggy] ${reason}`));
}

/**
 * Synchronous-throw stub for `chrome.debugger.*` EventSink surfaces. The
 * `addListener` signature returns `void`, so a Promise rejection would be
 * a contract violation (D14); a synchronous throw is the correct failure
 * signal for caller code that registers listeners.
 */
function throwSync(reason: string): never {
  throw new Error(`[loggy] ${reason}`);
}

const debuggerUnsupported = {
  attach: () => rejectUnsupported('chrome.debugger.attach is not supported on Firefox'),
  detach: () => rejectUnsupported('chrome.debugger.detach is not supported on Firefox'),
  sendCommand: () =>
    rejectUnsupported('chrome.debugger.sendCommand is not supported on Firefox'),
  onEvent: {
    addListener: () => throwSync('chrome.debugger.onEvent is not supported on Firefox'),
    removeListener: () => {},
    hasListener: () => false,
  },
  onDetach: {
    addListener: () => throwSync('chrome.debugger.onDetach is not supported on Firefox'),
    removeListener: () => {},
    hasListener: () => false,
  },
};

/**
 * Identity wrapper around a `chrome.events.Event` (also the browser.* shape).
 * Listener identity is preserved (D14).
 */
function eventSink<TListener extends (...args: any[]) => void>(
  source: chrome.events.Event<TListener>,
): chrome.events.Event<TListener> {
  return source;
}

export const firefoxBrowser: BrowserAPI = {
  runtime: {
    sendMessage: <TResponse>(message: unknown) =>
      sendMessageWithLastError<TResponse>(
        (msg, cb) => browser.runtime.sendMessage(msg as never, cb),
        message,
      ),
    get lastError() {
      return browser.runtime.lastError;
    },
    getURL: (path) => browser.runtime.getURL(path),
    connect: (connectInfo) => browser.runtime.connect(connectInfo),
    // Lazy getters: `firefoxBrowser` is a top-level export, so any value
    // assigned here is evaluated at module-load time. The browser-apis
    // barrel (`index.ts`) statically imports BOTH chrome.ts and firefox.ts;
    // Rollup then leaks orphan property accesses as side-effecting
    // statements into the wrong-browser bundle (e.g. `browser.runtime.X`
    // lands in the Chrome bundle, where the Firefox `browser` global does
    // not exist, and crashes with "browser is not defined"). Deferring every
    // `eventSink(global.X)` to a getter means module load is side-effect-free
    // regardless of which context the bundle ships to. The EventSink
    // contract is unchanged.
    get onMessage() {
      return eventSink(browser.runtime.onMessage);
    },
    get onConnect() {
      return eventSink(browser.runtime.onConnect);
    },
    get onInstalled() {
      return eventSink(browser.runtime.onInstalled);
    },
    get onStartup() {
      return eventSink(browser.runtime.onStartup);
    },
    getPlatformInfo: () => browser.runtime.getPlatformInfo(),
  },
  storage: {
    local: {
      // D10 hybrid: dispatch on argument count.
      get: ((keys: string | string[] | null, callback?: (items: any) => void) => {
        if (callback) {
          browser.storage.local.get(keys as never, callback);
          return;
        }
        return browser.storage.local.get(keys as never);
      }) as BrowserAPI['storage']['local']['get'],
      set: ((items: Record<string, unknown>, callback?: () => void) => {
        if (callback) {
          browser.storage.local.set(items, callback);
          return;
        }
        return browser.storage.local.set(items);
      }) as BrowserAPI['storage']['local']['set'],
    },
    session: {
      // @types/chrome uses NoInferX; runtime accepts string|string[]|null.
      get: ((keys: string | string[] | null) =>
        browser.storage.session.get(keys as never)) as BrowserAPI['storage']['session']['get'],
      set: (items) => browser.storage.session.set(items),
      remove: (keys) => browser.storage.session.remove(keys as never),
    },
    get onChanged() {
      return eventSink(browser.storage.onChanged);
    },
  },
  tabs: {
    // Use browser.tabs (native Firefox) — chrome.tabs is undefined in the
    // DevTools panel context under moz-extension:// origin.
    query: (queryInfo) => browser.tabs.query(queryInfo),
    get: (tabId) => browser.tabs.get(tabId),
    create: (createProperties) => browser.tabs.create(createProperties),
    sendMessage: <TResponse>(tabId: number, message: unknown) =>
      sendMessageWithLastError<TResponse>(
        (msg, cb) => browser.tabs.sendMessage(tabId, msg as never, cb),
        message,
      ),
    get onRemoved() {
      return eventSink(browser.tabs.onRemoved);
    },
    get onActivated() {
      return eventSink(browser.tabs.onActivated);
    },
    get onUpdated() {
      return eventSink(browser.tabs.onUpdated);
    },
  },
  debugger: debuggerUnsupported,
  scripting: {
    executeScript: (injection) => browser.scripting.executeScript(injection),
    registerContentScripts: (scripts) => browser.scripting.registerContentScripts(scripts),
    unregisterContentScripts: (filter) => browser.scripting.unregisterContentScripts(filter),
    getRegisteredContentScripts: (filter) =>
      browser.scripting.getRegisteredContentScripts(filter),
  },
  action: {
    setIcon: (details) => browser.action.setIcon(details),
  },
  alarms: {
    create: ((nameOrInfo: string | chrome.alarms.AlarmCreateInfo, maybeInfo?: chrome.alarms.AlarmCreateInfo) => {
      if (maybeInfo !== undefined) {
        return browser.alarms.create(nameOrInfo as string, maybeInfo);
      }
      return browser.alarms.create(nameOrInfo as chrome.alarms.AlarmCreateInfo);
    }) as BrowserAPI['alarms']['create'],
    clear: (name) => browser.alarms.clear(name),
    get onAlarm() {
      return eventSink(browser.alarms.onAlarm);
    },
  },
  devtools: {
    inspectedWindow: {
      get tabId() {
        return browser.devtools.inspectedWindow.tabId;
      },
      // @types/chrome only declares the callback overload; wrap into Promise.
      eval: ((expression: string, callback?: (result: unknown, exceptionInfo: any) => void) => {
        if (callback) {
          browser.devtools.inspectedWindow.eval(expression, callback);
          return;
        }
        return new Promise<{ result?: unknown; exceptionInfo?: any }>((resolve) => {
          browser.devtools.inspectedWindow.eval(expression, (result, exceptionInfo) => {
            resolve({ result, exceptionInfo });
          });
        });
      }) as BrowserAPI['devtools']['inspectedWindow']['eval'],
    },
    network: {
      getHAR: () =>
        new Promise<HARLog>((resolve) => {
          browser.devtools.network.getHAR((harLog) => {
            resolve(harLog as unknown as HARLog);
          });
        }),
      // Lazy getters: `firefoxBrowser` is a top-level export, so the object
      // literal is evaluated at module-load time. Non-DevTools contexts
      // (popup, FAB, content scripts) have no `browser.devtools` — eager
      // access crashes those bundles. Deferring to a getter keeps the
      // EventSink contract while ensuring `browser.devtools.network` is
      // only touched in the DevTools panel context where it exists.
      get onRequestFinished() {
        return eventSink(
          browser.devtools.network.onRequestFinished as chrome.events.Event<
            (request: DevToolsNetworkRequest) => void
          >,
        );
      },
      get onNavigated() {
        return eventSink(browser.devtools.network.onNavigated);
      },
    },
    panels: {
      create: (title, iconPath, pagePath) =>
        new Promise<chrome.devtools.panels.ExtensionPanel>((resolve) => {
          browser.devtools.panels.create(title, iconPath, pagePath, (panel) => resolve(panel));
        }),
    },
  },
};
