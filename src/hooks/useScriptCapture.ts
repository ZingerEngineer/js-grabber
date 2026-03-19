import { useEffect } from 'react'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { scriptCaptured } from '@/store/slices/scriptsSlice'
import { selectAutoCapture, selectSettings } from '@/store/slices/settingsSlice'
import type { CapturedScript } from '@/types'
import { generateId } from '@/utils/generateId'
import { detectScriptType } from '@/utils/detectScriptType'
import { extractFilename } from '@/utils/extractFilename'

// Runs only in the DevTools panel context — chrome.devtools.* is available here.
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
    function onRequestFinished(request: chrome.devtools.network.Request): void {
      const url = request.request.url
      if (!isScriptUrl(url)) return

      request.getContent((content, _encoding) => {
        dispatchScript(url, content ?? '')
      })
    }

    chrome.devtools.network.onRequestFinished.addListener(onRequestFinished)

    // 2. Capture scripts already present in the inspected page (e.g. on panel open).
    chrome.devtools.inspectedWindow.getResources((resources) => {
      resources
        .filter((r) => {
          if (r.type !== 'script') return false
          if (!includeInline && r.url === '') return false
          return true
        })
        .forEach((resource) => {
          resource.getContent((content, _encoding) => {
            dispatchScript(resource.url || `inline-${generateId()}`, content ?? '')
          })
        })
    })

    return () => {
      chrome.devtools.network.onRequestFinished.removeListener(onRequestFinished)
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
