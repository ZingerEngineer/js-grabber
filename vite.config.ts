import { readFileSync } from 'fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import webExtension from 'vite-plugin-web-extension'
import { resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

const TARGET_BROWSER = (process.env.TARGET_BROWSER ?? 'chrome') as 'chrome' | 'firefox'

function buildManifest(): object {
  const manifest = JSON.parse(readFileSync('./manifest.json', 'utf-8'))

  if (TARGET_BROWSER === 'firefox') {
    // Firefox MV3 uses background.scripts[] instead of service_worker
    manifest.background = { scripts: ['src/background/index.ts'], type: 'module' }
    manifest.browser_specific_settings = {
      gecko: { id: 'js-grabber@zingerengineer', strict_min_version: '128.0' },
    }
  }

  return manifest
}

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
    // even though it's referenced dynamically in devtools.ts via runtime.getURL.
    webExtension({
      manifest: buildManifest,
      additionalInputs: ['src/panel/index.html'],
      browser: TARGET_BROWSER,
    }),
  ],

  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },

  build: {
    // Always wipe the target dist/ dir before each build so stale chunks from
    // previous builds never silently carry over (e.g. renamed or deleted files).
    emptyOutDir: true,
    outDir: `dist/${TARGET_BROWSER}`,
  },
})
