import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import webExtension from 'vite-plugin-web-extension'
import { resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  plugins: [
    // Tailwind v4 — must come before react()
    tailwindcss(),

    // Note: @tanstack/router-plugin is NOT used here.
    // File-based routing emits $-prefixed route files which Rollup renames to
    // _-prefixed chunks (e.g. $scriptId.tsx → _scriptId.js). Chrome extensions
    // forbid filenames starting with "_". Both panel and options use manual
    // (code-based) route definitions to avoid this entirely.

    react(),

    // Reads manifest.json and builds all extension entry points.
    // additionalInputs registers src/panel/index.html as a build entry
    // even though it's referenced dynamically in devtools.ts via chrome.runtime.getURL.
    webExtension({
      additionalInputs: ['src/panel/index.html'],
    }),
  ],

  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },

  build: {
    // Always wipe dist/ before each build so stale chunks from previous
    // builds never silently carry over (e.g. renamed or deleted files).
    emptyOutDir: true,
  },
})
