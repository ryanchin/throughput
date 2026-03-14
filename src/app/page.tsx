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

function ClipboardCheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="m9 14 2 2 4-4" />
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

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function TargetIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function LightbulbIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
      <path d="M9 18h6" />
      <path d="M10 22h4" />
    </svg>
  );
}

function MapIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m3 7 6-3 6 3 6-3v13l-6 3-6-3-6 3V7z" />
      <path d="M9 4v13" />
      <path d="M15 7v13" />
    </svg>
  );
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
      <line x1="16" x2="16" y1="2" y2="6" />
      <line x1="8" x2="8" y1="2" y2="6" />
      <line x1="3" x2="21" y1="10" y2="10" />
    </svg>
  );
}

function CodeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Page Component                                                     */
/* ------------------------------------------------------------------ */

export default async function HomePage() {
  const { trackCount, certCount } = await getStats();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── NAV ── */}
      <nav
        data-testid="landing-nav"
        className="sticky top-0 z-50 border-b border-border-subtle bg-background/90 backdrop-blur-sm"
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="bg-gradient-brand bg-clip-text text-2xl font-extrabold tracking-tight text-transparent">
            AAVA
          </Link>
          <div className="flex items-center gap-4">
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
        className="relative flex min-h-screen items-center justify-center px-6"
      >
        <HeroBackground />
        <div className="relative z-10 mx-auto max-w-3xl text-center">
          <h1 className="bg-gradient-brand bg-clip-text text-5xl font-extrabold tracking-tight text-transparent sm:text-6xl lg:text-7xl">
            PM mastery, verified.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-foreground-muted">
            The open certification platform for product managers. Study the methodology, pass the exam, earn a verified credential.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/certifications"
              data-testid="cta-get-certified"
              className="rounded-lg bg-accent px-8 py-3 font-medium text-background shadow-accent-glow transition-colors hover:bg-accent-hover"
            >
              Get Certified
            </Link>
            <Link
              href="/docs"
              data-testid="cta-explore"
              className="rounded-lg border border-border px-8 py-3 font-medium text-foreground transition-colors hover:bg-raised"
            >
              Explore the Methodology
            </Link>
          </div>
        </div>
      </section>

      {/* ── SECTION 2: TRUST STRIP ── */}
      <section
        data-testid="trust-strip"
        className="border-y border-border-subtle bg-background py-6"
      >
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-6 px-6 sm:gap-8">
          <span className="text-sm text-foreground-muted">
            Built on the AAVA Product Methodology
          </span>
          <span className="rounded-full border border-border bg-surface px-4 py-1.5 text-sm text-foreground">
            {trackCount} certification track{trackCount !== 1 ? "s" : ""}
          </span>
          <span className="rounded-full border border-border bg-surface px-4 py-1.5 text-sm text-foreground">
            {certCount} practitioner{certCount !== 1 ? "s" : ""} certified
          </span>
        </div>
      </section>

      {/* ── SECTION 3: WHAT YOU LEARN ── */}
      <section data-testid="what-you-learn" className="px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-3xl font-bold text-foreground">
            What you&apos;ll learn
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-foreground-muted">
            Three tiers of PM certification, from foundations to specialist.
          </p>

          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
            {/* Foundations */}
            <div className="rounded-xl border border-border bg-surface p-6 shadow-card">
              <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-foreground-muted">
                <div className="h-3 w-3 rounded-full bg-foreground-muted" />
              </div>
              <h3 className="mt-4 text-xl font-semibold text-foreground">Foundations</h3>
              <ul className="mt-4 space-y-2.5">
                <li className="flex items-start gap-2 text-sm text-foreground-muted">
                  <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-foreground-muted" />
                  Product management fundamentals
                </li>
                <li className="flex items-start gap-2 text-sm text-foreground-muted">
                  <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-foreground-muted" />
                  Goal-setting &amp; OKR frameworks
                </li>
                <li className="flex items-start gap-2 text-sm text-foreground-muted">
                  <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-foreground-muted" />
                  Agile delivery basics
                </li>
              </ul>
              <div className="mt-6 border-t border-border pt-4">
                <p className="text-xs text-foreground-muted">Free &middot; ~4 hours</p>
                <Link href="/certifications" className="mt-1 inline-block text-sm font-medium text-accent transition-colors hover:text-accent-hover">
                  Start for free &rarr;
                </Link>
              </div>
            </div>

            {/* Practitioner */}
            <div className="rounded-xl border border-border bg-surface p-6 shadow-card">
              <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-accent shadow-accent-glow">
                <div className="h-3 w-3 rounded-full bg-accent" />
              </div>
              <h3 className="mt-4 text-xl font-semibold text-foreground">Practitioner</h3>
              <ul className="mt-4 space-y-2.5">
                <li className="flex items-start gap-2 text-sm text-foreground-muted">
                  <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                  Advanced sprint planning
                </li>
                <li className="flex items-start gap-2 text-sm text-foreground-muted">
                  <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                  Stakeholder alignment techniques
                </li>
                <li className="flex items-start gap-2 text-sm text-foreground-muted">
                  <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                  Data-driven decision making
                </li>
              </ul>
              <div className="mt-6 border-t border-border pt-4">
                <p className="text-xs text-foreground-muted">Free &middot; ~6 hours</p>
                <Link href="/certifications" className="mt-1 inline-block text-sm font-medium text-accent transition-colors hover:text-accent-hover">
                  Begin certification &rarr;
                </Link>
              </div>
            </div>

            {/* Specialist */}
            <div className="rounded-xl border border-border bg-surface p-6 shadow-card">
              <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-gold" style={{ boxShadow: '0 0 16px rgba(245, 200, 66, 0.15)' }}>
                <div className="h-3 w-3 rounded-full bg-gold" />
              </div>
              <h3 className="mt-4 text-xl font-semibold text-foreground">Specialist</h3>
              <ul className="mt-4 space-y-2.5">
                <li className="flex items-start gap-2 text-sm text-foreground-muted">
                  <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                  Domain-specific expertise
                </li>
                <li className="flex items-start gap-2 text-sm text-foreground-muted">
                  <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                  Complex program management
                </li>
                <li className="flex items-start gap-2 text-sm text-foreground-muted">
                  <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                  Strategic product leadership
                </li>
              </ul>
              <div className="mt-6 border-t border-border pt-4">
                <p className="text-xs italic text-foreground-muted">Requires Practitioner</p>
                <Link href="/certifications" className="mt-1 inline-block text-sm font-medium text-accent transition-colors hover:text-accent-hover">
                  View requirements &rarr;
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 4: HOW IT WORKS ── */}
      <section data-testid="how-it-works" className="bg-surface/50 px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-3xl font-bold text-foreground">
            How it works
          </h2>

          <div className="relative mt-14 grid grid-cols-1 gap-12 md:grid-cols-3 md:gap-8">
            {/* Connecting line (desktop only) */}
            <div className="pointer-events-none absolute left-[calc(16.67%+24px)] right-[calc(16.67%+24px)] top-6 hidden border-t border-dashed border-border md:block" />

            {/* Step 1 */}
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent-muted">
                <BookIcon className="h-6 w-6 text-accent" />
              </div>
              <p className="mt-4 text-xs text-foreground-muted">01</p>
              <h3 className="mt-1 text-lg font-semibold text-foreground">Study</h3>
              <p className="mt-2 text-sm text-foreground-muted">
                Free methodology content. No login required.
              </p>
            </div>

            {/* Step 2 */}
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent-muted">
                <ClipboardCheckIcon className="h-6 w-6 text-accent" />
              </div>
              <p className="mt-4 text-xs text-foreground-muted">02</p>
              <h3 className="mt-1 text-lg font-semibold text-foreground">Examine</h3>
              <p className="mt-2 text-sm text-foreground-muted">
                Timed proctored exam. Open-ended questions graded by AI.
              </p>
            </div>

            {/* Step 3 */}
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent-muted">
                <AwardIcon className="h-6 w-6 text-accent" />
              </div>
              <p className="mt-4 text-xs text-foreground-muted">03</p>
              <h3 className="mt-1 text-lg font-semibold text-foreground">Certify</h3>
              <p className="mt-2 text-sm text-foreground-muted">
                Shareable certificate. LinkedIn badge. Verified URL.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 5: METHODOLOGY PREVIEW ── */}
      <section data-testid="methodology-preview" className="px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-3xl font-bold text-foreground">
            The AAVA PM Methodology
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-foreground-muted">
            A structured framework for building products with clarity and confidence.
          </p>

          <div className="scrollbar-hide mt-10 flex gap-4 overflow-x-auto pb-4">
            {[
              { name: "Goals", stage: 1, icon: TargetIcon },
              { name: "Research", stage: 2, icon: SearchIcon },
              { name: "Ideation", stage: 3, icon: LightbulbIcon },
              { name: "Roadmapping", stage: 4, icon: MapIcon },
              { name: "Sprint Planning", stage: 5, icon: CalendarIcon },
              { name: "Development", stage: 6, icon: CodeIcon },
            ].map(({ name, stage, icon: Icon }) => (
              <div
                key={stage}
                className="min-w-[200px] shrink-0 rounded-xl border border-border bg-surface p-5"
              >
                <Icon className="h-6 w-6 text-accent" />
                <p className="mt-3 text-xs text-foreground-muted">Stage {stage}</p>
                <h3 className="mt-1 text-base font-semibold text-foreground">{name}</h3>
              </div>
            ))}
          </div>

          <div className="mt-6 text-center">
            <Link
              href="/docs"
              className="text-sm font-medium text-accent transition-colors hover:text-accent-hover"
            >
              Explore the methodology &rarr;
            </Link>
          </div>
        </div>
      </section>

      {/* ── SECTION 6: FOR TEAMS ── */}
      <section data-testid="for-teams" className="bg-surface/50 px-6 py-20">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 lg:grid-cols-2">
          {/* Left column */}
          <div>
            <h2 className="text-3xl font-bold text-foreground">
              Training your PM team?
            </h2>
            <p className="mt-4 text-foreground-muted">
              Throughput includes private training zones for your organization. Onboard employees, enable sales teams, and track progress — all in one platform.
            </p>
            <ul className="mt-6 space-y-3">
              {[
                "Course completion tracking & scoring",
                "Role-based access control",
                "Sales enablement materials",
                "AI-graded assessments",
              ].map((item) => (
                <li key={item} className="flex items-center gap-2 text-sm text-foreground-muted">
                  <CheckIcon className="h-4 w-4 shrink-0 text-accent" />
                  {item}
                </li>
              ))}
            </ul>
            <a
              href="mailto:hello@aava.ai"
              className="mt-6 inline-block font-medium text-accent transition-colors hover:text-accent-hover"
            >
              Request access &rarr;
            </a>
          </div>

          {/* Right column — decorative mockup */}
          <div className="rounded-xl border border-border bg-surface p-6 shadow-card">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-foreground">Sprint Planning Fundamentals</h3>
              <span className="rounded-full bg-accent-muted px-3 py-0.5 text-xs font-medium text-accent">
                In Progress
              </span>
            </div>
            <div className="mt-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-foreground-muted">Progress</span>
                <span className="font-medium text-foreground">75%</span>
              </div>
              <div className="mt-2 h-2 w-full rounded-full bg-muted">
                <div className="h-2 w-3/4 rounded-full bg-accent" />
              </div>
            </div>
            <ul className="mt-5 space-y-3">
              {[
                { title: "Introduction to Sprint Cycles", done: true },
                { title: "Backlog Prioritization", done: true },
                { title: "Estimation Techniques", done: true },
                { title: "Running Effective Standups", done: false },
              ].map((lesson) => (
                <li
                  key={lesson.title}
                  className="flex items-center gap-3 text-sm"
                >
                  {lesson.done ? (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-success/20">
                      <CheckIcon className="h-3 w-3 text-success" />
                    </span>
                  ) : (
                    <span className="h-5 w-5 rounded-full border-2 border-border" />
                  )}
                  <span className={lesson.done ? "text-foreground-muted" : "text-foreground"}>
                    {lesson.title}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── SECTION 7: FOOTER ── */}
      <footer data-testid="footer" className="border-t border-border px-6 py-12">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 md:grid-cols-3">
          {/* Left */}
          <div>
            <span className="bg-gradient-brand bg-clip-text text-2xl font-bold tracking-tight text-transparent">
              AAVA
            </span>
            <p className="mt-1 text-sm text-foreground-muted">Throughput</p>
            <p className="mt-2 text-sm text-foreground-muted">
              A product of{" "}
              <a href="https://aava.ai" className="text-foreground-muted underline transition-colors hover:text-foreground">
                AAVA
              </a>
            </p>
          </div>

          {/* Center */}
          <div className="flex flex-col gap-2">
            <Link href="/certifications" className="text-sm text-foreground-muted transition-colors hover:text-foreground">
              Certifications
            </Link>
            <Link href="/docs" className="text-sm text-foreground-muted transition-colors hover:text-foreground">
              Methodology
            </Link>
            <Link href="/knowledge" className="text-sm text-foreground-muted transition-colors hover:text-foreground">
              Knowledge
            </Link>
            <Link href="/login" className="text-sm text-foreground-muted transition-colors hover:text-foreground">
              Login
            </Link>
          </div>

          {/* Right */}
          <div className="flex items-end md:justify-end">
            <p className="text-sm text-foreground-muted">
              &copy; 2026 AAVA Product Studio
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
