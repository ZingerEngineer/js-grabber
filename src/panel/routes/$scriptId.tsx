import { createFileRoute } from '@tanstack/react-router'
import { ScriptDetailPage } from '../components/ScriptDetailPage'

export const Route = createFileRoute('/$scriptId')({
  component: ScriptDetailPage,
})
