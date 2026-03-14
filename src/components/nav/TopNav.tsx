'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { SearchBar } from '@/components/knowledge/SearchBar'
import type { Database } from '@/lib/supabase/database.types'

type Profile = Database['public']['Tables']['profiles']['Row']

const ZONE_LABELS: Record<string, string> = {
  '/training': 'Training',
  '/sales': 'Sales Enablement',
  '/admin': 'Admin',
  '/knowledge': 'Knowledge',
  '/certifications': 'Certifications',
}

interface TopNavProps {
  profile: Profile
}

export function TopNav({ profile }: TopNavProps) {
  const pathname = usePathname()
  const router = useRouter()

  // Determine which zone links to show based on role
  const navLinks: { href: string; label: string }[] = []

  if (['employee', 'sales', 'admin'].includes(profile.role)) {
    navLinks.push({ href: '/training', label: 'Training' })
  }
  if (['sales', 'admin'].includes(profile.role)) {
    navLinks.push({ href: '/sales', label: 'Sales' })
  }
  navLinks.push({ href: '/certifications', label: 'Certifications' })
  if (['employee', 'sales', 'admin'].includes(profile.role)) {
    navLinks.push({ href: '/knowledge', label: 'Knowledge' })
  }
  if (profile.role === 'admin') {
    navLinks.push({ href: '/admin', label: 'Admin' })
  }
  // Internal docs site
  navLinks.push({ href: '/docs', label: 'Docs' })

  // Determine current zone for indicator
  const currentZone = Object.keys(ZONE_LABELS).find(
    zone => pathname === zone || pathname.startsWith(zone + '/')
  )

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo + Zone */}
        <div className="flex items-center gap-4">
          <Link href="/" className="bg-gradient-brand bg-clip-text text-lg font-bold text-transparent">
            AAVA
          </Link>
          {currentZone && (
            <span className="rounded-md bg-accent-muted px-2 py-0.5 text-xs font-medium text-accent">
              {ZONE_LABELS[currentZone]}
            </span>
          )}
        </div>

        {/* Nav Links */}
        <nav className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => {
            const isExternal = link.href.startsWith('http')
            const isActive = !isExternal && pathname.startsWith(link.href)
            const className = `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              isActive
                ? 'bg-raised text-foreground'
                : 'text-foreground-muted hover:text-foreground'
            }`
            return isExternal ? (
              <a
                key={link.href}
                href={link.href}
                className={className}
                target="_blank"
                rel="noopener noreferrer"
              >
                {link.label}
              </a>
            ) : (
              <Link
                key={link.href}
                href={link.href}
                className={className}
              >
                {link.label}
              </Link>
            )
          })}
        </nav>

        {/* User area */}
        <div className="flex items-center gap-3">
          <SearchBar />
          <div className="text-right">
            <p className="text-sm font-medium text-foreground">
              {profile.full_name || profile.email}
            </p>
            <p className="text-xs text-foreground-muted capitalize">{profile.role}</p>
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-muted text-xs font-medium text-accent">
            {(profile.full_name || profile.email).charAt(0).toUpperCase()}
          </div>
          <button
            onClick={handleLogout}
            className="rounded-md px-2 py-1 text-sm text-foreground-muted hover:text-foreground"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  )
}
