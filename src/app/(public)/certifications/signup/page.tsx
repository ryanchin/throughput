import { Metadata } from 'next'
import { CertSignupForm } from '@/components/certifications/CertSignupForm'

export const metadata: Metadata = {
  title: 'Create Account | AAVA Certifications',
  description: 'Create a free account to take AAVA certification exams.',
}

export default function CertSignupPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md" data-testid="cert-signup-page">
        <div className="text-center mb-8">
          <a href="/certifications" className="text-lg font-bold text-foreground">
            Throughput
          </a>
          <h1 className="mt-6 text-3xl font-bold bg-gradient-brand bg-clip-text text-transparent">
            Create Your Account
          </h1>
          <p className="mt-2 text-sm text-foreground-muted">
            Free forever. Start earning AAVA certifications today.
          </p>
        </div>
        <CertSignupForm />
        <p className="mt-6 text-center text-sm text-foreground-muted">
          Already have an account?{' '}
          <a href="/login" className="text-accent hover:text-accent-hover">
            Sign in
          </a>
        </p>
      </div>
    </div>
  )
}
