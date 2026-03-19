# 05 — `useScriptCapture` Hook

**File:** `src/hooks/useScriptCapture.ts`

## Simple Version

**Analogy: A librarian with two jobs**

Imagine a librarian who starts work when the panel opens. They have two jobs:

1. **Stand at the door** and log every new book (JavaScript file) that gets delivered while the library is open. This is the network listener — it catches every script the browser loads *after* the panel opens.

2. **Walk around and catalog books already on the shelves.** Some books were there before the librarian started. This is `getResources` — it scans scripts already loaded before the panel opened.

When the panel closes or the user turns off auto-capture, the librarian stops both jobs, tears up their notepad, and goes home.

```
Panel mounts
     │
     ▼
useScriptCapture()
     │
     ├── [Job 1] Start watching the door
     │     browser.devtools.network.onRequestFinished.addListener(...)
     │
     └── [Job 2] Walk the shelves (async)
           browser.devtools.inspectedWindow.getResources()
                 │
                 └── for each script resource → getContent() → dispatch

Panel unmounts / autoCapture toggled off
     │
     ▼
Cleanup runs:
   cancelled = true          (stops late async callbacks)
   removeListener(...)       (stops watching the door)
```

---

## Deep Version

`useScriptCapture` is a **side-effect hook** that bridges the DevTools Protocol APIs with the Redux store. It has no return value — it only produces side effects (dispatching `scriptCaptured` actions).

### Dependency Array

```ts
useEffect(() => {
  if (!autoCapture) return
  // ... setup
  return () => { /* cleanup */ }
}, [autoCapture, dispatch, excludePatterns, includeInline, maxFileSizeBytes])
```

The effect re-runs whenever any setting changes. This means if the user adds an exclusion pattern in the Options page, the hook tears down its listeners and re-registers them with the new filters baked in. This is correct but has a subtle cost: the `getResources` async IIFE also re-runs on each settings change, potentially re-capturing already-present scripts. The deduplication in `scriptsSlice` (`if exists, skip`) prevents duplicates.

### Job 1: Network Listener (Future Requests)

```ts
function onRequestFinished(request: unknown): void {
  const harRequest = request as HarNetworkRequest
  const url = harRequest.request.url
  if (!isScriptUrl(url)) return

  harRequest.getContent().then(([content]) => {
    dispatchScript(url, content ?? '')
  })
}

browser.devtools.network.onRequestFinished.addListener(onRequestFinished as any)
```

`onRequestFinished` fires for every completed network request in the inspected page — HTML, CSS, images, fonts, JS, XHR, fetch, etc. The `isScriptUrl` guard filters to `.js`, `.mjs`, `.cjs`, or `.js?` (query-parametrised JS URLs).

The polyfill wraps `request.getContent()` as a Promise returning `[content: string, encoding: string]`. Only the first element (raw text) is used.

```
browser.devtools.network.onRequestFinished
         │
         │  fires for every network request
         ▼
   onRequestFinished(request)
         │
         ├── isScriptUrl(url)?  ──No──► return
         │
         Yes
         │
         ▼
   request.getContent()  →  Promise<[content, encoding]>
         │
         ▼
   dispatchScript(url, content)
         │
         ▼
   Redux: scriptCaptured({ id, url, filename, sizeBytes, ... })
```

### Job 2: Existing Resources (Past Requests)

```ts
let cancelled = false
const inspectedWindow = browser.devtools.inspectedWindow as unknown as InspectedWindowWithResources

;(async () => {
  const resources = await inspectedWindow.getResources()
  if (cancelled) return
  resources
    .filter(r => r.type === 'script' && (includeInline || r.url !== ''))
    .forEach(resource => {
      resource.getContent((content, _encoding) => {
        if (cancelled) return
        dispatchScript(resource.url || `inline-${generateId()}`, content ?? '')
      })
    })
})()
```

`getResources()` returns all resources the browser has loaded for the inspected page — the equivalent of the Network panel's complete history. This is what enables the panel to show scripts even if you opened DevTools *after* the page had already loaded.

**Why two different APIs for content retrieval?**

