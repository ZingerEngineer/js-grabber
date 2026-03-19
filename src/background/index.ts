// Background service worker (MV3).
// State here is NOT persistent — service workers are terminated when idle.
// All persisted data must go through chrome.storage.local.

import type { ExtensionMessage, MessageResponse } from '@/types/messages'

chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, _sender, sendResponse) => {
    handleMessage(message)
      .then(sendResponse)
      .catch((err: unknown) => {
        const error = err instanceof Error ? err.message : 'Unknown error'
        sendResponse({ success: false, error } satisfies MessageResponse)
      })
    // Return true to keep the message channel open for the async response.
    return true
  },
)

async function handleMessage(
  message: ExtensionMessage,
): Promise<MessageResponse<unknown>> {
  switch (message.type) {
    case 'DOWNLOAD_SCRIPT': {
      // Content is fetched in the panel context and passed as a blob URL.
      // The background only orchestrates via chrome.downloads if needed.
      return { success: true, data: null }
    }
    case 'DOWNLOAD_ALL': {
      return { success: true, data: null }
    }
    default:
      return { success: false, error: `Unhandled message type` }
  }
}
