export function extractFilename(url: string): string {
  try {
    const { pathname } = new URL(url)
    return pathname.split('/').pop() || 'script.js'
  } catch {
    // Fallback for inline scripts or malformed URLs
    return url.split('/').pop() || 'script.js'
  }
}
