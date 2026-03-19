import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import webExtension from 'vite-plugin-web-extension'
import { resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  plugins: [
    // Tailwind v4 — must come before react()
    tailwindcss(),

    // File-based routing for the panel SPA only.
    // Options uses manual routes (fewer pages, simpler).
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
      routesDirectory: 'src/panel/routes',
      generatedRouteTree: 'src/panel/routeTree.gen.ts',
    }),

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
    rollupOptions: {
      output: {
        // Chrome extensions forbid filenames starting with "_".
        // TanStack Router's auto code splitting turns $scriptId.tsx → _scriptId.js,
        // which triggers the error. Routing all chunks into assets/ fixes it.
        chunkFileNames: 'assets/[name]-[hash].js',
      },
    },
  },
})
