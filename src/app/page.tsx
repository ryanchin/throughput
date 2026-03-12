import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="text-center">
        <h1 className="bg-gradient-brand bg-clip-text text-7xl font-bold tracking-tight text-transparent sm:text-8xl">
          AAVA
        </h1>
        <h2 className="mt-4 text-3xl font-semibold text-foreground sm:text-4xl">
          Throughput
        </h2>
        <p className="mt-3 text-lg text-foreground-muted">
          Training &amp; Certification Platform
        </p>
        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Link
            href="/training"
            className="inline-flex items-center rounded-lg bg-accent px-6 py-3 text-sm font-medium text-background shadow-accent-glow transition-colors hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background"
          >
            Start Training
          </Link>
          <Link
            href="/certifications"
            className="inline-flex items-center rounded-lg border border-border bg-surface px-6 py-3 text-sm font-medium text-foreground transition-colors hover:bg-raised"
          >
            View Certifications
          </Link>
        </div>
      </div>
    </div>
  );
}
