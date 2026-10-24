import asyncio

from fastapi.testclient import TestClient

from app import main
from app.main import app

client = TestClient(app)


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_config():
    r = client.get("/v1/config")
    assert r.status_code == 200
    assert r.json()["supported_exams"][0]["id"] == "rrb_ntpc"
    assert {"overall_accuracy", "last_5_accuracy", "weakness", "retention", "time_efficiency"} <= set(r.json()["adaptive_metrics"])

def test_config_cache_policy_and_request_id():
    request_id = "00000000-0000-4000-8000-000000000001"
    r = client.get("/v1/config", headers={"X-Request-ID": request_id})
    assert r.status_code == 200
    assert r.headers["X-Request-ID"] == request_id
    assert r.headers["Cache-Control"].startswith("public, max-age=300")

def test_cors_allows_idempotency_and_request_tracing_headers():
    response = client.options(
        "/v1/questions/00000000-0000-4000-8000-000000000001/answer",
        headers={
            "Origin": "https://app.tayar.ai",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "authorization,content-type,idempotency-key,x-request-id",
        },
    )
    assert response.status_code == 200
    allowed = response.headers.get("access-control-allow-headers", "").lower()
    assert "idempotency-key" in allowed
    assert "x-request-id" in allowed


def test_metrics_endpoint_is_prometheus_compatible():
    client.get("/health")
    r = client.get("/metrics")
    assert r.status_code == 200
    assert "text/plain" in r.headers["content-type"]
    assert "tayar_http_requests_total" in r.text
    assert "tayar_http_request_duration_seconds" in r.text

def test_verified_hint_cache_stores_and_returns_results():
    main._hint_cache.clear()
    result = {"provider": "groq", "hint": "Use the verified first step."}
    main._store_cached_hint("unit-test-hint", result)
    assert main._get_cached_hint("unit-test-hint") == result
    main._hint_cache.clear()


def test_hint_rate_limit_blocks_excess_inference():
    main._hint_requests.clear()
    user_id = "unit-test-rate-limit"
    for _ in range(main.HINT_RATE_LIMIT):
        assert main._consume_hint_request(user_id) is None
    retry_after = main._consume_hint_request(user_id)
    assert retry_after is not None and retry_after >= 1
    main._hint_requests.pop(user_id, None)


def test_attempt_preview():
    r = client.post("/v1/attempts/preview", json={
        "question_id": "demo", "topic_id": "percentages", "is_correct": False,
        "elapsed_ms": 12000, "confidence": 2
    })
    assert r.status_code == 200
    body = r.json()
    assert body["accepted"] is True
    assert body["attempt"]["elapsed_ms"] == 12000
    assert "Preview only" in body["note"]


def test_attempt_rejects_elapsed_time_over_one_hour():
    r = client.post("/v1/attempts/preview", json={
        "question_id": "demo", "topic_id": "percentages", "is_correct": False,
        "elapsed_ms": 3600001
    })
    assert r.status_code == 422


def test_attempt_rejects_invalid_confidence():
    r = client.post("/v1/attempts/preview", json={
        "question_id": "demo", "topic_id": "percentages", "is_correct": False,
        "elapsed_ms": 1000, "confidence": 6
    })
    assert r.status_code == 422


def test_hint_requires_verified_server_solution(monkeypatch):
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_SERVICE_ROLE_KEY", raising=False)
    r = client.post("/v1/ai/hint", headers={"Authorization": "Bearer fake"}, json={
        "question_id": "00000000-0000-0000-0000-000000000001",
        "hint_level": "nudge"
    })
    assert r.status_code == 503
    assert "Verified solution service is not configured" in r.json()["detail"]


def test_question_answer_rejects_malformed_question_id():
    r = client.post("/v1/questions/not-a-uuid/answer", headers={"Authorization": "Bearer fake"}, json={
        "answer_given": "A",
        "elapsed_ms": 1000
    })
    assert r.status_code == 422


def test_legacy_email_password_routes_are_disabled():
    for path in ("/v1/auth/signup", "/v1/auth/signin"):
        response = client.post(path, json={"email": "learner@example.com", "password": "correct-horse-battery"})
        assert response.status_code == 404


