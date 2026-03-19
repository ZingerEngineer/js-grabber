---
name: JS Grabber project overview
description: Chrome extension purpose, tech stack, and architecture decisions
type: project
---

Chrome DevTools extension (Manifest V3) called "JS Grabber". Captures all JS bundles/files visible in the Sources tab, displays them in a custom DevTools panel, allows individual or bulk download.

**Tech stack**: React 19, Tailwind CSS v4 (@tailwindcss/vite), Redux Toolkit v2, TanStack Router v1 (hash-based routing), Vite 6 + vite-plugin-web-extension, TypeScript 5 strict, Vitest + RTL, pnpm.

**Why:** User is building a developer tool for reverse-engineering or auditing web apps. The extension hooks into chrome.devtools.network to capture scripts as they load.

**How to apply:** Keep suggestions aligned to MV3 constraints (no persistent BG state, CSP restrictions, hash routing). All coding conventions are in `.claude/CLAUDE.md`.
