# BrowserAPI Surface Audit

One row per surface on the `BrowserAPI` interface and its sub-interfaces. Columns:
- **Surface**: dotted path on `BrowserAPI` (e.g., `runtime.sendMessage`)
- **chrome.\* path**: the underlying chrome API call shape
- **browser.\* path**: the Firefox browser.\* equivalent (or "n/a" if unsupported)
- **Firefox contexts**: where this surface works on Firefox (bg SW / panel / popup / content / FAB), or "-" if unsupported

## Legend
- **EventSink** = object with `addListener`/`removeListener`/`hasListener` (identity-preserving — D14).
- **D10 hybrid** = Promise-returning overload is canonical; callback overload preserved for legacy call sites.
- **D13** = `runtime.sendMessage` / `tabs.sendMessage` use a callback-form wrapper that surfaces `runtime.lastError` as a Promise rejection.
- **Firefox unsupported** = the surface is not available on Firefox. Promise-returning methods (`attach`/`detach`/`sendCommand`) reject with an "Unsupported on Firefox" error; EventSink `addListener` surfaces throw synchronously to match the `void` return contract (D14).

| # | Surface | chrome.* path | browser.* path | Firefox contexts |
|---|---|---|---|---|
| 1 | `runtime.sendMessage` | `chrome.runtime.sendMessage(msg, cb?)` (D13) | `browser.runtime.sendMessage(msg, cb?)` → wrapped Promise (D13) — same `sendMessageWithLastError` callback pattern as chrome.ts | bg SW, panel, popup, content, FAB |
| 2 | `runtime.lastError` | `chrome.runtime.lastError` (property) | `browser.runtime.lastError` (Firefox compat shim) | bg SW, panel, popup, content, FAB |
| 3 | `runtime.getURL` | `chrome.runtime.getURL(path)` | `browser.runtime.getURL(path)` | bg SW, panel, popup, content, FAB |
| 4 | `runtime.connect` | `chrome.runtime.connect(connectInfo?)` | `browser.runtime.connect(connectInfo?)` | bg SW, panel, popup, content, FAB |
| 5 | `runtime.onMessage` | `chrome.runtime.onMessage.addListener(fn)` (EventSink) | `browser.runtime.onMessage` (EventSink) | bg SW, panel, popup, content, FAB |
| 6 | `runtime.onConnect` | `chrome.runtime.onConnect.addListener(fn)` (EventSink) | `browser.runtime.onConnect` (EventSink) | bg SW, panel, popup, content, FAB |
| 7 | `runtime.onInstalled` | `chrome.runtime.onInstalled.addListener(fn)` (EventSink) | `browser.runtime.onInstalled` (EventSink) | bg SW, panel, popup, content, FAB |
| 8 | `runtime.onStartup` | `chrome.runtime.onStartup.addListener(fn)` (EventSink) | `browser.runtime.onStartup` (EventSink) | bg SW, panel, popup, content, FAB |
| 9 | `runtime.getPlatformInfo` | `chrome.runtime.getPlatformInfo(cb)` → wrapped Promise | `browser.runtime.getPlatformInfo()` (Promise) | bg SW, panel, popup |
| 10 | `storage.local.get` | `chrome.storage.local.get(keys, cb?)` (D10 hybrid) | `browser.storage.local.get(keys, cb?)` (D10 hybrid) | bg SW, panel, popup |
| 11 | `storage.local.set` | `chrome.storage.local.set(items, cb?)` (D10 hybrid) | `browser.storage.local.set(items, cb?)` (D10 hybrid) | bg SW, panel, popup |
| 12 | `storage.session.get` | `chrome.storage.session.get(keys)` | `browser.storage.session.get(keys)` | bg SW, panel, popup |
| 13 | `storage.session.set` | `chrome.storage.session.set(items)` | `browser.storage.session.set(items)` | bg SW, panel, popup |
| 14 | `storage.session.remove` | `chrome.storage.session.remove(keys)` | `browser.storage.session.remove(keys)` | bg SW, panel, popup |
| 15 | `storage.onChanged` | `chrome.storage.onChanged.addListener(fn)` (EventSink) | `browser.storage.onChanged` (EventSink) | bg SW, panel, popup, content |
| 16 | `tabs.query` | `chrome.tabs.query(queryInfo)` | `browser.tabs.query(queryInfo)` | bg SW, panel, popup |
| 17 | `tabs.get` | `chrome.tabs.get(tabId)` | `browser.tabs.get(tabId)` | bg SW, panel, popup |
| 18 | `tabs.create` | `chrome.tabs.create(createProperties)` | `browser.tabs.create(createProperties)` | bg SW, panel, popup |
| 19 | `tabs.sendMessage` | `chrome.tabs.sendMessage(tabId, msg, cb?)` (D13) | `browser.tabs.sendMessage(tabId, msg, cb?)` → wrapped Promise (D13) — same `sendMessageWithLastError` callback pattern as chrome.ts | bg SW, panel, popup, content, FAB |
| 20 | `tabs.onRemoved` | `chrome.tabs.onRemoved.addListener(fn)` (EventSink) | `browser.tabs.onRemoved` (EventSink) | bg SW, panel, popup |
| 21 | `tabs.onActivated` | `chrome.tabs.onActivated.addListener(fn)` (EventSink) | `browser.tabs.onActivated` (EventSink) | bg SW, panel, popup |
| 22 | `tabs.onUpdated` | `chrome.tabs.onUpdated.addListener(fn)` (EventSink) | `browser.tabs.onUpdated` (EventSink) | bg SW, panel, popup |
| 23 | `debugger.attach` | `chrome.debugger.attach(target, version)` | n/a (rejected Promise "Unsupported on Firefox") | - |
| 24 | `debugger.detach` | `chrome.debugger.detach(target)` | n/a (rejected Promise "Unsupported on Firefox") | - |
| 25 | `debugger.sendCommand` | `chrome.debugger.sendCommand(target, method, params?)` | n/a (rejected Promise "Unsupported on Firefox") | - |
| 26 | `debugger.onEvent` | `chrome.debugger.onEvent.addListener(fn)` (EventSink) | n/a (`addListener` throws synchronously "Unsupported on Firefox"; `removeListener`/`hasListener` no-op) | - |
| 27 | `debugger.onDetach` | `chrome.debugger.onDetach.addListener(fn)` (EventSink) | n/a (`addListener` throws synchronously "Unsupported on Firefox"; `removeListener`/`hasListener` no-op) | - |
| 28 | `scripting.executeScript` | `chrome.scripting.executeScript(injection)` | `browser.scripting.executeScript(injection)` | bg SW, panel, popup |
| 29 | `scripting.registerContentScripts` | `chrome.scripting.registerContentScripts(scripts)` | `browser.scripting.registerContentScripts(scripts)` | bg SW |
| 30 | `scripting.unregisterContentScripts` | `chrome.scripting.unregisterContentScripts(filter?)` | `browser.scripting.unregisterContentScripts(filter?)` | bg SW |
| 31 | `scripting.getRegisteredContentScripts` | `chrome.scripting.getRegisteredContentScripts(filter?)` | `browser.scripting.getRegisteredContentScripts(filter?)` | bg SW |
| 32 | `action.setIcon` | `chrome.action.setIcon(details)` | `browser.action.setIcon(details)` | bg SW, popup |
| 33 | `alarms.create(alarmInfo)` | `chrome.alarms.create(alarmInfo)` | `browser.alarms.create(alarmInfo)` | bg SW |
| 34 | `alarms.create(name, alarmInfo)` | `chrome.alarms.create(name, alarmInfo)` | `browser.alarms.create(name, alarmInfo)` | bg SW |
| 35 | `alarms.clear` | `chrome.alarms.clear(name?)` | `browser.alarms.clear(name?)` | bg SW |
| 36 | `alarms.onAlarm` | `chrome.alarms.onAlarm.addListener(fn)` (EventSink) | `browser.alarms.onAlarm` (EventSink) | bg SW |
| 37 | `devtools.inspectedWindow.tabId` | `chrome.devtools.inspectedWindow.tabId` | `browser.devtools.inspectedWindow.tabId` (readonly getter) | panel |
| 38 | `devtools.inspectedWindow.eval` | `chrome.devtools.inspectedWindow.eval(expr, cb?)` (D10 hybrid) | `browser.devtools.inspectedWindow.eval(expr, cb?)` (D10 hybrid) | panel |
| 39 | `devtools.network.getHAR` | `chrome.devtools.network.getHAR(cb)` → wrapped Promise | `browser.devtools.network.getHAR()` (native Promise) | panel |
| 40 | `devtools.network.onRequestFinished` | `chrome.devtools.network.onRequestFinished.addListener(fn)` (EventSink) | `browser.devtools.network.onRequestFinished` (EventSink) | panel |
| 41 | `devtools.network.onNavigated` | `chrome.devtools.network.onNavigated.addListener(fn)` (EventSink) | `browser.devtools.network.onNavigated` (EventSink) | panel |
| 42 | `devtools.panels.create` | `chrome.devtools.panels.create(title, icon, page, cb)` → wrapped Promise | `browser.devtools.panels.create(title, icon, page)` (native Promise) | panel |
| 43 | `runtime.connect` → `port.name` | `chrome.runtime.Port.name` | `browser.runtime.Port.name` | bg SW, panel, popup, content |
| 44 | `runtime.connect` → `port.postMessage` | `chrome.runtime.Port.postMessage(msg)` | `browser.runtime.Port.postMessage(msg)` | bg SW, panel, popup, content |
| 45 | `runtime.connect` → `port.onDisconnect` | `chrome.runtime.Port.onDisconnect.addListener(fn)` (EventSink) | `browser.runtime.Port.onDisconnect` (EventSink) | bg SW, panel, popup, content |
| 46 | `runtime.connect` → `port.onMessage` | `chrome.runtime.Port.onMessage.addListener(fn)` (EventSink) | `browser.runtime.Port.onMessage` (EventSink) | bg SW, panel, popup, content |
| 47 | `runtime.connect` → `port.disconnect` | `chrome.runtime.Port.disconnect()` | `browser.runtime.Port.disconnect()` | bg SW, panel, popup, content |

## Firefox Contexts Key

| Context | Description |
|---------|-------------|
| **bg SW** | Background service worker (the persistent script) |
| **panel** | DevTools panel page |
| **popup** | Extension popup (browserAction popup) |
| **content** | Content script (runs in-page) |
| **FAB** | Firefox Android Floating Action Button |
| **-** | Surface not available on Firefox |
