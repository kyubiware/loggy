import type { BrowserAPI } from './types';

// Build-time detection via Vite define
declare const __BROWSER__: string;

// Static imports for tree-shaking
import { chromeBrowser } from './chrome';
import { firefoxBrowser } from './firefox';

export const browser: BrowserAPI = __BROWSER__ === 'firefox' ? firefoxBrowser : chromeBrowser;

export type { BrowserAPI, DevToolsNetworkRequest } from './types';
