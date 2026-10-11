import { describe, expect, it } from 'vitest'
import { isChunkLoadError } from './chunkError.ts'

describe('isChunkLoadError', () => {
  it('Chrome, Safari, Firefox ve paketleyici mesajlarını tanır', () => {
    expect(isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: https://x/assets/Stats-1.js'))).toBe(true)
    expect(isChunkLoadError(new TypeError('Importing a module script failed.'))).toBe(true)
    expect(isChunkLoadError(new TypeError('error loading dynamically imported module: https://x/a.js'))).toBe(true)
    expect(isChunkLoadError(new Error('Loading chunk 12 failed.'))).toBe(true)
    expect(isChunkLoadError(new Error('Unable to preload CSS for /assets/Plan.css'))).toBe(true)
  })

  it('ChunkLoadError adını tanır', () => {
    const e = new Error('boom')
    e.name = 'ChunkLoadError'
    expect(isChunkLoadError(e)).toBe(true)
  })

  it('sıradan hataları ve bozuk değerleri chunk hatası saymaz', () => {
    expect(isChunkLoadError(new TypeError("Cannot read properties of undefined (reading 'map')"))).toBe(false)
    expect(isChunkLoadError(new Error('x'))).toBe(false)
    expect(isChunkLoadError('Failed to fetch dynamically imported module')).toBe(false)
    expect(isChunkLoadError(null)).toBe(false)
    expect(isChunkLoadError(undefined)).toBe(false)
    expect(isChunkLoadError({ message: 42 })).toBe(false)
  })
})
