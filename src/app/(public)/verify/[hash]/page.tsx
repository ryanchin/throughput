import { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { getTierBadgeColor, getTierName } from '@/lib/certifications/prerequisites'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ hash: string }>
}): Promise<Metadata> {
  const { hash } = await params
  const supabase = await createClient()

  const { data: cert } = await supabase
    .from('certificates')
    .select('cert_number, revoked')
    .eq('verification_hash', hash)
    .single()

  if (!cert) {
    return { title: 'Invalid Certificate | AAVA Certifications' }
  }

  return {
    title: cert.revoked
      ? `Certificate Revoked | AAVA Certifications`
      : `Verify ${cert.cert_number} | AAVA Certifications`,
  }
}

export default async function VerifyPage({
  params,
}: {
  params: Promise<{ hash: string }>
}) {
  const { hash } = await params
  const supabase = await createClient()

  // Fetch certificate — do NOT filter by revoked, we show revoked status
  const { data: cert } = await supabase
    .from('certificates')
    .select(
      'id, user_id, track_id, cert_number, verification_hash, issued_at, revoked, revoked_at'
    )
    .eq('verification_hash', hash)
    .single()

  // Determine state
  const state: 'valid' | 'revoked' | 'invalid' = !cert
    ? 'invalid'
    : cert.revoked
      ? 'revoked'
      : 'valid'

  // Fetch related data only if certificate exists
  let recipientName: string | null = null
  let trackTitle: string | null = null
  let tierName: string | null = null
  let tierInfo: ReturnType<typeof getTierBadgeColor> | null = null
  let formattedIssueDate: string | null = null
  let formattedRevokedDate: string | null = null
  let certDisplayUrl: string | null = null

  if (cert) {
    const [{ data: profile }, { data: track }] = await Promise.all([
      supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', cert.user_id)
        .single(),
      supabase
        .from('certification_tracks')
        .select('id, title, slug, tier, domain')
        .eq('id', cert.track_id)
        .single(),
    ])

    recipientName = profile?.full_name ?? profile?.email ?? 'Certificate Holder'
    trackTitle = track?.title ?? 'Unknown Certification'

    if (track) {
      tierInfo = getTierBadgeColor(track.tier)
      tierName = getTierName(track.tier, track.domain)
    }

    formattedIssueDate = new Date(cert.issued_at).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })

    if (cert.revoked_at) {
      formattedRevokedDate = new Date(cert.revoked_at).toLocaleDateString(
        'en-US',
        { year: 'numeric', month: 'long', day: 'numeric' }
      )
    }

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ?? 'https://throughput.aava.ai'
    certDisplayUrl = `${siteUrl}/certifications/certificate/${cert.verification_hash}`
  }

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
          {state === 'valid' && (
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
                      {recipientName}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wider text-foreground-muted">
                      Certification
                    </dt>
                    <dd className="text-lg font-semibold text-foreground mt-1">
                      {trackTitle}
                    </dd>
                    {tierInfo && tierName && (
                      <span
                        className={`inline-flex items-center mt-2 px-3 py-1 rounded-full text-xs font-medium border ${tierInfo.textColor} ${tierInfo.borderColor} ${tierInfo.bgColor}`}
                      >
                        {tierName}
                      </span>
                    )}
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wider text-foreground-muted">
                      Issue Date
                    </dt>
                    <dd className="text-sm text-foreground mt-1">
                      {formattedIssueDate}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wider text-foreground-muted">
                      Certificate Number
                    </dt>
                    <dd className="text-sm font-mono text-foreground mt-1">
                      {cert!.cert_number}
                    </dd>
                  </div>
                </dl>
              </div>

              <p className="text-sm text-foreground-muted text-center mb-6">
                This certificate is authentic and was issued by AAVA Product
                Studio.
              </p>

              {certDisplayUrl && (
                <div className="text-center">
                  <a
                    href={certDisplayUrl}
                    className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-accent text-background font-medium hover:bg-accent-hover transition-colors"
                  >
                    View Full Certificate
                  </a>
                </div>
              )}
            </div>
          )}

          {state === 'revoked' && (
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
                      {recipientName}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wider text-foreground-muted">
                      Certification
                    </dt>
                    <dd className="text-lg font-semibold text-foreground mt-1">
                      {trackTitle}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wider text-foreground-muted">
                      Issue Date
                    </dt>
                    <dd className="text-sm text-foreground mt-1">
                      {formattedIssueDate}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wider text-foreground-muted">
                      Certificate Number
                    </dt>
                    <dd className="text-sm font-mono text-foreground mt-1">
                      {cert!.cert_number}
                    </dd>
                  </div>
                </dl>

                {/* Revocation notice */}
                <div className="mt-6 pt-4 border-t border-destructive/20">
                  <p className="text-sm text-destructive font-medium">
                    This certificate was revoked
                    {formattedRevokedDate ? ` on ${formattedRevokedDate}` : ''}.
                  </p>
                </div>
              </div>
            </div>
          )}

          {state === 'invalid' && (
            <div data-testid="verify-invalid">
              {/* X icon */}
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
                    <circle cx="12" cy="12" r="10" />
                    <line x1="15" y1="9" x2="9" y2="15" />
                    <line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                </div>
              </div>

              <h1 className="text-2xl font-bold text-destructive text-center mb-4">
                Invalid Certificate
              </h1>

              <p className="text-sm text-foreground-muted text-center">
                This certificate ID could not be found. It may have been entered
                incorrectly.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
