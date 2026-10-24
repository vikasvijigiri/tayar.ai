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
