import '@/app/globals.css'

/** Minimal layout for public share pages — no sidebar, no auth required. */
export default function ShareLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      {/* Minimal branded header */}
      <header className="border-b border-border bg-surface">
        <div className="mx-auto max-w-4xl px-6 py-4 flex items-center gap-3">
          <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-brand text-sm font-bold text-white">
            PS
          </div>
          <span className="text-sm font-semibold text-foreground">Product Studio</span>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-4xl px-6 py-10">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-border mt-20">
        <div className="mx-auto max-w-4xl px-6 py-6 text-center text-xs text-foreground-muted">
          Shared via Product Studio Throughput
        </div>
      </footer>
    </div>
  )
}
