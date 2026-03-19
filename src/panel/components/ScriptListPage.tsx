import { useState } from 'react'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { selectAllScripts, scriptsCleared } from '@/store/slices/scriptsSlice'
import { useScriptCapture } from '@/hooks/useScriptCapture'
import { ScriptListItem } from './ScriptListItem'
import { Button } from '@/components/Button'

const ScriptListPage = () => {
  const dispatch = useAppDispatch()
  const scripts = useAppSelector(selectAllScripts)
  const [filter, setFilter] = useState('')

  useScriptCapture()

  const filtered = scripts.filter(
    (s) =>
      filter === '' ||
      s.filename.toLowerCase().includes(filter.toLowerCase()) ||
      s.url.toLowerCase().includes(filter.toLowerCase()),
  )

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-surface-overlay px-3 py-2 shrink-0">
        <input
          type="search"
          placeholder="Filter by filename or URL…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="flex-1 rounded bg-surface-raised px-2 py-1 text-text placeholder:text-text-muted outline-none focus:ring-1 focus:ring-accent"
        />
        <span className="text-text-muted text-xs shrink-0">{filtered.length} files</span>
        <Button variant="ghost" size="sm" onClick={() => dispatch(scriptsCleared())}>
          Clear
        </Button>
      </div>

      <ul className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <li className="flex items-center justify-center h-24 text-text-muted text-xs">
            {scripts.length === 0
              ? 'Waiting for scripts… reload the inspected page.'
              : 'No scripts match the filter.'}
          </li>
        ) : (
          filtered.map((script) => <ScriptListItem key={script.id} script={script} />)
        )}
      </ul>
    </div>
  )
}

export { ScriptListPage }
