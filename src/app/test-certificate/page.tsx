'use client'
import { CertificateActions } from '@/components/certifications/CertificateActions'

export default function TestCertificatePage() {
  return (
    <div className="min-h-screen bg-background p-8 flex flex-col items-center">
      <div className="w-full max-w-3xl">
        {/* Mock certificate card */}
        <div
          className="bg-surface border-2 border-gold rounded-2xl p-12 text-center mb-8"
          data-testid="certificate-page"
        >
          <p className="text-sm text-foreground-muted uppercase tracking-widest mb-4">
            AAVA Product Studio
          </p>
          <h1
            className="text-4xl font-bold bg-gradient-brand bg-clip-text text-transparent mb-2"
            data-testid="cert-recipient"
          >
            Jane Doe
          </h1>
          <h2
            className="text-2xl font-semibold text-foreground mb-4"
            data-testid="cert-title"
          >
            AAVA Practitioner Certification
          </h2>
          <p className="text-foreground-muted mb-2">Issued January 15, 2026</p>
          <p className="text-foreground-muted mb-4" data-testid="cert-number">
            Certificate Number: AAVA-2026-000042
          </p>
          <div
            className="flex items-center justify-center gap-2 text-success"
            data-testid="cert-verified"
          >
            <span>✓</span>
            <span>Verified by AAVA Product Studio</span>
          </div>
        </div>

        <CertificateActions
          certNumber="AAVA-2026-000042"
          certTitle="AAVA Practitioner Certification"
          verifyUrl="https://aava.ai/verify/abc123hash"
          issueDate="2026-01-15T00:00:00Z"
        />
      </div>
    </div>
  )
}
