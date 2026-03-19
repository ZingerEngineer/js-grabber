import { createFileRoute } from '@tanstack/react-router'
import { ScriptListPage } from '../components/ScriptListPage'

export const Route = createFileRoute('/')({
  component: ScriptListPage,
})
