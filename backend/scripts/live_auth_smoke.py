#!/usr/bin/env python3
"""Interactive live API smoke test. OTP and access tokens remain on this machine.

Run from backend/: python scripts/live_auth_smoke.py
To include the persistent answer-submission test (adds one attempt to this account):
  python scripts/live_auth_smoke.py --include-write-test
"""
from __future__ import annotations

import argparse
import getpass
import json
import sys
import uuid
from typing import Any

import requests

API_BASE = "https://tayar-ai-api.onrender.com"
TIMEOUT = 25


def fail(message: str) -> None:
    print(f"FAIL: {message}")
    raise SystemExit(1)


def expect(condition: bool, message: str) -> None:
    if not condition:
        fail(message)


def request_json(method: str, url: str, **kwargs: Any) -> tuple[requests.Response, Any]:
    response = requests.request(method, url, timeout=TIMEOUT, **kwargs)
    try:
        body = response.json()
    except ValueError:
        body = None
    return response, body


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--include-write-test",
        action="store_true",
        help="Submit one real answer; this permanently adds an attempt to the signed-in user's history.",
    )
    args = parser.parse_args()

    print(f"Checking live API: {API_BASE}")
    response, config = request_json("GET", f"{API_BASE}/v1/config")
    expect(response.status_code == 200 and isinstance(config, dict), "GET /v1/config failed")
    supabase_url = config.get("supabase_url")
    anon_key = config.get("supabase_anon_key")
    expect(isinstance(supabase_url, str) and supabase_url.startswith("https://"), "API config has no valid Supabase URL")
    expect(isinstance(anon_key, str) and bool(anon_key), "API config has no public Supabase anon key")
    print("PASS GET /v1/config (exam and auth config present)")

    phone = input("Enter your phone in international format (e.g. +919494790344): ").strip()
    expect(phone.startswith("+") and phone[1:].isdigit(), "Use international phone format such as +919494790344")

    response, body = request_json(
        "POST",
        f"{supabase_url.rstrip('/')}/auth/v1/otp",
        headers={"apikey": anon_key, "Content-Type": "application/json"},
        json={"phone": phone, "create_user": True},
    )
    expect(response.status_code in (200, 201), f"SMS OTP request failed (HTTP {response.status_code}); check Supabase phone auth/provider configuration")
    print("OTP request accepted. Enter the code from your SMS; it is not sent to ChatGPT.")
    otp = getpass.getpass("SMS OTP: ").strip()
    expect(bool(otp), "OTP cannot be empty")

    response, session = request_json(
        "POST",
        f"{supabase_url.rstrip('/')}/auth/v1/verify",
        headers={"apikey": anon_key, "Content-Type": "application/json"},
        json={"phone": phone, "token": otp, "type": "sms"},
    )
    expect(response.status_code == 200 and isinstance(session, dict), f"OTP verification failed (HTTP {response.status_code})")
    access_token = session.get("access_token")
    expect(isinstance(access_token, str) and access_token, "Supabase did not return an access token")
    headers = {"Authorization": f"Bearer {access_token}"}
    print("PASS Supabase SMS authentication (access token kept in process memory)")

    response, user = request_json(
        "GET",
        f"{supabase_url.rstrip('/')}/auth/v1/user",
        headers={"apikey": anon_key, **headers},
    )
    expect(response.status_code == 200 and isinstance(user, dict) and user.get("id"), "Supabase user verification failed")
    print("PASS authenticated Supabase user verification")

    # Read-only endpoints first.
    response, questions = request_json("GET", f"{API_BASE}/v1/questions?exam_id=rrb_ntpc&limit=5", headers=headers)
    expect(response.status_code == 200 and isinstance(questions, dict), f"GET /v1/questions failed (HTTP {response.status_code}): {questions}")
    rows = questions.get("questions")
    expect(isinstance(rows, list), "Question response has no questions array")
    print(f"PASS GET /v1/questions (returned {len(rows)} questions)")

    response, history = request_json("GET", f"{API_BASE}/v1/attempts/history?exam_id=rrb_ntpc&limit=5", headers=headers)
    expect(response.status_code == 200 and isinstance(history, dict) and isinstance(history.get("attempts"), list),
           f"GET /v1/attempts/history failed (HTTP {response.status_code}): {history}")
    print(f"PASS GET /v1/attempts/history (returned {len(history['attempts'])} attempts)")

    response, summary = request_json("GET", f"{API_BASE}/v1/attempts/summary?exam_id=rrb_ntpc", headers=headers)
    expect(response.status_code == 200 and isinstance(summary, dict), f"GET /v1/attempts/summary failed (HTTP {response.status_code}): {summary}")
    print("PASS GET /v1/attempts/summary")

    # Hint requests may invoke an external AI provider and can incur provider usage.
    if rows:
        question_id = rows[0].get("id")
        if question_id:
            response, hint = request_json(
                "POST", f"{API_BASE}/v1/ai/hint",
                headers={**headers, "Content-Type": "application/json"},
                json={"question_id": question_id, "hint_level": "nudge"},
            )
            expect(response.status_code == 200 and isinstance(hint, dict),
                   f"POST /v1/ai/hint failed (HTTP {response.status_code}): {hint}")
            expect(isinstance(hint.get("hint"), str) and hint["hint"].strip(), "Hint response did not contain a useful hint")
            print("PASS POST /v1/ai/hint")
        else:
            print("SKIP POST /v1/ai/hint: question ID missing")
    else:
        print("SKIP POST /v1/ai/hint: no questions returned")

    if args.include_write_test:
        if not rows:
            fail("Cannot test answer submission because no questions were returned")
        question_id = rows[0].get("id")
        expect(isinstance(question_id, str) and question_id, "First question has no ID")
        print("\nWARNING: the next request creates a persistent attempt in this signed-in user's history.")
        confirmation = input("Type SAVE-TEST-ATTEMPT to continue: ").strip()
        expect(confirmation == "SAVE-TEST-ATTEMPT", "Persistent answer test cancelled")
        answer = input("Choose an answer label A, B, C, or D (this is a real submission): ").strip().upper()
        expect(answer in {"A", "B", "C", "D"}, "Answer must be A, B, C, or D")
        key = str(uuid.uuid4())
        response, result = request_json(
            "POST", f"{API_BASE}/v1/questions/{question_id}/answer",
            headers={**headers, "Content-Type": "application/json", "Idempotency-Key": key},
            json={"answer_given": answer, "elapsed_ms": 1000},
        )
        expect(response.status_code == 200 and isinstance(result, dict),
               f"POST /v1/questions/{{question_id}}/answer failed (HTTP {response.status_code}): {result}")
        print("PASS POST /v1/questions/{question_id}/answer (one persistent attempt created)")
        # Retry with the same idempotency key to check duplicate submission behavior.
        response2, result2 = request_json(
            "POST", f"{API_BASE}/v1/questions/{question_id}/answer",
            headers={**headers, "Content-Type": "application/json", "Idempotency-Key": key},
            json={"answer_given": answer, "elapsed_ms": 1000},
        )
        expect(response2.status_code == 200 and isinstance(result2, dict),
               f"Idempotent retry failed (HTTP {response2.status_code}): {result2}")
        print("PASS answer idempotency retry")
    else:
        print("SKIP answer submission: read-only mode (use --include-write-test only if you accept a saved attempt)")

    print("\nLIVE AUTHENTICATED SMOKE TESTS PASSED")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except requests.RequestException as exc:
        fail(f"Network request failed: {exc}")
