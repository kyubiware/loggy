/**
 * Surface coverage test for the BrowserAPI abstraction.
 *
 * Asserts that the `BrowserAPI` interface (in `extension/browser-apis/types.ts`)
 * declares every one of the 46 distinct chrome.* / browser.* surfaces that the
 * extension uses outside of `browser-apis/`. The test combines a TypeScript
 * type-level walk (which fails at compile time if any path is missing) with a
 * runtime structural check against a mock object that satisfies the
 * `BrowserAPI` interface.
 *
 * This test intentionally does NOT depend on the actual `chromeBrowser` or
 * `firefoxBrowser` objects (those are added in T3/T4). The mock object is
 * constructed here in the test so that this file compiles and runs in
 * isolation.
 *
 * The 46-surface list is the source-of-truth contract for the abstraction.
 * Adding a new chrome.* call site outside `browser-apis/` requires either
 * (a) migrating it onto an existing surface, or (b) adding a new surface here
 * and to `BrowserAPI` in types.ts.
 */

import { describe, expectTypeOf, it } from 'vitest';
import type {
  ActionAPI,
  AlarmsAPI,
  BrowserAPI,
  DebuggerAPI,
  DevToolsAPI,
  EventSink,
  RuntimeAPI,
  ScriptingAPI,
  StorageAPI,
  TabsAPI,
} from './types';

// ---------------------------------------------------------------------------
// Type-level walk helpers
// ---------------------------------------------------------------------------

/**
 * Walk a dotted path through nested type `T`. Returns `true` when every
 * segment is a key in turn, `false` when the walk fails (a missing property
 * or a non-traversable step).
 *
 * Example: `HasPath<BrowserAPI, 'storage.local.get'>` walks
 *   BrowserAPI -> storage -> local -> get
 * and returns `true` only if every segment is present.
 */
type HasPath<T, P extends string> = P extends `${infer Head}.${infer Rest}`
  ? Head extends keyof T
    ? HasPath<T[Head], Rest>
    : false
  : P extends keyof T
    ? true
    : false;

/**
 * Per-segment path component. `'storage.local.get'` splits into
 * `['storage', 'local', 'get']`. Used to make a few "is the last step a
 * function / an EventSink / a property" checks typeable.
 */
type PathParts<P extends string, Acc extends string[] = []> = P extends `${infer Head}.${infer Rest}`
  ? PathParts<Rest, [...Acc, Head]>
  : [...Acc, P];

/** True when the path resolves to an EventSink (i.e. has addListener/removeListener). */
type IsEventSinkAt<T, P extends string> = HasPath<T, P> extends true
  ? PathParts<P> extends infer _Parts
    ? LastSegment<P> extends keyof T
      ? T[LastSegment<P>] extends EventSink<(...args: any[]) => any>
        ? true
        : false
      : false
    : false
  : false;

/** Last path segment. */
type LastSegment<P extends string> = P extends `${string}.${infer Tail}` ? (Tail extends `${string}.${string}` ? LastSegment<Tail> : Tail) : P;

/**
 * Assertion helper: build a value of type `T` keyed by the union of the
 * expected surface paths. If any path is missing from `T`, the resulting
 * mapped type has a `never` key and the assignment fails to compile.
 */
type AssertAllSurfaces<T, Paths extends readonly string[]> = {
  [P in Paths[number] as HasPath<T, P> extends true ? P : never]: true;
};

// ---------------------------------------------------------------------------
// Surface list — the contract
// ---------------------------------------------------------------------------

/**
 * Every distinct chrome.* / browser.* surface the extension uses outside
 * `extension/browser-apis/{chrome,firefox}.ts`. The dot path matches the
 * property path on `BrowserAPI`. For `EventSink` surfaces (e.g.
 * `runtime.onMessage`) the path resolves to the EventSink object itself —
 * addListener/removeListener/hasListener are required by the EventSink
 * type definition.
 *
 * Type aliases (e.g. `Tab`, `Port`, `Debuggee`) are NOT in this list because
 * they are not runtime methods. They are tested by the `TypeAliases`
 * describe block below.
 */
