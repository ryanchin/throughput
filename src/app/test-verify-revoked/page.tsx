export default function TestVerifyRevokedPage() {
  return (
    <div className="min-h-screen bg-background" data-testid="verify-page">
      {/* Navigation */}
      <nav className="border-b border-border bg-surface">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <a href="/" className="text-lg font-bold text-foreground">
              Throughput
            </a>
            <span className="text-foreground-subtle">/</span>
            <a
              href="/certifications"
              className="text-sm text-foreground-muted hover:text-foreground"
            >
              Certifications
            </a>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-lg px-4 py-16 sm:px-6">
        <div data-testid="verify-status">
          <div data-testid="verify-revoked">
            {/* Warning triangle icon */}
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center">
                <svg
                  width="40"
                  height="40"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-destructive"
                  aria-hidden="true"
                >
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
            </div>

            <h1 className="text-2xl font-bold text-destructive text-center mb-8">
              Certificate Revoked
            </h1>

            {/* Certificate details card */}
            <div className="bg-surface border border-destructive/30 rounded-xl p-6 shadow-card mb-6">
              <dl className="space-y-4">
                <div>
                  <dt className="text-xs uppercase tracking-wider text-foreground-muted">
                    Recipient
                  </dt>
                  <dd className="text-lg font-semibold text-foreground mt-1">
                    Jane Doe
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wider text-foreground-muted">
                    Certification
                  </dt>
                  <dd className="text-lg font-semibold text-foreground mt-1">
                    AAVA Practitioner
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wider text-foreground-muted">
                    Issue Date
                  </dt>
                  <dd className="text-sm text-foreground mt-1">
                    January 15, 2026
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wider text-foreground-muted">
                    Certificate Number
                  </dt>
                  <dd className="text-sm font-mono text-foreground mt-1">
                    AAVA-2026-000042
                  </dd>
                </div>
              </dl>

              {/* Revocation notice */}
              <div className="mt-6 pt-4 border-t border-destructive/20">
                <p className="text-sm text-destructive font-medium">
                  This certificate was revoked on March 10, 2026.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
