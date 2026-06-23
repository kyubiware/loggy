/**
 * Chrome implementation of the `BrowserAPI` interface.
 *
 * T3 scope: full implementation per the design contract in `types.ts`.
 *  - `runtime.sendMessage` / `tabs.sendMessage`: callback-form wrappers
 *    that reject with `chrome.runtime.lastError` when set (D13). Chrome's
 *    native Promise form does not surface lastError reliably across
 *    versions, so the callback overload is used and wrapped into a Promise.
 *  - All `EventSink` fields forward listener references unchanged (D14):
 *    `chrome.events.Event` already preserves identity, so `eventSink` is
 *    a typed pass-through.
 *  - D10 hybrid Promise + callback overloads on `storage.local.get/set`
 *    and `devtools.inspectedWindow.eval`.
 */
import type { HARLog } from '../types/har';
import type { BrowserAPI, DevToolsNetworkRequest } from './types';

/**
 * Identity wrapper around a `chrome.events.Event`. `chrome.events.Event`
 * already exposes addListener/removeListener/hasListener with identity
 * preservation (D14), so the wrapper just forwards the reference.
 */
function eventSink<TListener extends (...args: any[]) => void>(
  source: chrome.events.Event<TListener>,
): chrome.events.Event<TListener> {
  return source;
}

/**
 * Send a single message and surface `chrome.runtime.lastError` (D13) as a
 * Promise rejection. Chrome's native Promise form does not consistently
 * reject when lastError is set across Chrome versions, so the callback
 * overload is used internally; `lastError` is read synchronously inside
 * the callback (the only point at which Chrome populates it).
 */
function sendMessageWithLastError<TResponse>(
  sender: (message: unknown, callback: (response: TResponse) => void) => void,
  message: unknown,
): Promise<TResponse> {
  return new Promise<TResponse>((resolve, reject) => {
    sender(message, (response: TResponse) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(response);
      }
    });
  });
}