| API | Style | Reason |
|-----|-------|--------|
| `network.Request.getContent()` | **Promise** (polyfill-wrapped) | Standard browser extension API |
| `resource.getContent(callback)` | **Callback** (HAR protocol) | DevTools Protocol object, not wrapped by polyfill |

`getResources()` is Chrome-only — the polyfill types don't include it because Firefox has no equivalent. The cast to `InspectedWindowWithResources` is required.

### The Cancellation Flag

```ts
let cancelled = false

;(async () => {
  const resources = await inspectedWindow.getResources()
  if (cancelled) return   // ← guard #1: effect cleaned up before getResources resolved
  resources.forEach(resource => {
    resource.getContent((content, _encoding) => {
      if (cancelled) return  // ← guard #2: cleanup happened between getResources and getContent
      dispatchScript(...)
    })
  })
})()

return () => {
  cancelled = true
  browser.devtools.network.onRequestFinished.removeListener(onRequestFinished)
}
```

The cleanup function (`return () => { ... }`) is synchronous — React calls it synchronously during unmount. But `getResources()` is asynchronous. Without the flag, this race is possible:

```
t=0  effect runs, starts async IIFE
t=1  component unmounts, cleanup runs (synchronous)
t=2  getResources() resolves  ← dispatch would fire on an unmounted component!
```

`cancelled = true` in the cleanup causes the async IIFE to bail out at `t=2`, preventing stale dispatch calls.

### `dispatchScript`: The Filter + Build Step

```ts
function dispatchScript(url: string, content: string): void {
  if (shouldExclude(url)) return       // pattern matching
  if (content.length > maxFileSizeBytes) return  // size cap

  const script: CapturedScript = {
    id: generateId(),
    url,
    filename: extractFilename(url),    // last path segment
    sizeBytes: content.length,
    capturedAt: Date.now(),
    content,
    type: detectScriptType(url),       // bundle/module/worker/inline/unknown
  }
  dispatch(scriptCaptured(script))
}
```

Two filters run before the object is built:
- **Exclusion patterns** — default excludes `chrome-extension://` and `devtools://` (scripts injected by extensions themselves)
- **Size cap** — default 10 MB; large minified bundles are still captured, but pathological cases are dropped

### `isScriptUrl`

```ts
function isScriptUrl(url: string): boolean {
  const { pathname } = new URL(url)
  const lower = pathname.toLowerCase()
  return (
    lower.endsWith('.js') || lower.endsWith('.mjs') ||
    lower.endsWith('.cjs') || lower.includes('.js?')
  )
}
```

Only path-based detection — no MIME type check. A URL like `https://cdn.com/loader?file=app.js` would match `.js?` and be captured. A URL ending in `.js` that actually serves JSON (misconfigured server) would also be captured. Content-type sniffing is not done for simplicity.

---

## Gotchas

- **`getResources` is Chrome-only.** On Firefox, `inspectedWindow.getResources` doesn't exist. The `await` will throw, caught by the `try/catch`, and only the network listener (Job 1) will work. Scripts loaded before the panel opened won't be backfilled on Firefox.
- **The effect re-runs on every settings change.** If the user opens Options and tweaks the size limit, the hook tears down and re-registers. The `getResources` backfill runs again, but `scriptsSlice`'s deduplication by URL prevents double-entries.
- **`content.length` is byte count in UTF-16, not UTF-8.** JavaScript strings are UTF-16. The `sizeBytes` field is actually the number of UTF-16 code units, not the on-wire byte size. For ASCII-only JS files this is identical to bytes, but for files with multi-byte characters it will differ.
- **Inline scripts get synthesised IDs as URLs.** An inline script has no URL, so it gets `inline-<uuid>` as its URL key. This means the same inline script can appear twice if `getResources` and `onRequestFinished` both capture it — `scriptsSlice` deduplicates by URL, and `inline-<uuid1>` ≠ `inline-<uuid2>`.

---

## Quick Recap

- The hook runs **two parallel capture jobs**: a network event listener for future requests and an async backfill for scripts already loaded.
- A **cancellation flag** prevents stale state updates after the component unmounts.
- **Two different content-retrieval styles** are used: Promise-based (polyfill) for network requests, callback-based (DevTools Protocol) for `getResources`.
- Every captured script is **filtered, built, and dispatched** to Redux as a `CapturedScript` object.
