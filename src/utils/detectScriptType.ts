import type { ScriptType } from '@/types'

export function detectScriptType(url: string): ScriptType {
  const lower = url.toLowerCase()
  if (lower.includes('worker')) return 'worker'
  if (lower.includes('chunk') || lower.includes('bundle')) return 'bundle'
  if (lower.endsWith('.mjs') || lower.includes('esm') || lower.includes('module')) return 'module'
  if (!lower.startsWith('http')) return 'inline'
  return 'unknown'
}