def test_refresh_fails_closed_without_supabase_configuration(monkeypatch):
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_ANON_KEY", raising=False)
    r = client.post("/v1/auth/refresh", json={"refresh_token": "refresh-token-for-testing"})
    assert r.status_code == 503
    assert "not configured" in r.json()["detail"]



def test_question_list_fails_closed_without_service_role_key(monkeypatch):
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_SERVICE_ROLE_KEY", raising=False)
    r = client.get("/v1/questions")
    assert r.status_code == 503
    assert "not configured" in r.json()["detail"]


def test_question_answer_requires_bearer_token():
    r = client.post("/v1/questions/00000000-0000-0000-0000-000000000001/answer", json={
        "answer_given": "A",
        "elapsed_ms": 12000
    })
    assert r.status_code == 401

def test_answer_requires_idempotency_key_after_authentication():
    r = client.post(
        "/v1/questions/00000000-0000-0000-0000-000000000001/answer",
        headers={"Authorization": "Bearer fake"},
        json={"answer_given": "A", "elapsed_ms": 1000},
    )
    assert r.status_code == 400
    assert "Idempotency-Key" in r.json()["detail"]


def test_question_answer_rejects_invalid_elapsed_time():
    r = client.post("/v1/questions/q1/answer", headers={"Authorization": "Bearer token"}, json={
        "answer_given": "A",
        "elapsed_ms": 3600001
    })
    assert r.status_code == 422


def test_attempt_summary_requires_bearer_token():
    r = client.get("/v1/attempts/summary")
    assert r.status_code == 401
    assert "Bearer" in r.json()["detail"]


def test_attempt_summary_fails_closed_without_supabase_configuration(monkeypatch):
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_ANON_KEY", raising=False)
    r = client.get("/v1/attempts/summary", headers={"Authorization": "Bearer fake"})
    assert r.status_code == 503
    assert "not configured" in r.json()["detail"]


def test_hint_requires_bearer_token():
    r = client.post("/v1/ai/hint", json={
        "question_id": "00000000-0000-0000-0000-000000000001",
        "hint_level": "nudge"
    })
    assert r.status_code == 401


def test_readiness_fails_when_supabase_is_not_configured(monkeypatch):
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_ANON_KEY", raising=False)
    monkeypatch.delenv("SUPABASE_SERVICE_ROLE_KEY", raising=False)
    r = client.get("/health/ready")
    assert r.status_code == 503
    assert r.json()["detail"]["status"] == "not_ready"


