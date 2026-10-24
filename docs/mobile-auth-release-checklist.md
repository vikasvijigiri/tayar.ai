# Tayar.ai mobile authentication release checklist

The mobile app intentionally supports **SMS OTP and Google OAuth only**. Email/password endpoints are disabled.

## Supabase Auth configuration

- Enable Phone authentication and configure a real SMS provider with delivery, spending limits, and rate limits.
- Disable Email provider sign-up/sign-in in Supabase Auth. Hiding email/password in the app and removing backend endpoints does not disable Supabase's public Auth endpoints; this dashboard setting is required to enforce phone/Google-only authentication.
- Enable the Google provider and configure the Google OAuth client ID/secret in Supabase Auth. Keep provider secrets in Supabase; never ship them in the app or backend public config.
- Add this exact callback to Supabase Auth > URL Configuration > Additional Redirect URLs:
  - `tayarai://auth/callback`
- Ensure the Google OAuth consent screen and authorized redirect URI include the Supabase project's OAuth callback URL shown by Supabase, not the app's custom scheme. Supabase completes the Google flow and then redirects to the app.
- Verify the app's custom scheme is `tayarai` in `mobile/app.json`.
- Keep the Supabase service-role key server-side only. `/v1/config` may return only the project URL and public anon/publishable key.

## Release verification

- Send and verify an SMS OTP on a real phone; confirm wrong, expired, replayed, and rate-limited codes fail.
- Complete Google sign-in on a physical Android device, including cancellation and denied-consent cases.
- Confirm tokens persist securely, refresh rotates the session, logout requests provider-side session revocation when reachable (and always clears local tokens), and protected API routes reject missing/invalid tokens.
- Confirm backend health/readiness, source-verification gates, answer idempotency, and AI hint cache behavior.
- Run GitHub Actions: Quality Gates, Backend CI, Dependency Audit, Monitoring Config CI, and Android APK.
- A workflow-generated APK signed with a one-time QA key is installable for testing but **cannot be used for reliable production upgrades**. Configure the persistent Android signing secrets before publishing a production release.

## Database hardening applied

The project function `public.rls_auto_enable()` is an event-trigger function. Execute permission was revoked from `PUBLIC`, `anon`, and `authenticated`; verification confirmed the event trigger remains attached and those roles can no longer execute the function directly. Database indexes and optimized `auth.uid()` policy expressions are tracked in the corresponding migration.
