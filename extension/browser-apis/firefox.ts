import type { BrowserAPI } from './types';

// browser.* is the native Firefox WebExtensions API. Use it for tabs.query
// because chrome.tabs (the Chrome compatibility shim) is undefined in the
// Firefox DevTools panel context (moz-extension:// origin).
declare const browser: typeof chrome;

export const firefoxBrowser: BrowserAPI = {
  devtools: {
    inspectedWindow: {
      eval: (code, callback) => chrome.devtools.inspectedWindow.eval(code, callback),
    },
    network: {
      getHAR: (callback) =>
        chrome.devtools.network.getHAR((harLog) => callback(harLog as unknown as Parameters<typeof callback>[0])),
      onRequestFinished: {
        addListener: (callback) => chrome.devtools.network.onRequestFinished.addListener(callback),
        removeListener: (callback) =>
          chrome.devtools.network.onRequestFinished.removeListener(callback),
      },
      onNavigated: {
        addListener: (callback) => chrome.devtools.network.onNavigated.addListener(callback),
        removeListener: (callback) => chrome.devtools.network.onNavigated.removeListener(callback),
      },
    },
    panels: {
      create: (title, iconPath, pagePath, callback) =>
        chrome.devtools.panels.create(title, iconPath, pagePath, callback),
    },
  },
  storage: {
    local: {
      get: (keys, callback) => chrome.storage.local.get(keys, callback),
      set: (items) => chrome.storage.local.set(items),
    },
  },
  tabs: {
    query: async (queryInfo) => {
      // Use browser.tabs (native Firefox API) instead of chrome.tabs.
      // chrome.tabs is a compatibility shim that's undefined in the
      // DevTools panel context (moz-extension:// origin).
      const tabs = await browser.tabs.query(queryInfo);
      return tabs.flatMap((tab) => (typeof tab.url === 'string' ? [{ url: tab.url }] : []));
    },
  },
};
