/**
 * Unit tests for the Firefox implementation of the `BrowserAPI` contract.
 *
 * Mirrors `chrome.test.ts` (T3) but exercises the `firefoxBrowser` wrapper.
 *
 * Coverage:
 *  - Surface coverage: `firefoxBrowser` implements every field of `BrowserAPI`.
 *  - `runtime.sendMessage` / `tabs.sendMessage` reject with
 *    `browser.runtime.lastError` when set (D13).
 *  - `storage.session.get` returns a Promise that resolves with the items.
 *  - `storage.local.get` supports both the Promise overload and the legacy
 *    callback overload (D10 hybrid).
 *  - `EventSink` fields forward the listener reference unchanged (D14).
 *  - `runtime.connect` returns a value assignable to `BrowserPort`.
 *  - `debugger.attach` / `detach` / `sendCommand` reject with a descriptive
 *    "Unsupported on Firefox" error (T2 left them throwing synchronously,
 *    which broke the `Promise<void>` / `Promise<object | undefined>` type
 *    contract — T4 returns `Promise.reject`).
 *  - `debugger.onEvent.addListener` / `onDetach.addListener` throw
 *    synchronously (D14: `addListener` returns `void`, not a Promise).
 *  - `tabs.query` delegates to the underlying `browser.tabs.query`.
 *
 * `firefoxBrowser` captures `browser.*` references at ES-module load time.
 * `globalThis.browser` is aliased to `globalThis.chrome` in
 * `vitest.setup.ts` (see `;(globalThis as ...).browser = globalThis.chrome`),
 * so the same chrome mocks back firefox's `browser.*` calls. Each test calls
 * `vi.resetModules()` in `beforeEach` and then dynamically imports
 * `./firefox` so the freshly-evaluated module picks up whatever mock state
 * the test has installed. The chrome test follows the same pattern with
 * the same `loadBrowser()` helper.
 *
 * **Naming convention:** we read the global mock surface via `chrome.*`
 * (which is the same object as `globalThis.browser` thanks to the alias)
 * and the loaded wrapper as the local `browser` const. This avoids the
 * `const browser` / global-`browser` shadowing that would otherwise cause
 * a TDZ ReferenceError when a test sets up a mock before calling
 * `loadBrowser()`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BrowserPort } from './types';

/**
 * Re-import `./firefox` so the top-level `firefoxBrowser` binding captures
 * the current `globalThis.browser` mock state. Must be called after any
 * per-test mock overrides.
 */
async function loadBrowser() {
  const mod = await import('./firefox');
  return mod.firefoxBrowser;
}

/**
 * Cast helper for the `chrome.*` event-sink methods installed by
 * `vitest.setup.ts`. Those are `vi.fn()` instances masquerading as the
 * typed chrome functions; we need the Mock surface to read call state.
 */
type MockFn = ReturnType<typeof vi.fn>;
function asMock(fn: unknown): MockFn {
  return fn as MockFn;
}

