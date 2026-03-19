import { defineConfig } from 'vitest/config'
import { resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.test.tsx',
        'src/test/**',
        'src/**/*.gen.ts',
        'src/background/**',
        'src/content/**',
        'src/devtools/**',
      ],
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
})
