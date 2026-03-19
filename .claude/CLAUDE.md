# CLAUDE.md — JS Grabber Development Guide

This file contains all coding conventions, architectural rules, and style guidelines for the JS Grabber Chrome extension. Follow every rule here when reading, writing, or modifying code in this project.

---

## Project Purpose

A Chrome DevTools extension (Manifest V3) that captures all JavaScript files and bundles loaded by an inspected webpage, displays them in a DevTools panel, and allows the user to download them individually or in bulk.

---

## Tech Stack & Versions

| Tool | Version | Notes |
|------|---------|-------|
| TypeScript | 5+ | Strict mode on. No `any` without explicit cast + comment |
| React | 19 | Function components only. No class components |
| Tailwind CSS | v4 | Use `@tailwindcss/vite` plugin. Import via `@import "tailwindcss"` |
| Redux Toolkit | v2 | `createSlice`, `configureStore`, `createAsyncThunk` only |
| TanStack Router | v1 | File-based routing with `@tanstack/router-plugin/vite`. Hash-based (`hashHistory`) since there is no server |
| Vite | 6+ | Multi-entry. Use `vite-plugin-web-extension` for Chrome extension bundling |
| Vitest | latest | Unit tests co-located with source. Integration tests in `src/__tests__/` |
| React Testing Library | latest | Test behavior, not implementation |
| pnpm | latest | Do not use npm or yarn |

---

## Chrome Extension Architecture (MV3)

### Entry Points

| Entry | Location | Description |
|-------|----------|-------------|
| Background service worker | `src/background/index.ts` | Non-persistent. Handles download coordination, chrome.storage |
| DevTools page | `src/devtools/index.ts` | Registers the DevTools panel. No UI here |
| DevTools panel SPA | `src/panel/` | Main UI. Access to `chrome.devtools.*` APIs |
| Popup SPA | `src/popup/` | Minimal status UI. Opens panel or options |
| Options SPA | `src/options/` | Full settings page |
| Content script | `src/content/index.ts` | Injected into pages if needed |

### Chrome APIs Used

- `chrome.devtools.network` — intercept network requests to detect JS files
- `chrome.devtools.inspectedWindow` — eval in inspected page context
- `chrome.devtools.panels` — register the DevTools panel
- `chrome.storage.local` — persist settings and captured file list
- `chrome.runtime.sendMessage` / `chrome.runtime.onMessage` — cross-context messaging
- `chrome.downloads` — trigger file downloads

### Messaging Pattern

All cross-context communication MUST go through typed message contracts in `src/types/messages.ts`.

```ts
// Define discriminated union messages
type ExtensionMessage =
  | { type: 'SCRIPT_CAPTURED'; payload: CapturedScript }
  | { type: 'DOWNLOAD_FILE'; payload: { url: string; filename: string } }
  | { type: 'GET_SETTINGS' }
```

---

## Project Structure Rules

```
src/
├── background/          One file per concern: index.ts, downloadsHandler.ts, storageService.ts
├── content/             Minimal. Only what must run in page context
├── devtools/            Panel registration only
├── panel/               Main SPA (DevTools panel)
│   ├── routes/          TanStack Router file-based routes
│   ├── components/      Panel-specific components
│   └── main.tsx
├── popup/               Popup SPA
├── options/             Options SPA
├── store/               Redux store — shared across SPAs via chrome.storage sync
│   ├── index.ts         configureStore + exports
│   ├── hooks.ts         useAppDispatch, useAppSelector
│   └── slices/          One file per domain slice
├── components/          Truly shared, context-agnostic UI components
├── hooks/               Custom React hooks (use* prefix, domain-named)
├── utils/               Pure functions only. No side effects. No React
└── types/               Global interfaces, enums, message contracts
```

### File Naming

| Item | Convention | Example |
|------|-----------|---------|
| React components | PascalCase `.tsx` | `ScriptListItem.tsx` |
| Hooks | camelCase `use` prefix `.ts` | `useScriptCapture.ts` |
| Slices | camelCase `Slice` suffix `.ts` | `scriptsSlice.ts` |
| Utilities | camelCase `.ts` | `formatBytes.ts` |
| Types/interfaces | PascalCase `.ts` | `CapturedScript.ts` |
| Route files | TanStack Router convention | `index.tsx`, `$scriptId.tsx` |
| Test files | Same name + `.test.ts(x)` | `ScriptListItem.test.tsx` |

