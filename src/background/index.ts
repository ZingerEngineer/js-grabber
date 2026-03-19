// Background service worker (MV3).
// State here is NOT persistent — the worker is terminated when idle.
// All durable data must go through chrome.storage.local.

import type { ExtensionMessage, MessageResponse } from '@/types/messages'

// ── Action click: immediately grab all scripts + page source ─────────────────

chrome.action.onClicked.addListener((tab) => {
  if (!tab.id || !tab.url) return

  // Only run on real web pages — skip chrome://, about:, extension pages, etc.
  if (!tab.url.startsWith('http://') && !tab.url.startsWith('https://')) {
    chrome.action.setBadgeText({ text: 'N/A', tabId: tab.id })
    chrome.action.setBadgeBackgroundColor({ color: '#45475a' })
    return
  }

  captureAndDownload(tab.id, tab.url)
})

// ── Core capture logic ────────────────────────────────────────────────────────

async function captureAndDownload(tabId: number, tabUrl: string): Promise<void> {
  const hostname = new URL(tabUrl).hostname

  // Show "working" badge
  chrome.action.setBadgeText({ text: '...', tabId })
  chrome.action.setBadgeBackgroundColor({ color: '#cba6f7' })

  try {
    // 1. Collect all <script src> URLs and inline script content from the live DOM.
    //    This function runs inside the inspected page — no closure variables allowed.
    const [injection] = await chrome.scripting.executeScript({
      target: { tabId },
      func: (): { externalUrls: string[]; inlineScripts: string[]; pageUrl: string } => {
        const externalUrls = Array.from(document.querySelectorAll('script[src]'))
          .map((el) => (el as HTMLScriptElement).src)
          .filter((url) => url.startsWith('http'))

        const inlineScripts = Array.from(
          document.querySelectorAll('script:not([src])'),
        )
          .map((el) => el.textContent ?? '')
          .filter((text) => text.trim().length > 0)

        return { externalUrls, inlineScripts, pageUrl: location.href }
      },
    })

    if (!injection.result) throw new Error('Script injection returned no result')

    const { externalUrls, inlineScripts, pageUrl } = injection.result
    let count = 0

    // 2. Download page HTML source (the server-returned HTML, like View Source).
    try {
      const res = await fetch(pageUrl)
      const html = await res.text()
      await chrome.downloads.download({
        url: 'data:text/html;charset=utf-8,' + encodeURIComponent(html),
        filename: `${hostname}/page.html`,
        saveAs: false,
      })
      count++
    } catch {
      // Page fetch may fail (auth-gated, CSP, etc.) — skip silently.
    }

    // 3. Download each external JS file.
    //    chrome.downloads fetches each URL directly, preserving cookies and auth.
    for (const scriptUrl of externalUrls) {
      try {
        await chrome.downloads.download({
          url: scriptUrl,
          filename: `${hostname}/${urlToFilename(scriptUrl)}`,
          saveAs: false,
        })
        count++
      } catch {
        // Individual file may fail (expired token, CORS, etc.) — skip.
      }
    }

    // 4. Download inline scripts bundled into a single file.
    if (inlineScripts.length > 0) {
      const combined = inlineScripts
        .map((src, i) => `/* ── inline script ${i + 1} ── */\n${src}`)
        .join('\n\n')
      await chrome.downloads.download({
        url: 'data:text/javascript;charset=utf-8,' + encodeURIComponent(combined),
        filename: `${hostname}/inline-scripts.js`,
        saveAs: false,
      })
      count++
    }

    // Show count badge (green = success)
    chrome.action.setBadgeText({ text: String(count), tabId })
    chrome.action.setBadgeBackgroundColor({ color: '#a6e3a1' })
  } catch (err) {
    console.error('[JS Grabber] captureAndDownload failed:', err)
    chrome.action.setBadgeText({ text: 'ERR', tabId })
    chrome.action.setBadgeBackgroundColor({ color: '#f38ba8' })
  }
}

function urlToFilename(url: string): string {
  try {
    const pathname = new URL(url).pathname
    return pathname.split('/').filter(Boolean).pop() ?? 'script.js'
  } catch {
    return 'script.js'
  }
}

// ── Message handler (for DevTools panel "Download All" button) ────────────────

chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, _sender, sendResponse) => {
    handleMessage(message)
      .then(sendResponse)
      .catch((err: unknown) => {
        const error = err instanceof Error ? err.message : 'Unknown error'
        sendResponse({ success: false, error } satisfies MessageResponse)
      })
    return true // keep channel open for async response
  },
)

async function handleMessage(
  message: ExtensionMessage,
): Promise<MessageResponse<unknown>> {
  switch (message.type) {
    case 'DOWNLOAD_ALL': {
      // Triggered from the DevTools panel. The inspected tab's ID and URL
      // must be read via chrome.tabs since we're in the background context.
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (tab?.id && tab?.url) {
        captureAndDownload(tab.id, tab.url)
      }
      return { success: true, data: null }
    }

    case 'DOWNLOAD_SCRIPT': {
      // Single file download triggered from the panel detail view.
      // The panel already has the content; this is a no-op stub for now.
      return { success: true, data: null }
    }

    default:
      return { success: false, error: 'Unhandled message type' }
  }
}
