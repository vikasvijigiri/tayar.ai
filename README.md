# Tayar.ai — Adaptive RRB NTPC preparation

Android-first adaptive exam preparation. RRB NTPC is the first exam configuration; the engine is designed to support additional exams by configuration and content.

## Stack
- Expo React Native + TypeScript
- FastAPI backend
- Supabase PostgreSQL/Auth (configure before production)
- AI gateway adapters: Groq, Gemini, Cerebras
- Render deployment blueprint
- GitHub Actions tests and Android APK artifacts

## Source integrity
No questions are seeded in this starter. Import only questions verified directly against source PDFs, preserving wording/options and recording source document/page. Verify answer keys and solution steps before publication. AI must never alter the stored answer key.

## Backend local run
```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```
Open http://127.0.0.1:8000/health and /docs.

## Mobile local run
Install Node.js LTS, then:
```bash
cd mobile
npm install
npx expo start
```

## CI/CD
Pushes and pull requests run checks and build an APK using GitHub Actions. APKs are available under Actions → workflow run → Artifacts. Pushing a tag such as `v0.1.0` attaches the APK to a GitHub Release. First CI build must be verified in Actions logs.

## Deploy
Render uses `render.yaml`. Configure server-side secrets in Render, never commit API keys. Run `backend/supabase/schema.sql` in Supabase SQL Editor. Never put the Supabase service-role key or AI keys in the mobile app.

## Required server environment variables
`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server only), `GROQ_API_KEY`, `GEMINI_API_KEY`, `CEREBRAS_API_KEY`, `AI_PROVIDER_ORDER=groq,gemini,cerebras`, `CORS_ORIGINS`.

## Current limitations
Starter foundation only: authentication and persistent attempts still need implementation; no verified question bank is included; no build/deployment is considered successful until CI and hosted health checks are verified. Free tiers have quotas, sleep/usage limits, and can change.
