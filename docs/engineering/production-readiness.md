# Tayar.ai production-readiness programme

This is the engineering source of truth for work required before Tayar.ai can be described as production-ready. A green build is evidence for that build only; it is not a release approval.

## 1. Current product and architecture baseline

- Android-first Expo React Native 0.81 / Expo SDK 54 application using TypeScript.
- FastAPI backend deployed through Render; Supabase PostgreSQL/Auth with Row Level Security.
- Server-side question delivery and answer grading; AI hints use stored verified solution steps through provider adapters.
- Prometheus metrics, Grafana dashboard configuration, liveness/readiness checks and scheduled synthetic API checks.
- RRB NTPC is the live exam configuration. Question text, numbers, units, answer options, answer keys and source attribution must remain tied to reviewed source PDFs. No generated or reconstructed questions are permitted.

## 2. Evidence already present in the repository

| Area | Existing implementation / automated evidence | What this evidence does not prove |
|---|---|---|
| Backend correctness | Pytest suite, Ruff, coverage report, response-contract tests, auth/refresh tests, answer-key protection, idempotency, hint caching/rate limiting, history pagination | Live Supabase tenant isolation or production provider behavior |
| Database bootstrap | PostgreSQL container in CI validates schema and starter seed; seed assertions run | Production migration rehearsal, backup restore or real RLS isolation across two users |
| Local capacity smoke | 20 concurrent workers × 50 requests with p95 threshold of 2 seconds against a local API process | Production capacity, database contention, sustained load, spike or soak behavior |
| Mobile static checks | TypeScript typecheck, source-integrity smoke checks and Android JS bundle export | Runtime interaction correctness or visual quality |
| Mobile API contracts | Extracted validators and executable boundary tests are being added in PR #28 | Full live API compatibility until integrated and rerun |
| Android packaging | Release APK build, package identity, signature verification, SHA-256 provenance and 100 MiB size ceiling | Persistent upgrade signing unless the release keystore is configured |
| Android UI automation | Maestro launch, malformed-phone validation and optional authenticated navigation on a hosted emulator | Complete user journeys, broad device coverage or physical-device behavior |
| Operations | Health/readiness endpoints, Prometheus metrics, Grafana dashboard/alerts and scheduled public API checks | An actively provisioned production alert receiver and tested incident response |

## 3. Workstreams and release gates

### A. Product requirements and UX
- [ ] Freeze target users, supported exams, supported Android versions and launch scope.
- [ ] Write acceptance criteria for every learner journey: onboarding, sign-in, learning discovery, practice, hints, results, progress, revision and sign-out.
- [ ] Define empty, loading, offline, timeout, permission-denied, expired-session and retry states for every network-backed screen.
- [ ] Validate layouts at compact, regular and large Android display sizes; test font scaling, keyboard overlap, landscape behavior and long content.
- [ ] Complete a visual system for color, typography, spacing, elevation, motion, iconography and component states.
- [ ] Review every screen for consistent hierarchy, clear calls to action, readable contrast and non-color-only status communication.
- [ ] Conduct usability review with representative learners before release.

**Exit evidence:** approved journey map, acceptance checklist, responsive screenshots and signed-off UI review.

### B. Mobile architecture and code quality
- [ ] Break the current monolithic App.tsx into navigation, screens, domain contracts, API client, authentication/session, practice, analytics and shared UI modules.
- [ ] Keep domain/business logic independent of React Native rendering.
- [ ] Define typed API interfaces and a single error/timeout/retry policy.
- [ ] Make account-scoped state reset deterministic on sign-out and account switching.
- [ ] Add cancellation/stale-response protection to every screen request.
- [ ] Add lint/format rules, strict TypeScript checks and import-boundary rules.
- [ ] Remove dead code, duplicated styles, magic values and obsolete documentation.
- [ ] Keep dependencies minimal; record why each native dependency is needed.

**Exit evidence:** module boundaries documented, typecheck/lint/tests green, no known critical race or state-leak defects.

