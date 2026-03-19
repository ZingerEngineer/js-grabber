# JS Grabber — Documentation

Detailed explanation of every major piece of the codebase. Each doc covers a specific layer or module, with both a simple analogy-based explanation and a deep technical walkthrough.

## Contents

| # | Doc | What it covers |
|---|-----|---------------|
| 01 | [Architecture Overview](./01-architecture-overview.md) | How all the contexts fit together; two capture modes; tech stack |
| 02 | [Background Service Worker](./02-background-service-worker.md) | Toolbar click → DOM injection → ZIP assembly → download |
| 03 | [DevTools Entry & Panel Registration](./03-devtools-entry-and-panel-registration.md) | How the JS Grabber tab appears in DevTools |
| 04 | [Panel SPA](./04-panel-spa.md) | React app: routing, ScriptListPage, ScriptDetailPage, components |
| 05 | [`useScriptCapture` Hook](./05-usescriptcapture-hook.md) | Live network capture + backfill; cancellation pattern |
| 06 | [Redux Store](./06-redux-store.md) | `scriptsSlice`, `settingsSlice`, typed hooks, selectors |
| 07 | [Messaging System](./07-messaging-system.md) | Typed cross-context messages; polyfill Promise pattern |
| 08 | [Build System & Cross-Browser](./08-build-system-and-cross-browser.md) | Vite config; `TARGET_BROWSER`; manifest patching; polyfill |

## Quick Mental Model

```
You open a page in the browser
         │
         ├─► Click toolbar icon
         │         │
         │         ▼
         │   Background SW wakes up
         │   Injects into page → reads <script> tags
         │   Fetches each JS file
         │   Packs into ZIP → downloads
         │
         └─► Open DevTools → JS Grabber tab
                   │
                   ▼
             devtools.ts registers panel
                   │
                   ▼
             Panel SPA loads (React + Redux)
                   │
                   ├─► useScriptCapture() starts
                   │     ├── watches onRequestFinished (future scripts)
                   │     └── calls getResources() (past scripts)
                   │
                   └─► Scripts appear in the list
                         │
                         └─► Click a script → detail view → Download
```

## Reading Order

If you're new to the codebase, read in order: **01 → 02 → 03 → 04 → 05 → 06 → 07 → 08**.

If you're debugging a specific area, jump directly to the relevant doc.
