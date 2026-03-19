import { describe, it, expect } from 'vitest'
import { formatBytes } from './formatBytes'

describe('formatBytes', () => {
  it('returns "0 B" for zero', () => {
    expect(formatBytes(0)).toBe('0 B')
  })

  it('formats bytes', () => {
    expect(formatBytes(512)).toBe('512.0 B')
  })

  it('formats kilobytes', () => {
    expect(formatBytes(1024)).toBe('1.0 KB')
    expect(formatBytes(1536)).toBe('1.5 KB')
  })

  it('formats megabytes', () => {
    expect(formatBytes(1048576)).toBe('1.0 MB')
  })

  it('respects custom decimal places', () => {
    expect(formatBytes(1536, 2)).toBe('1.50 KB')
    expect(formatBytes(1536, 0)).toBe('2 KB')
  })
})
