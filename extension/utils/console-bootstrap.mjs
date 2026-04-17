/**
 * Shared console capture bootstrap script.
 *
 * This script is injected into the inspected window to capture console.log/warn/error/info/debug calls.
 * It maintains a circular buffer of captured logs (max 1000 entries) to prevent memory bloat.
 *
 * The script:
 * - Prevents double-installation with __loggyConsoleCaptureInstalled flag
 * - Preserves existing logs if already present (defensive initialization)
 * - Patches console methods to capture logs before passing through
 * - Serializes arguments into concise semantic summaries for high-value payloads
 *
 * Shared by:
 * - devtools.js (installed on DevTools open and page navigation)
 * - panel/capture.ts (installed on-demand when capturing logs)
 */

function bootstrapConsoleCapture() {
  if (typeof window === 'undefined') {
    return;
  }

  if (window.__loggyConsoleCaptureInstalled) {
    return;
  }

  window.__loggyConsoleCaptureInstalled = true;
  window.__loggyConsoleLogs = Array.isArray(window.__loggyConsoleLogs)
    ? window.__loggyConsoleLogs
    : [];

  const originalConsole = {
    log: console.log,
    warn: console.warn,
    error: console.error,
    info: console.info,
    debug: console.debug
  };

  function toMessage(arg) {
    const maxDepth = 2;
    const maxEntries = 5;
    const maxStringLength = 200;

    function truncate(value) {
      if (typeof value !== 'string') {
        return value;
      }

      return value.length > maxStringLength ? value.slice(0, maxStringLength - 3) + '...' : value;
    }

    function formatPrimitive(value, inContainer) {
      if (value === null) {
        return 'null';
      }

      if (value === undefined) {
        return 'undefined';
      }

      if (typeof value === 'string') {
        const normalized = truncate(value);
        return inContainer ? JSON.stringify(normalized) : normalized;
      }

      if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
      }

      if (typeof value === 'bigint') {
        return String(value) + 'n';
      }

      if (typeof value === 'symbol') {
        return String(value);
      }

      if (typeof value === 'function') {
        return '[Function' + (value.name ? ': ' + value.name : '') + ']';
      }

      return undefined;
    }

    function formatError(error) {
      const name = error && error.name ? error.name : 'Error';
      const message = error && error.message ? String(error.message) : '';
      const stack = typeof error.stack === 'string' ? error.stack : '';
      const frames = stack
        .split('\n')
        .slice(1)
        .map(function (frame) {
          return frame.trim();
        })
        .filter(Boolean)
        .slice(0, 3);

      const summary = name + (message ? ': ' + truncate(message) : '');
      return frames.length > 0 ? summary + ' ' + frames.join(' ') : summary;
    }

    function isDomLikeNode(value) {
      return (
        value &&
        typeof value === 'object' &&
        typeof value.tagName === 'string' &&
        value.tagName.length > 0
      );
    }

    function formatDomLikeNode(node) {
      const tagName = String(node.tagName).toLowerCase();
      const id = node.id ? '#' + String(node.id) : '';
      const className = typeof node.className === 'string' ? node.className.trim() : '';
      const classSuffix = className
        ? '.' + className.split(/\s+/).filter(Boolean).slice(0, 3).join('.')
        : '';

      return '<' + tagName + id + classSuffix + '>';
    }

    function formatObjectTag(value) {
      try {
        const tag = Object.prototype.toString.call(value).slice(8, -1);
        return tag && tag !== 'Object' ? '[' + tag + ']' : '[Object]';
      } catch (_error) {
        return '[Object]';
      }
    }

    function serialize(value, seen, depth, inContainer) {
      const primitive = formatPrimitive(value, inContainer);
      if (primitive !== undefined) {
        return primitive;
      }

      if (value instanceof Error) {
        return formatError(value);
      }

      if (!value || typeof value !== 'object') {
        try {
          return String(value);
        } catch (_error) {
          return '[Unknown]';
        }
      }

      if (seen.has(value)) {
        return '[Circular]';
      }

      if (isDomLikeNode(value)) {
        return formatDomLikeNode(value);
      }

      seen.add(value);

      if (Array.isArray(value)) {
        const items = value.slice(0, maxEntries).map(function (item) {
          return serialize(item, seen, depth + 1, true);
        });
        const suffix = value.length > maxEntries ? ', ...' : '';
        return '[' + items.join(', ') + suffix + ']';
      }

      if (depth >= maxDepth) {
        return formatObjectTag(value);
      }

      const tag = formatObjectTag(value);
      const name = value && value.constructor && value.constructor.name;
      const prefix = name && name !== 'Object' && tag !== '[' + name + ']' ? name + ' ' : '';

      try {
        const keys = Object.keys(value);
        if (keys.length === 0) {
          return prefix ? prefix.trim() : tag;
        }

        const preview = keys.slice(0, maxEntries).map(function (key) {
          return key + ': ' + serialize(value[key], seen, depth + 1, true);
        });
        const suffix = keys.length > maxEntries ? ', ...' : '';
        const body = '{' + preview.join(', ') + suffix + '}';
        return prefix + body;
      } catch (_error) {
        try {
          return prefix + JSON.stringify(value);
        } catch (_stringifyError) {
          return prefix ? prefix.trim() : tag;
        }
      }
    }

    return serialize(arg, new WeakSet(), 0, false);
  }

  const recentErrors = [];
  const DEDUP_WINDOW_MS = 100;
  const MAX_RECENT_ERRORS = 5;

  function pruneRecentErrors(now) {
    while (recentErrors.length > 0 && now - recentErrors[0].time > DEDUP_WINDOW_MS) {
      recentErrors.shift();
    }
  }

  function normalizeErrorFingerprint(message) {
    return String(message)
      .trim()
      .replace(/^Uncaught\s+/, '')
      .replace(/^Unhandled promise rejection:\s+/, '')
      .replace(/\s+at\s+.+$/, '');
  }

  function isDuplicateError(message) {
    const now = Date.now();
    const fingerprint = normalizeErrorFingerprint(message);

    pruneRecentErrors(now);

    return recentErrors.some(function (entry) {
      return entry.message === message || entry.fingerprint === fingerprint;
    });
  }

  function recordError(message) {
    recentErrors.push({
      message: message,
      fingerprint: normalizeErrorFingerprint(message),
      time: Date.now()
    });

    if (recentErrors.length > MAX_RECENT_ERRORS) {
      recentErrors.shift();
    }
  }

  function relay(source, payload) {
    window.postMessage(
      {
        type: '__LOGGY_RELAY__',
        source: source,
        payload: payload
      },
      '*'
    );
  }

  function pushLog(level, message) {
    const timestamp = new Date().toISOString();

    window.__loggyConsoleLogs.push({
      timestamp: timestamp,
      level: level,
      message: message
    });

    if (window.__loggyConsoleLogs.length > 1000) {
      window.__loggyConsoleLogs.shift();
    }

    relay('console', {
      timestamp: timestamp,
      level: level,
      message: message
    });
  }

  function formatErrorType(error, fallbackMessage) {
    if (error && typeof error.name === 'string' && error.name.trim()) {
      return error.name.trim();
    }

    const messageText = String(fallbackMessage || '');
    const match = messageText.match(/^([A-Za-z_$][\w$]*(?:Error|Exception)):\s+/);
    return match ? match[1] : 'Error';
  }

  function formatErrorMessage(message, errorType, error) {
    const source = error && error.message ? String(error.message) : String(message || '');
    const escapedErrorType = errorType.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    const normalized = source
      .replace(/^Uncaught\s+/, '')
      .replace(new RegExp('^' + escapedErrorType + ':\\s+'), '');

    return normalized || 'Unknown error';
  }

  function formatUncaughtError(message, filename, lineno, colno, error) {
    const errorType = formatErrorType(error, message);
    const errorMessage = formatErrorMessage(message, errorType, error);
    const hasLocation = Boolean(filename);
    const line = typeof lineno === 'number' ? lineno : 0;
    const column = typeof colno === 'number' ? colno : 0;
    const location = hasLocation ? ' at ' + String(filename) + ':' + line + ':' + column : '';

    return 'Uncaught ' + errorType + ': ' + errorMessage + location;
  }

  function formatRejectionReason(reason) {
    if (reason instanceof Error) {
      const name = reason.name && String(reason.name).trim() ? String(reason.name).trim() : 'Error';
      const message = reason.message ? String(reason.message) : '';
      return message ? name + ': ' + message : name;
    }

    if (typeof reason === 'string') {
      return reason;
    }

    return toMessage(reason);
  }

  function capture(level, args) {
    const message = args.map(toMessage).join(' ');

    if (level === 'error') {
      if (isDuplicateError(message)) {
        return;
      }

      recordError(message);
    }

    pushLog(level, message);
  }

  console.log = function (...args) {
    capture('log', args);
    originalConsole.log.apply(console, args);
  };
  console.warn = function (...args) {
    capture('warn', args);
    originalConsole.warn.apply(console, args);
  };
  console.error = function (...args) {
    capture('error', args);
    originalConsole.error.apply(console, args);
  };
  console.info = function (...args) {
    capture('info', args);
    originalConsole.info.apply(console, args);
  };
  console.debug = function (...args) {
    capture('debug', args);
    originalConsole.debug.apply(console, args);
  };

  const originalOnError = window.onerror;
  const originalOnUnhandledRejection = window.onunhandledrejection;

  window.onerror = function (message, filename, lineno, colno, error) {
    const fullMessage = formatUncaughtError(message, filename, lineno, colno, error);

    if (!isDuplicateError(fullMessage)) {
      recordError(fullMessage);
      pushLog('error', fullMessage);
    }

    if (typeof originalOnError === 'function') {
      return originalOnError.apply(this, arguments);
    }

    return false;
  };

  window.onunhandledrejection = function (event) {
    const fullMessage = 'Unhandled promise rejection: ' + formatRejectionReason(event && event.reason);

    if (!isDuplicateError(fullMessage)) {
      recordError(fullMessage);
      pushLog('error', fullMessage);
    }

    if (typeof originalOnUnhandledRejection === 'function') {
      return originalOnUnhandledRejection.apply(this, arguments);
    }
  };

  if (typeof fetch === 'function') {
    const originalFetch = window.fetch;

    window.fetch = function (...args) {
      const startTime = Date.now();
      const input = args[0];
      const init = args[1] || {};
      const url = input && typeof input === 'object' && 'url' in input ? String(input.url) : String(input);
      const method =
        (input && typeof input === 'object' && 'method' in input && String(input.method)) ||
        (init && init.method && String(init.method)) ||
        'GET';

      return originalFetch.apply(this, args).then(
        function (response) {
          const responseUrl = response && response.url ? String(response.url) : url;
          const responseMethod = method;
          const status = response && typeof response.status === 'number' ? response.status : 0;
          const contentType = response && response.headers ? response.headers.get('content-type') || '' : '';

          try {
            response
              .clone()
              .text()
              .then(function (body) {
                relay('network', {
                  timestamp: new Date(startTime).toISOString(),
                  url: responseUrl,
                  method: responseMethod,
                  status: status,
                  responseBodyPreview: String(body || '').slice(0, 1024),
                  contentType: contentType,
                  duration: Date.now() - startTime
                });
              })
              .catch(function () {
                relay('network', {
                  timestamp: new Date(startTime).toISOString(),
                  url: responseUrl,
                  method: responseMethod,
                  status: status,
                  responseBodyPreview: '',
                  contentType: contentType,
                  duration: Date.now() - startTime
                });
              });
          } catch (_error) {
            relay('network', {
              timestamp: new Date(startTime).toISOString(),
              url: responseUrl,
              method: responseMethod,
              status: status,
              responseBodyPreview: '',
              contentType: contentType,
              duration: Date.now() - startTime
            });
          }

          return response;
        },
        function (error) {
          relay('network', {
            timestamp: new Date(startTime).toISOString(),
            url: url,
            method: method,
            status: 0,
            responseBodyPreview: '',
            error: error && error.message ? String(error.message) : String(error || 'Fetch failed'),
            duration: Date.now() - startTime
          });

          throw error;
        }
      );
    };
  }

  if (typeof XMLHttpRequest === 'function' && XMLHttpRequest.prototype) {
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (method, url) {
      this.__loggyMethod = method;
      this.__loggyUrl = url;

      return originalOpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function () {
      const startTime = Date.now();

      this.addEventListener(
        'loadend',
        function () {
          relay('network', {
            timestamp: new Date(startTime).toISOString(),
            url: this.__loggyUrl ? String(this.__loggyUrl) : '',
            method: this.__loggyMethod ? String(this.__loggyMethod) : 'GET',
            status: typeof this.status === 'number' ? this.status : 0,
            duration: Date.now() - startTime
          });
        }.bind(this),
        { once: true }
      );

      return originalSend.apply(this, arguments);
    };
  }
}

bootstrapConsoleCapture();

export const CONSOLE_BOOTSTRAP_SCRIPT = `(${bootstrapConsoleCapture.toString()})();`;