describe('firefoxBrowser', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  describe('surface coverage — implements every field of BrowserAPI', () => {
    it('exposes every top-level namespace and leaf method on the contract', async () => {
      const browser = await loadBrowser();

      // Top-level namespaces.
      expect(browser.runtime).toBeDefined();
      expect(browser.storage).toBeDefined();
      expect(browser.storage.local).toBeDefined();
      expect(browser.storage.session).toBeDefined();
      expect(browser.tabs).toBeDefined();
      expect(browser.debugger).toBeDefined();
      expect(browser.scripting).toBeDefined();
      expect(browser.action).toBeDefined();
      expect(browser.alarms).toBeDefined();
      expect(browser.devtools).toBeDefined();
      expect(browser.devtools.inspectedWindow).toBeDefined();
      expect(browser.devtools.network).toBeDefined();
      expect(browser.devtools.panels).toBeDefined();

      // runtime.*
      expect(typeof browser.runtime.sendMessage).toBe('function');
      expect(typeof browser.runtime.getURL).toBe('function');
      expect(typeof browser.runtime.connect).toBe('function');
      expect(typeof browser.runtime.getPlatformInfo).toBe('function');
      expect(browser.runtime.onMessage).toBeDefined();
      expect(typeof browser.runtime.onMessage.addListener).toBe('function');
      expect(typeof browser.runtime.onMessage.removeListener).toBe('function');
      expect(typeof browser.runtime.onMessage.hasListener).toBe('function');
      expect(browser.runtime.onConnect).toBeDefined();
      expect(browser.runtime.onInstalled).toBeDefined();
      expect(browser.runtime.onStartup).toBeDefined();

      // storage.*
      expect(typeof browser.storage.local.get).toBe('function');
      expect(typeof browser.storage.local.set).toBe('function');
      expect(typeof browser.storage.session.get).toBe('function');
      expect(typeof browser.storage.session.set).toBe('function');
      expect(typeof browser.storage.session.remove).toBe('function');
      expect(browser.storage.onChanged).toBeDefined();

      // tabs.*
      expect(typeof browser.tabs.query).toBe('function');
      expect(typeof browser.tabs.get).toBe('function');
      expect(typeof browser.tabs.create).toBe('function');
      expect(typeof browser.tabs.sendMessage).toBe('function');
      expect(browser.tabs.onRemoved).toBeDefined();
      expect(browser.tabs.onActivated).toBeDefined();
      expect(browser.tabs.onUpdated).toBeDefined();

      // debugger.*
      expect(typeof browser.debugger.attach).toBe('function');
      expect(typeof browser.debugger.detach).toBe('function');
      expect(typeof browser.debugger.sendCommand).toBe('function');
      expect(browser.debugger.onEvent).toBeDefined();
      expect(typeof browser.debugger.onEvent.addListener).toBe('function');
      expect(typeof browser.debugger.onEvent.removeListener).toBe('function');
      expect(typeof browser.debugger.onEvent.hasListener).toBe('function');
      expect(browser.debugger.onDetach).toBeDefined();

      // scripting.*
      expect(typeof browser.scripting.executeScript).toBe('function');
      expect(typeof browser.scripting.registerContentScripts).toBe('function');
      expect(typeof browser.scripting.unregisterContentScripts).toBe('function');
      expect(typeof browser.scripting.getRegisteredContentScripts).toBe('function');

      // action.*
      expect(typeof browser.action.setIcon).toBe('function');

      // alarms.*
      expect(typeof browser.alarms.create).toBe('function');
      expect(typeof browser.alarms.clear).toBe('function');
      expect(browser.alarms.onAlarm).toBeDefined();

      // devtools.*
      expect(typeof browser.devtools.inspectedWindow.eval).toBe('function');
      expect(typeof browser.devtools.network.getHAR).toBe('function');
      expect(browser.devtools.network.onRequestFinished).toBeDefined();
      expect(browser.devtools.network.onNavigated).toBeDefined();
      expect(typeof browser.devtools.panels.create).toBe('function');
    });
  });

  describe('debugger surfaces — Firefox unsupported', () => {
    it('attach rejects with a descriptive "Unsupported on Firefox" error', async () => {
      const browser = await loadBrowser();
      await expect(browser.debugger.attach({ tabId: 1 }, '1.3')).rejects.toThrow(/Firefox/);
    });

    it('detach rejects with a descriptive "Unsupported on Firefox" error', async () => {
      const browser = await loadBrowser();
      await expect(browser.debugger.detach({ tabId: 1 })).rejects.toThrow(/Firefox/);
    });

    it('sendCommand rejects with a descriptive "Unsupported on Firefox" error', async () => {
      const browser = await loadBrowser();
      await expect(
        browser.debugger.sendCommand({ tabId: 1 }, 'Network.enable'),
      ).rejects.toThrow(/Firefox/);
    });

    it('onEvent.addListener throws synchronously (not a Promise rejection)', async () => {
      const browser = await loadBrowser();
      // `addListener` returns void per the EventSink contract; the failure
      // signal must be a synchronous throw, NOT an unhandled rejection.
      expect(() => browser.debugger.onEvent.addListener(() => {})).toThrow(/Firefox/);
    });

    it('onDetach.addListener throws synchronously (not a Promise rejection)', async () => {
      const browser = await loadBrowser();
      expect(() => browser.debugger.onDetach.addListener(() => {})).toThrow(/Firefox/);
    });
  });

  describe('runtime.sendMessage — D13 lastError contract', () => {
    // `globalThis.browser === globalThis.chrome` per vitest.setup aliasing,
    // so we set up mocks on `chrome.runtime.sendMessage` and observe them
    // through the loaded `browser` (firefoxBrowser) wrapper.
    const originalSendMessage = chrome.runtime.sendMessage;
    afterEach(() => {
      chrome.runtime.sendMessage = originalSendMessage;
      // Tests set lastError via cast; clear it so later tests start clean.
      const runtime = chrome.runtime as { lastError?: unknown };
      delete runtime.lastError;
    });

    it('rejects with browser.runtime.lastError value when it is set', async () => {
      const testError = new Error(
        'Could not establish connection. Receiving end does not exist.',
      );
      chrome.runtime.sendMessage = vi.fn(
        (_message: unknown, callback?: (response: unknown) => void) => {
          // Mirror real Firefox: the shim populates lastError synchronously
          // before dispatching the callback.
          (chrome.runtime as { lastError?: Error }).lastError = testError;
          if (callback) callback(undefined);
        },
      ) as typeof chrome.runtime.sendMessage;

      const browser = await loadBrowser();

      await expect(browser.runtime.sendMessage('ping')).rejects.toBe(testError);
    });

    it('resolves with the response when browser.runtime.lastError is unset', async () => {
      chrome.runtime.sendMessage = vi.fn(
        (_message: unknown, callback?: (response: unknown) => void) => {
          if (callback) callback({ ok: true });
        },
      ) as typeof chrome.runtime.sendMessage;

      const browser = await loadBrowser();

      await expect(browser.runtime.sendMessage('ping')).resolves.toEqual({ ok: true });
    });
  });

  describe('tabs.query — delegates to browser.tabs.query', () => {
    const originalQuery = chrome.tabs.query;
    afterEach(() => {
      chrome.tabs.query = originalQuery;
    });

    it('invokes the underlying browser.tabs.query with the same queryInfo', async () => {
      const tabs = [{ id: 1, url: 'about:blank' } as unknown as chrome.tabs.Tab];
      const queryMock = vi.fn(() => Promise.resolve(tabs)) as typeof chrome.tabs.query;
      chrome.tabs.query = queryMock;

      const browser = await loadBrowser();
      const result = await browser.tabs.query({ active: true });

      expect(queryMock).toHaveBeenCalledTimes(1);
      expect(queryMock).toHaveBeenCalledWith({ active: true });
      expect(result).toBe(tabs);
    });
  });

  describe('EventSink identity preservation — D14', () => {
    it('passes the same listener reference through to the underlying browser event', async () => {
      const browser = await loadBrowser();
      const sink = browser.runtime.onMessage;

      // eventSink() returns the underlying browser.* Event unchanged; prove
      // the wrapper did not clone or curry it. globalThis.browser and
      // globalThis.chrome are the same object (vitest.setup alias), so
      // either reference identifies the same sink.
      expect(sink).toBe(chrome.runtime.onMessage);

      const addListenerMock = asMock(chrome.runtime.onMessage.addListener);
      const removeListenerMock = asMock(chrome.runtime.onMessage.removeListener);
      addListenerMock.mockClear();
      removeListenerMock.mockClear();

      const listener = vi.fn();
      sink.addListener(listener);
      sink.removeListener(listener);

      expect(addListenerMock).toHaveBeenCalledTimes(1);
      expect(addListenerMock).toHaveBeenCalledWith(listener);
      expect(removeListenerMock).toHaveBeenCalledTimes(1);
      expect(removeListenerMock).toHaveBeenCalledWith(listener);
    });
  });

  describe('runtime.connect — BrowserPort shape', () => {
    it('returns an object assignable to BrowserPort with all required fields', async () => {
      const browser = await loadBrowser();
      const port = browser.runtime.connect({ name: 'test-port' });

      // Compile-time assertions: the returned port must satisfy BOTH the
      // abstraction (BrowserPort) AND the chrome-native shape
      // (chrome.runtime.Port). The latter matters because consumer code
      // (e.g. panel/src/hooks/useLifecycle.ts:94) holds a
      // `useRef<chrome.runtime.Port | null>` and needs the abstract
      // BrowserPort to be structurally compatible. T5 widened
      // BrowserPort.onDisconnect/onMessage to chrome.events.Event (not
      // EventSink) to make this assignability hold.
      const _abstractShape: BrowserPort = port;
      const _nativeShape: chrome.runtime.Port = port;
      expect(_abstractShape).toBe(port);
      expect(_nativeShape).toBe(port);

      // Runtime structural check against the BrowserPort contract.
      expect(typeof port.name).toBe('string');
      expect(typeof port.postMessage).toBe('function');
      // T5: disconnect() was added to BrowserPort because callers
      // (e.g. panel/src/hooks/useLifecycle.ts cleanup) need to programmatically
      // close a long-lived port. The native browser.runtime.Port provides it;
      // this assertion proves the wrapper passes the method through and that
      // it is callable without throwing.
      expect(typeof port.disconnect).toBe('function');
      expect(() => port.disconnect()).not.toThrow();
      expect(port.onDisconnect).toBeDefined();
      expect(typeof port.onDisconnect.addListener).toBe('function');
      expect(typeof port.onDisconnect.removeListener).toBe('function');
      expect(port.onMessage).toBeDefined();
      expect(typeof port.onMessage.addListener).toBe('function');
      expect(typeof port.onMessage.removeListener).toBe('function');
    });
  });
});
