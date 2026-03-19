import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { selectSettings, settingsUpdated, settingsReset } from '@/store/slices/settingsSlice'
import { Button } from '@/components/Button'

const SettingsPage = () => {
  const dispatch = useAppDispatch()
  const settings = useAppSelector(selectSettings)

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-text text-sm font-semibold mb-4 uppercase tracking-wider text-text-muted">
          Capture
        </h2>
        <div className="space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.autoCapture}
              onChange={(e) => dispatch(settingsUpdated({ autoCapture: e.target.checked }))}
              className="accent-accent w-4 h-4"
            />
            <span className="text-sm text-text">Auto-capture scripts on page load</span>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.includeInline}
              onChange={(e) => dispatch(settingsUpdated({ includeInline: e.target.checked }))}
              className="accent-accent w-4 h-4"
            />
            <span className="text-sm text-text">Include inline scripts</span>
          </label>
        </div>
      </section>

      <section>
        <h2 className="text-text text-sm font-semibold mb-1 uppercase tracking-wider text-text-muted">
          Exclusion Patterns
        </h2>
        <p className="text-text-muted text-xs mb-3">
          Scripts whose URLs contain any of these patterns will be ignored. One pattern per line.
        </p>
        <textarea
          value={settings.excludePatterns.join('\n')}
          onChange={(e) =>
            dispatch(
              settingsUpdated({
                excludePatterns: e.target.value.split('\n').filter(Boolean),
              }),
            )
          }
          rows={5}
          spellCheck={false}
          className="w-full rounded bg-surface-raised px-3 py-2 text-sm text-text placeholder:text-text-muted outline-none focus:ring-1 focus:ring-accent resize-y font-mono"
          placeholder="chrome-extension://&#10;devtools://"
        />
      </section>

      <div className="flex gap-3 pt-2">
        <Button variant="ghost" size="sm" onClick={() => dispatch(settingsReset())}>
          Reset to defaults
        </Button>
      </div>
    </div>
  )
}

export { SettingsPage }
