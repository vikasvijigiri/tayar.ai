#!/usr/bin/env python3
"""Public synthetic checks for the deployed Tayar.ai API.

This intentionally avoids creating users or writing attempts. Successful
authenticated flows are covered by backend/scripts/live_auth_smoke.py, which
requires a human-entered Supabase OTP and is not suitable for scheduled CI.
"""
from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.request
from typing import Any

BASE = "https://tayar-ai-api.onrender.com"
TIMEOUT = 60
RETRIES = 3


class CheckFailure(RuntimeError):
    pass


def request(method: str, path: str, payload: dict[str, Any] | None = None, extra_headers: dict[str, str] | None = None) -> tuple[int, Any, str]:
    body = json.dumps(payload).encode() if payload is not None else None
    headers = {"User-Agent": "TayarAI-Synthetic-Monitor/1.0", "Accept": "application/json"}
    if body is not None:
        headers["Content-Type"] = "application/json"
    if extra_headers:
        headers.update(extra_headers)
    last_error: Exception | None = None
    for attempt in range(RETRIES):
        req = urllib.request.Request(BASE + path, data=body, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=TIMEOUT) as response:
                raw = response.read().decode("utf-8", "replace")
                try:
                    data: Any = json.loads(raw)
                except json.JSONDecodeError:
                    data = raw
                return response.status, data, response.headers.get("Content-Type", "")
        except urllib.error.HTTPError as exc:
            raw = exc.read().decode("utf-8", "replace")
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                data = raw
            if exc.code in (429, 500, 502, 503, 504) and attempt + 1 < RETRIES:
                time.sleep(5 * (attempt + 1))
                continue
            return exc.code, data, exc.headers.get("Content-Type", "")
        except (urllib.error.URLError, TimeoutError) as exc:
            last_error = exc
            if attempt + 1 < RETRIES:
                time.sleep(5 * (attempt + 1))
    raise CheckFailure(f"{method} {path}: network/timeout after retries ({type(last_error).__name__})")


def expect(ok: bool, message: str) -> None:
    if not ok:
        raise CheckFailure(message)


def check(method: str, path: str, expected: int, payload: dict[str, Any] | None = None, extra_headers: dict[str, str] | None = None) -> tuple[Any, str]:
    status, data, content_type = request(method, path, payload, extra_headers)
    expect(status == expected, f"{method} {path}: expected HTTP {expected}, got {status}")
    print(f"PASS {method} {path} -> {status}")
    return data, content_type


def main() -> int:
    health, _ = check("GET", "/health", 200)
    expect(isinstance(health, dict) and health.get("status") == "ok", "/health returned an unexpected payload")

    readiness, _ = check("GET", "/health/ready", 200)
    deps = readiness.get("dependencies", {}) if isinstance(readiness, dict) else {}
    expect(readiness.get("status") == "ready", "/health/ready did not report ready")
    expect(deps.get("supabase") == "connected", "Supabase is not connected")
    expect(deps.get("question_bank") == "available", "Verified question bank is unavailable")
    expect(deps.get("ai_provider_configured") is True, "No AI provider is configured")

    config, _ = check("GET", "/v1/config", 200)
    expect(isinstance(config, dict), "/v1/config returned a non-object payload")
    expect(any(x.get("id") == "rrb_ntpc" for x in config.get("supported_exams", []) if isinstance(x, dict)),
           "RRB NTPC is missing from supported exams")
    expect(config.get("ai_enabled") is True, "API config reports AI disabled")
    expect(isinstance(config.get("supabase_url"), str) and config["supabase_url"].startswith("https://"),
           "Supabase URL is missing from public config")
    expect(isinstance(config.get("supabase_anon_key"), str) and bool(config["supabase_anon_key"]),
           "Supabase publishable/anon key is missing from public config")

    questions, _ = check("GET", "/v1/questions?exam_id=rrb_ntpc&limit=5", 200)
    rows = questions.get("questions") if isinstance(questions, dict) else None
    expect(isinstance(rows, list) and len(rows) > 0, "Question endpoint returned no questions")
    expect(questions.get("total_count", 0) >= len(rows), "Question count metadata is inconsistent")
    for row in rows:
        expect(isinstance(row.get("id"), str) and row["id"], "Question ID is missing")
        expect(row.get("exam_id") == "rrb_ntpc", "Question exam_id is incorrect")
        expect(isinstance(row.get("question_text"), str) and row["question_text"].strip(), "Question text is empty")
        expect(isinstance(row.get("options"), list) and len(row["options"]) == 4, "Question must have exactly four options")
        expect(all(isinstance(option, str) and option.strip() for option in row["options"]), "Question has an empty option")
        expect(isinstance(row.get("source_document"), str) and row["source_document"].strip(), "Source document is missing")
        expect(row.get("source_page") not in (None, ""), "Source page is missing")
        expect("answer_key" not in row and "solution_steps" not in row, "Public question endpoint leaked answer material")
    print(f"PASS question integrity and answer-key non-disclosure ({len(rows)} rows; bank total {questions['total_count']})")

    metrics_token = os.getenv("METRICS_BEARER_TOKEN", "").strip()
    metrics_headers = {"Authorization": f"Bearer {metrics_token}"} if metrics_token else None
    metrics, metrics_type = check("GET", "/metrics", 200, extra_headers=metrics_headers)
    expect("text/plain" in metrics_type, "/metrics did not return Prometheus text exposition")
    expect(isinstance(metrics, str) and ("# HELP" in metrics or "# TYPE" in metrics),
           "/metrics did not return Prometheus metrics")

    # These requests deliberately omit credentials and must be rejected before data access.
    check("GET", "/v1/attempts/history?exam_id=rrb_ntpc&limit=1", 401)
    check("GET", "/v1/attempts/summary?exam_id=rrb_ntpc", 401)
    check("POST", "/v1/ai/hint", 401, {
        "question_id": "00000000-0000-0000-0000-000000000001",
        "hint_level": "nudge",
    })
    check("POST", "/v1/questions/00000000-0000-0000-0000-000000000001/answer", 401, {
        "answer_given": "A",
        "elapsed_ms": 1000,
    })

    # A short token exercises request validation without contacting Supabase Auth.
    check("POST", "/v1/auth/refresh", 422, {"refresh_token": "x"})

    print("ALL PUBLIC API SYNTHETIC CHECKS PASSED")
    print("NOTE: Successful OTP login, authenticated reads, AI inference and answer writes are not exercised here.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except CheckFailure as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        raise SystemExit(1)