export const chromeBrowser: BrowserAPI = {
  runtime: {
    sendMessage: <TResponse>(message: unknown) =>
      sendMessageWithLastError<TResponse>(
        (msg, cb) => chrome.runtime.sendMessage(msg, cb),
        message,
      ),
    get lastError() {
      return chrome.runtime.lastError;
    },
    getURL: (path) => chrome.runtime.getURL(path),
    connect: (connectInfo) => chrome.runtime.connect(connectInfo),
    onMessage: eventSink(chrome.runtime.onMessage),
    onConnect: eventSink(chrome.runtime.onConnect),
    onInstalled: eventSink(chrome.runtime.onInstalled),
    onStartup: eventSink(chrome.runtime.onStartup),
    getPlatformInfo: () => chrome.runtime.getPlatformInfo(),
  },
  storage: {
    local: {
      // D10 hybrid: dispatch on argument count to keep both the Promise
      // canonical variant and the legacy callback variant.
      get: ((keys: string | string[] | null, callback?: (items: any) => void) => {
        if (callback) {
          chrome.storage.local.get(keys as never, callback);
          return;
        }
        return chrome.storage.local.get(keys as never);
      }) as BrowserAPI['storage']['local']['get'],
      set: ((items: Record<string, unknown>, callback?: () => void) => {
        if (callback) {
          chrome.storage.local.set(items, callback);
          return;
        }
        return chrome.storage.local.set(items);
      }) as BrowserAPI['storage']['local']['set'],
    },
    session: {
      // @types/chrome uses `NoInferX<keyof T>` on get/remove, which blocks
      // plain `string | string[] | null` arguments. Runtime accepts all three;
      // cast through `never` is the documented workaround.
      get: ((keys: string | string[] | null) =>
        chrome.storage.session.get(keys as never)) as BrowserAPI['storage']['session']['get'],
      set: (items) => chrome.storage.session.set(items),
      remove: (keys) => chrome.storage.session.remove(keys as never),
    },
    onChanged: eventSink(chrome.storage.onChanged),
  },
  tabs: {
    query: (queryInfo) => chrome.tabs.query(queryInfo),
    get: (tabId) => chrome.tabs.get(tabId),
    create: (createProperties) => chrome.tabs.create(createProperties),
    sendMessage: <TResponse>(tabId: number, message: unknown) =>
      sendMessageWithLastError<TResponse>(
        (msg, cb) => chrome.tabs.sendMessage(tabId, msg, cb),
        message,
      ),
    onRemoved: eventSink(chrome.tabs.onRemoved),
    onActivated: eventSink(chrome.tabs.onActivated),
    onUpdated: eventSink(chrome.tabs.onUpdated),
  },
  debugger: {
    attach: (target, protocolVersion) => chrome.debugger.attach(target, protocolVersion),
    detach: (target) => chrome.debugger.detach(target),
    // chrome.debugger.sendCommand's @types param shape `{ [key: string]: unknown }`
    // is narrower than our `object`; narrow via cast at the call boundary.
    sendCommand: (target, method, params) =>
      chrome.debugger.sendCommand(target, method, params as { [key: string]: unknown } | undefined),
    onEvent: eventSink(chrome.debugger.onEvent),
    onDetach: eventSink(chrome.debugger.onDetach),
  },
  scripting: {
    executeScript: (injection) => chrome.scripting.executeScript(injection),
    registerContentScripts: (scripts) => chrome.scripting.registerContentScripts(scripts),
    unregisterContentScripts: (filter) => chrome.scripting.unregisterContentScripts(filter),
    getRegisteredContentScripts: (filter) => chrome.scripting.getRegisteredContentScripts(filter),
  },
  action: {
    setIcon: (details) => chrome.action.setIcon(details),
  },
  alarms: {
    create: ((nameOrInfo: string | chrome.alarms.AlarmCreateInfo, maybeInfo?: chrome.alarms.AlarmCreateInfo) => {
      if (maybeInfo !== undefined) {
        return chrome.alarms.create(nameOrInfo as string, maybeInfo);
      }
      return chrome.alarms.create(nameOrInfo as chrome.alarms.AlarmCreateInfo);
    }) as BrowserAPI['alarms']['create'],
    clear: (name) => chrome.alarms.clear(name),
    onAlarm: eventSink(chrome.alarms.onAlarm),
  },
  devtools: {
    inspectedWindow: {
      get tabId() {
        return chrome.devtools.inspectedWindow.tabId;
      },
      // @types/chrome only declares the callback overload; the Promise variant
      // is implemented by wrapping the callback form (D10 hybrid).
      eval: ((expression: string, callback?: (result: unknown, exceptionInfo: any) => void) => {
        if (callback) {
          chrome.devtools.inspectedWindow.eval(expression, callback);
          return;
        }
        return new Promise<{ result?: unknown; exceptionInfo?: any }>((resolve) => {
          chrome.devtools.inspectedWindow.eval(expression, (result, exceptionInfo) => {
            resolve({ result, exceptionInfo });
          });
        });
      }) as BrowserAPI['devtools']['inspectedWindow']['eval'],
    },
    network: {
      // @types/chrome only declares the callback overload; wrap into a Promise.
      getHAR: () =>
        new Promise<HARLog>((resolve) => {
          chrome.devtools.network.getHAR((harLog) => {
            // HARFormatLog (chrome) is a superset of our minimal HARLog.
            resolve(harLog as unknown as HARLog);
          });
        }),
      onRequestFinished: eventSink(
        chrome.devtools.network.onRequestFinished as chrome.events.Event<
          (request: DevToolsNetworkRequest) => void
        >,
      ),
      onNavigated: eventSink(chrome.devtools.network.onNavigated),
    },
    panels: {
      // @types/chrome only declares the callback overload; wrap into a Promise.
      create: (title, iconPath, pagePath) =>
        new Promise<chrome.devtools.panels.ExtensionPanel>((resolve) => {
          chrome.devtools.panels.create(title, iconPath, pagePath, (panel) => resolve(panel));
        }),
    },
  },
};
