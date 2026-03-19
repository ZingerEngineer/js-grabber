# 06 — Redux Store & State Management

**Files:** `src/store/`, `src/types/index.ts`

## Simple Version

**Analogy: A whiteboard in the panel's conference room**

The Redux store is like a whiteboard that every component in the panel SPA can read from and write to. When a new script is captured, someone writes it on the whiteboard. When a component needs the script list, it reads the whiteboard. When the user hits "Clear", someone erases the whiteboard.

The whiteboard has two sections:

1. **Scripts section** — the list of captured scripts, which one is selected, and status flags
2. **Settings section** — user preferences (auto-capture on/off, exclusion patterns, size limit)

Only approved "writers" (Redux actions) can change the whiteboard — no component scribbles on it directly.

---

## Deep Version

### Store Configuration

```ts
// src/store/index.ts
export const store = configureStore({
  reducer: {
    scripts: scriptsReducer,
    settings: settingsReducer,
  },
  devTools: process.env.NODE_ENV !== 'production',
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
```

The store combines two slices into a single state tree:

```
RootState {
  scripts: ScriptsState
  settings: CaptureSettings
}
```

`devTools` is enabled in development so Redux DevTools (browser extension) can inspect state and replay actions.

### Typed Hooks

```ts
// src/store/hooks.ts
export const useAppDispatch = useDispatch.withTypes<AppDispatch>()
export const useAppSelector = useSelector.withTypes<RootState>()
```

These are thin wrappers that bake the `RootState` and `AppDispatch` types in permanently. This means TypeScript knows the full shape of state when you call `useAppSelector` — no type casting needed in components.

**Rule:** Always import `useAppDispatch` and `useAppSelector` from `@/store/hooks`, never the raw versions from `react-redux`.

---

### Slice 1: `scriptsSlice`

**State shape:**
```ts
interface ScriptsState {
  items: CapturedScript[]   // all captured scripts
  selectedId: string | null // which script is "focused" (detail view)
  status: 'idle' | 'loading' | 'error'
  error: string | null
}
```

**Actions:**

| Action | Reducer logic | When dispatched |
|--------|--------------|-----------------|
| `scriptCaptured(script)` | Push to `items` if URL not already present | `useScriptCapture` → network event |
| `scriptSelected(id \| null)` | Set `selectedId` | (reserved for future use) |
| `scriptsCleared()` | Reset `items = []`, `selectedId = null` | User clicks "Clear" button |

**Deduplication:**
```ts
scriptCaptured: (state, action: PayloadAction<CapturedScript>) => {
  const exists = state.items.some((s) => s.url === action.payload.url)
  if (!exists) {
    state.items.push(action.payload)
  }
},
```

Deduplication is by **URL equality**. The same JS file can fire multiple network events (e.g. from cache validation, multiple frames). Only the first capture per URL is kept. Note: two inline scripts with different synthesised URLs (`inline-<uuid>`) would both be kept.

**Selectors:**

```ts
selectAllScripts    // → CapturedScript[]
selectSelectedId    // → string | null
selectScriptCount   // → number
selectScriptById(id) // → (state) => CapturedScript | undefined
```

`selectScriptById` is a **selector factory** — it returns a selector function, not a value. This lets you call it inline in a component:

```ts
const script = useAppSelector(selectScriptById(scriptId))
// equivalent to:
// useAppSelector(state => state.scripts.items.find(s => s.id === scriptId))
```

---

### Slice 2: `settingsSlice`

**State shape** (same as `CaptureSettings` type):
```ts
interface CaptureSettings {
  autoCapture: boolean         // master on/off switch for live capture
  includeInline: boolean       // whether to capture <script> blocks without src
  excludePatterns: string[]    // URL substrings to ignore
  maxFileSizeBytes: number     // default: 10 MB
}
```

**Default values:**
```ts
const initialState: CaptureSettings = {
  autoCapture: true,
  includeInline: false,
  excludePatterns: ['chrome-extension://', 'devtools://'],
  maxFileSizeBytes: 10 * 1024 * 1024,
}
```

