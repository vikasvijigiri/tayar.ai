import httpx
import pytest
from fastapi.testclient import TestClient

from app import main
from app.main import app

client = TestClient(app)


class FakeResponse:
    def __init__(self, status_code=200, payload=None):
        self.status_code = status_code
        self.payload = {} if payload is None else payload

    @property
    def is_success(self):
        return 200 <= self.status_code < 300

    def json(self):
        return self.payload

    def raise_for_status(self):
        if self.status_code >= 400:
            request = httpx.Request("GET", "https://supabase.test/fake")
            response = httpx.Response(self.status_code, request=request)
            raise httpx.HTTPStatusError("fake upstream error", request=request, response=response)


class FakeAsyncClient:
    user_response = FakeResponse(200, {"id": "test-user"})
    question_response = FakeResponse(
        200, [{"solution_steps": ["Find the common factor."], "topic_id": "topic-id"}]
    )
    topic_response = FakeResponse(200, [{"name": "Number System"}])
    post_response = FakeResponse(200, {"access_token": "fake-access", "user": {"id": "test-user"}})
    post_error = None

    def __init__(self, *args, **kwargs):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, traceback):
        return False

    async def get(self, url, **kwargs):
        if "/auth/v1/user" in url:
            return self.user_response
        if "/rest/v1/questions" in url:
            return self.question_response
        if "/rest/v1/topics" in url:
            return self.topic_response
        raise AssertionError(f"Unexpected fake GET URL: {url}")

    async def post(self, url, **kwargs):
        if self.post_error is not None:
            raise self.post_error
        return self.post_response


@pytest.fixture
def fake_supabase(monkeypatch):
    FakeAsyncClient.user_response = FakeResponse(200, {"id": "test-user"})
    FakeAsyncClient.question_response = FakeResponse(
        200, [{"solution_steps": ["Find the common factor."], "topic_id": "topic-id"}]
    )
    FakeAsyncClient.topic_response = FakeResponse(200, [{"name": "Number System"}])
    FakeAsyncClient.post_response = FakeResponse(
        200, {"access_token": "fake-access", "refresh_token": "fake-refresh", "user": {"id": "test-user"}}
    )
    FakeAsyncClient.post_error = None
    monkeypatch.setattr(main.httpx, "AsyncClient", FakeAsyncClient)
    monkeypatch.setenv("SUPABASE_URL", "https://supabase.test")
    monkeypatch.setenv("SUPABASE_ANON_KEY", "fake-anon")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "fake-service")
    monkeypatch.setenv("AI_PROVIDER_ORDER", "groq")
    monkeypatch.setenv("GROQ_API_KEY", "fake-groq-key")
    main._hint_cache.clear()
    main._hint_requests.clear()
    main._hint_locks.clear()
    yield
    main._hint_cache.clear()
    main._hint_requests.clear()
    main._hint_locks.clear()


def test_legacy_email_password_routes_are_disabled():
    for path in ("/v1/auth/signup", "/v1/auth/signin"):
        response = client.post(path, json={"email": "learner@example.com", "password": "correct-horse-battery"})
        assert response.status_code == 404


def test_refresh_returns_rotated_session(fake_supabase):
    response = client.post("/v1/auth/refresh", json={"refresh_token": "refresh-token-value"})
    assert response.status_code == 200
    assert response.json()["refresh_token"] == "fake-refresh"


def test_hint_requires_bearer_token():
    response = client.post(
        "/v1/ai/hint",
        json={"question_id": "00000000-0000-4000-8000-000000000001", "hint_level": "nudge"},
    )
    assert response.status_code == 401


def test_hint_returns_404_when_verified_question_is_missing(fake_supabase):
    FakeAsyncClient.question_response = FakeResponse(200, [])
    response = client.post(
        "/v1/ai/hint",
        headers={"Authorization": "Bearer fake-access"},
        json={"question_id": "00000000-0000-4000-8000-000000000001", "hint_level": "nudge"},
    )
    assert response.status_code == 404


def test_hint_returns_no_provider_when_solution_steps_are_missing(fake_supabase):
    FakeAsyncClient.question_response = FakeResponse(
        200, [{"solution_steps": [], "topic_id": "topic-id"}]
    )
    response = client.post(
        "/v1/ai/hint",
        headers={"Authorization": "Bearer fake-access"},
        json={"question_id": "00000000-0000-4000-8000-000000000002", "hint_level": "nudge"},
    )
    assert response.status_code == 200
    assert response.json()["provider"] is None


def test_hint_uses_cached_provider_result_without_second_inference(fake_supabase, monkeypatch):
    calls = []

    async def fake_completion(provider, system, user):
        calls.append(provider)
        return "Think about the common factor first."

    monkeypatch.setattr(main, "provider_completion", fake_completion)
    payload = {"question_id": "00000000-0000-4000-8000-000000000003", "hint_level": "nudge"}
    headers = {"Authorization": "Bearer fake-access"}
    first = client.post("/v1/ai/hint", headers=headers, json=payload)
    second = client.post("/v1/ai/hint", headers=headers, json=payload)
    assert first.status_code == 200
    assert second.status_code == 200
    assert first.json() == second.json()
    assert first.json()["provider"] == "groq"
    assert calls == ["groq"]


def test_hint_rate_limit_returns_429_after_ten_uncached_requests(fake_supabase, monkeypatch):
    async def fake_completion(provider, system, user):
        return "Think about the common factor first."

    monkeypatch.setattr(main, "provider_completion", fake_completion)
    headers = {"Authorization": "Bearer fake-access"}
    responses = []
    for number in range(1, 12):
        question_id = f"00000000-0000-4000-8000-{number:012d}"
        responses.append(
            client.post(
                "/v1/ai/hint",
                headers=headers,
                json={"question_id": question_id, "hint_level": "nudge"},
            )
        )
    assert all(response.status_code == 200 for response in responses[:10])
    assert responses[10].status_code == 429
    assert "Retry-After" in responses[10].headers
