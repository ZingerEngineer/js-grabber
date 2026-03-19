<div align="center">
  <img src="https://res.cloudinary.com/dxdkqsgfm/image/upload/v1773892818/js-grabber_1_xvsnsu.svg" alt="JS Grabber" width="120" />
  <h1>JS Grabber</h1>
  <p>A Chrome DevTools extension that captures and downloads all JavaScript bundles and source files from any webpage — in one click.</p>
</div>

---

## Features

- **One-click grab** — click the toolbar icon to instantly download all scripts + page source as a single ZIP
- **DevTools panel** — live script list with metadata (URL, size, type) as the page loads
- **Smart capture** — intercepts network requests via `chrome.devtools.network` and reads already-loaded resources
- **ZIP packaging** — all files bundled into `hostname.zip` with preserved URL path structure, no download spam
- **Filter & search** — filter scripts by filename or URL in the panel
- **Settings page** — configure capture rules, exclusion patterns, and file size limits

## How It Works

**Toolbar icon click:**
```
Click icon → inject into page → collect <script src> URLs + inline scripts
          → fetch page HTML + all JS files in background
          → pack into hostname.zip → one download
```

**DevTools panel:**
```
Open DevTools → JS Grabber tab → reload page
             → panel captures scripts as they load via chrome.devtools.network
             → browse, filter, preview, and download individual files
```

## Tech Stack

| Layer | Library | Version |
|-------|---------|---------|
| UI | React | 19 |
| Styling | Tailwind CSS | v4 |
| State | Redux Toolkit | v2 |
| Routing | TanStack Router | v1 |
| ZIP | JSZip | v3 |
| Build | Vite + vite-plugin-web-extension | latest |
| Language | TypeScript | 5 (strict) |
| Testing | Vitest + React Testing Library | latest |
| Package manager | pnpm | latest |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Toolbar Icon (action)                                      │
│  └── chrome.action.onClicked → background captureAndDownload│
├─────────────────────────────────────────────────────────────┤
│  Background Service Worker                                  │
│  ├── Executes script in tab to collect script URLs          │
│  ├── Fetches all files (cross-origin, no CORS limits)       │
│  ├── Packages into ZIP via JSZip                            │
│  └── Triggers single chrome.downloads call                  │
├─────────────────────────────────────────────────────────────┤
│  DevTools Panel SPA                                         │
│  ├── Captures scripts via chrome.devtools.network           │
│  ├── Reads existing resources via inspectedWindow           │
│  └── Script list → detail view (TanStack Router)            │
├─────────────────────────────────────────────────────────────┤
│  Options Page SPA                                           │
│  └── Auto-capture toggle, exclusion patterns, size limits   │
└─────────────────────────────────────────────────────────────┘
```

## Project Structure

```
js-grabber/
├── public/
│   └── icons/                   # Extension icons (16/32/48/128px)
├── src/
│   ├── background/
│   │   └── index.ts             # Service worker: action click → ZIP download
│   ├── content/
│   │   └── index.ts             # Content script (placeholder)
│   ├── devtools/
│   │   ├── index.html           # DevTools page entry
│   │   └── devtools.ts          # Registers the panel tab
│   ├── panel/                   # DevTools panel SPA
│   │   ├── index.html
│   │   ├── main.tsx
│   │   ├── App.tsx              # TanStack Router (hash history)
│   │   └── components/
│   ├── popup/                   # Popup SPA (reserved, not active)
│   ├── options/                 # Settings SPA
│   │   └── components/
│   │       └── SettingsPage.tsx
│   ├── store/                   # Redux Toolkit
│   │   ├── index.ts
│   │   ├── hooks.ts             # useAppDispatch / useAppSelector
│   │   └── slices/
│   │       ├── scriptsSlice.ts
│   │       └── settingsSlice.ts
│   ├── components/              # Shared UI (Button, Badge)
│   ├── hooks/
│   │   └── useScriptCapture.ts  # DevTools network capture hook
│   ├── utils/                   # Pure functions + tests
│   └── types/                   # Global interfaces & message contracts
├── manifest.json                # Chrome MV3 manifest
├── vite.config.ts
├── tsconfig.json
├── vitest.config.ts
└── package.json
```

## Getting Started

```bash
pnpm install
pnpm build        # production build → dist/
pnpm dev          # watch mode (rebuilds on save)
pnpm test         # Vitest
pnpm typecheck    # tsc --noEmit
```

### Load in Brave / Chrome

1. `pnpm build`
2. Open `brave://extensions` or `chrome://extensions`
3. Enable **Developer mode**
4. Click **Load unpacked** → select the `dist/` folder
5. The JS Grabber icon appears in your toolbar

### Using the Extension

| Action | Result |
|--------|--------|
| Click toolbar icon on any page | Downloads `hostname.zip` with all scripts + page source |
| Open DevTools → **JS Grabber** tab | Live panel — capture, browse, and download individual scripts |
| Extension icon badge | `...` loading · `N` files downloaded · `ERR` on failure |

## Contributing

See [CLAUDE.md](.claude/CLAUDE.md) for full development guidelines, coding conventions, and architectural decisions.