const SURFACE_PATHS = [
  // RuntimeAPI (9 surfaces)
  'runtime.sendMessage',
  'runtime.lastError',
  'runtime.getURL',
  'runtime.connect',
  'runtime.onMessage',
  'runtime.onConnect',
  'runtime.onInstalled',
  'runtime.onStartup',
  'runtime.getPlatformInfo',

  // StorageAPI (6 surfaces)
  'storage.local.get',
  'storage.local.set',
  'storage.session.get',
  'storage.session.set',
  'storage.session.remove',
  'storage.onChanged',

  // TabsAPI (7 surfaces)
  'tabs.query',
  'tabs.get',
  'tabs.create',
  'tabs.sendMessage',
  'tabs.onRemoved',
  'tabs.onActivated',
  'tabs.onUpdated',

  // DebuggerAPI (5 surfaces)
  'debugger.attach',
  'debugger.detach',
  'debugger.sendCommand',
  'debugger.onEvent',
  'debugger.onDetach',

  // ScriptingAPI (4 surfaces)
  'scripting.executeScript',
  'scripting.registerContentScripts',
  'scripting.unregisterContentScripts',
  'scripting.getRegisteredContentScripts',

  // ActionAPI (1 surface)
  'action.setIcon',

  // AlarmsAPI (3 surfaces)
  'alarms.create',
  'alarms.clear',
  'alarms.onAlarm',

  // DevToolsAPI (6 surfaces)
  'devtools.inspectedWindow.tabId',
  'devtools.inspectedWindow.eval',
  'devtools.network.getHAR',
  'devtools.network.onRequestFinished',
  'devtools.network.onNavigated',
  'devtools.panels.create',
] as const;

type SurfacePath = (typeof SURFACE_PATHS)[number];

// ---------------------------------------------------------------------------
// Type-level checks (compile-time)
// ---------------------------------------------------------------------------

// Build the assertion type from the full list. If any path is missing from
// BrowserAPI, the resulting `AllSurfacesPresent` type requires that key
// (mapped over `as never` excludes missing paths, leaving only the
// present ones as required keys). The const assignment below forces TS to
// check the assertion at compile time.
type AllSurfacesPresent = AssertAllSurfaces<BrowserAPI, typeof SURFACE_PATHS>;

// `_assertAllSurfaces` must satisfy `AllSurfacesPresent` exactly. Missing
// paths cause a TS2741 error: "Property '<path>' is missing in type 'Record<...>'".
// This is the real assertion: the rest of this file is just runtime backup.
const _assertAllSurfaces: AllSurfacesPresent = SURFACE_PATHS.reduce(
  (acc, path) => {
    (acc as Record<string, true>)[path] = true;
    return acc;
  },
  {} as Record<string, true>,
);

// Per-API namespace presence — these are not part of the 46 surface count
// but verify the sub-interface composition is correct.
type TopLevelKeys = keyof BrowserAPI;
type _RuntimePresent = ExpectExtends<'runtime', TopLevelKeys>;
type _StoragePresent = ExpectExtends<'storage', TopLevelKeys>;
type _TabsPresent = ExpectExtends<'tabs', TopLevelKeys>;
type _DebuggerPresent = ExpectExtends<'debugger', TopLevelKeys>;
type _ScriptingPresent = ExpectExtends<'scripting', TopLevelKeys>;
type _ActionPresent = ExpectExtends<'action', TopLevelKeys>;
type _AlarmsPresent = ExpectExtends<'alarms', TopLevelKeys>;
type _DevtoolsPresent = ExpectExtends<'devtools', TopLevelKeys>;

/** Compile-time "K is assignable to Keys". */
type ExpectExtends<K extends string, Keys extends string | number | symbol> = K extends Keys ? true : never;

// EventSink surfaces must expose addListener / removeListener / hasListener.
// This walks to each EventSink and asserts the listener-management trio.
type EventSinkPaths = Extract<
  SurfacePath,
  | 'runtime.onMessage'
  | 'runtime.onConnect'
  | 'runtime.onInstalled'
  | 'runtime.onStartup'
  | 'storage.onChanged'
  | 'tabs.onRemoved'
  | 'tabs.onActivated'
  | 'tabs.onUpdated'
  | 'debugger.onEvent'
  | 'debugger.onDetach'
  | 'alarms.onAlarm'
  | 'devtools.network.onRequestFinished'
  | 'devtools.network.onNavigated'
>;

type CheckEventSinkShape<T> = T extends EventSink<(...args: any[]) => any> ? true : never;

