# Tayar.ai — evidence-based engineering audit

**Audit date:** 2026-11-27  
**Repository:** `vikasvijigiri/tayar.ai`  
**Working branch:** `eng/production-hardening-governance`  
**Pull request:** [#33](https://github.com/vikasvijigiri/tayar.ai/pull/33)  
**Decision:** Not production-certified; owner-controlled release gates remain.

## Verified engineering evidence

| Area | Evidence | Status |
|---|---|---|
| Backend tests | 83 tests passed | Pass |
| Backend coverage | 85.87% statement coverage; CI floor 85% | Pass |
| Local concurrency smoke | 1,000 requests, 20 workers, p95 124.2 ms; 2,000 ms limit | Pass; not a production load test |
| Database schema/seed | PostgreSQL 17 CI schema and seed validation | Pass |
| Code security | CodeQL Python and JavaScript/TypeScript | Pass |
| Secret scanning | Gitleaks on the squashed PR head | Pass |
| Python supply chain | pip-audit | Pass |
| npm supply chain | npm audit policy; zero high/critical | Pass with two time-bounded moderate exceptions |
| SBOM | CycloneDX: 37 backend and 713 mobile components | Generated and retained as CI artifacts |
| Mobile static checks | TypeScript, source smoke tests, Android bundle | Pass |
| Android UI smoke | API 35 Maestro smoke and malformed-phone validation | Pass |
| Android package | APK checksum and v2/v3 signature verified | QA key only |
| Responsive UI | API 29/API 35, 130% font scale | Pending emulator result |
| Live API | Scheduled synthetic API and deployed smoke checks | Pass during audit window |

### Supply-chain exceptions

The mobile dependency audit reports zero high/critical vulnerabilities. Two moderate advisories in Expo SDK 54 transitive build-tool dependencies are accepted only until **2026-12-11** with documented mitigations. The mobile SBOM contains `node-forge@1.4.4`; the vulnerable `1.4.0` was not found. The audit policy is being strengthened to bind exceptions to exact lockfile node paths and versions.

### Question-bank structural audit

Read-only SQL checks on the production database found:
- 50 active/source-verified question rows across 12 topics.
- 0 duplicate normalized question texts.
- 0 questions with non-four-option or duplicate-option sets.
- 0 invalid A–D answer-key labels.
- 0 missing solution steps, source-page metadata, difficulty or syllabus weight.

This is structural validation only. Forty-nine rows reference one chapterwise compilation and one references a second PDF. The publisher, official provenance, answer-key accuracy and redistribution rights have not been independently established. See [Issue #34](https://github.com/vikasvijigiri/tayar.ai/issues/34).

## Production environment observed

- Render API: Free plan, one instance, Oregon.
- Supabase: Free plan, Tokyo.
- Cross-region API/database traffic.
- Metrics bearer secret absent; the currently deployed endpoint is public. PR #33 changes the code to fail closed until a token is configured, but this is not deployed.
- Supabase Security Advisor: leaked-password protection disabled.
- Main branch protection: disabled.
- No isolated Supabase preview branch; preview integration CI is skipped.
- No `TEST_PHONE` / `TEST_OTP` secrets; authenticated navigation is skipped.
- No persistent production Android signing key; APK evidence uses an ephemeral QA key.
- No physical-device test evidence.
- Privacy policy draft lacks a confirmed support/privacy contact and legal approval.

Supabase's Free plan does not include automatic backups, point-in-time recovery, branching, leaked-password protection, an uptime SLA, or more than one day of API/database log retention. Supabase documents leaked-password protection as Pro-only. A Pro upgrade is an owner billing decision; no plan was changed and no billable branch was created.

## Owner-controlled release gates

1. Approve an appropriate paid production/staging plan and region strategy; configure backup/restore and retention.
2. Set a high-entropy `METRICS_BEARER_TOKEN` in Render and the matching GitHub Actions secret.
3. Enable main-branch protection and require the complete CI status-check set plus independent review.
4. Configure a dedicated non-production Supabase project/branch and test credentials; run live signup/sign-in/refresh, RLS isolation, attempt idempotency, AI hint and account-deletion tests.
5. Store a persistent Android signing keystore and passwords in GitHub Actions secrets; verify the signed release artifact.
6. Install and test the release build on physical Android devices.
7. Publish a reviewed privacy policy, terms, account-deletion process and real support/privacy contact.
8. Clear question provenance, independent answer/solution review and redistribution rights before public distribution.
9. Complete a production load test, alert routing, backup restore drill, incident/rollback runbook and security review.

## Important limitations

- PR #33 is a draft and has not been merged or deployed.
- A successful CI run does not prove live authentication, external-provider reliability, production-scale capacity, data-rights clearance or operational recovery.
- The mobile `App.tsx` and backend `main.py` remain large modules; a maintainability refactor is still needed.
- No claim of “world-class” or “production-ready” should be made until the owner-controlled gates above are closed with evidence.
