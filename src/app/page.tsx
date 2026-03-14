import Link from "next/link";
import { HeroBackground } from "@/components/landing/HeroBackground";
import { createServiceClient } from "@/lib/supabase/server";

export const revalidate = 3600;

async function getStats() {
  try {
    const supabase = createServiceClient();

    const [tracksResult, certsResult] = await Promise.all([
      supabase
        .from("certification_tracks")
        .select("id", { count: "exact", head: true })
        .eq("status", "published"),
      supabase
        .from("certificates")
        .select("id", { count: "exact", head: true }),
    ]);

    return {
      trackCount: tracksResult.count ?? 0,
      certCount: certsResult.count ?? 0,
    };
  } catch {
    return { trackCount: 0, certCount: 0 };
  }
}

async function getTopLevelDocs() {
  try {
    const supabase = createServiceClient();

    const { data } = await supabase
      .from("docs_pages")
      .select("id, title, slug")
      .eq("status", "published")
      .eq("type", "docs")
      .is("parent_id", null)
      .order("order_index", { ascending: true })
      .limit(6);

    return data ?? [];
  } catch {
    return [];
  }
}

/* ------------------------------------------------------------------ */
/*  Inline SVG Icons                                                   */
/* ------------------------------------------------------------------ */

function BookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
    </svg>
  );
}

function AwardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="6" />
      <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
    </svg>
  );
}

function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

function FileTextIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      <path d="M10 9H8" />
      <path d="M16 13H8" />
      <path d="M16 17H8" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Page Component                                                     */
/* ------------------------------------------------------------------ */

