import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getTierBadgeColor, getTierName } from '@/lib/certifications/prerequisites'
import { CertificateActions } from '@/components/certifications/CertificateActions'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ certHash: string }>
}): Promise<Metadata> {
  const { certHash } = await params
  const supabase = await createClient()

  const { data: cert } = await supabase
    .from('certificates')
    .select('cert_number')
    .eq('verification_hash', certHash)
    .eq('revoked', false)
    .single()

  return {
    title: cert
      ? `Certificate ${cert.cert_number} | AAVA Certifications`
      : 'Certificate Not Found',
  }
}

export default async function CertificateDisplayPage({
  params,
}: {
  params: Promise<{ certHash: string }>
}) {
  const { certHash } = await params
  const supabase = await createClient()

  // Fetch certificate by verification hash
  const { data: cert } = await supabase
    .from('certificates')
    .select('id, user_id, track_id, cert_number, verification_hash, issued_at, revoked')
    .eq('verification_hash', certHash)
    .single()

  if (!cert || cert.revoked) {
    notFound()
  }

  // Fetch recipient profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, email')
    .eq('id', cert.user_id)
    .single()

  // Fetch certification track
  const { data: track } = await supabase
    .from('certification_tracks')
    .select('id, title, slug, tier, domain, passing_score')
    .eq('id', cert.track_id)
    .single()

  if (!track) {
    notFound()
  }

  const tierInfo = getTierBadgeColor(track.tier)
  const tierName = getTierName(track.tier, track.domain)
  const recipientName = profile?.full_name ?? profile?.email ?? 'Certificate Holder'
  const issuedDate = new Date(cert.issued_at)
  const formattedDate = issuedDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://throughput.aava.ai'
  const verifyUrl = `${siteUrl}/verify/${cert.verification_hash}`

  return (
    <div className="min-h-screen bg-background" data-testid="certificate-page">
      <style>{`
        @media print {
          nav, .print\\:hidden, footer { display: none !important; }
          body, html { background: #fff !important; }
          [data-testid="certificate-page"] { background: #fff !important; min-height: auto !important; }
          [data-testid="certificate-card"] {
            background: #fff !important;
            border-color: #D4A843 !important;
            box-shadow: none !important;
            color: #1a1a1a !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          [data-testid="certificate-card"] * {
            color: #1a1a1a !important;
            background: none !important;
            -webkit-background-clip: unset !important;
            background-clip: unset !important;
            -webkit-text-fill-color: unset !important;
          }
          [data-testid="cert-recipient"] {
            color: #0066cc !important;
          }
          .print-only { display: block !important; }
        }
        @media screen { .print-only { display: none; } }
      `}</style>

      {/* Navigation */}
      <nav className="border-b border-border bg-surface print:hidden">
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

      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Certificate Card */}
        <div
          className="bg-surface border-2 border-gold rounded-2xl p-8 sm:p-12 shadow-card relative overflow-hidden"
          style={{ boxShadow: '0 0 40px rgba(245, 200, 66, 0.08)' }}
          data-testid="certificate-card"
        >
          {/* Decorative corner accents */}
          <div className="absolute top-0 left-0 w-20 h-20 border-t-2 border-l-2 border-gold/30 rounded-tl-2xl" />
          <div className="absolute top-0 right-0 w-20 h-20 border-t-2 border-r-2 border-gold/30 rounded-tr-2xl" />
          <div className="absolute bottom-0 left-0 w-20 h-20 border-b-2 border-l-2 border-gold/30 rounded-bl-2xl" />
          <div className="absolute bottom-0 right-0 w-20 h-20 border-b-2 border-r-2 border-gold/30 rounded-br-2xl" />

          <div className="relative text-center">
            {/* Issuer */}
            <p className="text-xs uppercase tracking-[0.25em] text-foreground-muted mb-6">
              AAVA Product Studio
            </p>

            {/* Decorative divider */}
            <div className="flex items-center justify-center gap-4 mb-8">
              <div className="h-px w-16 bg-gold/30" />
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="text-gold"
                aria-hidden="true"
              >
                <path d="M12 2l2.4 7.4h7.6l-6 4.6 2.3 7-6.3-4.6-6.3 4.6 2.3-7-6-4.6h7.6z" />
              </svg>
              <div className="h-px w-16 bg-gold/30" />
            </div>

            {/* Heading */}
            <h1 className="text-sm uppercase tracking-[0.2em] text-foreground-muted mb-8">
              Certificate of Achievement
            </h1>

            {/* Recipient Name */}
            <p className="text-xs uppercase tracking-[0.15em] text-foreground-muted mb-2">
              This certifies that
            </p>
            <h2
              className="text-3xl sm:text-4xl font-bold bg-gradient-brand bg-clip-text text-transparent mb-6"
              data-testid="cert-recipient"
            >
              {recipientName}
            </h2>

            {/* Certification Title */}
            <p className="text-xs uppercase tracking-[0.15em] text-foreground-muted mb-2">
              has successfully completed
            </p>
            <h3
              className="text-2xl sm:text-3xl font-semibold text-foreground mb-4"
              data-testid="cert-title"
            >
              {track.title}
            </h3>

            {/* Tier Badge */}
            <div className="flex justify-center mb-8">
              <span
                className={`inline-flex items-center px-4 py-1.5 rounded-full text-sm font-medium border ${tierInfo.textColor} ${tierInfo.borderColor} ${tierInfo.bgColor}`}
              >
                {tierName}
              </span>
            </div>

            {/* Issue Date */}
            <p className="text-sm text-foreground-muted mb-2">
              Issued on {formattedDate}
            </p>

            {/* Certificate Number */}
            <p
              className="text-sm text-foreground-muted mb-6"
              data-testid="cert-number"
            >
              Certificate Number: {cert.cert_number}
            </p>

            {/* Decorative divider */}
            <div className="flex items-center justify-center gap-4 mb-6">
              <div className="h-px w-24 bg-border" />
              <div className="h-px w-24 bg-border" />
            </div>

            {/* Verification Badge */}
            <div
              className="inline-flex items-center gap-2 text-success"
              data-testid="cert-verified"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <span className="text-sm font-medium">
                Verified by AAVA Product Studio
              </span>
            </div>

            {/* Verification URL (small, for reference) */}
            <p className="mt-4 text-xs text-foreground-subtle break-all">
              {verifyUrl}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-8">
          <CertificateActions
            certNumber={cert.cert_number}
            certTitle={track.title}
            verifyUrl={verifyUrl}
            issueDate={cert.issued_at}
          />
        </div>
      </main>
    </div>
  )
}
