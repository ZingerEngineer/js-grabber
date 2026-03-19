# JS Grabber

A Chrome DevTools extension that captures and downloads all JavaScript bundles and source files available in the **Sources** tab of Chrome DevTools.

## Features

- Intercepts and lists all JS files/bundles loaded by the inspected page
- Displays scripts in a DevTools panel with metadata (URL, size, type)
- Download individual files or bulk-export as a ZIP
- Filter/search by filename, URL, or content type
- Settings page to configure capture rules, exclusions, and storage

## Tech Stack

| Layer | Library | Version |
|-------|---------|---------|
| UI | React | 19 |
| Styling | Tailwind CSS | v4 |
| State | Redux Toolkit | v2 |
| Routing | TanStack Router | v1 |
| Build | Vite + vite-plugin-web-extension | latest |
| Language | TypeScript | 5+ |
| Testing | Vitest + React Testing Library | latest |
| Package manager | pnpm | latest |

## Chrome Extension Architecture

```
┌─────────────────────────────────────────────────────────┐
│  DevTools Panel (main UI)                               │
│  ├── Script list, filters, download controls            │
│  └── Uses chrome.devtools.network + chrome.devtools.inspectedWindow │
├─────────────────────────────────────────────────────────┤
│  Background Service Worker                              │
│  ├── Handles download coordination                      │
│  └── Manages extension storage (chrome.storage.local)  │
├─────────────────────────────────────────────────────────┤
│  Options Page (settings SPA)                            │
│  └── Capture rules, exclusion patterns, export prefs   │
├─────────────────────────────────────────────────────────┤
│  Popup                                                  │
│  └── Quick status + open panel shortcut                │
└─────────────────────────────────────────────────────────┘
```

## Project Structure

```
js-grabber/
├── src/
│   ├── background/          # MV3 service worker
│   │   └── index.ts
│   ├── content/             # Content scripts (if needed)
│   │   └── index.ts
│   ├── devtools/            # DevTools entry
│   │   ├── index.html
│   │   └── index.ts         # Registers the panel
│   ├── panel/               # DevTools panel SPA
│   │   ├── index.html
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   └── routes/          # TanStack Router file-based routes
│   ├── popup/               # Extension popup SPA
│   │   ├── index.html
│   │   ├── main.tsx
│   │   └── App.tsx
│   ├── options/             # Options/settings SPA
│   │   ├── index.html
│   │   ├── main.tsx
│   │   └── App.tsx
│   ├── store/               # Redux store
│   │   ├── index.ts
│   │   ├── hooks.ts         # Typed useAppDispatch / useAppSelector
│   │   └── slices/
│   │       ├── scriptsSlice.ts
│   │       └── settingsSlice.ts
│   ├── components/          # Shared UI components
│   ├── hooks/               # Custom React hooks
│   ├── utils/               # Pure utility functions
│   └── types/               # Global TypeScript types/interfaces
├── public/
│   └── icons/
├── manifest.json            # Chrome MV3 manifest
├── vite.config.ts
├── tsconfig.json
├── vitest.config.ts
└── package.json
```

## Getting Started

```bash
pnpm install
pnpm dev      # watch mode — loads unpacked from dist/
pnpm build    # production build
pnpm test     # run tests
pnpm typecheck
```

### Load in Chrome

1. `pnpm build`
2. Open `chrome://extensions`
3. Enable **Developer mode**
4. **Load unpacked** → select `dist/`
5. Open DevTools on any page → find the **JS Grabber** panel

## Contributing

See [CLAUDE.md](.claude/CLAUDE.md) for full development guidelines, coding conventions, and architectural decisions.
