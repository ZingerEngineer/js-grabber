export type ScriptType = 'bundle' | 'module' | 'worker' | 'inline' | 'unknown'

export interface CapturedScript {
  id: string
  url: string
  filename: string
  sizeBytes: number
  capturedAt: number
  content?: string
  type: ScriptType
}

export interface CaptureSettings {
  autoCapture: boolean
  includeInline: boolean
  excludePatterns: string[]
  maxFileSizeBytes: number
}
