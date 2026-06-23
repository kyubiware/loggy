/**
 * BrowserAPI abstraction — type contract.
 *
 * Defines the unified `BrowserAPI` interface that the extension uses to talk
 * to browser-specific extension APIs.
 *
 * Composition:
 *   BrowserAPI
 *     ├── runtime    (RuntimeAPI)
 *     ├── storage    (StorageAPI = LocalAPI + SessionAPI + OnChangedAPI)
 *     ├── tabs       (TabsAPI)
 *     ├── debugger   (DebuggerAPI)
 *     ├── scripting  (ScriptingAPI)
 *     ├── action     (ActionAPI)
 *     ├── alarms     (AlarmsAPI)
 *     └── devtools   (DevToolsAPI)
 *
 * The `EventSink<TListener>` generic is the universal listener-binding
 * shape: addListener / removeListener / hasListener with identity
 * preservation.
 */
import type { HARLog } from '../types/har';

// ---------------------------------------------------------------------------
// Chrome type re-exports
// ---------------------------------------------------------------------------

export type MessageSender = chrome.runtime.MessageSender;
export type Port = chrome.runtime.Port;
export type ChromePort = chrome.runtime.Port;
export type Debuggee = chrome.debugger.Debuggee;
export type StorageChange = chrome.storage.StorageChange;
export type RegisteredContentScript = chrome.scripting.RegisteredContentScript;
export type ExecutionWorld = chrome.scripting.ExecutionWorld;
export type EvaluationExceptionInfo = chrome.devtools.inspectedWindow.EvaluationExceptionInfo;

// ---------------------------------------------------------------------------
// EventSink — universal listener-binding shape
// ---------------------------------------------------------------------------

export interface EventSink<TListener extends (...args: any[]) => void> {
  addListener(listener: TListener): void;
  removeListener(listener: TListener): void;
  hasListener(listener: TListener): boolean;
}

// ---------------------------------------------------------------------------
// BrowserPort — port surface
// ---------------------------------------------------------------------------

export interface BrowserPort {
  name: string;
  postMessage(message: unknown): void;
  disconnect(): void;
  onDisconnect: chrome.events.Event<(port: BrowserPort) => void>;
  onMessage: chrome.events.Event<(message: unknown, port: BrowserPort) => void>;
}

// ---------------------------------------------------------------------------
// DevToolsNetworkRequest — preserved legacy shape
// ---------------------------------------------------------------------------

export interface DevToolsNetworkRequest {
  request: { url: string };
  response: { content?: { mimeType?: string } };
  startedDateTime: string;
  getContent(callback: (content: string, encoding: string) => void): void;
}

// ---------------------------------------------------------------------------
// RuntimeAPI
// ---------------------------------------------------------------------------

export interface RuntimeAPI {
  sendMessage<TResponse = unknown>(message: unknown): Promise<TResponse>;
  readonly lastError: chrome.runtime.LastError | undefined;
  getURL(path: string): string;
  connect(connectInfo?: { name?: string }): BrowserPort;
  onMessage: EventSink<
    (message: unknown, sender: MessageSender, sendResponse: (response?: unknown) => void) => boolean | void
  >;
  onConnect: EventSink<(port: BrowserPort) => void>;
  onInstalled: EventSink<(details: chrome.runtime.InstalledDetails) => void>;
  onStartup: EventSink<() => void>;
  getPlatformInfo(): Promise<chrome.runtime.PlatformInfo>;
}

// ---------------------------------------------------------------------------
// StorageAPI (LocalAPI + SessionAPI + OnChangedAPI)
// ---------------------------------------------------------------------------

export interface LocalStorageAPI {
  get<T = Record<string, unknown>>(keys: string | string[] | null): Promise<T>;
  get<T = Record<string, unknown>>(keys: string | string[] | null, callback: (items: T) => void): void;
  set(items: Record<string, unknown>): Promise<void>;
  set(items: Record<string, unknown>, callback: () => void): void;
}

export interface SessionStorageAPI {
  get<T = Record<string, unknown>>(keys: string | string[] | null): Promise<T>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string | string[]): Promise<void>;
}

