import type { AlwaysLogHost } from '../types/messages.ts'

/**
 * Storage key for always-log hosts.
 */
export const LOGGY_ALWAYS_LOG_HOSTS_KEY = 'loggy_always_log_hosts' as const

function readAlwaysLogHosts(): Promise<AlwaysLogHost[]> {
  return new Promise((resolve) => {
    chrome.storage.local.get([LOGGY_ALWAYS_LOG_HOSTS_KEY], (result) => {
      const storedHosts = result[LOGGY_ALWAYS_LOG_HOSTS_KEY]

      if (!Array.isArray(storedHosts)) {
        resolve([])
        return
      }

      resolve(
        storedHosts.filter((entry): entry is AlwaysLogHost => {
          return (
            typeof entry === 'object' &&
            entry !== null &&
            typeof entry.host === 'string' &&
            typeof entry.createdAt === 'number'
          )
        }),
      )
    })
  })
}

/**
 * Reads the always-log host list from storage.
 */
export async function getAlwaysLogHosts(): Promise<AlwaysLogHost[]> {
  return readAlwaysLogHosts()
}

/**
 * Adds a host to the always-log list.
 */
export async function addAlwaysLogHost(host: string): Promise<void> {
  const currentHosts = await readAlwaysLogHosts()

  if (currentHosts.some((entry) => entry.host === host)) {
    return
  }

  const nextHosts: AlwaysLogHost[] = [...currentHosts, { host, createdAt: Date.now() }]

  await new Promise<void>((resolve) => {
    chrome.storage.local.set({ [LOGGY_ALWAYS_LOG_HOSTS_KEY]: nextHosts }, () => resolve())
  })
}

/**
 * Removes a host from the always-log list.
 */
export async function removeAlwaysLogHost(host: string): Promise<void> {
  const currentHosts = await readAlwaysLogHosts()
  const nextHosts = currentHosts.filter((entry) => entry.host !== host)

  await new Promise<void>((resolve) => {
    chrome.storage.local.set({ [LOGGY_ALWAYS_LOG_HOSTS_KEY]: nextHosts }, () => resolve())
  })
}

/**
 * Checks whether a host is in the always-log list.
 */
export async function isHostInAlwaysLogList(host: string): Promise<boolean> {
  const currentHosts = await readAlwaysLogHosts()

  return currentHosts.some((entry) => entry.host === host)
}
