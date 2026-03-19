import type { ReactNode } from 'react'

interface PanelLayoutProps {
  children: ReactNode
}

const PanelLayout = ({ children }: PanelLayoutProps) => {
  return (
    <div className="flex h-screen w-full flex-col bg-surface text-text font-mono text-sm overflow-hidden">
      <header className="flex items-center gap-2 border-b border-surface-overlay px-3 py-2 shrink-0">
        <span className="font-semibold text-accent">JS Grabber</span>
      </header>
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  )
}

export { PanelLayout }
