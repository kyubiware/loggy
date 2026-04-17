import type { CaptureMode } from '../types/messages'

export const MODE_LABELS: Record<CaptureMode, string> = {
  'content-script': 'Content Script',
  debugger: 'Enhanced',
  devtools: 'DevTools Panel',
  inactive: 'Inactive',
}

export const MODE_ICONS: Record<CaptureMode, string> = {
  'content-script': '📝',
  debugger: '🔬',
  devtools: '🔧',
  inactive: '⏸',
}

export function formatTokenCount(tokenEstimate: number): string {
  if (tokenEstimate >= 1_000_000) {
    return `${(tokenEstimate / 1_000_000).toFixed(1)}M`
  }

  if (tokenEstimate >= 1_000) {
    return `${(tokenEstimate / 1_000).toFixed(1)}k`
  }

  return tokenEstimate.toString()
}
