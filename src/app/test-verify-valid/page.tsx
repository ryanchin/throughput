export default function TestVerifyValidPage() {
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
          <div data-testid="verify-valid">
            {/* Green checkmark icon */}
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center animate-pulse">
                <svg
                  width="40"
                  height="40"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-success"
                  aria-hidden="true"
                >
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              </div>
            </div>

            <h1 className="text-2xl font-bold text-success text-center mb-8">
              Certificate Verified
            </h1>

            {/* Certificate details card */}
            <div className="bg-surface border border-success/30 rounded-xl p-6 shadow-card mb-6">
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
            </div>

            <p className="text-sm text-foreground-muted text-center mb-6">
              This certificate is authentic and was issued by AAVA Product
              Studio.
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
