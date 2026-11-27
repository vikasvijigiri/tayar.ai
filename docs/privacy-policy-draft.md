# Tayar.ai privacy notice — internal draft

> **Status: DRAFT — NOT PUBLISHED.** This document is not a final privacy notice or legal advice. Do not link it from the app or publish it until the open verification items below are completed and the owner/legal reviewer approves it.

Last technical review: 2026-11-27

## 1. What the application does

Tayar.ai is an exam-preparation application. Users sign in, practise verified questions, review their progress, and may request AI-generated hints based on server-stored solution steps.

## 2. Information processed

### Account and authentication
- Phone number and/or identity information required by the configured Supabase Auth providers (phone OTP and Google OAuth are implemented in the mobile client).
- Supabase-issued access and refresh tokens. The Android app stores these in Android SecureStore; the server validates bearer access tokens with Supabase Auth.
- The API does not need a user's phone number to grade an answer or generate an AI hint.

### Practice activity
The current database schema stores attempt records containing:
- account user ID;
- question ID;
- whether the answer was correct;
- elapsed time in milliseconds;
- optional confidence rating;
- answer selected;
- idempotency key; and
- creation timestamp.

Question-bank content and verified solution steps are application content, not personal profile fields.

### AI hints
To generate a hint, the API retrieves the verified solution and topic from Supabase. The prompt sent to the configured AI provider contains the topic, hint level, and stored solution steps. The inspected implementation does not include the user's phone number, account ID, bearer token, or refresh token in that prompt.

The backend supports Groq, Google Gemini, and Cerebras, selected through server-side environment configuration. The provider actually enabled for production, its model, data-processing terms, retention settings, and regional processing must be verified before publication. Do not assume all three providers receive data.

## 3. Service providers and infrastructure

The codebase integrates:
- Supabase Auth and PostgreSQL for identity and application data;
- Render for API hosting;
- GitHub Actions for source validation, builds, security scans, and retained build/test artifacts; and
- whichever AI inference provider is enabled through server-side configuration.

Before publication, the owner must confirm the actual production project/region, provider configuration, vendor agreements, subprocessors, and current retention controls. Repository code alone cannot verify deployed account settings or vendor contracts.

## 4. Operational telemetry

The inspected API middleware records request ID, HTTP method, route template, status code, and duration. AI telemetry records provider name, outcome, and latency. Unexpected API errors return a generic response; their logs include request correlation and traceback frames without exception text or request bodies.

The application must continue to avoid logging access tokens, refresh tokens, OTPs, phone numbers, answer payloads, or AI prompts. Render, Supabase, AI-provider, and GitHub platform log retention is controlled partly by deployed vendor settings and has not yet been verified.

## 5. Storage and retention

Practice attempts remain associated with an account until the account is deleted. The schema declares the attempts-to-auth-user relationship with ON DELETE CASCADE. The mobile app now offers account deletion; the API requires a recently authenticated Supabase session and deletes the server-verified account.

The deletion implementation has automated mocked-provider tests. A live deletion test against a dedicated non-production Supabase project, including confirmation that all linked records are removed, is still required before public launch.

Exact retention periods for Supabase backups, Render logs, AI-provider request data, and GitHub artifacts must be confirmed from the actual production plans/settings and vendor terms. Do not publish guessed retention periods.

## 6. Security controls

- Access and refresh tokens are stored using Android SecureStore.
- Supabase service-role credentials and AI provider keys are intended to remain server-side.
- User identity for protected operations is validated with Supabase Auth.
- Account deletion derives the target user ID from the verified Auth response; it does not accept a client-supplied user ID.
- User-specific API responses use private/no-store cache headers.
- CI performs dependency auditing, CodeQL analysis, and secret scanning.

These controls do not replace a production security assessment or live configuration review.

## 7. User choices and requests

Users can view their practice progress in the app and can request permanent account deletion from the Services screen. Deletion removes the Auth user and, through the declared foreign-key cascade, linked attempt records.

A data export, profile correction workflow, and a published support channel have not been verified as available. Do not promise these features until implemented.

## 8. Contact and publication blockers

**Support/privacy contact: NOT CONFIGURED.** The owner must provide and verify a monitored support/privacy email or equivalent private contact channel. Do not invent one or use a public issue tracker for account-specific personal data.

Before this notice is published, complete:
1. Confirm the production Supabase project, region, Auth providers, backup retention, and deletion behavior.
2. Confirm the production AI provider(s), model(s), data retention, training/use terms, and subprocessors.
3. Confirm Render log retention and access controls.
4. Set and verify a monitored privacy/support contact.
5. Determine applicable jurisdictions, legal basis, user-rights language, age/guardian requirements, and statutory retention obligations with qualified counsel.
6. Publish this approved notice at a stable HTTPS URL and link it in the app's sign-in/account screens.
7. Complete live account-deletion and data-isolation tests in a dedicated non-production environment.

Until these items are completed, this draft must not be represented as a published privacy policy.


## Internal release verification notes — remove before publication

These notes are operational findings, not consumer-facing policy language. They must be rechecked immediately before publication.

- The observed Supabase project is on the Free plan in the Tokyo region. The observed Render API service is on the Free plan in Oregon with one instance. API traffic therefore crosses regions; the final data-flow and latency disclosure must match the deployment actually chosen at launch.
- The current Supabase Free plan does not provide automatic database backups, point-in-time recovery, branching, an uptime SLA, or more than one day of API/database log retention. Leaked-password protection is Pro-only. The production Auth project currently has this protection disabled.
- The backend can be configured for Groq, Google Gemini, or Cerebras. The exact provider and model active at launch must be confirmed from deployment configuration and disclosed accurately.
- Attempt history is retained in the account database until account deletion or a separately approved retention policy. No fixed automatic deletion period has been verified.
- A real support/privacy contact is not yet supplied. Replace every placeholder with an owner-controlled contact and obtain legal review before publishing.
- The policy is a draft. It is not evidence that a privacy notice, terms, consent flow, or user-rights process is live in the app.