### C. Authentication and privacy
- [ ] Verify SMS OTP success, invalid/expired OTP, resend cooldown, provider rate limiting and network interruption.
- [ ] Verify Google OAuth PKCE success, cancellation, callback mismatch, missing code and interrupted browser session.
- [ ] Test refresh rotation, concurrent 401 responses, refresh-token reuse, revoked sessions, app relaunch and force-stop.
- [ ] Test sign-out during an in-flight refresh and rapid account switching.
- [ ] Verify tokens and OAuth verifier remain in platform secure storage; never log or bundle credentials.
- [ ] Verify account deletion/data export/retention policy and privacy notice before public launch.
- [ ] Test RLS with two distinct real test users; prove one user cannot read or modify another user's attempts.
- [ ] Verify production and non-production Supabase projects, redirect URLs and allowed origins are separated.

**Exit evidence:** dedicated non-production Supabase integration run, two-user isolation report, auth edge-case results and privacy review.

### D. Question bank and exam integrity
- [ ] Verify each published question against the exact uploaded PDF and preserve original wording, numbers, units and options.
- [ ] Store document/page/shift/source metadata and reviewer status with every question.
- [ ] Verify answer keys and solution calculations independently before publication.
- [ ] Reject records missing source attribution, malformed options, unsupported exam IDs or unreviewed status.
- [ ] Prove public question responses never contain answer keys.
- [ ] Prove answer grading occurs server-side against the stored key.
- [ ] Test duplicate question IDs/text, pagination boundaries, unpublished content and empty bank behavior.
- [ ] Maintain an auditable correction/depublication process; never silently rewrite a source question.
- [ ] Keep AI hints constrained to verified solution material; AI must not decide or modify the answer key.

**Exit evidence:** source-to-database audit, seed assertions, API leakage tests and reviewed content import report.

### E. Backend, database and API reliability
- [ ] Maintain request/response schemas and compatibility tests for every public endpoint.
- [ ] Test authentication, authorization, validation, rate limiting and idempotency on all write endpoints.
- [ ] Test Supabase unavailable/slow, malformed upstream payloads, provider 429/5xx, connection reset and timeout behavior.
- [ ] Rehearse every schema migration on a disposable database and verify forward/backward recovery strategy.
- [ ] Validate indexes and query plans against realistic question and attempt volumes.
- [ ] Test connection pooling, transaction boundaries and duplicate submission races.
- [ ] Verify request IDs, safe cache headers, CORS allowlist and non-sensitive error responses.
- [ ] Set explicit API latency, error-rate and availability objectives.

**Exit evidence:** full backend CI, migration rehearsal, live integration tests, query-plan review and documented SLOs.

### F. Security and supply chain
- [ ] Keep dependency audits current for Python and JavaScript production and development dependencies.
- [ ] Add/verify secret scanning, static analysis and code scanning; resolve critical/high findings or document accepted risk.
- [ ] Review authentication, authorization, RLS, CORS, rate limits, input validation and abuse controls.
- [ ] Verify service-role and AI provider keys exist only in server-side secret storage.
- [ ] Review logs, traces, analytics and metrics for PII, tokens, OTPs, question answers or user prompts.
- [ ] Generate an SBOM and retain build provenance for release artifacts.
- [ ] Pin GitHub Actions to immutable commit SHAs where practical and review third-party action permissions.
- [ ] Perform an independent threat model and pre-release penetration test.

**Exit evidence:** security scan reports, secrets review, SBOM, threat model and resolved release-blocking findings.

### G. Performance, scaling and resilience
- [ ] Establish baseline cold-start, warm-start, screen-transition, API latency, memory and APK size measurements.
- [ ] Run ramp, spike, sustained and soak tests against a staging environment—not the free production service.
- [ ] Test realistic Supabase concurrency, connection limits, query latency and write contention.
- [ ] Test AI provider fallback, per-user quotas, concurrency limits, timeout budgets and cost ceilings.
- [ ] Add bounded retries with jitter only where operations are safe/idempotent.
- [ ] Verify offline behavior and recovery without duplicate answer submissions.
- [ ] Test app background/foreground, process death, low memory, poor network and device storage pressure.
- [ ] Define capacity thresholds and scale the Render service/database plan before public launch.

**Exit evidence:** reproducible staging load report, capacity model, cost model and resilience test results. The checked-in 1,000-request local smoke test is only a baseline, not a production-scale test.

