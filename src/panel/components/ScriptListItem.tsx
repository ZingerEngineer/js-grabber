import { useNavigate } from '@tanstack/react-router'
import type { CapturedScript } from '@/types'
import { formatBytes } from '@/utils/formatBytes'
import { Badge } from '@/components/Badge'

interface ScriptListItemProps {
  script: CapturedScript
}

const ScriptListItem = ({ script }: ScriptListItemProps) => {
  const navigate = useNavigate()

  return (
    <li
      className="flex items-center gap-2 px-3 py-2 hover:bg-surface-raised cursor-pointer border-b border-surface-overlay/50"
      onClick={() =>
        navigate({ to: '/$scriptId', params: { scriptId: script.id } })
      }
    >
      <Badge type={script.type} />
      <span className="flex-1 truncate text-text" title={script.url}>
        {script.filename}
      </span>
      <span className="text-text-muted text-xs shrink-0">{formatBytes(script.sizeBytes)}</span>
    </li>
  )
}

export { ScriptListItem }
