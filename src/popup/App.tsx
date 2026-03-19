import { useAppSelector } from '@/store/hooks'
import { selectScriptCount } from '@/store/slices/scriptsSlice'

// Note: the popup has its own isolated Redux store instance.
// It does not share live state with the panel — only persisted
// chrome.storage values can be synced across extension pages.
// For the MVP, this shows a static hint.

const App = () => {
  const count = useAppSelector(selectScriptCount)

  return (
    <div className="w-64 p-4 bg-surface text-text font-mono">
      <h1 className="text-accent font-semibold text-base mb-2">JS Grabber</h1>
      <p className="text-text-muted text-sm">
        {count} script{count !== 1 ? 's' : ''} captured
      </p>
      <p className="text-text-muted text-xs mt-3 leading-relaxed">
        Open DevTools → <span className="text-accent">JS Grabber</span> panel to view and
        download captured scripts.
      </p>
    </div>
  )
}

export { App }
