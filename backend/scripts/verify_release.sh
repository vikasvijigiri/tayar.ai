#!/usr/bin/env bash
set -euo pipefail

# Run release-blocking checks in an isolated environment so test/lint tools
# do not become part of the deployed API runtime.
TEST_ENV="/tmp/tayar-release-checks"
python -m venv "$TEST_ENV"
"$TEST_ENV/bin/python" -m pip install --disable-pip-version-check --no-cache-dir -r requirements-dev.txt
"$TEST_ENV/bin/ruff" check app tests
"$TEST_ENV/bin/python" -m compileall -q app
"$TEST_ENV/bin/python" -m pytest tests -q
