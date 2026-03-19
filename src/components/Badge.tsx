import { twMerge } from 'tailwind-merge'
import type { ScriptType } from '@/types'

const typeStyles: Record<ScriptType, string> = {
  bundle: 'bg-warning/20 text-warning',
  module: 'bg-accent/20 text-accent',
  worker: 'bg-success/20 text-success',
  inline: 'bg-error/20 text-error',
  unknown: 'bg-surface-overlay text-text-muted',
}

interface BadgeProps {
  type: ScriptType
  className?: string
}

const Badge = ({ type, className }: BadgeProps) => {
  return (
    <span
      className={twMerge(
        'inline-flex items-center rounded px-1.5 py-0.5 text-xs font-mono uppercase shrink-0',
        typeStyles[type],
        className,
      )}
    >
      {type}
    </span>
  )
}

export { Badge }