The exclusion defaults block extension scripts from being captured (extensions inject their own scripts into pages — usually noise).

**Actions:**

| Action | Reducer logic |
|--------|--------------|
| `settingsUpdated(partial)` | Merge patch: `{ ...state, ...payload }` |
| `settingsReset()` | Return `initialState` |

`settingsUpdated` takes a `Partial<CaptureSettings>` — you only send the fields that changed:

```ts
dispatch(settingsUpdated({ autoCapture: false }))
// state becomes: { autoCapture: false, includeInline: false, ... }
```

---

### The `CapturedScript` Type

```ts
interface CapturedScript {
  id: string          // UUID, generated at capture time
  url: string         // full request URL (or 'inline-<uuid>' for inline)
  filename: string    // last path segment, e.g. 'app.chunk.js'
  sizeBytes: number   // content.length (UTF-16 units)
  capturedAt: number  // Date.now() timestamp
  content?: string    // full source text (optional — could be stripped for perf)
  type: ScriptType    // 'bundle' | 'module' | 'worker' | 'inline' | 'unknown'
}
```

`content` is optional to allow future implementations that store metadata without the full source. Currently it's always populated at capture time.

### State Flow Diagram

```
useScriptCapture (hook)
        │
        │  dispatch(scriptCaptured(script))
        ▼
  scriptsSlice.reducer
        │  appends to items[] if URL is new
        ▼
  store.getState().scripts.items[]
        │
        │  useAppSelector(selectAllScripts)
        ▼
  ScriptListPage renders list
        │
        │  user clicks row → navigate to /$scriptId
        ▼
  ScriptDetailPage
        │  useAppSelector(selectScriptById(scriptId))
        ▼
  renders source + Download button


SettingsPage
        │  user changes checkbox
        │  dispatch(settingsUpdated({ autoCapture: false }))
        ▼
  settingsSlice.reducer
        │  merges partial update
        ▼
  store.getState().settings.autoCapture === false
        │
        │  useAppSelector(selectAutoCapture) → false
        ▼
  useScriptCapture skips effect → no listeners registered
```

### Why Not `localStorage` or `chrome.storage`?

The current implementation stores all state **in-memory** within the Redux store. This means:

- Closing DevTools → state is lost (captured scripts disappear)
- Refreshing the panel → state is lost
- The popup SPA sees `count = 0` because it has its own separate store instance

Persisting to `chrome.storage.local` is the correct long-term solution (and is noted in `CLAUDE.md`), but is not yet wired up. The settings slice is a natural candidate for `storage.sync` (small, user-specific).

---

## Gotchas

- **Each SPA has its own store instance.** The panel, popup, and options page each call `configureStore` independently. State in one is completely invisible to the others. The comment in `src/popup/App.tsx` explicitly calls this out.
- **RTK uses Immer in reducers.** Inside `createSlice` reducers, you write mutating code (`state.items.push(...)`) and Immer produces an immutable update behind the scenes. Outside reducers (e.g. in selectors or components), treat state as immutable — never mutate it directly.
- **`selectScriptById` is a factory, not a selector.** Calling `selectScriptById('abc')` returns a function. Calling that function with state returns the script. This is called a "curried selector" pattern.
- **`settingsUpdated` uses spread, not Immer mutation.** The reducer returns `{ ...state, ...action.payload }` rather than mutating `state`. Both styles work in RTK — the spread approach is more appropriate here because the entire settings object can be replaced wholesale.

---

## Quick Recap

- The store has two slices: **`scripts`** (captured file list) and **`settings`** (user preferences).
- **Deduplication** in `scriptCaptured` prevents the same URL from appearing twice.
- **Typed hooks** (`useAppDispatch`, `useAppSelector`) enforce full type safety throughout.
- State is **in-memory only** — closing DevTools clears everything. `chrome.storage` persistence is the next step.
