import { createRootRoute, Outlet } from '@tanstack/react-router'
import { PanelLayout } from '../components/PanelLayout'

export const Route = createRootRoute({
  component: () => (
    <PanelLayout>
      <Outlet />
    </PanelLayout>
  ),
})
