# 02 — Background Service Worker

**File:** `src/background/index.ts`

## Simple Version

**Analogy: A pizza delivery driver who sleeps between orders**

The background service worker is like a delivery driver who is asleep most of the time. The moment you ring the doorbell (click the toolbar icon), they wake up, drive to the restaurant (inject into the webpage), pick up all the pizzas (grab JS files), pack everything in one box (ZIP), and deliver it to your door (trigger a download). Then they go back to sleep.

They don't keep a notepad between deliveries — every time they wake up, they start fresh.

Here's what happens step-by-step when you click the icon:

```
1. You click the JS Grabber icon
2. Browser wakes up the service worker
3. Worker checks: is this an http/https page?
   → No: shows "N/A" badge and stops
   → Yes: continues
4. Badge turns purple "..."
5. Worker injects a tiny function into the webpage
6. That function reads the DOM and returns:
   - all <script src="..."> URLs
   - all inline <script> blocks
   - the page's own URL
7. Worker fetches page.html
8. Worker fetches each JS file one by one
9. All files are packed into a ZIP
10. ZIP is downloaded as hostname.zip
11. Badge turns green showing file count
    (or red "ERR" if something failed)
```

---

## Deep Version

### Entry Point: Action Click

```ts
browser.action.onClicked.addListener((tab) => {
  if (!tab.url.startsWith('http://') && !tab.url.startsWith('https://')) {
    // Extension pages, devtools:// URLs, etc. — can't inject into these
    browser.action.setBadgeText({ text: 'N/A', tabId: tab.id })
    return
  }
  captureAndDownload(tab.id, tab.url)
})
```

This guard is necessary because `browser.scripting.executeScript` throws if you try to inject into a privileged page like `chrome://settings` or `about:debugging`.

### Script Injection

```ts
const [injection] = await browser.scripting.executeScript({
  target: { tabId },
  func: () => ({
    externalUrls: Array.from(document.querySelectorAll('script[src]'))
      .map((el) => el.src)
      .filter((url) => url.startsWith('http')),
    inlineScripts: Array.from(document.querySelectorAll('script:not([src])'))
      .map((el) => el.textContent ?? '')
      .filter((t) => t.trim().length > 0),
    pageUrl: location.href,
  }),
})
```

`executeScript` serialises the return value as JSON and sends it back. This is why the injected `func` **cannot reference any closure variables** from the background script — it runs in a completely separate JS engine (the tab's renderer process). Only JSON-serialisable primitives can cross this boundary.

The `func` uses `querySelectorAll` to read only what the browser has already parsed into the live DOM, so it captures the exact runtime state — including dynamically-added scripts.

### ZIP Assembly Pipeline

```
injection.result
    │
    ├── pageUrl   ──► fetch(pageUrl)              → zip.file('page.html', ...)
    │
    ├── externalUrls[]
    │       └── for each url ──► fetch(url)       → zip.file('scripts/<path>', ...)
    │
    └── inlineScripts[]
            └── combined      ──► zip.file('scripts/inline-scripts.js', combined)
```

Each `fetch` is wrapped in its own `try/catch` so a single failed URL (CORS block, auth gate, 404) doesn't abort the entire batch.

### URL → ZIP Path Mapping

```ts
function urlToZipPath(url: string): string {
  const { hostname: host, pathname } = new URL(url)
  const clean = pathname.replace(/^\//, '').split('?')[0] || 'script.js'
  return clean.includes('/') ? clean : `${host}/${clean}`
}
```

| Input URL | ZIP path |
|-----------|----------|
| `https://example.com/static/js/app.js` | `static/js/app.js` |
| `https://cdn.example.com/lib.js` | `cdn.example.com/lib.js` |
| `https://example.com/lib.js?v=abc` | `lib.js` (query string stripped) |

Same-origin scripts use their pathname directly (leading `/` removed). Cross-origin scripts are prefixed with the CDN hostname to avoid name collisions.

### Why `data:` URI Instead of `URL.createObjectURL`

Service workers live outside the DOM — they have no access to `document`, `window`, or `URL.createObjectURL`. The only way to pass a binary blob to `browser.downloads.download` from a service worker is via a `data:` URI:

```ts
const base64 = await zip.generateAsync({ type: 'base64' })
await browser.downloads.download({
  url: `data:application/zip;base64,${base64}`,
  filename: `${hostname}.zip`,
})
```

This means the entire ZIP is held in memory as a base64 string before download. For large pages this can be several megabytes.

### Message Handler

The DevTools panel's "Download All" button sends a `DOWNLOAD_ALL` message. The background handles it:

```ts
browser.runtime.onMessage.addListener((message: unknown, _sender: unknown) => {
  return handleMessage(message as ExtensionMessage).catch((err) => ({
    success: false,
    error: err.message,
  }))
})
```

The polyfill's `onMessage` uses the **Promise return pattern** (not the old `sendResponse` callback + `return true` pattern used by raw `chrome.*`). Returning a Promise from the listener is how the polyfill signals an async response.

```
Panel                       Background
  │                              │
  │── sendMessage({type:'DOWNLOAD_ALL'}) ──►│
  │                              │
  │                    queries active tab
  │                    calls captureAndDownload()
  │                              │
  │◄── { success: true, data: null } ──────│
```

### Badge States

| State | Text | Color | Meaning |
|-------|------|-------|---------|
| Loading | `...` | Purple `#cba6f7` | Capture in progress |
| Success | `{n}` | Green `#a6e3a1` | n files downloaded |
| Non-HTTP | `N/A` | Grey `#45475a` | Not a web page |
| Error | `ERR` | Red `#f38ba8` | Something failed |

---

## Gotchas

- **Closure variables are invisible inside `func`.** Any variable defined outside the injected function — including imports — cannot be used inside it. The function is serialised to a string and re-evaluated in the page context.
- **The worker may be killed mid-ZIP.** MV3 service workers have a 5-minute hard timeout per activation. A page with hundreds of large scripts could hit this. There is no mechanism to resume a killed worker.
- **CORS blocks fetches, not DOM reads.** `querySelectorAll` can read script tags from any origin, but `fetch` will be blocked by CORS for cross-origin responses without the correct headers. Most CDN-served scripts do include `Access-Control-Allow-Origin: *`, but private APIs won't.
- **`data:` URIs for ZIPs have a size ceiling** in some browsers (~2GB in practice, but extension download APIs may impose lower limits).

---

## Quick Recap

- The background is a **sleeping service worker** that wakes on toolbar click.
- It **injects into the page** to read the live DOM for script URLs, then **fetches each file** separately.
- All files are **assembled into a ZIP in memory** and downloaded via a `data:` URI.
- It also **listens for messages** from the DevTools panel to trigger the same workflow.