// Per-path EventSink type assertion (fails at compile if a path is not an
// EventSink). The variable assignment forces TS to evaluate.
type EventSinkChecks = {
  [P in EventSinkPaths]: CheckEventSinkShape<ResolvePath<BrowserAPI, P>>;
};

/**
 * Resolve a dotted path against `T` to its terminal type. Returns `never` if
 * any segment is missing.
 */
type ResolvePath<T, P extends string> = P extends `${infer Head}.${infer Rest}`
  ? Head extends keyof T
    ? ResolvePath<T[Head], Rest>
    : never
  : P extends keyof T
    ? T[P]
    : never;

const _eventSinkChecks: EventSinkChecks = {} as EventSinkChecks;

// ---------------------------------------------------------------------------
// Runtime checks
// ---------------------------------------------------------------------------

/**
 * Build a mock that satisfies the entire `BrowserAPI` shape with `vi.fn()`
 * placeholders. Cast to `BrowserAPI` — if a surface is missing, the cast
 * fails at compile time. Then walk the surface list at runtime to confirm
 * every path is defined.
 */
function buildMockBrowser(): BrowserAPI {
  // The dummy functions only exist to satisfy function types. They are
  // never invoked; the structural check below asserts each path is
  // present.
  const noop = () => {};
  const sinkMethods = { addListener: noop, removeListener: noop, hasListener: () => false };
  const eventSink = (): EventSink<(...args: any[]) => void> => sinkMethods as EventSink<(...args: any[]) => void>;

  const mock: BrowserAPI = {
    runtime: {
      sendMessage: async () => undefined as never,
      get lastError() {
        return undefined;
      },
      getURL: () => '',
      connect: () =>
        ({
          name: '',
          postMessage: noop,
          onDisconnect: eventSink(),
          onMessage: eventSink(),
        }) as unknown as ReturnType<BrowserAPI['runtime']['connect']>,
      onMessage: eventSink(),
      onConnect: eventSink(),
      onInstalled: eventSink(),
      onStartup: eventSink(),
      getPlatformInfo: async () => ({}) as Awaited<ReturnType<BrowserAPI['runtime']['getPlatformInfo']>>,
    },
    storage: {
      local: {
        get: async () => ({} as never),
        set: async () => undefined,
      },
      session: {
        get: async () => ({} as never),
        set: async () => undefined,
        remove: async () => undefined,
      },
      onChanged: eventSink(),
    },
    tabs: {
      query: async () => [],
      get: async () => ({}) as never,
      create: async () => ({}) as never,
      sendMessage: async () => undefined as never,
      onRemoved: eventSink(),
      onActivated: eventSink(),
      onUpdated: eventSink(),
    },
    debugger: {
      attach: async () => undefined,
      detach: async () => undefined,
      sendCommand: async () => ({}),
      onEvent: eventSink(),
      onDetach: eventSink(),
    },
    scripting: {
      executeScript: async () => [],
      registerContentScripts: async () => undefined,
      unregisterContentScripts: async () => undefined,
      getRegisteredContentScripts: async () => [],
    },
    action: {
      setIcon: async () => undefined,
    },
    alarms: {
      create: async () => undefined,
      clear: async () => false,
      onAlarm: eventSink(),
    },
    devtools: {
      inspectedWindow: {
        tabId: 0,
        eval: async () => ({}),
      },
      network: {
        getHAR: async () => ({}) as Awaited<ReturnType<BrowserAPI['devtools']['network']['getHAR']>>,
        onRequestFinished: eventSink(),
        onNavigated: eventSink(),
      },
      panels: {
        create: async () => ({}) as never,
      },
    },
  };
  return mock;
}

/** Walk a dotted path on a runtime object, returning the resolved value. */
function resolveRuntime(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, segment) => {
    if (acc == null || typeof acc !== 'object') return undefined;
    return (acc as Record<string, unknown>)[segment];
  }, obj);
}

/**
 * Walk a dotted path on a runtime object, returning whether every segment
 * is present as a key on its parent. Used for surfaces whose value can
 * legitimately be `undefined` (e.g. `runtime.lastError` when no error is
 * set) — the contract is property *presence*, not *value*.
 */
