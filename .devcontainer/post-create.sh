#!/usr/bin/env bash
set -euo pipefail

echo "==> Installing backend development dependencies"
python -m venv backend/.venv
backend/.venv/bin/python -m pip install --upgrade pip
backend/.venv/bin/pip install -r backend/requirements-dev.txt

echo "==> Installing locked mobile dependencies"
npm --prefix mobile ci --no-audit --no-fund

echo "==> Tayar.ai cloud workspace is ready"
echo "API: cd backend && ../backend/.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"
echo "Mobile checks: cd mobile && npm run typecheck && npm test"
echo "Android UI tests run on a hosted emulator in GitHub Actions."
