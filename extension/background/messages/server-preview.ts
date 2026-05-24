import { probeServerFromBackground, pushToServer } from '../server-sync'
import { debugLog } from '../../utils/debug-logger'
import type {
  CachePreviewResponse,
  CachedPreviewResponse,
  ProbeServerResponse,
  PushToServerResponse,
} from '../../types/messages'

const PREVIEW_CACHE_TTL_MS = 5 * 60 * 1000
const previewCache = new Map<string, { markdown: string; createdAt: number }>()

export function handleCachePreview(markdown: string): CachePreviewResponse {
  const id = crypto.randomUUID()
  previewCache.set(id, { markdown, createdAt: Date.now() })
  return { id }
}

export function handleGetCachedPreview(id: string): CachedPreviewResponse {
  const entry = previewCache.get(id)

  if (!entry) {
    return { markdown: null }
  }

  const age = Date.now() - entry.createdAt
  if (age > PREVIEW_CACHE_TTL_MS) {
    previewCache.delete(id)
    return { markdown: null }
  }

  previewCache.delete(id)
  return { markdown: entry.markdown }
}

export async function handleProbeServer(url: string): Promise<ProbeServerResponse> {
  console.log('[Loggy:bg] received probe-server message, url:', url)
  const connected = await probeServerFromBackground(url)
  console.log('[Loggy:bg] probe-server responding with connected:', connected)
  debugLog('message', 'background', `probe-server responding with connected: ${connected}`)
  return { connected }
}

export async function handlePushToServer(
  url: string,
  markdown: string,
  senderTabId?: number,
): Promise<PushToServerResponse> {
  debugLog('message', 'background', `push-to-server received from panel: url=${url} (${markdown.length} chars)`)
  const success = await pushToServer(url, markdown)
  debugLog('message', 'background', `push-to-server result: ${success}`, { senderTabId })
  return { success }
}
