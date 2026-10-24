# Tayar.ai — Adaptive RRB NTPC preparation

Android-first adaptive exam preparation. RRB NTPC is the first exam configuration; the engine is intended to support additional exams through configuration and verified content.

## Stack
- Expo React Native + TypeScript
- FastAPI backend on Render
- Supabase PostgreSQL/Auth with Row Level Security
- AI gateway adapters: Groq, Gemini, Cerebras
- Prometheus metrics endpoint and provisioned Grafana dashboard
- GitHub Actions tests and Android APK/AAB build artifacts

## Source integrity
A reviewed starter SQL seed is provided at `backend/supabase/seed_verified_math.sql`. It contains 14 questions across Number System, L.C.M and H.C.F, Percentage, Time and Work, and Pipe and Cistern. Each question's wording, original options, answer key and source page/shift were checked directly against the uploaded PDFs. The solution steps are independently authored and arithmetically checked, not claimed as verbatim PDF explanations. Run the seed only after `backend/supabase/schema.sql`; the app will not show these questions until the seed has been applied to the connected Supabase project. Continue importing only questions verified directly against source PDFs. AI must never alter the stored answer key.

## Backend local run
```bash
cd backend
python -m venv .venv
# Windows: .venv\\Scripts\\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```
Endpoints:
- `GET /health` — process health
- `GET /v1/config` — supported exam and adaptive metrics
- `GET /metrics` — Prometheus request count and latency metrics
- `POST /v1/auth/refresh` — server-side Supabase refresh-token exchange; app sign-in is SMS OTP and Google OAuth only
- `GET /v1/questions` — active, source-verified questions only; excludes answer keys
- `POST /v1/questions/{question_id}/answer` — authenticates the user, grades server-side against the stored answer key, and persists the attempt under RLS
- `GET /v1/attempts/summary` — authenticated accuracy, recent accuracy and average response-time metrics
- `GET /v1/attempts/history` — paginated, authenticated recent answer history for review; does not expose answer keys
- `POST /v1/attempts/preview` — development-only validation preview; disabled unless `ENABLE_ATTEMPT_PREVIEW=true`; does not persist
- `POST /v1/ai/hint` — authenticated hints based only on stored verified solution steps

Open `http://127.0.0.1:8000/docs` for the OpenAPI schema.

## Mobile local run
```bash
cd mobile
npm install
npx expo start
```
The mobile app uses a minimal SMS OTP / Google OAuth sign-in screen, Expo SecureStore for access/refresh tokens, fixed Home, Practice, Analytics, Revision and Services destinations, and cross-links between related screens. The eight-minute timer starts only when the learner enters Practice. Practice batches rotate through the published verified question bank using server-reported counts. Analytics includes accuracy, speed, topic performance and recent saved answer history. The Services page checks liveness, readiness, configuration, Prometheus metrics, question delivery and authenticated analytics/history endpoints. Real SMS delivery, Google OAuth, deep-link callback and physical-device testing are still required.

## Monitoring (local Prometheus + Grafana)
Docker and Docker Compose are required. From the repository root:
```bash
# Set a strong local Grafana password first
export GRAFANA_ADMIN_PASSWORD='replace-with-a-strong-local-password'
docker compose -f monitoring/docker-compose.yml up -d
```
- Grafana: http://localhost:3000
- Prometheus: http://localhost:9090
- Default local Grafana username: `admin`; password is the value you set in `GRAFANA_ADMIN_PASSWORD`.

The provisioned Grafana dashboard is named **Tayar.ai API Reliability**. Prometheus scrapes the public Render `/metrics` endpoint every 30 seconds. A metric chart may remain empty until Prometheus can reach the endpoint and the API receives requests. The endpoint is currently public and exposes aggregate operational metrics only; do not add personal data, tokens, prompts or secrets to metrics labels.

For a hosted Grafana/Prometheus setup, deploy the same scrape configuration to a reachable Prometheus instance and connect Grafana to that instance. This repository contains configuration; it does not itself provision a hosted Grafana account.

## Authentication release configuration
The app exposes only SMS OTP and Google OAuth controls. In Supabase Auth settings, enable Phone and Google providers, configure an SMS provider and Google client credentials, disable Email/password sign-up/sign-in to enforce the phone/Google-only policy, and add `tayarai://auth/callback` to Additional Redirect URLs. Also configure Google's authorized redirect URI to the Supabase Auth callback URL shown in the dashboard. Provider credentials must remain in Supabase, not in the app. The public anon/publishable key may be returned by `/v1/config`; the service-role key must never be returned there.

## Deploy
Render uses `render.yaml`. Configure the environment variables in the Render dashboard after linking the repository:
- `SUPABASE_URL` and `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-side only; used to read verified questions and fetch answer keys for grading; never expose it to the app)
- At least one AI key for AI hints: `GROQ_API_KEY`, `GEMINI_API_KEY`, or `CEREBRAS_API_KEY`
- Optional provider order and model overrides documented in `backend/app/main.py`

Never commit API keys. Never place a Supabase service-role key or AI key in the mobile app. Run the tracked migrations in `backend/supabase/migrations/` against the existing project before future deployments. For a new project, run `backend/supabase/schema.sql`, then `backend/supabase/seed_verified_math.sql`, and finally `backend/supabase/seed_assertions.sql` in Supabase SQL Editor to publish and validate 50 source-verified questions across twelve topics. The incremental `seed_verified_math_expansion.sql` adds the first 24-question expansion to an existing 14-question installation; `seed_verified_math_expansion_12.sql` adds twelve more questions and seven topics to an existing 38-question installation. Attempt writes use the signed-in user's access token and database RLS. The service-role key is used only server-side for verified-question reads and answer-key lookup; grading is server-side and question-list responses exclude answer keys.

## CI/CD
Pushes and pull requests run backend tests, Ruff linting, coverage reporting, dependency audits, mobile type checking/smoke tests, and Android builds. The Android workflow uses the committed npm lockfile (`npm ci`), caches Gradle dependencies, verifies the APK package ID/signature/SHA-256, and fails if the APK exceeds 100 MiB. Artifacts are available under Actions → workflow run → Artifacts for seven days. No public release is created automatically.

For a persistent production APK signature, create and back up a release keystore offline, then configure these repository Actions secrets: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, and `ANDROID_KEY_PASSWORD`. Base64-encode the keystore file before storing it in `ANDROID_KEYSTORE_BASE64`. Never commit the keystore, put passwords in source control, or upload the private key as a build artifact. If the secrets are absent, CI creates a one-time QA signing key; that APK is installable for testing but cannot receive signed in-place upgrades.

## Current limitations
- The reviewed bank now has 50 source-verified questions across twelve quantitative topics. This is a smoke-test/early-access bank, not comprehensive coverage of the full RRB NTPC syllabus; continue expanding from the uploaded source PDFs before a broad public launch.
- SMS OTP and Google OAuth code paths, secure token storage/refresh, verified-question delivery, server-side grading and basic attempt summaries are implemented; real SMS/Google provider configuration and end-to-end physical-device tests remain mandatory release gates.
- Prometheus/Grafana configuration is committed, but hosted dashboards are not provisioned by these files alone.
- A passing build or unit test does not mean the app is production-ready. Verify live service configuration and test on real Android devices before publishing.
- The current Android APK is a one-time QA-signed candidate unless all persistent signing secrets are configured. It is not suitable for reliable in-place production upgrades.
- Free-tier quotas, cold starts and usage limits may affect availability.