---

## TypeScript Rules

- **Strict mode**: `"strict": true` in tsconfig. This is non-negotiable.
- **No `any`**: Use `unknown` and narrow it. If `any` is unavoidable, add `// eslint-disable-next-line @typescript-eslint/no-explicit-any` + comment explaining why.
- **Explicit return types** on all exported functions and hooks.
- **Interface over type** for object shapes. `type` for unions and intersections.
- **Enums**: Use `const enum` for internal constants, string union types for API contracts.
- **Import order**: Node built-ins → external packages → internal (`@/` aliases) → relative
- **Path aliases**: Use `@/` for `src/`. Configure in `tsconfig.json` and `vite.config.ts`.

```ts
// Good
import { useState } from 'react'
import { useAppSelector } from '@/store/hooks'
import { ScriptListItem } from './ScriptListItem'
```

---

## React Rules

- **Function components only**. Arrow functions preferred for components.
- **Props interface**: Always define a `Props` interface in the same file, above the component.
- **Single responsibility**: A component does one thing. If JSX exceeds ~100 lines, split it.
- **Custom hooks** for all non-trivial logic. Components should mostly compose hooks + render JSX.
- **No inline styles**. Use Tailwind utility classes exclusively.
- **Key props**: Always use stable, unique IDs as keys. Never use array index as key.
- **Memoization**: Use `useMemo`/`useCallback` only when a measured performance problem exists. Don't prematurely optimize.

```tsx
// Good component structure
interface ScriptListItemProps {
  script: CapturedScript
  onDownload: (id: string) => void
}

const ScriptListItem = ({ script, onDownload }: ScriptListItemProps) => {
  return (
    <li className="flex items-center gap-2 px-3 py-2 hover:bg-slate-800">
      {/* ... */}
    </li>
  )
}

export { ScriptListItem }
```

---

## Tailwind CSS Rules (v4)

- Use Tailwind v4 with the `@tailwindcss/vite` plugin.
- Import in your root CSS: `@import "tailwindcss";`
- **No custom `tailwind.config.ts`** unless adding design tokens — v4 configures via CSS `@theme`.
- Define design tokens in `src/styles/theme.css` using CSS custom properties under `@theme`.
- **Component variants**: Use `cva` (class-variance-authority) for components with multiple variants.
- **No Tailwind `@apply`** in component files. Compose classes in JSX.
- Prefer Tailwind utility classes over arbitrary values `[value]`. If using arbitrary values often, it belongs in `@theme`.

```css
/* src/styles/theme.css */
@import "tailwindcss";

@theme {
  --color-surface: #1e1e2e;
  --color-surface-raised: #313244;
  --color-accent: #cba6f7;
  --font-mono: "JetBrains Mono", monospace;
}
```

---

## Redux Toolkit Rules

- **One slice per domain**: `scriptsSlice`, `settingsSlice`, `downloadQueueSlice`.
- **Typed hooks**: Always use `useAppDispatch` and `useAppSelector` from `src/store/hooks.ts`. Never use raw `useDispatch`/`useSelector`.
- **Selectors**: Define `select*` selectors at the bottom of each slice file. Export and use them — never select raw state paths inline.
- **Async thunks**: Use `createAsyncThunk` for any async operation. Handle all three states (pending/fulfilled/rejected) in `extraReducers`.
- **Immutability**: RTK uses Immer — write mutating code in reducers. Do not spread unless outside a reducer.
- **No business logic in components**: All state mutation logic lives in slices/thunks. Components only dispatch and select.

```ts
// src/store/slices/scriptsSlice.ts
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'
import type { RootState } from '@/store'

export interface CapturedScript {
  id: string
  url: string
  filename: string
  sizeBytes: number
  capturedAt: number
  content?: string
}

interface ScriptsState {
  items: CapturedScript[]
  status: 'idle' | 'loading' | 'error'
  error: string | null
}

const initialState: ScriptsState = {
  items: [],
  status: 'idle',
  error: null,
}

export const scriptsSlice = createSlice({
  name: 'scripts',
  initialState,
  reducers: {
    scriptCaptured: (state, action: PayloadAction<CapturedScript>) => {
      state.items.push(action.payload)
    },
    scriptsCleared: (state) => {
      state.items = []
    },
  },
})

export const { scriptCaptured, scriptsCleared } = scriptsSlice.actions

// Selectors
export const selectAllScripts = (state: RootState) => state.scripts.items
export const selectScriptById = (id: string) => (state: RootState) =>
  state.scripts.items.find((s) => s.id === id)

export default scriptsSlice.reducer
```