export interface StorageAPI {
  local: LocalStorageAPI;
  session: SessionStorageAPI;
  onChanged: EventSink<
    (changes: Record<string, StorageChange>, areaName: 'local' | 'session' | 'sync' | 'managed') => void
  >;
}

// ---------------------------------------------------------------------------
// TabsAPI
// ---------------------------------------------------------------------------

export interface TabsAPI {
  query(queryInfo: chrome.tabs.QueryInfo): Promise<chrome.tabs.Tab[]>;
  get(tabId: number): Promise<chrome.tabs.Tab>;
  create(createProperties: chrome.tabs.CreateProperties): Promise<chrome.tabs.Tab>;
  sendMessage<TResponse = unknown>(tabId: number, message: unknown): Promise<TResponse>;
  onRemoved: EventSink<(tabId: number, removeInfo: { windowId: number; isWindowClosing: boolean }) => void>;
  onActivated: EventSink<(activeInfo: { tabId: number; windowId: number }) => void>;
  onUpdated: EventSink<(tabId: number, changeInfo: chrome.tabs.OnUpdatedInfo, tab: chrome.tabs.Tab) => void>;
}

// ---------------------------------------------------------------------------
// DebuggerAPI
// ---------------------------------------------------------------------------

export interface DebuggerAPI {
  attach(target: Debuggee, protocolVersion: string): Promise<void>;
  detach(target: Debuggee): Promise<void>;
  sendCommand(target: Debuggee, method: string, params?: object): Promise<object | undefined>;
  onEvent: EventSink<(source: Debuggee, method: string, params?: object) => void>;
  onDetach: EventSink<(source: Debuggee, reason: string) => void>;
}

// ---------------------------------------------------------------------------
// ScriptingAPI
// ---------------------------------------------------------------------------

export interface ScriptingAPI {
  executeScript(injection: chrome.scripting.ScriptInjection<unknown[], unknown>): Promise<
    chrome.scripting.InjectionResult<unknown>[]
  >;
  registerContentScripts(scripts: RegisteredContentScript[]): Promise<void>;
  unregisterContentScripts(filter?: { ids?: string[] }): Promise<void>;
  getRegisteredContentScripts(filter?: { ids?: string[] }): Promise<RegisteredContentScript[]>;
}

// ---------------------------------------------------------------------------
// ActionAPI
// ---------------------------------------------------------------------------

export interface ActionAPI {
  setIcon(details: chrome.action.TabIconDetails): Promise<void>;
}

// ---------------------------------------------------------------------------
// AlarmsAPI
// ---------------------------------------------------------------------------

export interface AlarmsAPI {
  create(alarmInfo: chrome.alarms.AlarmCreateInfo): Promise<void>;
  create(name: string, alarmInfo: chrome.alarms.AlarmCreateInfo): Promise<void>;
  clear(name?: string): Promise<boolean>;
  onAlarm: EventSink<(alarm: chrome.alarms.Alarm) => void>;
}

// ---------------------------------------------------------------------------
// DevToolsAPI
// ---------------------------------------------------------------------------

export interface DevToolsAPI {
  inspectedWindow: {
    readonly tabId: number;
    eval(expression: string): Promise<{ result?: unknown; exceptionInfo?: EvaluationExceptionInfo }>;
    eval(
      expression: string,
      callback: (result: unknown, exceptionInfo: EvaluationExceptionInfo) => void,
    ): void;
  };
  network: {
    getHAR(): Promise<HARLog>;
    onRequestFinished: EventSink<(request: DevToolsNetworkRequest) => void>;
    onNavigated: EventSink<(url: string) => void>;
  };
  panels: {
    create(title: string, iconPath: string, pagePath: string): Promise<chrome.devtools.panels.ExtensionPanel>;
  };
}

// ---------------------------------------------------------------------------
// Top-level composition
// ---------------------------------------------------------------------------

export interface BrowserAPI {
  runtime: RuntimeAPI;
  storage: StorageAPI;
  tabs: TabsAPI;
  debugger: DebuggerAPI;
  scripting: ScriptingAPI;
  action: ActionAPI;
  alarms: AlarmsAPI;
  devtools: DevToolsAPI;
}
