import { useNavigate } from '@tanstack/react-router'
import { scriptDetailRoute } from '../App'
import { useAppSelector } from '@/store/hooks'
import { selectScriptById } from '@/store/slices/scriptsSlice'
import { Button } from '@/components/Button'
import { Badge } from '@/components/Badge'
import { formatBytes } from '@/utils/formatBytes'
import { downloadScript } from '@/utils/downloadScript'

const ScriptDetailPage = () => {
  const navigate = useNavigate()
  const { scriptId } = scriptDetailRoute.useParams()
  const script = useAppSelector(selectScriptById(scriptId))

  if (!script) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-text-muted">
        <p>Script not found.</p>
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: '/' })}>
          ← Back to list
        </Button>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-surface-overlay px-3 py-2 shrink-0">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: '/' })}>
          ← Back
        </Button>
        <Badge type={script.type} />
        <span className="flex-1 truncate text-text" title={script.url}>
          {script.filename}
        </span>
        <span className="text-text-muted text-xs shrink-0">{formatBytes(script.sizeBytes)}</span>
        <Button size="sm" onClick={() => downloadScript(script)}>
          Download
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-3">
        <p className="text-text-muted text-xs mb-3 break-all">{script.url}</p>
        {script.content ? (
          <pre className="text-text text-xs font-mono whitespace-pre-wrap leading-relaxed">
            {script.content}
          </pre>
        ) : (
          <p className="text-text-muted text-xs">Content not available.</p>
        )}
      </div>
    </div>
  )
}

export { ScriptDetailPage }
