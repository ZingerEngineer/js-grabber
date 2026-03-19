# 01 — Architecture Overview

## Simple Version

**Analogy: A post office inside a browser**

Think of your browser as a building with many rooms. JS Grabber is a special employee who works in three different rooms at once:

1. **The mailroom (Background Service Worker)** — sits quietly in the background. When you click the toolbar button, it wakes up, runs into the webpage, grabs all the JavaScript files, packs them into a ZIP, and delivers it to your Downloads folder. Then it goes back to sleep.

2. **The inspection desk (DevTools Panel)** — only exists when you open DevTools. It watches every file the page loads in real time, like a security camera, and logs each JavaScript file it sees into a list.

3. **The front desk (Popup)** — the small window that opens when you click the extension icon. It just shows you how many scripts were found and points you toward the DevTools panel.

These three rooms can't directly talk to each other, so they pass typed notes (messages) through a central message bus.

---

## Deep Version

JS Grabber is a **Manifest V3 (MV3) Chrome/Firefox extension** built on a multi-context architecture. Each browser extension context is a separate JavaScript runtime with different APIs and lifetimes — they share no memory.

```
┌─────────────────────────────────────────────────────────────────────┐
│  BROWSER                                                            │
│                                                                     │
│  ┌──────────────────────┐     ┌──────────────────────────────────┐ │
│  │  Background SW       │     │  DevTools Window                 │ │
│  │  (service worker)    │     │  ┌────────────────────────────┐  │ │
│  │                      │     │  │  devtools/index.html       │  │ │
│  │  • action.onClicked  │     │  │  └─ devtools.ts            │  │ │
│  │  • scripting.execute │     │  │     registers panel tab    │  │ │
│  │  • downloads.download│     │  └────────────────────────────┘  │ │
│  │  • runtime.onMessage │     │  ┌────────────────────────────┐  │ │
│  │                      │     │  │  panel/index.html (SPA)    │  │ │
│  │  Lifetime: ephemeral │     │  │  • React + Redux           │  │ │
│  │  (terminated on idle)│     │  │  • TanStack Router         │  │ │
│  └──────────┬───────────┘     │  │  • useScriptCapture hook   │  │ │
│             │                 │  └────────────────────────────┘  │ │
│             │ runtime.sendMessage                                  │ │
│             │                 └──────────────────────────────────┘ │
│  ┌──────────┴───────────┐                                          │
│  │  Popup SPA           │     ┌──────────────────────────────────┐ │
│  │  popup/index.html    │     │  Options SPA                     │ │
│  │  • Status display    │     │  options/index.html              │ │
│  │                      │     │  • Settings form                 │ │
│  └──────────────────────┘     └──────────────────────────────────┘ │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Inspected Page (the website the user is browsing)          │   │
│  │  • script injection via browser.scripting.executeScript     │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### Two Capture Modes

The extension has two independent capture workflows:

| Mode | Trigger | Mechanism | Output |
|------|---------|-----------|--------|
| **One-shot ZIP** | Toolbar icon click | `scripting.executeScript` → DOM scan → `fetch` each URL | Single `hostname.zip` download |
| **Live DevTools panel** | Open DevTools → JS Grabber tab | `devtools.network.onRequestFinished` + `devtools.inspectedWindow.getResources` | Scrollable script list in panel |

### Context Isolation

Each SPA (panel, popup, options) instantiates its **own Redux store** in memory. They do not share live state. The only durable shared state is `browser.storage.local` (not yet wired up in the current version — state is in-memory per session).

### Tech Stack at a Glance

| Layer | Technology | Why |
|-------|-----------|-----|
| Language | TypeScript 5 (strict) | Type safety across isolated contexts |
| UI | React 19 | Function components + hooks |
| State | Redux Toolkit v2 | Predictable state, devtools |
| Routing | TanStack Router v1 (hash history) | Works on `chrome-extension://` URLs (no server) |
| Styling | Tailwind CSS v4 | Zero-runtime, utility-first |
| Build | Vite 6 + vite-plugin-web-extension | Multi-entry extension build |
| Polyfill | webextension-polyfill | Single `browser.*` API for Chrome + Firefox |
| ZIP | JSZip | In-memory ZIP generation |

---

## Gotchas

- **Service workers are ephemeral.** The background script is terminated after ~30 seconds of inactivity. Any in-memory state (variables, caches) is lost between activations. Everything durable must go to `browser.storage.local`.
- **Contexts don't share memory.** A Redux store in the panel SPA is completely separate from one in the popup SPA. Dispatching an action in one does not affect the other.
- **DevTools APIs are context-gated.** `browser.devtools.*` only works inside the devtools page (`devtools/index.html`) or the panel page (`panel/index.html`). Importing them in the background or content script will silently fail or throw.

---

## Quick Recap

- JS Grabber lives in **four isolated browser contexts**: background SW, devtools page, panel SPA, popup SPA.
- **Two capture modes**: one-shot ZIP (toolbar click) and live capture (DevTools panel).
- Contexts communicate via **typed messages** (`browser.runtime.sendMessage`).
- The build system produces **separate outputs** for Chrome (`dist/chrome/`) and Firefox (`dist/firefox/`) from a single source tree.