### H. Observability and incident operations
- [ ] Track request rate, p50/p95/p99 latency, error rate, dependency health and AI-provider outcomes.
- [ ] Keep metric labels low-cardinality and free of personal data.
- [ ] Provision production dashboards and alert destinations; verify alerts reach a responsible operator.
- [ ] Run an alert drill for API outage, database outage, elevated 5xx and latency regression.
- [ ] Define incident severity, on-call ownership, communication and postmortem process.
- [ ] Add mobile crash/ANR reporting only with an approved privacy-safe configuration.
- [ ] Document operational runbooks for Render, Supabase, secrets rotation and provider outages.

**Exit evidence:** live dashboard, alert delivery test, runbooks and incident drill record.

### I. QA and test automation
- [ ] Keep pure domain tests, component tests, API integration tests, backend tests and UI end-to-end tests separate.
- [ ] Add React Native component tests for form fields, buttons, navigation, practice options, timer and result states.
- [ ] Expand Maestro flows to OTP, OAuth cancellation, practice submit/retry, hints, progress, revision, sign-out and relaunch.
- [ ] Add negative tests for answer-key leakage, duplicate submission, stale requests and account switching.
- [ ] Add accessibility checks and manual TalkBack/keyboard navigation review.
- [ ] Add screenshot/visual regression coverage for key screens and compact/large font layouts.
- [ ] Run a device/OS matrix and at least one physical Android device before release.
- [ ] Preserve JUnit, logs, screenshots and artifact provenance for every release candidate.

**Exit evidence:** traceable test matrix, passing CI, retained device evidence and no unresolved release-blocking defects.

### J. Release engineering and deployment
- [ ] Use separate development, staging and production configurations and credentials.
- [ ] Verify Expo config, Android package ID, version/versionCode, permissions, deep links and network security configuration.
- [ ] Configure and back up a persistent Android release keystore; never ship an ephemeral QA-signed build.
- [ ] Build and verify release APK/AAB, signature, checksum, size and provenance.
- [ ] Test upgrade installation over the previous production build and clean installation.
- [ ] Test database migration order and deploy/rollback sequencing.
- [ ] Use staged rollout, release notes, crash/ANR monitoring and a rollback decision threshold.
- [ ] Verify Play Console policy, privacy/data-safety declarations, store assets and signing ownership before Play release.

**Exit evidence:** signed release candidate, upgrade test, deployment checklist, rollback rehearsal and store-policy review.

### K. Documentation and maintenance
- [ ] Keep README, API docs, environment variable list and QA instructions aligned with actual code.
- [ ] Document architecture decisions, schema changes, release process and support escalation.
- [ ] Define dependency update cadence, vulnerability response SLA and backup/restore schedule.
- [ ] Schedule recurring regression, accessibility and disaster-recovery checks.

## 4. Known limitations to resolve before production

1. The app entry point is still a large monolithic file; modularization is underway.
2. Current Maestro coverage is a starter suite, not complete learner-journey acceptance coverage.
3. Real SMS/Google OAuth and two-user RLS isolation need dedicated non-production integration tests.
4. Physical-device, TalkBack and broad Android-version testing have not been evidenced by the hosted emulator.
5. The repository's Render service is configured on the free plan; public-launch capacity and availability require a deliberate production hosting/database decision.
6. Persistent Android release signing must be verified; an ephemeral QA key cannot support production upgrades.
7. The configured dependency audits are not a substitute for full SAST, secret scanning, SBOM and penetration testing.
8. Hosted monitoring configuration exists, but actual alert routing and incident drills must be demonstrated.

## 5. Definition of done

A work item is done only when:
- acceptance criteria are explicit;
- implementation is reviewed;
- automated tests pass at the correct level;
- security, accessibility and failure states are considered;
- evidence is attached to the PR/release;
- documentation is updated; and
- remaining risks are recorded with an owner and resolution plan.

A production release is blocked by any unresolved critical/high security issue, data-isolation defect, answer-key exposure, source-integrity violation, unrecoverable answer-submission defect, failed release signing/upgrade test or missing rollback path.
