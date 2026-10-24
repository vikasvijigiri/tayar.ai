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
- `POST /v1/auth/signup`, `POST /v1/auth/signin`, `POST /v1/auth/refresh` — Supabase email authentication/session endpoints
- `GET /v1/questions` — active, source-verified questions only; excludes answer keys
- `POST /v1/questions/{question_id}/answer` — authenticates the user, grades server-side against the stored answer key, and persists the attempt under RLS
- `GET /v1/attempts/summary` — authenticated accuracy, recent accuracy and average response-time metrics
- `POST /v1/attempts/preview` — development-only validation preview; does not persist
- `POST /v1/ai/hint` — authenticated hints based only on stored verified solution steps

Open `http://127.0.0.1:8000/docs` for the OpenAPI schema.

## Mobile local run
```bash
cd mobile
npm install
npx expo start
```
The dashboard checks the configured Render API health endpoint, supports Supabase sign-in/session refresh, loads only published verified questions, submits answers for server-side grading, and refreshes learning statistics after answers. Live Supabase configuration and device-level testing are still required.

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

## Deploy
Render uses `render.yaml`. Configure the environment variables in the Render dashboard after linking the repository:
- `SUPABASE_URL` and `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-side only; used to read verified questions and fetch answer keys for grading; never expose it to the app)
- At least one AI key for AI hints: `GROQ_API_KEY`, `GEMINI_API_KEY`, or `CEREBRAS_API_KEY`
- Optional provider order and model overrides documented in `backend/app/main.py`

Never commit API keys. Never place a Supabase service-role key or AI key in the mobile app. Run `backend/supabase/schema.sql` and then `backend/supabase/seed_verified_math.sql` in Supabase SQL Editor to publish the reviewed starter questions. Attempt writes use the signed-in user's access token and database RLS. The service-role key is used only server-side for verified-question reads and answer-key lookup; grading is server-side and question-list responses exclude answer keys.

## CI/CD
Pushes and pull requests run backend tests, dependency audit, mobile type checking/smoke tests, and Android builds. The Android workflow builds an installable APK and a Play Store AAB, reports their sizes, and fails if the APK exceeds 100 MiB. Artifacts are available under Actions → workflow run → Artifacts. Pushing a tag such as `v0.1.0` attaches release files to a GitHub Release.

## Current limitations
- The 14-question starter seed is committed but must still be applied to the target Supabase project; the live app currently has no published question bank until that is done.
- Sign-up/sign-in UI, secure token storage/refresh, verified-question delivery, server-side grading and basic attempt summaries are implemented but require live Supabase integration tests before production use.
- Prometheus/Grafana configuration is committed, but hosted dashboards are not provisioned by these files alone.
- A passing build or unit test does not mean the app is production-ready. Verify live service configuration and test on real Android devices before publishing.
- Free-tier quotas, cold starts and usage limits may affect availability.
