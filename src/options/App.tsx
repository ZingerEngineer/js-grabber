import {
  createHashHistory,
  createRouter,
  createRootRoute,
  createRoute,
  Outlet,
} from '@tanstack/react-router'
import { SettingsPage } from './components/SettingsPage'

// Options uses manual (code-based) route definitions — it only has one page,
// so file-based routing would be overkill. Add routes here as the options grow.

const rootRoute = createRootRoute({
  component: () => (
    <div className="min-h-screen bg-surface text-text font-mono">
      <div className="max-w-2xl mx-auto p-8">
        <h1 className="text-accent font-semibold text-xl mb-8">JS Grabber — Settings</h1>
        <Outlet />
      </div>
    </div>
  ),
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: SettingsPage,
})

const routeTree = rootRoute.addChildren([indexRoute])
const hashHistory = createHashHistory()

export const router = createRouter({
  routeTree,
  history: hashHistory,
})
