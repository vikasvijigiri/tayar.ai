from fastapi.testclient import TestClient
import app.main as main
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


def test_metrics_endpoint_is_prometheus_compatible():
    client.get("/health")
    r = client.get("/metrics")
    assert r.status_code == 200
    assert "text/plain" in r.headers["content-type"]
    assert "tayar_http_requests_total" in r.text
    assert "tayar_http_request_duration_seconds" in r.text


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


def test_signup_fails_closed_without_supabase_configuration(monkeypatch):
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_ANON_KEY", raising=False)
    r = client.post("/v1/auth/signup", json={"email": "test@example.com", "password": "correct-horse-battery"})
    assert r.status_code == 503
    assert "not configured" in r.json()["detail"]


def test_signin_fails_closed_without_supabase_configuration(monkeypatch):
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_ANON_KEY", raising=False)
    r = client.post("/v1/auth/signin", json={"email": "test@example.com", "password": "correct-horse-battery"})
    assert r.status_code == 503
    assert "not configured" in r.json()["detail"]


def test_refresh_fails_closed_without_supabase_configuration(monkeypatch):
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_ANON_KEY", raising=False)
    r = client.post("/v1/auth/refresh", json={"refresh_token": "refresh-token-for-testing"})
    assert r.status_code == 503
    assert "not configured" in r.json()["detail"]


def test_auth_rejects_short_password():
    r = client.post("/v1/auth/signin", json={"email": "test@example.com", "password": "short"})
    assert r.status_code == 422


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
