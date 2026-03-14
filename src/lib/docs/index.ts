import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'

const CONTENT_DIR = path.join(process.cwd(), 'src/content/docs')

export interface DocPage {
  slug: string[]
  title: string
  sidebarPosition: number
  content: string
  description?: string
}

export interface SidebarItem {
  title: string
  slug: string[]
  href: string
  sidebarPosition: number
  children: SidebarItem[]
}

/**
 * Read a single doc page by slug segments.
 * e.g. ['getting-started', 'what-is-aava']
 */
export function getDocBySlug(slugParts: string[]): DocPage | null {
  // Try direct file match first
  const directPath = path.join(CONTENT_DIR, ...slugParts) + '.md'
  if (fs.existsSync(directPath)) {
    return parseDocFile(directPath, slugParts)
  }

  // Try index/overview file in directory
  const dirPath = path.join(CONTENT_DIR, ...slugParts)
  if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
    const overviewPath = path.join(dirPath, 'overview.md')
    if (fs.existsSync(overviewPath)) {
      return parseDocFile(overviewPath, slugParts)
    }
    const indexPath = path.join(dirPath, 'index.md')
    if (fs.existsSync(indexPath)) {
      return parseDocFile(indexPath, slugParts)
    }
  }

  // Directory exists but no overview — generate a section landing page
  if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
    const sectionMeta = getSectionMeta(dirPath)
    const title = sectionMeta?.title || formatTitle(slugParts[slugParts.length - 1] || 'Documentation')

    // Build a simple landing page listing child sections
    const tree = buildTree(dirPath, slugParts)
    const links = tree
      .map((item) => `- [${item.title}](/docs/${item.slug.join('/')})`)
      .join('\n')

    return {
      slug: slugParts,
      title,
      sidebarPosition: sectionMeta?.position ?? 999,
      content: `# ${title}\n\n${links}`,
    }
  }

  return null
}

/**
 * Read _section.json metadata for a directory, if it exists.
 */
function getSectionMeta(dirPath: string): { title: string; position: number } | null {
  const sectionMetaPath = path.join(dirPath, '_section.json')
  if (fs.existsSync(sectionMetaPath)) {
    return JSON.parse(fs.readFileSync(sectionMetaPath, 'utf-8'))
  }
  return null
}

/**
 * Get the intro/landing page content
 */
export function getIntroDoc(): DocPage | null {
  const introPath = path.join(CONTENT_DIR, 'intro.md')
  if (fs.existsSync(introPath)) {
    return parseDocFile(introPath, [])
  }
  return null
}

function parseDocFile(filePath: string, slug: string[]): DocPage {
  const raw = fs.readFileSync(filePath, 'utf-8')
  const { data, content } = matter(raw)

  return {
    slug,
    title: data.title || slug[slug.length - 1] || 'Documentation',
    sidebarPosition: data.sidebar_position ?? 999,
    content,
    description: data.description,
  }
}

/**
 * Build the full sidebar tree from the content directory.
 */
export function getSidebarTree(): SidebarItem[] {
  return buildTree(CONTENT_DIR, [])
}

