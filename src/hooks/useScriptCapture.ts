import { useEffect } from 'react'
import browser from 'webextension-polyfill'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { scriptCaptured } from '@/store/slices/scriptsSlice'
import { selectAutoCapture, selectSettings } from '@/store/slices/settingsSlice'
import type { CapturedScript } from '@/types'
import { generateId } from '@/utils/generateId'
import { detectScriptType } from '@/utils/detectScriptType'
import { extractFilename } from '@/utils/extractFilename'

// The polyfill's DevtoolsNetwork.Request only exposes getContent() — it omits the
// underlying HAR entry fields. We define the shape we actually use here.
interface HarNetworkRequest {
  request: { url: string }
  // The polyfill wraps getContent() as a Promise returning [content, encoding].
  getContent(): Promise<[string, string]>
}

// getResources is a Chrome-specific DevTools API not present in the polyfill types
// (Firefox has no equivalent). We define local types and cast when accessing.
interface InspectedWindowResource {
  url: string
  type: string
  // getContent on Resource is a DevTools Protocol (HAR spec) callback — the polyfill
  // does not wrap it, so the callback form is correct here.
  getContent(callback: (content: string, encoding: string) => void): void
}

interface InspectedWindowWithResources {
  getResources(): Promise<InspectedWindowResource[]>
}

// Runs only in the DevTools panel context — browser.devtools.* is available here.
export function useScriptCapture(): void {
  const dispatch = useAppDispatch()
  const autoCapture = useAppSelector(selectAutoCapture)
  const { excludePatterns, maxFileSizeBytes, includeInline } = useAppSelector(selectSettings)

  useEffect(() => {
    if (!autoCapture) return

    function shouldExclude(url: string): boolean {
      return excludePatterns.some((pattern) => url.includes(pattern))
    }

    function dispatchScript(url: string, content: string): void {
      if (shouldExclude(url)) return
      if (content.length > maxFileSizeBytes) return

      const script: CapturedScript = {
        id: generateId(),
        url,
        filename: extractFilename(url),
        sizeBytes: content.length,
        capturedAt: Date.now(),
        content,
        type: detectScriptType(url),
      }
      dispatch(scriptCaptured(script))
    }

    // 1. Capture future network requests as the page loads scripts.
    //    Cast to HarNetworkRequest to access the HAR .request.url field and the
    //    polyfill's Promise-based getContent().
    function onRequestFinished(request: unknown): void {
      const harRequest = request as HarNetworkRequest
      const url = harRequest.request.url
      if (!isScriptUrl(url)) return

      harRequest.getContent().then(([content]) => {
        dispatchScript(url, content ?? '')
      }).catch(() => {
        // Network or DevTools error — skip.
      })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- addListener accepts any compatible function; the cast is needed because HarNetworkRequest extends the polyfill's minimal Request type
    browser.devtools.network.onRequestFinished.addListener(onRequestFinished as any)

    // 2. Capture scripts already present in the inspected page (e.g. on panel open).
    //    getResources() is Chrome-only and not in the polyfill types — cast required.
    //    A cancellation flag guards against dispatch calls firing after unmount when
    //    the Promise resolves late (cleanup must be synchronous, so we can't await here).
    let cancelled = false
    const inspectedWindow = browser.devtools.inspectedWindow as unknown as InspectedWindowWithResources
    ;(async () => {
      try {
        const resources = await inspectedWindow.getResources()
        if (cancelled) return
        resources
          .filter((r) => {
            if (r.type !== 'script') return false
            if (!includeInline && r.url === '') return false
            return true
          })
          .forEach((resource) => {
            // resource.getContent is a DevTools Protocol callback — not wrapped by polyfill.
            resource.getContent((content, _encoding) => {
              if (cancelled) return
              dispatchScript(resource.url || `inline-${generateId()}`, content ?? '')
            })
          })
      } catch (err) {
        console.error('[JS Grabber] getResources failed:', err)
      }
    })()

    return () => {
      cancelled = true
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- matching the any cast on addListener above
      browser.devtools.network.onRequestFinished.removeListener(onRequestFinished as any)
    }
  }, [autoCapture, dispatch, excludePatterns, includeInline, maxFileSizeBytes])
}

function isScriptUrl(url: string): boolean {
  try {
    const { pathname } = new URL(url)
    const lower = pathname.toLowerCase()
    return (
      lower.endsWith('.js') ||
      lower.endsWith('.mjs') ||
      lower.endsWith('.cjs') ||
      lower.includes('.js?')
    )
  } catch {
    return false
  }
}
