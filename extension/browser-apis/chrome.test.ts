/**
 * Unit tests for the Chrome implementation of the `BrowserAPI` contract.
 *
 * Verifies the surfaces whose wrappers do more than forward the call:
 *  - `runtime.sendMessage` / `tabs.sendMessage` reject with
 *    `chrome.runtime.lastError` when set (D13).
 *  - `storage.session.get` returns a Promise that resolves with the items.
 *  - `storage.local.get` supports both the Promise overload and the legacy
 *    callback overload (D10 hybrid).
 *  - `EventSink` fields forward the listener reference unchanged (D14).
 *  - `runtime.connect` returns a value assignable to `BrowserPort`.
 *
 * `chromeBrowser` captures `chrome.*` references at ES-module load time.
 * Each test calls `vi.resetModules()` in `beforeEach` and then dynamically
 * imports `./chrome`, so the freshly-evaluated module picks up whatever
 * mock state the test has installed on `globalThis.chrome`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BrowserPort } from './types';

/**
 * Re-import `./chrome` so the top-level `chromeBrowser` binding captures the
 * current `globalThis.chrome` mock state. Must be called after any per-test
 * mock overrides.
 */
async function loadBrowser() {
  const mod = await import('./chrome');
  return mod.chromeBrowser;
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

describe('chromeBrowser', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  describe('runtime.sendMessage — D13 lastError contract', () => {
    const originalSendMessage = chrome.runtime.sendMessage;
    afterEach(() => {
      chrome.runtime.sendMessage = originalSendMessage;
      // Tests set lastError via cast; clear it so later tests start clean.
      const runtime = chrome.runtime as { lastError?: unknown };
      delete runtime.lastError;
    });

    it('resolves with the response when chrome.runtime.lastError is unset', async () => {
      chrome.runtime.sendMessage = vi.fn(
        (_message: unknown, callback?: (response: unknown) => void) => {
          // Mirror real Chrome: callback fires synchronously with the response.
          if (callback) callback({ ok: true });
          return Promise.resolve({ ok: true });
        },
      ) as typeof chrome.runtime.sendMessage;

      const browser = await loadBrowser();

      await expect(browser.runtime.sendMessage('ping')).resolves.toEqual({ ok: true });
    });

    it('rejects with the chrome.runtime.lastError value when it is set', async () => {
      const testError = new Error(
        'Could not establish connection. Receiving end does not exist.',
      );
      chrome.runtime.sendMessage = vi.fn(
        (_message: unknown, callback?: (response: unknown) => void) => {
          // Real Chrome populates lastError synchronously before dispatching
          // the callback; mirror that here so the wrapper observes it.
          (chrome.runtime as { lastError?: Error }).lastError = testError;
          if (callback) callback(undefined);
          return Promise.resolve(undefined);
        },
      ) as typeof chrome.runtime.sendMessage;

      const browser = await loadBrowser();

      await expect(browser.runtime.sendMessage('ping')).rejects.toBe(testError);
    });
  });

  describe('storage.session — Promise wrapper', () => {
    const originalGet = chrome.storage.session.get;
    afterEach(() => {
      chrome.storage.session.get = originalGet;
    });

    it('get resolves with the items returned by chrome.storage.session.get', async () => {
      const items = { sessionKey: 'session-value' };
      chrome.storage.session.get = vi.fn(
        () => Promise.resolve(items),
      ) as typeof chrome.storage.session.get;

      const browser = await loadBrowser();

      await expect(browser.storage.session.get('sessionKey')).resolves.toEqual(items);
    });
  });

  describe('storage.local.get — D10 hybrid overloads', () => {
    const originalGet = chrome.storage.local.get;
    afterEach(() => {
      chrome.storage.local.get = originalGet;
    });

    it('Promise overload resolves with items when no callback is supplied', async () => {
      const items = { localKey: 'local-value' };
      chrome.storage.local.get = vi.fn(
        (_keys: unknown, callback?: (items: unknown) => void) => {
          if (callback) {
            callback(items);
            return;
          }
          return Promise.resolve(items);
        },
      ) as typeof chrome.storage.local.get;

      const browser = await loadBrowser();

      await expect(browser.storage.local.get('localKey')).resolves.toEqual(items);
    });

    it('callback overload invokes the callback with items and returns void', async () => {
      const items = { localKey: 'local-value' };
      chrome.storage.local.get = vi.fn(
        (_keys: unknown, callback?: (items: unknown) => void) => {
          if (callback) callback(items);
        },
      ) as typeof chrome.storage.local.get;

      const browser = await loadBrowser();
      const cb = vi.fn();

      const result = browser.storage.local.get('localKey', cb);

      expect(result).toBeUndefined();
      expect(cb).toHaveBeenCalledWith(items);
    });
  });

  describe('EventSink identity preservation — D14', () => {
    it('passes the same listener reference through to the underlying chrome event', async () => {
      const browser = await loadBrowser();
      const sink = browser.runtime.onMessage;

      // eventSink() returns the underlying chrome.events.Event unchanged;
      // prove the wrapper did not clone or curry it.
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
      // close a long-lived port. The native chrome.runtime.Port provides it;
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
