import type { ConsentState } from '../../types/messages'
import type { TabCaptureState } from '../../types/messages'
import type { StatusResponse } from '../../types/messages'
import type { TabExportDataResponse } from '../../types/messages'
import type { CachePreviewResponse } from '../../types/messages'
import type { CachedPreviewResponse } from '../../types/messages'
import type { ConsentResponseMessage } from '../../types/messages'
import type { AlwaysLogHostsResponse } from '../../types/messages'
import type { ProbeServerResponse } from '../../types/messages'
import type { PushToServerResponse } from '../../types/messages'

export type ControlMessageResult =
  | StatusResponse
  | TabCaptureState
  | (TabCaptureState & { consent: ConsentState })
  | TabExportDataResponse
  | CachePreviewResponse
  | CachedPreviewResponse
  | ConsentState
  | ConsentResponseMessage
  | AlwaysLogHostsResponse
  | ProbeServerResponse
  | PushToServerResponse
  | { ok: boolean }
