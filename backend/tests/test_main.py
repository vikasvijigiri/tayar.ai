from fastapi.testclient import TestClient
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


def test_hint_returns_controlled_503_when_no_provider_configured(monkeypatch):
    for key in ("GROQ_API_KEY", "GEMINI_API_KEY", "CEREBRAS_API_KEY"):
        monkeypatch.delenv(key, raising=False)
    r = client.post("/v1/ai/hint", json={
        "question_id": "q1", "topic": "percentages",
        "stored_solution_steps": ["Convert the percentage to a fraction"],
        "hint_level": "nudge"
    })
    assert r.status_code == 503
    assert "No AI provider configured" in r.json()["detail"]


def test_persisted_attempt_requires_bearer_token():
    r = client.post("/v1/attempts", json={
        "question_id": "00000000-0000-0000-0000-000000000001",
        "is_correct": True,
        "elapsed_ms": 1000
    })
    assert r.status_code == 401
    assert "Bearer" in r.json()["detail"]


def test_persisted_attempt_rejects_malformed_question_id():
    r = client.post("/v1/attempts", headers={"Authorization": "Bearer fake"}, json={
        "question_id": "not-a-uuid",
        "is_correct": True,
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
