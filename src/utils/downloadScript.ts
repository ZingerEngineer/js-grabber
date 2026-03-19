import type { CapturedScript } from '@/types'

export function downloadScript(script: CapturedScript): void {
  const content = script.content ?? ''
  const blob = new Blob([content], { type: 'application/javascript' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = script.filename
  anchor.click()
  URL.revokeObjectURL(url)
}
