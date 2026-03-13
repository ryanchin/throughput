'use client'

import Link from 'next/link'

/**
 * Test page for the landing page E2E tests.
 * Mirrors the real landing page structure with mock data, no DB calls.
 */

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}

function BookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
    </svg>
  )
}

function ClipboardCheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="m9 14 2 2 4-4" />
    </svg>
  )
}

function AwardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="6" />
      <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
    </svg>
  )
}

function TargetIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
    </svg>
  )
}

export default function TestLandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* NAV */}
      <nav data-testid="landing-nav" className="sticky top-0 z-50 border-b border-border-subtle bg-background/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="bg-gradient-brand bg-clip-text text-2xl font-bold tracking-tight text-transparent">AAVA</span>
          <div className="flex items-center gap-4">
            <Link href="/login" data-testid="nav-login" className="text-sm font-medium text-foreground-muted hover:text-foreground">Login</Link>
            <Link href="/certifications" data-testid="nav-get-certified" className="rounded-lg bg-accent px-5 py-2 text-sm font-medium text-background hover:bg-accent-hover">Get Certified</Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section data-testid="hero-section" className="relative flex min-h-[60vh] items-center justify-center px-6">
        <div className="relative z-10 mx-auto max-w-3xl text-center">
          <h1 className="bg-gradient-brand bg-clip-text text-5xl font-bold tracking-tight text-transparent sm:text-6xl lg:text-7xl">PM mastery, verified.</h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-foreground-muted">The open certification platform for product managers. Study the methodology, pass the exam, earn a verified credential.</p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link href="/certifications" data-testid="cta-get-certified" className="rounded-lg bg-accent px-8 py-3 font-medium text-background shadow-accent-glow hover:bg-accent-hover">Get Certified</Link>
            <Link href="/docs" data-testid="cta-explore" className="rounded-lg border border-border px-8 py-3 font-medium text-foreground hover:bg-raised">Explore the Methodology</Link>
          </div>
        </div>
      </section>

      {/* TRUST STRIP */}
      <section data-testid="trust-strip" className="border-y border-border-subtle bg-background py-6">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-6 px-6 sm:gap-8">
          <span className="text-sm text-foreground-muted">Built on the AAVA Product Methodology</span>
          <span className="rounded-full border border-border bg-surface px-4 py-1.5 text-sm text-foreground">3 certification tracks</span>
          <span className="rounded-full border border-border bg-surface px-4 py-1.5 text-sm text-foreground">12 practitioners certified</span>
        </div>
      </section>

      {/* WHAT YOU LEARN */}
      <section data-testid="what-you-learn" className="px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-3xl font-bold text-foreground">What you&apos;ll learn</h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-foreground-muted">Three tiers of PM certification, from foundations to specialist.</p>
          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
            {['Foundations', 'Practitioner', 'Specialist'].map((tier) => (
              <div key={tier} className="rounded-xl border border-border bg-surface p-6 shadow-card">
                <h3 className="text-xl font-semibold text-foreground">{tier}</h3>
                <ul className="mt-4 space-y-2.5">
                  <li className="flex items-start gap-2 text-sm text-foreground-muted"><CheckIcon className="mt-0.5 h-4 w-4 shrink-0" />Topic one</li>
                  <li className="flex items-start gap-2 text-sm text-foreground-muted"><CheckIcon className="mt-0.5 h-4 w-4 shrink-0" />Topic two</li>
                  <li className="flex items-start gap-2 text-sm text-foreground-muted"><CheckIcon className="mt-0.5 h-4 w-4 shrink-0" />Topic three</li>
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section data-testid="how-it-works" className="bg-surface/50 px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-3xl font-bold text-foreground">How it works</h2>
          <div className="mt-14 grid grid-cols-1 gap-12 md:grid-cols-3 md:gap-8">
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent-muted"><BookIcon className="h-6 w-6 text-accent" /></div>
              <p className="mt-4 text-xs text-foreground-muted">01</p>
              <h3 className="mt-1 text-lg font-semibold text-foreground">Study</h3>
              <p className="mt-2 text-sm text-foreground-muted">Free methodology content. No login required.</p>
            </div>
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent-muted"><ClipboardCheckIcon className="h-6 w-6 text-accent" /></div>
              <p className="mt-4 text-xs text-foreground-muted">02</p>
              <h3 className="mt-1 text-lg font-semibold text-foreground">Examine</h3>
              <p className="mt-2 text-sm text-foreground-muted">Timed proctored exam. Open-ended questions graded by AI.</p>
            </div>
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent-muted"><AwardIcon className="h-6 w-6 text-accent" /></div>
              <p className="mt-4 text-xs text-foreground-muted">03</p>
              <h3 className="mt-1 text-lg font-semibold text-foreground">Certify</h3>
              <p className="mt-2 text-sm text-foreground-muted">Shareable certificate. LinkedIn badge. Verified URL.</p>
            </div>
          </div>
        </div>
      </section>

      {/* METHODOLOGY PREVIEW */}
      <section data-testid="methodology-preview" className="px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-3xl font-bold text-foreground">The AAVA PM Methodology</h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-foreground-muted">A structured framework for building products with clarity and confidence.</p>
          <div className="mt-10 flex gap-4 overflow-x-auto pb-4">
            {['Goals', 'Research', 'Ideation', 'Roadmapping', 'Sprint Planning', 'Development'].map((name, i) => (
              <div key={name} className="min-w-[200px] shrink-0 rounded-xl border border-border bg-surface p-5">
                <TargetIcon className="h-6 w-6 text-accent" />
                <p className="mt-3 text-xs text-foreground-muted">Stage {i + 1}</p>
                <h3 className="mt-1 text-base font-semibold text-foreground">{name}</h3>
              </div>
            ))}
          </div>
          <div className="mt-6 text-center">
            <Link href="/docs" className="text-sm font-medium text-accent hover:text-accent-hover">Explore the methodology &rarr;</Link>
          </div>
        </div>
      </section>

      {/* FOR TEAMS */}
      <section data-testid="for-teams" className="bg-surface/50 px-6 py-20">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 lg:grid-cols-2">
          <div>
            <h2 className="text-3xl font-bold text-foreground">Training your PM team?</h2>
            <p className="mt-4 text-foreground-muted">Throughput includes private training zones for your organization. Onboard employees, enable sales teams, and track progress — all in one platform.</p>
            <ul className="mt-6 space-y-3">
              {['Course completion tracking & scoring', 'Role-based access control', 'Sales enablement materials', 'AI-graded assessments'].map((item) => (
                <li key={item} className="flex items-center gap-2 text-sm text-foreground-muted"><CheckIcon className="h-4 w-4 shrink-0 text-accent" />{item}</li>
              ))}
            </ul>
            <a href="mailto:hello@aava.ai" className="mt-6 inline-block font-medium text-accent hover:text-accent-hover">Request access &rarr;</a>
          </div>
          <div className="rounded-xl border border-border bg-surface p-6 shadow-card">
            <h3 className="text-base font-semibold text-foreground">Sprint Planning Fundamentals</h3>
            <div className="mt-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-foreground-muted">Progress</span>
                <span className="font-medium text-foreground">75%</span>
              </div>
              <div className="mt-2 h-2 w-full rounded-full bg-muted">
                <div className="h-2 w-3/4 rounded-full bg-accent" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer data-testid="footer" className="border-t border-border px-6 py-12">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 md:grid-cols-3">
          <div>
            <span className="bg-gradient-brand bg-clip-text text-2xl font-bold tracking-tight text-transparent">AAVA</span>
            <p className="mt-1 text-sm text-foreground-muted">Throughput</p>
          </div>
          <div className="flex flex-col gap-2">
            <Link href="/certifications" className="text-sm text-foreground-muted hover:text-foreground">Certifications</Link>
            <Link href="/docs" className="text-sm text-foreground-muted hover:text-foreground">Methodology</Link>
            <Link href="/knowledge" className="text-sm text-foreground-muted hover:text-foreground">Knowledge</Link>
            <Link href="/login" className="text-sm text-foreground-muted hover:text-foreground">Login</Link>
          </div>
          <div className="flex items-end md:justify-end">
            <p className="text-sm text-foreground-muted">&copy; 2026 AAVA Product Studio</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