def test_question_list_allowlists_public_fields(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://supabase.example")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "server-only-test-key")

    class FakeResponse:
        status_code = 200
        is_success = True

        def json(self):
            return [{
                "id": "00000000-0000-0000-0000-000000000001",
                "exam_id": "rrb_ntpc",
                "question_text": "Verified question?",
                "options": ["A", "B", "C", "D"],
                "source_document": "test.pdf",
                "source_page": "1",
                "answer_key": "C",
                "internal_note": "must never be exposed",
            }]

        def raise_for_status(self):
            return None

    class FakeAsyncClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return False

        async def get(self, url, params=None, headers=None):
            assert params["source_verified"] == "eq.true"
            assert params["active"] == "eq.true"
            assert "answer_key" not in params["select"]
            return FakeResponse()

    monkeypatch.setattr(main.httpx, "AsyncClient", FakeAsyncClient)
    r = client.get("/v1/questions?limit=1")
    assert r.status_code == 200
    question = r.json()["questions"][0]
    assert question["question_text"] == "Verified question?"
    assert "answer_key" not in question
    assert "internal_note" not in question


def test_attempt_summary_calculates_accuracy_speed_and_weak_topics():
    rows = [
        {"question_id": "q1", "is_correct": False, "elapsed_ms": 10000, "questions": {"topic_id": "math", "topics": {"name": "Algebra", "slug": "algebra"}}},
        {"question_id": "q1", "is_correct": True, "elapsed_ms": 8000, "questions": {"topic_id": "math", "topics": {"name": "Algebra", "slug": "algebra"}}},
        {"question_id": "q2", "is_correct": False, "elapsed_ms": 12000, "questions": {"topic_id": "math", "topics": {"name": "Algebra", "slug": "algebra"}}},
        {"question_id": "q3", "is_correct": True, "elapsed_ms": 5000, "questions": {"topic_id": "math", "topics": {"name": "Algebra", "slug": "algebra"}}},
        {"question_id": "q4", "is_correct": True, "elapsed_ms": 7000, "questions": {"topic_id": "percent", "topics": {"name": "Percentages", "slug": "percentages"}}},
    ]
    summary = main.summarize_attempt_rows(rows)
    assert summary["total_attempts"] == 5
    assert summary["overall_accuracy_pct"] == 60.0
    assert summary["last_5_accuracy_pct"] == 60.0
    assert summary["average_time_seconds"] == 8.4
    assert summary["repeat_accuracy_pct"] == 100.0
    assert summary["weakest_topic"]["topic"] == "Algebra"
    assert summary["weakest_topic"]["accuracy_pct"] == 50.0
    assert summary["topic_performance"][0]["slug"] == "algebra"


def test_attempt_summary_handles_no_attempts():
    summary = main.summarize_attempt_rows([])
    assert summary["total_attempts"] == 0
    assert summary["overall_accuracy_pct"] is None
    assert summary["last_5_accuracy_pct"] is None
    assert summary["average_time_seconds"] is None
    assert summary["repeat_accuracy_pct"] is None
    assert summary["weakest_topic"] is None


def test_answer_grades_from_server_key_and_saves_with_user_session(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://supabase.example")
    monkeypatch.setenv("SUPABASE_ANON_KEY", "public-anon-test-key")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "server-only-test-key")
    calls = {"get": [], "post": []}

    class FakeResponse:
        def __init__(self, status_code=200, body=None):
            self.status_code = status_code
            self._body = body if body is not None else {}
            self.content = b"[]" if isinstance(self._body, list) else b"{}"

        def json(self):
            return self._body

        def raise_for_status(self):
            if self.status_code >= 400:
                import httpx
                request = httpx.Request("GET", "https://supabase.example/test")
                response = httpx.Response(self.status_code, request=request)
                raise httpx.HTTPStatusError("fake error", request=request, response=response)

    class FakeAsyncClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return False

        async def get(self, url, params=None, headers=None):
            calls["get"].append({"url": url, "params": params, "headers": headers})
            if url.endswith("/auth/v1/user"):
                return FakeResponse(body={"id": "user-123"})
            assert params["select"] == "id,answer_key,solution_steps,source_document,source_page,active,source_verified"
            assert params["source_verified"] == "eq.true"
            assert headers["Authorization"] == "Bearer server-only-test-key"
            return FakeResponse(body=[{
                "id": "00000000-0000-0000-0000-000000000001",
                "answer_key": "B",
                "solution_steps": ["Use the verified method", "Calculate the result"],
                "source_document": "verified.pdf",
                "source_page": "12",
                "active": True,
                "source_verified": True,
            }])

        async def post(self, url, params=None, headers=None, json=None):
            calls["post"].append({"url": url, "params": params, "headers": headers, "json": json})
            return FakeResponse(status_code=201, body=[{
                "idempotency_key": json["idempotency_key"],
                "is_correct": json["is_correct"],
                "answer_given": json["answer_given"],
            }])

    monkeypatch.setattr(main.httpx, "AsyncClient", FakeAsyncClient)
    response = client.post(
        "/v1/questions/00000000-0000-0000-0000-000000000001/answer",
        headers={"Authorization": "Bearer user-token", "Idempotency-Key": "00000000-0000-4000-8000-000000000001"},
        json={"answer_given": "B", "elapsed_ms": 4200, "confidence": 4},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["saved"] is True
    assert body["is_correct"] is True
    assert body["answer_key"] == "B"
    assert body["source_document"] == "verified.pdf"
    assert calls["post"][0]["json"]["user_id"] == "user-123"
    assert calls["post"][0]["json"]["is_correct"] is True
    assert calls["post"][0]["headers"]["Authorization"] == "Bearer server-only-test-key"
    assert calls["post"][0]["headers"]["apikey"] == "server-only-test-key"
    assert "answer_key" not in calls["post"][0]["json"]


def test_answer_returns_404_for_unpublished_or_unverified_question(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://supabase.example")
    monkeypatch.setenv("SUPABASE_ANON_KEY", "public-anon-test-key")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "server-only-test-key")

    class FakeResponse:
        status_code = 200

        def __init__(self, body):
            self.body = body

        def json(self):
            return self.body

        def raise_for_status(self):
            return None

    class FakeAsyncClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return False

        async def get(self, url, params=None, headers=None):
            if url.endswith("/auth/v1/user"):
                return FakeResponse({"id": "user-123"})
            return FakeResponse([])

    monkeypatch.setattr(main.httpx, "AsyncClient", FakeAsyncClient)
    response = client.post(
        "/v1/questions/00000000-0000-0000-0000-000000000001/answer",
        headers={"Authorization": "Bearer user-token", "Idempotency-Key": "00000000-0000-4000-8000-000000000001"},
        json={"answer_given": "A", "elapsed_ms": 1000},
    )
    assert response.status_code == 404
    assert response.json()["detail"] == "Verified question not found."


def test_ai_provider_success_is_instrumented(monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "test-only-key")

    class FakeResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {"choices": [{"message": {"content": "A concise verified hint."}}]}

    class FakeAsyncClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return False

        async def post(self, url, json=None, headers=None):
            assert url == main.PROVIDERS["groq"][1]
            assert headers["Authorization"] == "Bearer test-only-key"
            return FakeResponse()

    monkeypatch.setattr(main.httpx, "AsyncClient", FakeAsyncClient)
    result = asyncio.run(main.provider_completion("groq", "system", "user"))
    assert result == "A concise verified hint."
    metrics = client.get("/metrics").text
    assert "tayar_ai_provider_requests_total" in metrics
    assert 'provider="groq"' in metrics
    assert 'outcome="success"' in metrics
    assert "tayar_ai_provider_request_duration_seconds" in metrics


def test_readiness_reports_connected_supabase_without_leaking_secrets(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://supabase.example")
    monkeypatch.setenv("SUPABASE_ANON_KEY", "public-anon-test-key")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "server-only-test-key")
    monkeypatch.setenv("GROQ_API_KEY", "test-ai-key")

    class FakeResponse:
        status_code = 200

        def raise_for_status(self):
            return None

    class FakeAsyncClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return False

        async def get(self, url, params=None, headers=None):
            assert url == "https://supabase.example/rest/v1/exams"
            assert params == {"select": "id", "limit": "1"}
            assert headers["Authorization"] == "Bearer server-only-test-key"
            return FakeResponse()

    monkeypatch.setattr(main.httpx, "AsyncClient", FakeAsyncClient)
    response = client.get("/health/ready")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ready"
    assert body["dependencies"]["supabase"] == "connected"
    assert body["dependencies"]["ai_provider_configured"] is True
    assert "server-only-test-key" not in response.text


def test_readiness_fails_closed_when_supabase_is_unreachable(monkeypatch):
    import httpx

    monkeypatch.setenv("SUPABASE_URL", "https://supabase.example")
    monkeypatch.setenv("SUPABASE_ANON_KEY", "public-anon-test-key")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "server-only-test-key")

    class FakeAsyncClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return False

        async def get(self, *args, **kwargs):
            raise httpx.ConnectError("test connection failure")

    monkeypatch.setattr(main.httpx, "AsyncClient", FakeAsyncClient)
    response = client.get("/health/ready")
    assert response.status_code == 503
    assert response.json()["detail"]["dependencies"]["supabase"] == "unreachable"


def test_question_strategy_uses_weak_topic_only_when_a_full_set_exists():
    weakest = {"slug": "algebra", "topic": "Algebra", "attempts": 3, "accuracy_pct": 33.3}
    assert main.choose_question_strategy(weakest, 10, 10) == (
        "weak_topic_focus", "sufficient_verified_topic_coverage"
    )
    assert main.choose_question_strategy(weakest, 9, 10) == (
        "mixed_baseline", "insufficient_verified_questions_for_full_set"
    )
    assert main.choose_question_strategy(None, 20, 10) == (
        "baseline", "baseline_not_established"
    )


def test_question_list_adapts_to_weak_topic_without_exposing_answer_key(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://supabase.example")
    monkeypatch.setenv("SUPABASE_ANON_KEY", "public-anon-test-key")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "server-only-test-key")

    history = [
        {"question_id": "q1", "is_correct": False, "elapsed_ms": 10000,
         "questions": {"topic_id": "topic-1", "topics": {"name": "Algebra", "slug": "algebra"}}},
        {"question_id": "q2", "is_correct": False, "elapsed_ms": 11000,
         "questions": {"topic_id": "topic-1", "topics": {"name": "Algebra", "slug": "algebra"}}},
        {"question_id": "q3", "is_correct": True, "elapsed_ms": 9000,
         "questions": {"topic_id": "topic-1", "topics": {"name": "Algebra", "slug": "algebra"}}},
    ]
    requested_question_params = {}

    class FakeResponse:
        def __init__(self, payload, status_code=200, headers=None):
            self.payload = payload
            self.status_code = status_code
            self.headers = headers or {}

        def json(self):
            return self.payload

        def raise_for_status(self):
            if self.status_code >= 400:
                raise main.httpx.HTTPStatusError("fake error", request=None, response=None)

    class FakeAsyncClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return False

        async def get(self, url, params=None, headers=None):
            if url.endswith("/auth/v1/user"):
                return FakeResponse({"id": "user-123"})
            if url.endswith("/rest/v1/attempts"):
                assert params["user_id"] == "eq.user-123"
                return FakeResponse(history)
            if url.endswith("/rest/v1/topics"):
                assert params["slug"] == "eq.algebra"
                return FakeResponse([{"id": "topic-1"}])
            if url.endswith("/rest/v1/questions") and params.get("select") == "id":
                return FakeResponse([{"id": "q1"}], headers={"content-range": "0-0/12"})
            if url.endswith("/rest/v1/questions"):
                requested_question_params.update(params)
                return FakeResponse([{
                    "id": "q4", "exam_id": "rrb_ntpc", "topic_id": "topic-1",
                    "question_text": "An Algebra question?", "options": ["A) 1", "B) 2", "C) 3", "D) 4"],
                    "answer_key": "B", "source_document": "verified.pdf", "source_page": "4",
                }])
            raise AssertionError(f"Unexpected URL: {url}")

    monkeypatch.setattr(main.httpx, "AsyncClient", FakeAsyncClient)
    response = client.get(
        "/v1/questions?exam_id=rrb_ntpc&limit=10&offset=0",
        headers={"Authorization": "Bearer test-user-token"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["strategy"] == "weak_topic_focus"
    assert body["focus_topic"]["slug"] == "algebra"
    assert requested_question_params["topic_id"] == "eq.topic-1"
    assert "answer_key" not in body["questions"][0]


def test_attempt_summary_filters_history_to_selected_exam(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://supabase.example")
    monkeypatch.setenv("SUPABASE_ANON_KEY", "public-anon-test-key")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "server-only-test-key")

    class FakeResponse:
        status_code = 200

        def __init__(self, payload):
            self.payload = payload

        def json(self):
            return self.payload

        def raise_for_status(self):
            return None

    class FakeAsyncClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return False

        async def get(self, url, params=None, headers=None):
            if url.endswith("/auth/v1/user"):
                return FakeResponse({"id": "user-123"})
            assert url.endswith("/rest/v1/attempts")
            assert params["user_id"] == "eq.user-123"
            assert params["questions.exam_id"] == "eq.rrb_ntpc"
            assert "questions!inner(exam_id" in params["select"]
            return FakeResponse([])

    monkeypatch.setattr(main.httpx, "AsyncClient", FakeAsyncClient)
    response = client.get(
        "/v1/attempts/summary?exam_id=rrb_ntpc",
        headers={"Authorization": "Bearer test-user-token"},
    )
    assert response.status_code == 200
    assert response.json()["exam_id"] == "rrb_ntpc"
    assert response.json()["total_attempts"] == 0



def test_attempt_history_requires_bearer_token():
    response = client.get("/v1/attempts/history")
    assert response.status_code == 401


def test_attempt_history_is_paginated_and_does_not_expose_answer_key(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://supabase.example")
    monkeypatch.setenv("SUPABASE_ANON_KEY", "public-anon-test-key")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "server-only-test-key")
    captured_params = {}

    class FakeResponse:
        status_code = 200

        def __init__(self, payload):
            self.payload = payload
            self.headers = {}

        def json(self):
            return self.payload

        def raise_for_status(self):
            return None

    class FakeAsyncClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return False

        async def get(self, url, params=None, headers=None):
            if url.endswith("/auth/v1/user"):
                return FakeResponse({"id": "user-123"})
            assert url.endswith("/rest/v1/attempts")
            captured_params.update(params)
            return FakeResponse([{
                "question_id": "question-1",
                "answer_given": "B",
                "is_correct": False,
                "elapsed_ms": 12400,
                "created_at": "2026-10-24T08:00:00Z",
                "questions": {
                    "exam_id": "rrb_ntpc",
                    "topic_id": "topic-1",
                    "question_text": "A source-verified question?",
                    "answer_key": "C",
                    "source_document": "verified.pdf",
                    "source_page": "12",
                    "topics": {"name": "Percentage", "slug": "percentage"},
                },
            }])

    monkeypatch.setattr(main.httpx, "AsyncClient", FakeAsyncClient)
    response = client.get(
        "/v1/attempts/history?exam_id=rrb_ntpc&limit=5&offset=10",
        headers={"Authorization": "Bearer test-user-token"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["limit"] == 5 and body["offset"] == 10
    assert body["attempts"][0]["topic"] == "Percentage"
    assert body["attempts"][0]["is_correct"] is False
    assert body["attempts"][0]["source_page"] == "12"
    assert "answer_key" not in body["attempts"][0]
    assert "answer_key" not in body["attempts"][0]["question_text"]
    assert captured_params["user_id"] == "eq.user-123"
    assert captured_params["questions.exam_id"] == "eq.rrb_ntpc"
    assert captured_params["limit"] == "5" and captured_params["offset"] == "10"


def test_hint_lock_registry_is_bounded_and_preserves_locked_entries():
    main._hint_locks.clear()
    locked = main._get_hint_lock("locked-key")

    async def hold_lock():
        async with locked:
            for index in range(main.HINT_LOCK_MAX_ENTRIES + 10):
                main._get_hint_lock(f"key-{index}")
            assert main._hint_locks.get("locked-key") is locked

    asyncio.run(hold_lock())
    assert len(main._hint_locks) <= main.HINT_LOCK_MAX_ENTRIES + 1
    main._hint_locks.clear()


def test_answer_rejects_idempotency_key_reuse_for_different_question(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://supabase.example")
    monkeypatch.setenv("SUPABASE_ANON_KEY", "public-anon-test-key")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "server-only-test-key")

    class FakeResponse:
        def __init__(self, body, status_code=200):
            self.body = body
            self.status_code = status_code
            self.content = b"[]" if isinstance(body, list) else b"{}"

        def json(self):
            return self.body

        def raise_for_status(self):
            if self.status_code >= 400:
                import httpx
                request = httpx.Request("GET", "https://supabase.example/test")
                response = httpx.Response(self.status_code, request=request)
                raise httpx.HTTPStatusError("fake error", request=request, response=response)

    class FakeAsyncClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return False

        async def get(self, url, params=None, headers=None):
            if url.endswith("/auth/v1/user"):
                return FakeResponse({"id": "user-123"})
            if url.endswith("/rest/v1/questions"):
                return FakeResponse([{"id": "00000000-0000-0000-0000-000000000001", "answer_key": "B", "solution_steps": [], "source_document": "verified.pdf", "source_page": "12"}])
            return FakeResponse([{"idempotency_key": "00000000-0000-4000-8000-000000000001", "question_id": "00000000-0000-0000-0000-000000000002", "is_correct": True, "answer_given": "B", "elapsed_ms": 4200, "confidence": 4}])

        async def post(self, url, params=None, headers=None, json=None):
            return FakeResponse([])

    monkeypatch.setattr(main.httpx, "AsyncClient", FakeAsyncClient)
    response = client.post(
        "/v1/questions/00000000-0000-0000-0000-000000000001/answer",
        headers={"Authorization": "Bearer user-token", "Idempotency-Key": "00000000-0000-4000-8000-000000000001"},
        json={"answer_given": "B", "elapsed_ms": 4200, "confidence": 4},
    )
    assert response.status_code == 409
    assert "different answer" in response.json()["detail"]
