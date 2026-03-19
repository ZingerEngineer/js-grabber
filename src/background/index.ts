// Background service worker (MV3).
// State here is NOT persistent — the worker is terminated when idle.
// All durable data must go through chrome.storage.local.

import JSZip from 'jszip'
import type { ExtensionMessage, MessageResponse } from '@/types/messages'

// ── Action click: grab everything and download a single ZIP ──────────────────

chrome.action.onClicked.addListener((tab) => {
  if (!tab.id || !tab.url) return

  if (!tab.url.startsWith('http://') && !tab.url.startsWith('https://')) {
    chrome.action.setBadgeText({ text: 'N/A', tabId: tab.id })
    chrome.action.setBadgeBackgroundColor({ color: '#45475a' })
    return
  }

  captureAndDownload(tab.id, tab.url)
})

// ── Core capture + ZIP logic ─────────────────────────────────────────────────

async function captureAndDownload(tabId: number, tabUrl: string): Promise<void> {
  const { hostname } = new URL(tabUrl)

  chrome.action.setBadgeText({ text: '...', tabId })
  chrome.action.setBadgeBackgroundColor({ color: '#cba6f7' })

  try {
    // 1. Collect script URLs + inline scripts from the live DOM.
    //    Runs inside the inspected page — no closure variables allowed.
    const [injection] = await chrome.scripting.executeScript({
      target: { tabId },
      func: (): { externalUrls: string[]; inlineScripts: string[]; pageUrl: string } => ({
        externalUrls: Array.from(document.querySelectorAll('script[src]'))
          .map((el) => (el as HTMLScriptElement).src)
          .filter((url) => url.startsWith('http')),
        inlineScripts: Array.from(document.querySelectorAll('script:not([src])'))
          .map((el) => el.textContent ?? '')
          .filter((t) => t.trim().length > 0),
        pageUrl: location.href,
      }),
    })

    if (!injection.result) throw new Error('Script injection returned no result')

    const { externalUrls, inlineScripts, pageUrl } = injection.result
    const zip = new JSZip()
    let fileCount = 0

    // 2. Page HTML source — fetch the server-returned HTML (like View Source).
    try {
      const res = await fetch(pageUrl)
      if (res.ok) {
        zip.file('page.html', await res.text())
        fileCount++
      }
    } catch {
      // Auth-gated or network error — skip.
    }

    // 3. External JS files — fetch each URL and add to scripts/ in the ZIP.
    //    Preserve the URL path so naming is unique and traceable.
    for (const url of externalUrls) {
      try {
        const res = await fetch(url)
        if (!res.ok) continue
        zip.file(`scripts/${urlToZipPath(url)}`, await res.text())
        fileCount++
      } catch {
        // Expired token, CORS block, etc. — skip and continue.
      }
    }

    // 4. Inline scripts — combine into one file for readability.
    if (inlineScripts.length > 0) {
      const combined = inlineScripts
        .map((src, i) => `/* ── inline script ${i + 1} ── */\n${src}`)
        .join('\n\n')
      zip.file('scripts/inline-scripts.js', combined)
      fileCount++
    }

    // 5. Generate ZIP as base64 and trigger a single download.
    //    Service workers don't support URL.createObjectURL, so we use a
    //    data URI. chrome.downloads accepts data: URLs directly.
    const base64 = await zip.generateAsync({ type: 'base64' })
    await chrome.downloads.download({
      url: `data:application/zip;base64,${base64}`,
      filename: `${hostname}.zip`,
      saveAs: false,
    })

    // Green badge showing how many files are in the zip.
    chrome.action.setBadgeText({ text: String(fileCount), tabId })
    chrome.action.setBadgeBackgroundColor({ color: '#a6e3a1' })
  } catch (err) {
    console.error('[JS Grabber] captureAndDownload failed:', err)
    chrome.action.setBadgeText({ text: 'ERR', tabId })
    chrome.action.setBadgeBackgroundColor({ color: '#f38ba8' })
  }
}

// Build a ZIP-safe relative path from a script URL.
// Same-origin:   /static/js/app.bundle.js → static/js/app.bundle.js
// Cross-origin:  https://cdn.example.com/lib.js → cdn.example.com/lib.js
function urlToZipPath(url: string): string {
  try {
    const { hostname: host, pathname } = new URL(url)
    const clean = pathname.replace(/^\//, '').split('?')[0] || 'script.js'
    return clean.includes('/') ? clean : `${host}/${clean}`
  } catch {
    return 'script.js'
  }
}

// ── Message handler (DevTools panel "Download All" button) ───────────────────

chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, _sender, sendResponse) => {
    handleMessage(message)
      .then(sendResponse)
      .catch((err: unknown) => {
        const error = err instanceof Error ? err.message : 'Unknown error'
        sendResponse({ success: false, error } satisfies MessageResponse)
      })
    return true
  },
)

async function handleMessage(
  message: ExtensionMessage,
): Promise<MessageResponse<unknown>> {
  switch (message.type) {
    case 'DOWNLOAD_ALL': {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (tab?.id && tab?.url) {
        captureAndDownload(tab.id, tab.url)
      }
      return { success: true, data: null }
    }

    case 'DOWNLOAD_SCRIPT':
      return { success: true, data: null }

    default:
      return { success: false, error: 'Unhandled message type' }
  }
}
