import { describe, it, expect } from 'vitest'
import { extractFilename } from './extractFilename'

describe('extractFilename', () => {
  it('extracts filename from a full URL', () => {
    expect(extractFilename('https://example.com/assets/app.bundle.js')).toBe('app.bundle.js')
  })

  it('handles query strings gracefully', () => {
    // URL constructor strips query from pathname, so we get the clean filename
    expect(extractFilename('https://cdn.example.com/chunk.123.js?v=2')).toBe('chunk.123.js')
  })

  it('falls back to "script.js" for empty segments', () => {
    expect(extractFilename('https://example.com/')).toBe('script.js')
  })

  it('handles malformed URLs', () => {
    const result = extractFilename('not-a-url')
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })
})
