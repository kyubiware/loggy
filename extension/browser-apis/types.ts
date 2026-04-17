import type { HARLog } from '../types/har';

export interface DevToolsNetworkRequest {
  request: { url: string };
  response: { content?: { mimeType?: string } };
  startedDateTime: string;
  getContent(callback: (content: string, encoding: string) => void): void;
}

export interface BrowserDevToolsAPI {
  inspectedWindow: {
    eval: (code: string, callback: (result: unknown, exception: unknown) => void) => void;
  };
  network: {
    getHAR: (callback: (harLog: HARLog) => void) => void;
    onRequestFinished: {
      addListener: (callback: (request: DevToolsNetworkRequest) => void) => void;
      removeListener: (callback: (request: DevToolsNetworkRequest) => void) => void;
    };
    onNavigated: {
      addListener: (callback: (url: string) => void) => void;
      removeListener: (callback: (url: string) => void) => void;
    };
  };
  panels: {
    create: (title: string, iconPath: string, pagePath: string, callback: () => void) => void;
  };
}

export interface BrowserStorageAPI {
  local: {
    get: (keys: string[], callback: (result: Record<string, unknown>) => void) => void;
    set: (items: Record<string, unknown>) => void;
  };
}

export interface BrowserTabsAPI {
  query: (queryInfo: {
    active: boolean;
    currentWindow: boolean;
  }) => Promise<Array<{ url: string }>>;
}

export interface BrowserAPI {
  devtools: BrowserDevToolsAPI;
  storage: BrowserStorageAPI;
  tabs: BrowserTabsAPI;
}