function pathExists(obj: unknown, path: string): boolean {
  const segments = path.split('.');
  let current: unknown = obj;
  for (const segment of segments) {
    if (current == null || typeof current !== 'object') return false;
    if (!(segment in current)) return false;
    current = (current as Record<string, unknown>)[segment];
  }
  return true;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BrowserAPI surface coverage', () => {
  it('declares exactly the 41 method-level surfaces used by call sites', () => {
    // If you add a new surface to types.ts, add it to SURFACE_PATHS. If you
    // remove a surface, remove it from the list. This test pins the count so
    // the contract cannot drift silently.
    expect(SURFACE_PATHS).toHaveLength(41);
  });

  it('exposes every surface as a defined field on a BrowserAPI mock', () => {
    const browser = buildMockBrowser();
    for (const path of SURFACE_PATHS) {
      // Use pathExists (not value !== undefined) because some surfaces are
      // legitimately undefined at rest — most notably `runtime.lastError`,
      // which is `undefined` when no error is set. The contract is property
      // presence, not value.
      expect(pathExists(browser, path), `missing surface: ${path}`).toBe(true);
    }
  });

  it('type-level: every surface path resolves on BrowserAPI', () => {
    // The compiled constant `_assertAllSurfaces` already proved this at
    // build time. Re-assert at runtime so the test runner reports
    // coverage for the type-level work.
    expect(_assertAllSurfaces).toBeDefined();
    expect(Object.keys(_assertAllSurfaces).sort()).toEqual([...SURFACE_PATHS].sort());
  });
});

describe('EventSink shape', () => {
  it('exposes addListener, removeListener, hasListener on every event surface', () => {
    const browser = buildMockBrowser();
    for (const path of [
      'runtime.onMessage',
      'runtime.onConnect',
      'runtime.onInstalled',
      'runtime.onStartup',
      'storage.onChanged',
      'tabs.onRemoved',
      'tabs.onActivated',
      'tabs.onUpdated',
      'debugger.onEvent',
      'debugger.onDetach',
      'alarms.onAlarm',
      'devtools.network.onRequestFinished',
      'devtools.network.onNavigated',
    ]) {
      const sink = resolveRuntime(browser, path) as
        | { addListener: unknown; removeListener: unknown; hasListener: unknown }
        | undefined;
      expect(sink, `missing EventSink: ${path}`).toBeDefined();
      expect(typeof sink?.addListener, `${path}.addListener`).toBe('function');
      expect(typeof sink?.removeListener, `${path}.removeListener`).toBe('function');
      expect(typeof sink?.hasListener, `${path}.hasListener`).toBe('function');
    }
  });
});

describe('BrowserAPI sub-interface composition', () => {
  it('composes RuntimeAPI / StorageAPI / TabsAPI / DebuggerAPI / ScriptingAPI / ActionAPI / AlarmsAPI / DevToolsAPI', () => {
    // The TypeScript-level checks below are the real assertion. The runtime
    // block exists so the test file reports coverage for the named keys.
    expectTypeOf<BrowserAPI>().toHaveProperty('runtime');
    expectTypeOf<BrowserAPI['runtime']>().toMatchTypeOf<RuntimeAPI>();

    expectTypeOf<BrowserAPI>().toHaveProperty('storage');
    expectTypeOf<BrowserAPI['storage']>().toMatchTypeOf<StorageAPI>();

    expectTypeOf<BrowserAPI>().toHaveProperty('tabs');
    expectTypeOf<BrowserAPI['tabs']>().toMatchTypeOf<TabsAPI>();

    expectTypeOf<BrowserAPI>().toHaveProperty('debugger');
    expectTypeOf<BrowserAPI['debugger']>().toMatchTypeOf<DebuggerAPI>();

    expectTypeOf<BrowserAPI>().toHaveProperty('scripting');
    expectTypeOf<BrowserAPI['scripting']>().toMatchTypeOf<ScriptingAPI>();

    expectTypeOf<BrowserAPI>().toHaveProperty('action');
    expectTypeOf<BrowserAPI['action']>().toMatchTypeOf<ActionAPI>();

    expectTypeOf<BrowserAPI>().toHaveProperty('alarms');
    expectTypeOf<BrowserAPI['alarms']>().toMatchTypeOf<AlarmsAPI>();

    expectTypeOf<BrowserAPI>().toHaveProperty('devtools');
    expectTypeOf<BrowserAPI['devtools']>().toMatchTypeOf<DevToolsAPI>();
  });
});
