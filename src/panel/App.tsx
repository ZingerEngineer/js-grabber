import {
  createHashHistory,
  createRouter,
  createRootRoute,
  createRoute,
  Outlet,
} from '@tanstack/react-router'
import { PanelLayout } from './components/PanelLayout'
import { ScriptListPage } from './components/ScriptListPage'
import { ScriptDetailPage } from './components/ScriptDetailPage'

// Manual (code-based) route definitions.
// File-based routing is intentionally avoided: TanStack Router's $-prefixed
// route files (e.g. $scriptId.tsx) become _-prefixed Rollup chunks, which
// Chrome extensions forbid.

const rootRoute = createRootRoute({
  component: () => (
    <PanelLayout>
      <Outlet />
    </PanelLayout>
  ),
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: ScriptListPage,
})

export const scriptDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/$scriptId',
  component: ScriptDetailPage,
})

const routeTree = rootRoute.addChildren([indexRoute, scriptDetailRoute])
const hashHistory = createHashHistory()

export const router = createRouter({
  routeTree,
  history: hashHistory,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
