export type EmbedType = 'youtube' | 'vimeo' | 'loom' | 'figma' | 'google_slides' | 'generic'

export interface EmbedInfo {
  src: string
  embedType: EmbedType
  title: string
}

/**
 * Parse a URL or iframe HTML string and return embed info.
 * Returns null if the input cannot be parsed as an embed.
 */
export function parseEmbed(input: string): EmbedInfo | null {
  const trimmed = input.trim()

  // Try iframe extraction first
  const iframeSrc = extractIframeSrc(trimmed)
  if (iframeSrc) {
    const embedType = detectEmbedType(iframeSrc)
    return {
      src: iframeSrc,
      embedType,
      title: embedType === 'generic' ? 'Embedded content' : `${capitalize(embedType)} embed`,
    }
  }

  // Try URL parsing
  const urlEmbed = parseEmbedUrl(trimmed)
  if (urlEmbed) return urlEmbed

  return null
}

/**
 * Extract the src attribute from an iframe HTML string.
 * Returns null if no valid src found.
 * SECURITY: Only extracts src, never stores raw HTML.
 */
export function extractIframeSrc(html: string): string | null {
  // Match src="..." or src='...' in iframe tags
  const match = html.match(/<iframe[^>]*\ssrc=["']([^"']+)["'][^>]*>/i)
  return match ? match[1] : null
}

/**
 * Parse a URL and convert to its embed equivalent.
 */
export function parseEmbedUrl(url: string): EmbedInfo | null {
  // YouTube
  const ytMatch = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/
  )
  if (ytMatch) {
    return {
      src: `https://www.youtube-nocookie.com/embed/${ytMatch[1]}`,
      embedType: 'youtube',
      title: 'YouTube video',
    }
  }

  // Vimeo
  const vimeoMatch = url.match(/(?:vimeo\.com\/|player\.vimeo\.com\/video\/)(\d+)/)
  if (vimeoMatch) {
    return {
      src: `https://player.vimeo.com/video/${vimeoMatch[1]}`,
      embedType: 'vimeo',
      title: 'Vimeo video',
    }
  }

  // Loom
  const loomMatch = url.match(/loom\.com\/(?:share|embed)\/([a-f0-9]+)/)
  if (loomMatch) {
    return {
      src: `https://www.loom.com/embed/${loomMatch[1]}`,
      embedType: 'loom',
      title: 'Loom video',
    }
  }

  // Figma
  const figmaMatch = url.match(/figma\.com\/(file|proto|design|board)\/([a-zA-Z0-9]+)/)
  if (figmaMatch) {
    return {
      src: `https://www.figma.com/embed?embed_host=throughput&url=${encodeURIComponent(url)}`,
      embedType: 'figma',
      title: 'Figma design',
    }
  }

  // Google Slides (published embed URL)
  const slidesMatch = url.match(/docs\.google\.com\/presentation\/d\/([a-zA-Z0-9_-]+)/)
  if (slidesMatch) {
    return {
      src: `https://docs.google.com/presentation/d/${slidesMatch[1]}/embed`,
      embedType: 'google_slides',
      title: 'Google Slides',
    }
  }

  // Generic URL (must look like a valid URL)
  try {
    const parsed = new URL(url)
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return {
        src: url,
        embedType: 'generic',
        title: 'Embedded content',
      }
    }
  } catch {
    // Not a valid URL
  }

  return null
}

/**
 * Detect embed type from a URL string.
 */
export function detectEmbedType(url: string): EmbedType {
  if (
    url.includes('youtube.com') ||
    url.includes('youtube-nocookie.com') ||
    url.includes('youtu.be')
  )
    return 'youtube'
  if (url.includes('vimeo.com') || url.includes('player.vimeo.com')) return 'vimeo'
  if (url.includes('loom.com')) return 'loom'
  if (url.includes('figma.com')) return 'figma'
  if (url.includes('docs.google.com/presentation')) return 'google_slides'
  return 'generic'
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ')
}
