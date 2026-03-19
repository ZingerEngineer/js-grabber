# 04 — DevTools Panel SPA

**Files:** `src/panel/`

## Simple Version

**Analogy: A live security monitor room**

Once you click the JS Grabber tab in DevTools, a small app loads — like a live security monitor room. It shows you every JavaScript file the page loads, one by one, as they arrive. You can scroll through the list, click on a file to read its source code, and download any file you want.

The room has three areas:

1. **The toolbar** — a filter box to search scripts, a file count, and a "Clear" button
2. **The list** — every captured script shown as a row with its name, type badge, and size
3. **The detail view** — click a row and the whole panel switches to show that script's full source code with a Download button

---

## Deep Version

### Entry Point: `main.tsx`

```ts
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Provider store={store}>        {/* Redux context */}
      <RouterProvider router={router} />  {/* TanStack Router */}
    </Provider>
  </React.StrictMode>,
)
```

The panel boots as a standard React SPA. The Redux `store` (from `src/store/index.ts`) and the TanStack Router `router` (from `src/panel/App.tsx`) are the two foundational providers wrapping everything.

### Routing: `src/panel/App.tsx`

The panel uses **manual (code-based) route definitions**, not TanStack Router's file-based plugin:

```ts
const rootRoute = createRootRoute({
  component: () => (
    <PanelLayout>
      <Outlet />    {/* child route renders here */}
    </PanelLayout>
  ),
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: ScriptListPage,
})

const scriptDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/$scriptId',
  component: ScriptDetailPage,
})

const router = createRouter({
  routeTree: rootRoute.addChildren([indexRoute, scriptDetailRoute]),
  history: createHashHistory(),   // ← hash-based: chrome-extension://...#/
})
```

**Why hash history?** Extension pages are served from `chrome-extension://<id>/src/panel/index.html`. There is no server to handle path-based navigation, so `createHashHistory()` appends routes as URL fragments (`#/`, `#/$scriptId`). The browser never sends these to a server.

**Why manual routes?** TanStack Router's file-based routing produces Rollup chunk filenames starting with `$` (e.g. `$scriptId.tsx`). Rollup renames `$`-prefixed chunks to `_`-prefixed filenames. Chrome MV3 **forbids** extension resources whose names start with `_`. Manual routes avoid this entirely.

### Route Tree Diagram

```
chrome-extension://<id>/src/panel/index.html
         │
         ▼
   rootRoute (PanelLayout wrapper)
         │
    ┌────┴────┐
    │         │
  #/         #/$scriptId
    │              │
ScriptListPage  ScriptDetailPage
```

### Component Breakdown

#### `PanelLayout`

The persistent shell — header bar with the "JS Grabber" title, wrapping an `<Outlet>` that swaps between the list and detail views:

```
┌──────────────────────────────────────┐
│  JS Grabber                  header  │
├──────────────────────────────────────┤
│                                      │
│   <Outlet />  (ScriptListPage or     │
│                ScriptDetailPage)     │
│                                      │
└──────────────────────────────────────┘
```

#### `ScriptListPage`

The main view at route `/`. Three responsibilities:

1. **Mounts `useScriptCapture()`** — activates all DevTools network listening (see doc 05).
2. **Filters the script list** — local `filter` state gates what's shown.
3. **Renders `ScriptListItem` rows** — each clickable row navigates to `#/$scriptId`.

```
ScriptListPage
├── useScriptCapture()          [side effect: starts listening]
├── useAppSelector(selectAllScripts) → scripts[]
├── local filter state
│
├── <input type="search" />     [controlled, updates filter]
├── <span>{n} files</span>
├── <Button onClick=scriptsCleared>Clear</Button>
│
└── <ul>
      └── scripts
            .filter(matchesFilter)
            .map(script => <ScriptListItem key={script.id} script={script} />)
    </ul>
```

#### `ScriptListItem`

A pure presentational row. On click it navigates to the script's detail view using TanStack Router's `useNavigate`:

```ts
navigate({ to: '/$scriptId', params: { scriptId: script.id } })
```

```
┌─────────────────────────────────────────────┐
│ [BUNDLE] app.chunk.js              142.3 KB │
│ [MODULE] react.esm.js               14.1 KB │
│ [INLINE] (inline)                    0.5 KB │
└─────────────────────────────────────────────┘
   ↑Badge  ↑filename (truncated)       ↑size
```

The `Badge` component colour-codes the script type:

| Type | Colour |
|------|--------|
| `bundle` | Amber |
| `module` | Purple (accent) |
| `worker` | Green |
| `inline` | Red |
| `unknown` | Grey |

#### `ScriptDetailPage`

Mounted at `#/$scriptId`. Reads `scriptId` from route params and selects that script from the store:

```ts
const { scriptId } = scriptDetailRoute.useParams()
const script = useAppSelector(selectScriptById(scriptId))
```

If the ID is invalid or the store was cleared, it shows a "not found" fallback with a back button. Otherwise it renders the script's full source in a `<pre>` block and a Download button that calls `downloadScript(script)` — a pure utility that creates a Blob URL and triggers an anchor click.

### Data Flow Summary

```
DevTools Network
       │
       ▼
useScriptCapture (hook)
       │  dispatches scriptCaptured(script)
       ▼
Redux store (scripts slice)
       │  state.scripts.items[]
       ▼
useAppSelector(selectAllScripts)
       │
       ▼
ScriptListPage → renders ScriptListItem rows
       │  navigate({ to: '/$scriptId' })
       ▼
ScriptDetailPage ← selectScriptById(scriptId)
       │  downloadScript(script)
       ▼
    Downloads folder (Blob URL anchor click)
```

### Styling

The panel uses **Tailwind CSS v4** with design tokens defined in `src/styles/theme.css`:

```css
@theme {
  --color-surface: #1e1e2e;       /* dark background */
  --color-accent:  #cba6f7;       /* purple highlights */
  --font-mono: "JetBrains Mono";  /* everything monospace */
}
```

These become Tailwind utility classes automatically (`bg-surface`, `text-accent`, etc.). No custom config file is needed.

---

## Gotchas

- **`useScriptCapture` is mounted in `ScriptListPage`, not at the root.** If the user navigates to `ScriptDetailPage` directly, the hook is unmounted and network listening stops. Captured scripts remain in the store (navigation doesn't destroy Redux state), but new ones won't be added until the user goes back to `/`.
- **The popup has its own store.** `src/popup/App.tsx` also calls `useAppSelector(selectScriptCount)` but that count is always `0` because the popup mounts its own fresh Redux store — it can't see the panel's in-memory state.
- **`downloadScript` uses `URL.createObjectURL`.** This works fine inside the panel SPA (which has DOM access), but it would fail in the background service worker for the same reason the background uses `data:` URIs.
- **Hash history means no browser back-button support.** Navigating `#/` → `#/$scriptId` pushes a history entry, so the browser back button works. But refreshing the panel page will try to re-render `ScriptDetailPage` with a `scriptId` that no longer exists in the store (store is in-memory, not persisted).

---

## Quick Recap

- The panel is a **React SPA** with Redux for state and TanStack Router for navigation.
- **Hash-based routing** is required because there is no server behind `chrome-extension://` URLs.
- **Manual route definitions** avoid the `_`-prefix Rollup filename bug.
- `ScriptListPage` mounts the capture hook; `ScriptDetailPage` reads from the store by ID.
- The `Badge` component colour-codes scripts by their detected type (bundle, module, worker, inline, unknown).