export default async function HomePage() {
  const [{ trackCount, certCount }, topDocs] = await Promise.all([
    getStats(),
    getTopLevelDocs(),
  ]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── NAV ── */}
      <nav
        data-testid="landing-nav"
        className="sticky top-0 z-50 border-b border-border-subtle bg-background/90 backdrop-blur-sm"
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="bg-gradient-brand bg-clip-text text-2xl font-extrabold tracking-tight text-transparent">
            AAVA Product Studio
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/docs"
              className="text-sm font-medium text-foreground-muted transition-colors hover:text-foreground"
            >
              Docs
            </Link>
            <Link
              href="/login"
              data-testid="nav-login"
              className="text-sm font-medium text-foreground-muted transition-colors hover:text-foreground"
            >
              Login
            </Link>
            <Link
              href="/certifications"
              data-testid="nav-get-certified"
              className="rounded-lg bg-accent px-5 py-2 text-sm font-medium text-background transition-colors hover:bg-accent-hover"
            >
              Get Certified
            </Link>
          </div>
        </div>
      </nav>

      {/* ── SECTION 1: HERO ── */}
      <section
        data-testid="hero-section"
        className="relative flex min-h-[80vh] items-center justify-center px-6"
      >
        <HeroBackground />
        <div className="relative z-10 mx-auto max-w-3xl text-center">
          <h1 className="bg-gradient-brand bg-clip-text text-5xl font-extrabold tracking-tight text-transparent sm:text-6xl lg:text-7xl">
            PM mastery, verified.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-foreground-muted">
            The training and certification platform for AAVA Product Studio.
          </p>
        </div>
      </section>

      {/* ── SECTION 2: TWO PATHS ── */}
      <section data-testid="two-paths" className="px-6 py-16">
        <div className="mx-auto grid max-w-4xl grid-cols-1 gap-6 md:grid-cols-2">
          {/* Docs card */}
          <Link
            href="/docs"
            data-testid="cta-explore"
            className="group rounded-xl border border-border bg-surface p-8 shadow-card transition-all hover:border-accent/40 hover:shadow-accent-glow"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent-muted">
              <BookIcon className="h-6 w-6 text-accent" />
            </div>
            <h2 className="mt-5 text-xl font-semibold text-foreground">
              AAVA Product Studio Docs
            </h2>
            <p className="mt-2 text-sm text-foreground-muted">
              How-tos, references, and guides for using AAVA Product Studio.
            </p>
            <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-accent transition-colors group-hover:text-accent-hover">
              Browse docs
              <ArrowRightIcon className="h-4 w-4" />
            </span>
          </Link>

          {/* Certification card */}
          <Link
            href="/certifications"
            data-testid="cta-get-certified"
            className="group rounded-xl border border-border bg-surface p-8 shadow-card transition-all hover:border-accent/40 hover:shadow-accent-glow"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent-muted">
              <AwardIcon className="h-6 w-6 text-accent" />
            </div>
            <h2 className="mt-5 text-xl font-semibold text-foreground">
              Get Certified
            </h2>
            <p className="mt-2 text-sm text-foreground-muted">
              Prove your proficiency. Earn a verified AAVA Product Studio credential.
            </p>
            <div className="mt-5 flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-accent transition-colors group-hover:text-accent-hover">
                View tracks
                <ArrowRightIcon className="h-4 w-4" />
              </span>
              {/* Tier dots */}
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full border border-foreground-muted bg-foreground-muted/20" title="Foundations" />
                <span className="h-2.5 w-2.5 rounded-full border border-accent bg-accent/20" title="Practitioner" />
                <span className="h-2.5 w-2.5 rounded-full border border-gold bg-gold/20" title="Specialist" />
              </div>
            </div>
          </Link>
        </div>
      </section>

      {/* ── SECTION 3: QUICK LINKS ── */}
      <section data-testid="quick-links" className="border-t border-border px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-2xl font-bold text-foreground">
            Popular topics
          </h2>
          <p className="mx-auto mt-2 max-w-md text-center text-sm text-foreground-muted">
            Jump into the docs or explore common starting points.
          </p>

          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {topDocs.length > 0
              ? topDocs.map((doc) => (
                  <Link
                    key={doc.id}
                    href={`/docs/${doc.slug}`}
                    className="group flex items-start gap-3 rounded-lg border border-border bg-background p-4 transition-colors hover:border-accent/30 hover:bg-surface"
                  >
                    <FileTextIcon className="mt-0.5 h-5 w-5 shrink-0 text-foreground-muted transition-colors group-hover:text-accent" />
                    <span className="text-sm font-medium text-foreground">{doc.title}</span>
                  </Link>
                ))
              : /* Fallback when no docs exist yet */
                [
                  "Getting Started",
                  "Goals & OKRs",
                  "Sprint Planning",
                  "Backlog Management",
                  "Roadmapping",
                  "Agile Delivery",
                ].map((title) => (
                  <Link
                    key={title}
                    href="/docs"
                    className="group flex items-start gap-3 rounded-lg border border-border bg-background p-4 transition-colors hover:border-accent/30 hover:bg-surface"
                  >
                    <FileTextIcon className="mt-0.5 h-5 w-5 shrink-0 text-foreground-muted transition-colors group-hover:text-accent" />
                    <span className="text-sm font-medium text-foreground">{title}</span>
                  </Link>
                ))}
          </div>

          <div className="mt-8 text-center">
            <Link
              href="/docs"
              className="text-sm font-medium text-accent transition-colors hover:text-accent-hover"
            >
              View all docs &rarr;
            </Link>
          </div>
        </div>
      </section>

      {/* ── SECTION 4: CERTIFICATION STRIP ── */}
      <section data-testid="cert-strip" className="border-t border-border bg-surface px-6 py-10">
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-6 sm:flex-row sm:justify-between">
          <div className="text-center sm:text-left">
            <h3 className="text-lg font-semibold text-foreground">AAVA Product Studio Certification</h3>
            <p className="mt-1 text-sm text-foreground-muted">
              {trackCount > 0 ? `${trackCount} track${trackCount !== 1 ? "s" : ""} available` : "Free certification tracks"}{" "}
              &middot;{" "}
              {certCount > 0 ? `${certCount} certified` : "AI-graded exams"}{" "}
              &middot; LinkedIn-ready credentials
            </p>
          </div>
          <div className="flex items-center gap-6">
            {/* Tier progression */}
            <div className="hidden items-center gap-2 sm:flex">
              <span className="rounded-full border border-foreground-muted/40 px-3 py-1 text-xs text-foreground-muted">Foundations</span>
              <span className="text-foreground-muted">&rarr;</span>
              <span className="rounded-full border border-accent/40 px-3 py-1 text-xs text-accent">Practitioner</span>
              <span className="text-foreground-muted">&rarr;</span>
              <span className="rounded-full border border-gold/40 px-3 py-1 text-xs text-gold">Specialist</span>
            </div>
            <Link
              href="/certifications"
              className="shrink-0 rounded-lg bg-accent px-5 py-2 text-sm font-medium text-background transition-colors hover:bg-accent-hover"
            >
              View all tracks
            </Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer data-testid="footer" className="border-t border-border px-6 py-10">
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-6 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="bg-gradient-brand bg-clip-text text-xl font-bold tracking-tight text-transparent">
              AAVA Product Studio
            </span>
            <span className="text-sm text-foreground-muted">
              &copy; 2026 AAVA Product Studio
            </span>
          </div>
          <div className="flex items-center gap-5">
            <Link href="/docs" className="text-sm text-foreground-muted transition-colors hover:text-foreground">
              Docs
            </Link>
            <Link href="/certifications" className="text-sm text-foreground-muted transition-colors hover:text-foreground">
              Certifications
            </Link>
            <Link href="/login" className="text-sm text-foreground-muted transition-colors hover:text-foreground">
              Login
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
