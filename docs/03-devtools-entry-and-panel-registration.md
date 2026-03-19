# 03 — DevTools Entry & Panel Registration

**Files:** `src/devtools/index.html`, `src/devtools/devtools.ts`

## Simple Version

**Analogy: A receptionist who adds a new tab to the counter**

When you open DevTools, the browser looks at the extension's manifest to find a "DevTools page". This is like a receptionist's office — it runs invisible code whose only job is to say: *"Hey DevTools, please add a new tab called 'JS Grabber' and load this HTML file inside it."*

Once that tab is added, the receptionist's job is done. The actual UI lives in the panel (the tab that was just registered).

```
You open DevTools
      │
      ▼
Browser loads devtools/index.html (invisible)
      │
      ▼
devtools.ts runs
      │
      ▼
browser.devtools.panels.create(
   name: 'JS Grabber',
   icon: 'icons/icon16.png',
   page: 'src/panel/index.html'
)
      │
      ▼
A new tab appears in the DevTools toolbar: [JS Grabber]
      │
      ▼
Clicking it loads panel/index.html (the real UI)
```

---

## Deep Version

### The DevTools Page Contract

MV3 manifests declare a `devtools_page` field:

```json
"devtools_page": "src/devtools/index.html"
```

The browser loads this page **once per DevTools window opening**, in a special context that has access to `browser.devtools.*` APIs. It is not a visible UI — `devtools/index.html` is essentially a blank HTML shell whose only purpose is to execute the registration script.

```html
<!-- src/devtools/index.html -->
<body>
  <script type="module" src="./devtools.ts"></script>
</body>
```

Vite bundles `devtools.ts` into a JS module. The HTML file is kept intentionally empty.

### Registration Code

```ts
// src/devtools/devtools.ts
import browser from 'webextension-polyfill'

browser.devtools.panels
  .create('JS Grabber', 'icons/icon16.png', 'src/panel/index.html')
  .then((panel) => console.log('[JS Grabber] DevTools panel registered.', panel))
  .catch((err) => console.error('[JS Grabber] Panel creation failed:', err))
```

`browser.devtools.panels.create` takes three arguments:

| Argument | Value | Notes |
|----------|-------|-------|
| `title` | `'JS Grabber'` | Tab label shown in DevTools toolbar |
| `iconPath` | `'icons/icon16.png'` | **Relative to extension root**, not an absolute URL |
| `pagePath` | `'src/panel/index.html'` | **Relative to extension root** — the panel SPA |

### Why Relative Paths

The API strictly requires **extension-relative paths** (not `chrome-extension://` absolute URLs). Using `browser.runtime.getURL('src/panel/index.html')` — which returns the absolute URL — would cause the API to reject the registration. The panel must be listed as a `web_accessible_resource` in the manifest so the DevTools context can load it.

### Context Availability

```
                    ┌──────────────────────────────────┐
                    │  What each context can access    │
                    ├──────────────┬───────────────────┤
  Context           │ devtools.*   │ runtime.* / tabs  │
  ──────────────────┼──────────────┼───────────────────┤
  Background SW     │     ✗        │        ✓          │
  DevTools page     │     ✓        │        ✓          │
  Panel SPA         │     ✓        │        ✓          │
  Popup / Options   │     ✗        │        ✓          │
  Content script    │     ✗        │     limited       │
  ──────────────────┴──────────────┴───────────────────┘
```

`browser.devtools.*` APIs are only available in the DevTools page and any page loaded from within DevTools (i.e. the panel SPA). Attempting to call them from the background service worker or popup will throw `TypeError: Cannot read properties of undefined`.

### Lifetime of the DevTools Page

The DevTools page lives as long as the DevTools window is open. It is a persistent context (unlike the background service worker which is ephemeral). However, because the page contains no UI, this persistence is not observable to the user.

When DevTools closes, the page is destroyed, and all `browser.devtools.*` event listeners (including `onRequestFinished` registered in the panel) are torn down automatically.

### The Panel SPA Relationship

```
devtools/index.html  ──registers──►  panel/index.html
     (invisible)                       (the UI)
                                           │
                                     Full React SPA
                                     Redux store
                                     TanStack Router
                                     useScriptCapture hook
```

The devtools page and the panel page are **two separate browsing contexts** — they don't share variables. The devtools page's only output is the side effect of calling `panels.create`, after which it is idle.

---

## Gotchas

- **`panels.create` is async.** If the panel HTML fails to load (wrong path, missing file), the Promise rejects silently — the tab just doesn't appear. Always check the devtools console for the `'Panel creation failed'` log.
- **Each DevTools window gets its own devtools page instance.** If you have two browser windows open with DevTools in both, `devtools.ts` runs twice, registering the panel twice (which is harmless — the browser deduplicates).
- **The `iconPath` must be declared in `web_accessible_resources`** (implicitly via the `assets/*` glob in the manifest) or it will silently not display.
- **Firefox quirk:** Firefox 128+ supports `browser.devtools.panels` via the polyfill, but `devtools.inspectedWindow.getResources` (used in the panel hook) is Chrome-only. The panel live-capture works differently on Firefox as a result.

---

## Quick Recap

- `devtools/index.html` is an **invisible shell** loaded once when DevTools opens.
- `devtools.ts` calls `browser.devtools.panels.create` to **add the JS Grabber tab** to the DevTools toolbar.
- All arguments are **extension-relative paths**, not absolute URLs.
- The panel SPA (`panel/index.html`) is an entirely separate context that gets loaded only when the user clicks the tab.
