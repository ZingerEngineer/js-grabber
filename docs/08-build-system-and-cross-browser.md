# 08 — Build System & Cross-Browser Compatibility

**Files:** `vite.config.ts`, `package.json`, `manifest.json`

## Simple Version

**Analogy: A factory that makes two versions of the same product**

Imagine a factory that builds USB chargers. Chrome and Firefox use slightly different plug standards. The factory uses the same components and wiring, but at the end of the line, it attaches a different plug depending on which country the charger is for. The core product is identical.

JS Grabber works the same way:

- The source code is **one codebase** using `browser.*` everywhere (via `webextension-polyfill`)
- At build time, you tell the factory: `TARGET_BROWSER=chrome` or `TARGET_BROWSER=firefox`
- The factory packages everything the same way, but:
  - **Chrome** gets a `service_worker` in the manifest
  - **Firefox** gets `scripts[]` in the manifest (Firefox doesn't support `service_worker` yet) plus a Firefox-specific ID

The outputs land in separate folders: `dist/chrome/` and `dist/firefox/`.

```
pnpm build:chrome  →  dist/chrome/manifest.json  (service_worker)
pnpm build:firefox →  dist/firefox/manifest.json (scripts[] + gecko id)
```

---

## Deep Version

### The Multi-Entry Build Problem

A browser extension is not a single web page — it has **multiple entry points** that all need to be built together:

| Entry | Source | Output |
|-------|--------|--------|
| Background | `src/background/index.ts` | `dist/*/src/background/index.js` |
| DevTools page | `src/devtools/index.html` | `dist/*/src/devtools/index.html` + bundled JS |
| Panel SPA | `src/panel/index.html` | `dist/*/src/panel/index.html` + bundled JS |
| Popup SPA | `src/popup/index.html` | `dist/*/src/popup/index.html` + bundled JS |
| Options SPA | `src/options/index.html` | `dist/*/src/options/index.html` + bundled JS |
| Manifest | `manifest.json` | `dist/*/manifest.json` (possibly patched) |
| Icons | `public/icons/*.png` | `dist/*/icons/*.png` |

`vite-plugin-web-extension` reads `manifest.json` to discover all these entry points automatically and wires up the Vite build to process each one.

### `vite.config.ts` Walkthrough

```ts
import { readFileSync } from 'fs'

const TARGET_BROWSER = (process.env.TARGET_BROWSER ?? 'chrome') as 'chrome' | 'firefox'

function buildManifest(): object {
  const manifest = JSON.parse(readFileSync('./manifest.json', 'utf-8'))

  if (TARGET_BROWSER === 'firefox') {
    manifest.background = { scripts: ['src/background/index.ts'], type: 'module' }
    manifest.browser_specific_settings = {
      gecko: { id: 'js-grabber@zingerengineer', strict_min_version: '128.0' },
    }
  }

  return manifest
}
```

**`readFileSync` at config time** — this runs during Vite's config evaluation phase, before any build starts. The function is called when `vite-plugin-web-extension` needs the manifest.

**Why a function, not a static object?** `vite-plugin-web-extension` accepts `manifest` as either a plain object or a function. Using a function means `buildManifest` is called lazily, after `TARGET_BROWSER` is resolved. If it were a top-level object literal, the patching logic would be harder to express.

**The Firefox patch:**

| Key | Chrome value | Firefox value | Why |
|-----|-------------|---------------|-----|
| `background.service_worker` | `"src/background/index.ts"` | removed | Firefox 128 doesn't support `service_worker` in MV3 |
| `background.scripts[]` | absent | `["src/background/index.ts"]` | Firefox's MV3 background model |
| `browser_specific_settings.gecko.id` | absent | `"js-grabber@zingerengineer"` | Firefox requires an extension ID for `about:debugging` load |
| `gecko.strict_min_version` | absent | `"128.0"` | `browser.devtools.panels` available from Firefox 128 |

`manifest.json` on disk **remains Chrome-only** — it's the source of truth for Chrome. The Firefox patch is applied at build time and only exists in `dist/firefox/`.

### Plugin Stack

```ts
plugins: [
  tailwindcss(),          // Tailwind v4 — must run before React transforms
  react(),                // JSX → JS, Fast Refresh in dev
  webExtension({
    manifest: buildManifest,
    additionalInputs: ['src/panel/index.html'],
    browser: TARGET_BROWSER,
  }),
]
```

**`additionalInputs`:** The panel page is loaded dynamically from the DevTools context (not referenced directly in the manifest). Without this, Vite wouldn't know to build it as a separate entry point.

**`browser: TARGET_BROWSER`:** Passed to `vite-plugin-web-extension` so it can apply browser-specific output processing (e.g. Firefox add-on ID injection, CSP patching).

### Output Directory

```ts
build: {
  emptyOutDir: true,
  outDir: `dist/${TARGET_BROWSER}`,
}
```

`emptyOutDir: true` wipes the target folder before each build. This prevents stale chunks from an old build (renamed files, deleted components) from silently persisting.

### npm Scripts

```json
"dev":           "pnpm dev:chrome",
"dev:chrome":    "TARGET_BROWSER=chrome vite build --watch",
"dev:firefox":   "TARGET_BROWSER=firefox vite build --watch",
"build":         "pnpm build:all",
"build:chrome":  "TARGET_BROWSER=chrome vite build",
"build:firefox": "TARGET_BROWSER=firefox vite build",
"build:all":     "pnpm build:chrome && pnpm build:firefox"
```

`--watch` mode rebuilds incrementally on save — no dev server needed (extension pages are loaded directly by the browser from the `dist/` folder, not through a Vite server).

### `webextension-polyfill` — The `browser.*` Abstraction

Without the polyfill, you'd write:
- **Chrome:** `chrome.tabs.query(...)` returns a value via callback
- **Firefox:** `browser.tabs.query(...)` returns a Promise

The polyfill wraps every Chrome API to return Promises and exposes them under `browser.*`. Source code becomes browser-agnostic:

```ts
import browser from 'webextension-polyfill'

// Works on both Chrome and Firefox
const tabs = await browser.tabs.query({ active: true, currentWindow: true })
```

**What the polyfill does NOT wrap:**
- `browser.devtools.inspectedWindow.getResources()` — Chrome-only API, no Firefox equivalent
- HAR object methods like `request.getContent()` and `resource.getContent()` — DevTools Protocol objects, not extension APIs

These two cases require manual type assertions and Chrome-specific fallback handling in `useScriptCapture.ts`.

### `@types/chrome` Removal

```bash
pnpm remove @types/chrome
```

Removing `@types/chrome` is intentional. It prevents accidental use of `chrome.*` APIs in source code — if you write `chrome.tabs.query(...)`, TypeScript now errors because `chrome` is not in scope. All code must go through `browser.*`.

### Build Output Structure

```
dist/
├── chrome/
│   ├── manifest.json          ← service_worker, no gecko
│   ├── icons/
│   │   ├── icon16.png
│   │   └── ...
│   ├── src/
│   │   ├── background/
│   │   │   └── index.js       ← bundled background SW
│   │   ├── devtools/
│   │   │   ├── index.html
│   │   │   └── devtools.js
│   │   └── panel/
│   │       ├── index.html
│   │       └── main.js
│   └── assets/                ← shared chunks (React, RTK, etc.)
│       └── *.js
└── firefox/
    ├── manifest.json          ← scripts[], gecko id
    └── ... (same structure)
```

### `.gitignore`

```
dist/chrome/
dist/firefox/
```

Both build outputs are git-ignored. The source code and `manifest.json` are versioned; the built artifacts are ephemeral and reproducible.

---

## Gotchas

- **`TARGET_BROWSER` is not validated at runtime.** Any string value is accepted at the shell level — `TARGET_BROWSER=safari vite build` would produce `dist/safari/` with a Chrome manifest, because the `if (TARGET_BROWSER === 'firefox')` branch wouldn't fire. The TypeScript cast `as 'chrome' | 'firefox'` is only compile-time.
- **The panel page must be in `additionalInputs`.** If you remove it, Vite skips building `src/panel/index.html` entirely. The DevTools panel would load a blank page. This is easy to miss because the manifest itself doesn't reference the panel directly (only the devtools page does, dynamically via `panels.create`).
- **`--watch` is not `--dev`.** Watch mode still runs a production-like build — there's no HMR (Hot Module Replacement). Changes require a full extension reload in `chrome://extensions` (or clicking the refresh icon). Browser extension development lacks the fast-refresh experience of a web app.
- **The `type: 'module'` in the Firefox background patch** tells Firefox the background script is an ES module. Without it, `import` statements would fail. The Chrome side already has this in `manifest.json`.
- **Firefox requires a stable extension ID for `storage.sync`** and signed releases. The `gecko.id` value in the Firefox manifest patch (`js-grabber@zingerengineer`) must be consistent across releases.

---

## Quick Recap

- `TARGET_BROWSER` env var selects the build target; `vite.config.ts` applies Firefox-only manifest patches at build time.
- **`manifest.json` is the Chrome source of truth** — never modified directly for Firefox.
- `webextension-polyfill` provides a unified `browser.*` API; `@types/chrome` is removed to enforce this.
- Two separate outputs: `dist/chrome/` and `dist/firefox/`, both git-ignored.
- **`additionalInputs`** is required for the panel SPA because it's not referenced directly in the manifest.
