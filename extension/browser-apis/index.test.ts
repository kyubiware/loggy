import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BrowserAPI } from './types';

describe('Browser API Abstraction', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it('exports chrome API when __BROWSER__ is chrome', async () => {
    vi.stubGlobal('__BROWSER__', 'chrome');

    const [{ browser }, { chromeBrowser }] = await Promise.all([
      import('./index'),
      import('./chrome'),
    ]);

    expect(browser).toBe(chromeBrowser);
    expect(browser.devtools).toBeDefined();
    expect(browser.storage).toBeDefined();
    expect(browser.tabs).toBeDefined();
  });

  it('exports firefox API when __BROWSER__ is firefox', async () => {
    vi.stubGlobal('__BROWSER__', 'firefox');

    const [{ browser }, { firefoxBrowser }] = await Promise.all([
      import('./index'),
      import('./firefox'),
    ]);

    expect(browser).toBe(firefoxBrowser);
    expect(browser.devtools).toBeDefined();
    expect(browser.storage).toBeDefined();
    expect(browser.tabs).toBeDefined();
  });

  it('provides typed interface for all 11 APIs', async () => {
    vi.stubGlobal('__BROWSER__', 'chrome');

    const { browser } = await import('./index');
    const typedBrowser: BrowserAPI = browser;

    expect(typedBrowser).toBe(browser);

    const typedAndAccessibleApis = [
      browser.devtools,
      browser.devtools.inspectedWindow,
      browser.devtools.inspectedWindow.eval,
      browser.devtools.network,
      browser.devtools.network.getHAR,
      browser.devtools.network.onNavigated.addListener,
      browser.devtools.network.onNavigated.removeListener,
      browser.devtools.panels.create,
      browser.storage.local.get,
      browser.storage.local.set,
      browser.tabs.query,
    ];

    expect(typedAndAccessibleApis).toHaveLength(11);
    expect(typedAndAccessibleApis.every((api) => api !== undefined)).toBe(true);

    expect(typeof browser.devtools.inspectedWindow.eval).toBe('function');
    expect(typeof browser.devtools.network.getHAR).toBe('function');
    expect(typeof browser.devtools.network.onNavigated.addListener).toBe('function');
    expect(typeof browser.devtools.network.onNavigated.removeListener).toBe('function');
    expect(typeof browser.devtools.panels.create).toBe('function');
    expect(typeof browser.storage.local.get).toBe('function');
    expect(typeof browser.storage.local.set).toBe('function');
    expect(typeof browser.tabs.query).toBe('function');
  });
});
