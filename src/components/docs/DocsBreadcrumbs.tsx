import Link from 'next/link'

interface DocsBreadcrumbsProps {
  slugParts: string[]
  pageTitle: string
}

function formatSegment(segment: string): string {
  return segment
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export function DocsBreadcrumbs({ slugParts, pageTitle }: DocsBreadcrumbsProps) {
  if (slugParts.length === 0) return null

  const crumbs: { label: string; href: string }[] = [
    { label: 'Docs', href: '/docs' },
  ]

  // Add intermediate path segments
  for (let i = 0; i < slugParts.length - 1; i++) {
    const href = '/docs/' + slugParts.slice(0, i + 1).join('/')
    crumbs.push({ label: formatSegment(slugParts[i]), href })
  }

  return (
    <nav className="mb-6 flex items-center gap-1.5 text-sm text-foreground-muted" aria-label="Breadcrumbs">
      {crumbs.map((crumb, i) => (
        <span key={crumb.href} className="flex items-center gap-1.5">
          {i > 0 && (
            <svg className="h-3.5 w-3.5 text-foreground-subtle" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
          )}
          <Link href={crumb.href} className="hover:text-foreground transition-colors">
            {crumb.label}
          </Link>
        </span>
      ))}
      <svg className="h-3.5 w-3.5 text-foreground-subtle" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
      </svg>
      <span className="text-foreground">{pageTitle}</span>
    </nav>
  )
}
