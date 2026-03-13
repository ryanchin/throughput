'use client'

import { FormEvent, useState } from 'react'

type FormState = 'idle' | 'submitting' | 'success' | 'error'

export function CertSignupForm() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [state, setState] = useState<FormState>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setState('submitting')
    setErrorMessage('')

    try {
      const res = await fetch('/api/certifications/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, email, password }),
      })

      if (res.ok) {
        setState('success')
        return
      }

      const body = await res.json().catch(() => null)

      if (res.status === 409) {
        setErrorMessage(
          'An account with this email already exists. Try signing in.'
        )
      } else {
        setErrorMessage(
          body?.error ?? 'Something went wrong. Please try again.'
        )
      }
      setState('error')
    } catch {
      setErrorMessage('Network error. Please check your connection and try again.')
      setState('error')
    }
  }

  if (state === 'success') {
    return (
      <div
        className="bg-surface border border-border rounded-xl p-6 text-center shadow-card"
        data-testid="signup-success"
      >
        <svg
          className="mx-auto mb-4 text-success"
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
        <h2 className="text-xl font-semibold text-foreground mb-2">
          Account Created!
        </h2>
        <p className="text-sm text-foreground-muted">
          Check your email to verify your account, then sign in to start your
          first certification.
        </p>
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-surface border border-border rounded-xl p-6 shadow-card"
      data-testid="cert-signup-form"
    >
      {state === 'error' && errorMessage && (
        <div
          className="mb-4 rounded-lg bg-destructive-muted border border-destructive px-4 py-3 text-sm text-destructive"
          data-testid="signup-error"
        >
          {errorMessage}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label
            htmlFor="fullName"
            className="block text-sm font-medium text-foreground mb-1.5"
          >
            Full Name
          </label>
          <input
            id="fullName"
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Jane Doe"
            className="bg-muted border border-border rounded-lg px-4 py-3 text-foreground placeholder:text-foreground-subtle focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent w-full"
            data-testid="signup-name"
          />
        </div>

        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-foreground mb-1.5"
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="jane@example.com"
            className="bg-muted border border-border rounded-lg px-4 py-3 text-foreground placeholder:text-foreground-subtle focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent w-full"
            data-testid="signup-email"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-foreground mb-1.5"
          >
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Min. 8 characters"
            className="bg-muted border border-border rounded-lg px-4 py-3 text-foreground placeholder:text-foreground-subtle focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent w-full"
            data-testid="signup-password"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={state === 'submitting'}
        className="mt-6 w-full bg-accent text-background hover:bg-accent-hover rounded-lg py-3 font-medium disabled:opacity-50 transition-colors"
        data-testid="signup-submit"
      >
        {state === 'submitting' ? 'Creating Account...' : 'Create Account'}
      </button>
    </form>
  )
}
