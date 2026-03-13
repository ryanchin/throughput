# Feature: Rate Limiting & Security Hardening

**Status:** Complete
**Zone:** shared (all zones)
**Last Updated:** 2026-03-13

## Purpose
Add rate limiting via Upstash Redis to all sensitive API routes to prevent abuse, add Content-Security-Policy headers for embed iframes, and audit environment variables to ensure no sensitive keys are exposed client-side.

## User Stories
- As a platform operator, I want rate limiting on quiz/cert submissions so that brute-force attempts are blocked
- As a platform operator, I want rate limiting on AI generation routes so that costs are controlled
- As a platform operator, I want rate limiting on auth routes so that credential stuffing is prevented
- As a platform operator, I want CSP headers so that only approved embed domains can load in iframes
- As a platform operator, I want assurance that sensitive API keys are never exposed to the client

## Acceptance Criteria
- [x] Install @upstash/ratelimit and @upstash/redis
- [x] Rate limit POST /api/quiz/submit: 10 submissions per user per hour
- [x] Rate limit POST /api/certifications/submit: 5 submissions per user per day
- [x] Rate limit POST /api/admin/generate/course: 20 generations per admin per day
- [x] Rate limit POST /api/admin/generate/lesson: 50 generations per admin per day
- [x] Rate limit /api/certifications/signup: 10 attempts per IP per 15 minutes
- [x] All API routes validate authenticated session explicitly (not solely RLS)
- [x] CSP headers allow only: YouTube, Vimeo, Loom, Figma, Google for embed iframes
- [x] No sensitive env vars (OPENROUTER_API_KEY, BUNNY_*, SUPABASE_SERVICE_ROLE_KEY) use NEXT_PUBLIC_ prefix
- [x] Integration test: quiz submit rate-limited request returns 429
- [x] Integration test: cert submit rate-limited request returns 429
- [x] Unit test: no sensitive env vars have NEXT_PUBLIC_ prefix

## Technical Notes
- Rate limiting backed by Upstash Redis (serverless, works on Vercel)
- Env vars: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
- Rate limiter utility at `src/lib/security/rate-limiter.ts` with pre-configured limiters per route
- CSP builder at `src/lib/security/csp.ts` — allowed frame sources for embed iframes
- CSP + security headers (X-Content-Type-Options, Referrer-Policy, X-Frame-Options) applied via `src/middleware.ts`
- Rate limit responses return 429 with Retry-After, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset headers
- Graceful degradation: if Upstash env vars are missing, rate limiting is skipped (dev/test mode)
- Auth rate limiting on `/api/certifications/signup` uses IP-based identification (x-forwarded-for or x-real-ip)
- No standalone login/signup API routes exist (main app auth is client-side Supabase); cert signup is the only server-side auth endpoint
- All 37 API routes verified: every POST/PATCH/DELETE handler validates session via `supabase.auth.getUser()` or `requireAdmin()`

## Test Coverage

### Unit Tests (12 tests)
- `tests/unit/security/rate-limiter.test.ts` — 3 tests: null limiter passthrough, within-limit allows, exceeded returns 429 with headers
- `tests/unit/security/csp.test.ts` — 9 tests: CSP includes all allowed embed domains (YouTube, Vimeo, Loom, Figma, Google, Bunny.net), frame-ancestors, default-src
- `tests/unit/security/env-vars.test.ts` — 2 tests: no sensitive env vars in .env files, no sensitive NEXT_PUBLIC_ refs in source code (file scan)

### Integration Tests (7 tests)
- `tests/integration/security/rate-limiting.test.ts` — 7 tests:
  - Quiz submit: allows within limit, returns 429 when exceeded, blocks before DB queries
  - Cert submit: returns 429 when exceeded, allows within limit, blocks before DB queries
  - Unauthenticated requests return 401 before rate limiting

**Total: 21 tests, all passing (654 tests total across full suite)**

## Known Limitations / Future Work
- Rate limiting requires Upstash Redis account (free tier: 10k commands/day)
- IP-based rate limiting may be inaccurate behind proxies without X-Forwarded-For
- Could add per-route monitoring/alerting for rate limit hits