---

## TanStack Router Rules

- **File-based routing** via `@tanstack/router-plugin/vite`.
- **Hash history** (`hashHistory`) — Chrome extension pages are served as `chrome-extension://` URLs with no server.
- Routes live in `src/panel/routes/` and `src/options/routes/`.
- **Route naming**: Follow TanStack conventions: `index.tsx`, `settings.tsx`, `$scriptId.tsx`.
- **Lazy loading**: Use `autoCodeSplitting: true` in the Vite plugin config.
- **Search params**: Use TanStack Router's typed search params for filters/pagination — not query strings manually parsed.
- **No `useNavigate` from React Router** — this project uses TanStack Router only.

```tsx
// src/panel/routes/index.tsx
import { createFileRoute } from '@tanstack/react-router'
import { ScriptListPage } from '@/panel/components/ScriptListPage'

export const Route = createFileRoute('/')({
  component: ScriptListPage,
})
```

---

## Testing Rules

- **Co-locate unit tests**: `ScriptListItem.test.tsx` next to `ScriptListItem.tsx`.
- **Integration tests**: `src/__tests__/` for multi-module flows.
- **RTL principles**: Query by role/label/text. No `querySelector`. No snapshot tests.
- **Coverage target**: 80% for utilities and slices. Components: test behavior, not markup.
- **Mock Chrome APIs**: Use a `__mocks__/chrome.ts` global mock. Never import chrome APIs directly in tested code — wrap them in service modules.
- **No mocking of Redux store**: Use `renderWithProviders` helper that wraps with a real store.

```ts
// src/utils/formatBytes.test.ts
import { describe, it, expect } from 'vitest'
import { formatBytes } from './formatBytes'

describe('formatBytes', () => {
  it('formats bytes under 1KB', () => {
    expect(formatBytes(512)).toBe('512 B')
  })
  it('formats kilobytes', () => {
    expect(formatBytes(1024)).toBe('1.0 KB')
  })
})
```

---

## Chrome Extension Specific Rules

- **No `localStorage`**: Use `chrome.storage.local` (or `chrome.storage.sync` for settings < 8KB). Wrap in a `storageService.ts` utility.
- **No `window.location`** in extension pages: Use TanStack Router navigation.
- **Content Security Policy**: MV3 has strict CSP. No inline scripts, no `eval`, no remote script loads.
- **Service worker**: Background script is a service worker — no persistent state in memory. Persist everything to `chrome.storage`.
- **DevTools APIs** are only available in `src/devtools/` and `src/panel/` contexts. Do not import `chrome.devtools.*` from background or content scripts.
- **Permissions**: Only request permissions actually used in `manifest.json`. Justify each permission with a comment.

---

## Git & Commit Rules

- Commits follow [Conventional Commits](https://www.conventionalcommits.org/):
  - `feat:` new feature
  - `fix:` bug fix
  - `chore:` tooling, deps, config
  - `refactor:` no behavior change
  - `test:` tests only
  - `docs:` documentation only
- Branch naming: `feat/short-description`, `fix/short-description`
- No commits directly to `main`. Use PRs or feature branches.

---

## What NOT to Do

- Do not use class components, HOCs, or render props — use hooks and composition.
- Do not use `React.FC` type — just type props directly.
- Do not use `default export` for components — use named exports.
- Do not use `any` without a justification comment.
- Do not write reducers outside of slices.
- Do not access `state.scripts.items` directly in components — use selectors.
- Do not use `npm` or `yarn` — use `pnpm` only.
- Do not store sensitive page content in `chrome.storage.sync` (size limit + syncs to cloud).
- Do not skip TypeScript errors with `@ts-ignore` — fix the type or use `@ts-expect-error` with a comment.
