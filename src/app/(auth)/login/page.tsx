import { Suspense } from 'react'
import LoginForm from './LoginForm'

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-8 shadow-card">
          <div className="mb-8 text-center">
            <h1 className="bg-gradient-brand bg-clip-text text-3xl font-bold text-transparent">AAVA Product Studio</h1>
            <p className="mt-1 text-sm text-foreground-muted">Sign in to Throughput</p>
          </div>
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
