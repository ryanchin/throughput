import { describe, it, expect } from 'vitest'
import {
  parseEmbed,
  extractIframeSrc,
  parseEmbedUrl,
  detectEmbedType,
} from '@/lib/editor/embed-utils'

describe('extractIframeSrc', () => {
  it('extracts src from double-quoted iframe', () => {
    const html = '<iframe src="https://example.com/embed" width="560"></iframe>'
    expect(extractIframeSrc(html)).toBe('https://example.com/embed')
  })

  it('extracts src from single-quoted iframe', () => {
    const html = "<iframe src='https://example.com/embed' width='560'></iframe>"
    expect(extractIframeSrc(html)).toBe('https://example.com/embed')
  })

  it('handles iframe with many attributes', () => {
    const html =
      '<iframe width="560" height="315" src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ" title="YouTube" frameborder="0" allowfullscreen></iframe>'
    expect(extractIframeSrc(html)).toBe(
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'
    )
  })

  it('returns null for non-iframe HTML', () => {
    expect(extractIframeSrc('<div>no iframe</div>')).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(extractIframeSrc('')).toBeNull()
  })

  it('returns null for plain text', () => {
    expect(extractIframeSrc('just some text')).toBeNull()
  })
})

describe('parseEmbedUrl', () => {
  describe('YouTube', () => {
    it('parses youtube.com/watch?v= URLs', () => {
      const result = parseEmbedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
      expect(result).toEqual({
        src: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
        embedType: 'youtube',
        title: 'YouTube video',
      })
    })

    it('parses youtu.be short URLs', () => {
      const result = parseEmbedUrl('https://youtu.be/dQw4w9WgXcQ')
      expect(result?.src).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')
      expect(result?.embedType).toBe('youtube')
    })

    it('parses youtube.com/embed URLs', () => {
      const result = parseEmbedUrl('https://www.youtube.com/embed/dQw4w9WgXcQ')
      expect(result?.src).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')
    })
  })

  describe('Vimeo', () => {
    it('parses vimeo.com URLs', () => {
      const result = parseEmbedUrl('https://vimeo.com/123456789')
      expect(result).toEqual({
        src: 'https://player.vimeo.com/video/123456789',
        embedType: 'vimeo',
        title: 'Vimeo video',
      })
    })

    it('parses player.vimeo.com URLs', () => {
      const result = parseEmbedUrl('https://player.vimeo.com/video/123456789')
      expect(result?.src).toBe('https://player.vimeo.com/video/123456789')
    })
  })

  describe('Loom', () => {
    it('parses loom.com/share URLs', () => {
      const result = parseEmbedUrl('https://www.loom.com/share/abc123def456')
      expect(result).toEqual({
        src: 'https://www.loom.com/embed/abc123def456',
        embedType: 'loom',
        title: 'Loom video',
      })
    })

    it('parses loom.com/embed URLs', () => {
      const result = parseEmbedUrl('https://www.loom.com/embed/abc123def456')
      expect(result?.src).toBe('https://www.loom.com/embed/abc123def456')
    })
  })

  describe('Figma', () => {
    it('parses figma.com/file URLs', () => {
      const result = parseEmbedUrl('https://www.figma.com/file/abc123/My-Design')
      expect(result?.embedType).toBe('figma')
      expect(result?.src).toContain('figma.com/embed')
      expect(result?.src).toContain(
        encodeURIComponent('https://www.figma.com/file/abc123/My-Design')
      )
    })

    it('parses figma.com/design URLs', () => {
      const result = parseEmbedUrl('https://www.figma.com/design/abc123/My-Design')
      expect(result?.embedType).toBe('figma')
    })
  })

  describe('Google Slides', () => {
    it('parses Google Slides URLs', () => {
      const result = parseEmbedUrl(
        'https://docs.google.com/presentation/d/abc123_def-456/edit'
      )
      expect(result).toEqual({
        src: 'https://docs.google.com/presentation/d/abc123_def-456/embed',
        embedType: 'google_slides',
        title: 'Google Slides',
      })
    })
  })

  describe('Generic', () => {
    it('accepts any valid HTTPS URL as generic', () => {
      const result = parseEmbedUrl('https://example.com/some-page')
      expect(result?.embedType).toBe('generic')
      expect(result?.src).toBe('https://example.com/some-page')
    })

    it('returns null for invalid URLs', () => {
      expect(parseEmbedUrl('not a url')).toBeNull()
    })

    it('returns null for empty string', () => {
      expect(parseEmbedUrl('')).toBeNull()
    })
  })
})

describe('detectEmbedType', () => {
  it('detects YouTube', () => {
    expect(detectEmbedType('https://www.youtube-nocookie.com/embed/abc')).toBe('youtube')
  })
  it('detects Vimeo', () => {
    expect(detectEmbedType('https://player.vimeo.com/video/123')).toBe('vimeo')
  })
  it('detects Loom', () => {
    expect(detectEmbedType('https://www.loom.com/embed/abc')).toBe('loom')
  })
  it('detects Figma', () => {
    expect(detectEmbedType('https://www.figma.com/embed?url=...')).toBe('figma')
  })
  it('detects Google Slides', () => {
    expect(detectEmbedType('https://docs.google.com/presentation/d/abc/embed')).toBe(
      'google_slides'
    )
  })
  it('returns generic for unknown', () => {
    expect(detectEmbedType('https://example.com')).toBe('generic')
  })
})

describe('parseEmbed', () => {
  it('parses iframe HTML input', () => {
    const html =
      '<iframe src="https://www.youtube-nocookie.com/embed/abc123" width="560"></iframe>'
    const result = parseEmbed(html)
    expect(result?.embedType).toBe('youtube')
    expect(result?.src).toBe('https://www.youtube-nocookie.com/embed/abc123')
  })

  it('parses URL input', () => {
    const result = parseEmbed('https://vimeo.com/123456')
    expect(result?.embedType).toBe('vimeo')
  })

  it('returns null for invalid input', () => {
    expect(parseEmbed('hello world')).toBeNull()
  })

  it('trims whitespace from input', () => {
    const result = parseEmbed('  https://youtu.be/abc123abcde  ')
    expect(result?.embedType).toBe('youtube')
  })
})
