import { createHashHistory, createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

// Hash history is required for Chrome extension pages (chrome-extension:// URLs,
// no server-side routing support).
const hashHistory = createHashHistory()

export const router = createRouter({
  routeTree,
  history: hashHistory,
})

// Register router type globally for full TanStack Router type inference.
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