function buildTree(dirPath: string, parentSlug: string[]): SidebarItem[] {
  if (!fs.existsSync(dirPath)) return []

  const entries = fs.readdirSync(dirPath, { withFileTypes: true })
  const items: SidebarItem[] = []

  // Process directories first
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const slug = [...parentSlug, entry.name]
      const childDir = path.join(dirPath, entry.name)
      const children = buildTree(childDir, slug)

      // Try to get the directory's title and position from:
      // 1. _section.json (explicit section metadata)
      // 2. overview.md frontmatter
      // 3. index.md frontmatter
      // 4. Formatted directory name (fallback)
      let title = formatTitle(entry.name)
      let sidebarPosition = 999

      const sectionMetaPath = path.join(childDir, '_section.json')
      const overviewPath = path.join(childDir, 'overview.md')
      const indexPath = path.join(childDir, 'index.md')

      // Layer 1: _section.json for explicit position and optional title override
      if (fs.existsSync(sectionMetaPath)) {
        const sectionMeta = JSON.parse(fs.readFileSync(sectionMetaPath, 'utf-8'))
        if (sectionMeta.title) title = sectionMeta.title
        sidebarPosition = sectionMeta.position ?? sidebarPosition
      }

      // Layer 2: overview.md / index.md for title (if not already set by _section.json)
      if (fs.existsSync(overviewPath)) {
        const overviewMeta = parseFrontmatter(overviewPath)
        if (overviewMeta.title && !fs.existsSync(sectionMetaPath)) {
          title = overviewMeta.title
        } else if (overviewMeta.title && fs.existsSync(sectionMetaPath)) {
          const sectionMeta = JSON.parse(fs.readFileSync(sectionMetaPath, 'utf-8'))
          if (!sectionMeta.title) title = overviewMeta.title
        }
        if (sidebarPosition === 999) sidebarPosition = overviewMeta.sidebarPosition
      } else if (fs.existsSync(indexPath)) {
        const indexMeta = parseFrontmatter(indexPath)
        if (indexMeta.title && title === formatTitle(entry.name)) title = indexMeta.title
        if (sidebarPosition === 999) sidebarPosition = indexMeta.sidebarPosition
      }

      // Filter out the overview/index from children since the directory link represents it
      const filteredChildren = children.filter(
        (c) => {
          const lastSegment = c.slug[c.slug.length - 1]
          return lastSegment !== 'overview' && lastSegment !== 'index'
        }
      )

      items.push({
        title: cleanTitle(title),
        slug,
        href: `/docs/${slug.join('/')}`,
        sidebarPosition,
        children: filteredChildren,
      })
    }
  }

  // Process files
  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith('.md') && entry.name !== 'intro.md') {
      const baseName = entry.name.replace(/\.md$/, '')
      // Skip overview/index files — they're represented by the directory
      if (baseName === 'overview' || baseName === 'index') continue

      const slug = [...parentSlug, baseName]
      const filePath = path.join(dirPath, entry.name)
      const meta = parseFrontmatter(filePath)

      items.push({
        title: meta.title || formatTitle(baseName),
        slug,
        href: `/docs/${slug.join('/')}`,
        sidebarPosition: meta.sidebarPosition,
        children: [],
      })
    }
  }

  // Sort by sidebar_position, then alphabetically
  items.sort((a, b) => {
    if (a.sidebarPosition !== b.sidebarPosition) {
      return a.sidebarPosition - b.sidebarPosition
    }
    return a.title.localeCompare(b.title)
  })

  return items
}

function parseFrontmatter(filePath: string): { title: string | null; sidebarPosition: number } {
  const raw = fs.readFileSync(filePath, 'utf-8')
  const { data } = matter(raw)
  return {
    title: data.title || null,
    sidebarPosition: data.sidebar_position ?? 999,
  }
}

/**
 * Format a kebab-case filename into a readable title.
 */
function formatTitle(name: string): string {
  return name
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

/**
 * Clean titles used for directory-level sidebar items.
 * Removes patterns like " -- Overview" or trailing " Overview" that come from
 * Docusaurus overview files being used as section headings.
 */
function cleanTitle(title: string): string {
  return title
    .replace(/\s*--\s*Overview$/i, '')   // "Goals & OKRs -- Overview" -> "Goals & OKRs"
    .replace(/\s+Overview$/i, '')         // "Certifications Overview" -> "Certifications"
    .trim()
}

/**
 * Get all doc slugs for static generation.
 */
export function getAllDocSlugs(): string[][] {
  return collectSlugs(CONTENT_DIR, [])
}

function collectSlugs(dirPath: string, parentSlug: string[]): string[][] {
  if (!fs.existsSync(dirPath)) return []

  const entries = fs.readdirSync(dirPath, { withFileTypes: true })
  const slugs: string[][] = []

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const slug = [...parentSlug, entry.name]
      // All directories are valid slugs — they resolve to overview.md or the first child
      slugs.push(slug)
      const childDir = path.join(dirPath, entry.name)
      slugs.push(...collectSlugs(childDir, slug))
    } else if (entry.isFile() && entry.name.endsWith('.md') && entry.name !== 'intro.md') {
      const baseName = entry.name.replace(/\.md$/, '')
      if (baseName === 'overview' || baseName === 'index') continue
      slugs.push([...parentSlug, baseName])
    }
  }

  return slugs
}
