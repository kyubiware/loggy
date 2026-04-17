import type { BrowserAPI } from './types';

export const chromeBrowser: BrowserAPI = {
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
      const tabs = await chrome.tabs.query(queryInfo);
      return tabs.flatMap((tab) => (typeof tab.url === 'string' ? [{ url: tab.url }] : []));
    },
  },
};
