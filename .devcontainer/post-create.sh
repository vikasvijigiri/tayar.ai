#!/usr/bin/env bash
set -euo pipefail

echo "==> Installing backend development dependencies"
python -m venv backend/.venv
backend/.venv/bin/python -m pip install --upgrade pip
backend/.venv/bin/pip install -r backend/requirements-dev.txt

echo "==> Installing locked mobile dependencies"
npm --prefix mobile ci --no-audit --no-fund

echo "==> Tayar.ai cloud workspace is ready"
echo "Backend: cd backend && ../backend/.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"
echo "Mobile:  cd mobile && npx expo start --host tunnel"
echo "Android emulator UI tests run in GitHub Actions, not inside Codespaces."
