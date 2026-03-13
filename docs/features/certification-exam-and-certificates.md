# Feature: Certification Exam & Certificates

**Status:** Complete
**Zone:** certification (public) + admin
**Last Updated:** 2026-03-13

## Purpose
Proctored certification exam flow with timed, randomized question pools, automated grading (MC immediate + open-ended via OpenRouter), certificate generation with unique verification hashes, LinkedIn Open Badges 3.0 integration, and public certificate verification pages.

## User Stories
- As a public user, I can start a timed certification exam after meeting prerequisites
- As a public user, I see a countdown timer during the exam that auto-submits when time expires
- As a public user, I receive a certificate with a unique verification hash when I pass
- As a public user, I can add my certificate to LinkedIn via a pre-filled deeplink
- As a public user, I can share my certificate via a public verification URL
- As anyone, I can verify a certificate's authenticity at /verify/[certHash]
- As a machine, I can retrieve Open Badges 3.0 JSON-LD at /api/badges/[certHash]

## Acceptance Criteria
- [x] Exam page at /certifications/[trackSlug]/exam with auth + prerequisite checks
- [x] Attempt limit: max 3 attempts per 30 days, cooldown timer shown
- [x] Server-side stratified question sampling (proportional across difficulty levels)
- [x] question_ids[] stored on cert_attempt immediately on exam start
- [x] Countdown timer: amber < 5 min, red < 1 min, auto-submit at 0
- [x] CertExamPlayer component with same UI patterns as QuizPlayer
- [x] POST /api/certifications/start-exam: creates attempt with selected questions
- [x] POST /api/certifications/submit: grades exam, generates certificate on pass
- [x] cert_number format: AAVA-YYYY-NNNNNN (6-digit padded sequence)
- [x] verification_hash: SHA-256 of (cert.id + user_id + issued_at)
- [x] Certificate page at /certifications/certificate/[certHash]
- [x] LinkedIn deeplink with pre-filled certification params
- [x] Download PDF via browser print CSS
- [x] Share link (copy to clipboard)
- [x] Public verification page at /verify/[certHash]
- [x] Revoked certificate notice on verification page
- [x] GET /api/badges/[certHash]: Open Badges 3.0 JSON-LD
- [x] Content-Type: application/ld+json with Cache-Control headers
- [x] Unit tests for cert_number, verification_hash, stratified sampling
- [x] Integration tests for submit, badges, attempt limits
- [x] E2E tests for exam flow, certificate page, verification

## Technical Notes
- CertExamPlayer replicates QuizPlayer UI patterns (single question, progress bar, MC/OE support) but with countdown timer and cert-specific submission
- Grading pipeline: MC immediate (case-insensitive exact match), open-ended → OpenRouter (same as quiz/submit)
- Service role client needed for cert_attempts + certificates writes (RLS bypass)
- 24h cooldown: expires_at set on cert_attempt row on failure
- Certificate page uses print CSS for PDF download (no server-side PDF library)
- Open Badges JSON-LD must remain permanently available (never delete cert records)
- LinkedIn organizationId placeholder — will be filled when AAVA LinkedIn page exists
- Stratified sampling: proportional allocation across easy/medium/hard with Fisher-Yates shuffle

## Test Coverage

### Unit Tests (35 tests)
- `tests/unit/lib/certifications/cert-number.test.ts` — 9 tests: generateCertNumber (5), parseCertNumber (4)
- `tests/unit/lib/certifications/verification.test.ts` — 4 tests: hash format, determinism, uniqueness, input sensitivity
- `tests/unit/lib/certifications/sampling.test.ts` — 8 tests: correct count, small pool, proportional distribution, single difficulty, empty pool, randomization, all levels represented
- `tests/unit/lib/certifications/prerequisites.test.ts` — 14 tests (from cert-tracks feature)

### Integration Tests (35 tests)
- `tests/integration/certifications/start-exam.test.ts` — 8 tests: auth, validation, 404, prerequisite check, attempt limit, in-progress resume, success
- `tests/integration/certifications/submit-and-badges.test.ts` — 12 tests: auth, validation, ownership, double-submit, pass+cert, fail+cooldown, badges JSON-LD, 404, revoked
- `tests/integration/certifications/certifications-api.test.ts` — 8 tests (from cert-tracks feature)
- `tests/integration/certifications/signup.test.ts` — 6 tests (from cert-tracks feature)

### E2E Tests (68 tests)
- `tests/e2e/certification/exam-flow.spec.ts` — 13 tests: pre-exam info, start button, attempt count, max attempts, cooldown
- `tests/e2e/certification/certificate-page.spec.ts` — 11 tests: card rendering, recipient, title, cert number, verified badge, LinkedIn href, download, share
- `tests/e2e/certification/verify-page.spec.ts` — 16 tests: valid state (8), revoked state (8)
- `tests/e2e/certification/public-browse.spec.ts` — 16 tests (from cert-tracks feature)
- `tests/e2e/certification/signup-flow.spec.ts` — 10 tests (from cert-tracks feature)

**Total: 138 tests across certification features, all passing**

## Known Limitations / Future Work
- No proctoring/camera monitoring (trust-based for now)
- LinkedIn organizationId is a placeholder until AAVA LinkedIn Company Page exists
- No certificate expiry management UI
- No admin certificate revocation UI (direct DB only for now)
- No per-question results review after exam submission (could show breakdown like QuizResults)
