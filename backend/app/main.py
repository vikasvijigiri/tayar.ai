import asyncio
import json
import logging
import os
from collections import OrderedDict, defaultdict, deque
from hashlib import sha256
from time import monotonic, perf_counter
from typing import Literal
from uuid import UUID, uuid4

import httpx
from fastapi import FastAPI, Header, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from prometheus_client import CONTENT_TYPE_LATEST, Counter, Histogram, generate_latest
from pydantic import BaseModel, Field
from starlette.responses import Response

app = FastAPI(
    title="Tayar.ai Adaptive API",
    version="0.1.0",
    description="Exam-agnostic adaptive learning API; RRB NTPC is the first exam.",
)
origins = [x.strip() for x in os.getenv("CORS_ORIGINS", "*").split(",") if x.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins or ["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Authorization", "Idempotency-Key", "X-Request-ID"],
)

REQUEST_COUNT = Counter(
    "tayar_http_requests_total",
    "Total HTTP requests handled by Tayar.ai API",
    ["method", "route", "status"],
)
REQUEST_LATENCY = Histogram(
    "tayar_http_request_duration_seconds",
    "HTTP request duration in seconds",
    ["method", "route"],
    buckets=(0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10),
)
AI_PROVIDER_REQUESTS = Counter(
    "tayar_ai_provider_requests_total",
    "AI provider completion attempts by provider and outcome",
    ["provider", "outcome"],
)
AI_PROVIDER_LATENCY = Histogram(
    "tayar_ai_provider_request_duration_seconds",
    "AI provider completion latency in seconds",
    ["provider"],
    buckets=(0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30),
)


logger = logging.getLogger("tayar.api")

# Single-instance in-memory guardrails for the current low-cost Render deployment.
# Move these to a shared Redis/KV store before running multiple API instances.
HINT_CACHE_TTL_SECONDS = 3600
HINT_CACHE_MAX_ENTRIES = 512
HINT_RATE_LIMIT = 10
HINT_RATE_WINDOW_SECONDS = 60
_hint_cache: OrderedDict[str, tuple[float, dict[str, str | None]]] = OrderedDict()
_hint_requests: dict[str, deque[float]] = defaultdict(deque)
_hint_locks: dict[str, asyncio.Lock] = {}


def _get_cached_hint(key: str) -> dict[str, str | None] | None:
    now = monotonic()
    for cached_key, (created_at, _) in list(_hint_cache.items()):
        if now - created_at >= HINT_CACHE_TTL_SECONDS:
            _hint_cache.pop(cached_key, None)
    entry = _hint_cache.get(key)
    if entry is None:
        return None
    _hint_cache.move_to_end(key)
    return entry[1]


def _store_cached_hint(key: str, result: dict[str, str | None]) -> None:
    _hint_cache[key] = (monotonic(), result)
    _hint_cache.move_to_end(key)
    while len(_hint_cache) > HINT_CACHE_MAX_ENTRIES:
        _hint_cache.popitem(last=False)


def _consume_hint_request(user_id: str) -> int | None:
    now = monotonic()
    requests = _hint_requests[user_id]
    while requests and now - requests[0] >= HINT_RATE_WINDOW_SECONDS:
        requests.popleft()
    if len(requests) >= HINT_RATE_LIMIT:
        return max(1, int(HINT_RATE_WINDOW_SECONDS - (now - requests[0]) + 0.999))
    requests.append(now)
    # Bound memory if a large number of accounts visit this single process.
    if len(_hint_requests) > 5000:
        for key, timestamps in list(_hint_requests.items()):
            if not timestamps or now - timestamps[-1] >= HINT_RATE_WINDOW_SECONDS:
                _hint_requests.pop(key, None)
    return None


@app.middleware("http")
async def observe_requests(request: Request, call_next):
    started = perf_counter()
    try:
        request_id = str(UUID(request.headers.get("X-Request-ID", "")))
    except (ValueError, AttributeError):
        request_id = str(uuid4())
    request.state.request_id = request_id

    response = await call_next(request)
    duration = perf_counter() - started
    route_obj = request.scope.get("route")
    route = getattr(route_obj, "path", "unmatched")

    if route != "/metrics":
        REQUEST_COUNT.labels(request.method, route, str(response.status_code)).inc()
        REQUEST_LATENCY.labels(request.method, route).observe(duration)

    response.headers["X-Request-ID"] = request_id
    # Cache only non-sensitive, stable configuration. User-specific content and writes
    # must never be stored by shared proxies or intermediary caches.
    if route == "/v1/config":
        response.headers["Cache-Control"] = "public, max-age=300, stale-while-revalidate=60"
    elif route.startswith(("/v1/auth/", "/v1/questions", "/v1/attempts", "/v1/ai/")):
        response.headers["Cache-Control"] = "private, no-store"
    logger.info(
        "request_id=%s method=%s route=%s status=%s duration_ms=%.2f",
        request_id, request.method, route, response.status_code, duration * 1000,
    )
    return response


class AttemptIn(BaseModel):
    question_id: str
    exam_id: str = "rrb_ntpc"
    topic_id: str
    is_correct: bool
    elapsed_ms: int = Field(ge=0, le=3600000)
    confidence: int | None = Field(default=None, ge=1, le=5)


class HintIn(BaseModel):
    question_id: UUID
    hint_level: Literal["nudge", "method", "steps"] = "nudge"


@app.get("/health")
def health():
    return {"status": "ok", "service": "tayar-ai-api", "version": app.version}


@app.get("/metrics", include_in_schema=False)
def metrics():
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)


@app.get("/health/ready")
async def readiness():
    """Readiness probe for configured backend dependencies; never returns secret values."""
    base_url = os.getenv("SUPABASE_URL", "").rstrip("/")
    anon_key = os.getenv("SUPABASE_ANON_KEY", "")
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    if not base_url or not anon_key or not service_key:
        raise HTTPException(
            status_code=503,
            detail={
                "status": "not_ready",
                "dependencies": {"supabase": "missing_configuration"},
            },
        )
    headers = {"apikey": service_key, "Authorization": f"Bearer {service_key}"}
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(
                f"{base_url}/rest/v1/exams",
                params={"select": "id", "limit": "1"},
                headers=headers,
            )
        if response.status_code >= 400:
            raise HTTPException(
                status_code=503,
                detail={"status": "not_ready", "dependencies": {"supabase": "unavailable"}},
            )
    except httpx.HTTPError:
        raise HTTPException(
            status_code=503,
            detail={"status": "not_ready", "dependencies": {"supabase": "unreachable"}},
        )
    return {
        "status": "ready",
        "dependencies": {
            "supabase": "connected",
            "ai_provider_configured": any(
                os.getenv(key) for key in ("GROQ_API_KEY", "GEMINI_API_KEY", "CEREBRAS_API_KEY")
            ),
        },
    }


@app.get("/v1/config")
def config():
    return {
        "supported_exams": [{"id": "rrb_ntpc", "name": "RRB NTPC"}],
        "adaptive_metrics": [
            "overall_accuracy",
            "last_5_accuracy",
            "weakness",
            "retention",
            "time_efficiency",
        ],
        "ai_enabled": any(
            os.getenv(k) for k in ("GROQ_API_KEY", "GEMINI_API_KEY", "CEREBRAS_API_KEY")
        ),
    }


@app.post("/v1/attempts/preview")
def preview_attempt(payload: AttemptIn):
    return {
        "accepted": True,
        "attempt": payload.model_dump(),
        "note": "Preview only; configure authentication and persistence before production use.",
    }


PROVIDERS = {
    "groq": (
        "GROQ_API_KEY",
        "https://api.groq.com/openai/v1/chat/completions",
        "GROQ_MODEL",
        "llama-3.3-70b-versatile",
    ),
    "gemini": (
        "GEMINI_API_KEY",
        "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
        "GEMINI_MODEL",
        "gemini-2.0-flash",
    ),
    "cerebras": (
        "CEREBRAS_API_KEY",
        "https://api.cerebras.ai/v1/chat/completions",
        "CEREBRAS_MODEL",
        "llama3.1-8b",
    ),
}


async def provider_completion(provider: str, system_prompt: str, user_prompt: str) -> str:
    key_env, url, model_env, default_model = PROVIDERS[provider]
    key = os.getenv(key_env)
    if not key:
        raise RuntimeError(f"{provider} not configured")
    body = {
        "model": os.getenv(model_env, default_model),
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.2,
        "max_tokens": 500,
    }
    started = perf_counter()
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                url, json=body, headers={"Authorization": f"Bearer {key}"}
            )
            response.raise_for_status()
            data = response.json()
        content = data["choices"][0]["message"]["content"]
        AI_PROVIDER_REQUESTS.labels(provider, "success").inc()
        return content
    except Exception:
        AI_PROVIDER_REQUESTS.labels(provider, "error").inc()
        raise
    finally:
        AI_PROVIDER_LATENCY.labels(provider).observe(perf_counter() - started)


@app.post("/v1/ai/hint")
async def get_hint(payload: HintIn, request: Request):
    """Generate a hint only from the verified solution stored server-side."""
    authorization = request.headers.get("authorization", "")
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        raise HTTPException(status_code=401, detail="Bearer access token required.")
    base_url = os.getenv("SUPABASE_URL", "").rstrip("/")
    anon_key = os.getenv("SUPABASE_ANON_KEY", "")
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    if not base_url or not anon_key or not service_key:
        raise HTTPException(status_code=503, detail="Verified solution service is not configured.")

    headers = {"apikey": service_key, "Authorization": f"Bearer {service_key}"}
    user_headers = {"apikey": anon_key, "Authorization": f"Bearer {token}"}
    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            user_response = await client.get(f"{base_url}/auth/v1/user", headers=user_headers)
            if user_response.status_code in (401, 403):
                raise HTTPException(status_code=401, detail="Invalid or expired access token.")
            user_response.raise_for_status()
            user_id = user_response.json().get("id")
            if not user_id:
                raise HTTPException(status_code=401, detail="Supabase did not return a user.")
            question_response = await client.get(
                f"{base_url}/rest/v1/questions",
                params={
                    "select": "solution_steps,topic_id",
                    "id": f"eq.{payload.question_id}",
                    "active": "eq.true",
                    "source_verified": "eq.true",
                    "limit": "1",
                },
                headers=headers,
            )
            question_response.raise_for_status()
            matches = question_response.json()
            if not matches:
                raise HTTPException(status_code=404, detail="Verified question not found.")
            question = matches[0]
            steps = question.get("solution_steps") or []
            if not steps:
                return {"hint": "A verified solution is not available for this question yet.", "provider": None}
            topic = str(question.get("topic_id") or "RRB NTPC")
            topic_id = question.get("topic_id")
            if topic_id:
                topic_response = await client.get(
                    f"{base_url}/rest/v1/topics",
                    params={"select": "name", "id": f"eq.{topic_id}", "limit": "1"},
                    headers=headers,
                )
                if topic_response.is_success and topic_response.json():
                    topic = topic_response.json()[0].get("name") or topic
    except HTTPException:
        raise
    except httpx.HTTPStatusError:
        raise HTTPException(status_code=502, detail="Verified solution lookup failed.")
    except httpx.HTTPError:
        raise HTTPException(status_code=503, detail="Verified solution service is temporarily unreachable.")

    cache_digest = sha256(
        json.dumps({"steps": steps, "topic": topic}, sort_keys=True, ensure_ascii=False).encode("utf-8")
    ).hexdigest()
    cache_key = f"v1:{payload.question_id}:{payload.hint_level}:{cache_digest}"
    # Per-key async locks prevent concurrent requests from paying for the same inference twice.
    lock = _hint_locks.setdefault(cache_key, asyncio.Lock())
    async with lock:
        cached = _get_cached_hint(cache_key)
        if cached is not None:
            return cached

        retry_after = _consume_hint_request(str(user_id))
        if retry_after is not None:
            raise HTTPException(
                status_code=429,
                detail="Hint rate limit reached. Try again shortly.",
                headers={"Retry-After": str(retry_after)},
            )

        order = [
            p.strip().lower()
            for p in os.getenv("AI_PROVIDER_ORDER", "groq,gemini,cerebras").split(",")
        ]
        system = (
            "You are a careful exam tutor. Never invent or change an answer key. "
            "Use only the supplied server-stored verified solution steps. If insufficient, say a verified solution is needed. "
            "Do not state an answer key unless it is explicitly present in the supplied steps. Be concise."
        )
        user = (
            f"Topic: {topic}\nHint level: {payload.hint_level}\n"
            f"Stored verified solution steps: {steps}\n"
            "Give a useful hint based only on this information."
        )
        errors = []
        for provider in order:
            if provider not in PROVIDERS or not os.getenv(PROVIDERS[provider][0]):
                continue
            try:
                result = {
                    "provider": provider,
                    "hint": await provider_completion(provider, system, user),
                }
                _store_cached_hint(cache_key, result)
                return result
            except (httpx.HTTPError, KeyError, RuntimeError, ValueError) as exc:
                errors.append(f"{provider}: {type(exc).__name__}")
        if errors:
            raise HTTPException(
                status_code=503,
                detail={"message": "AI providers unavailable", "providers": errors},
            )
        raise HTTPException(status_code=503, detail="No AI provider configured.")


class AuthCredentials(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=8, max_length=128)


class RefreshCredentials(BaseModel):
    refresh_token: str = Field(min_length=10, max_length=4096)


@app.post("/v1/auth/signup")
async def auth_signup(payload: AuthCredentials):
    """Create a Supabase Auth account; confirmation requirements follow project settings."""
    base_url = os.getenv("SUPABASE_URL", "").rstrip("/")
    anon_key = os.getenv("SUPABASE_ANON_KEY", "")
    if not base_url or not anon_key:
        raise HTTPException(status_code=503, detail="Supabase authentication is not configured.")
    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            response = await client.post(
                f"{base_url}/auth/v1/signup",
                headers={"apikey": anon_key, "Content-Type": "application/json"},
                json={"email": payload.email, "password": payload.password},
            )
        if response.status_code >= 500:
            raise HTTPException(status_code=502, detail="Authentication provider is temporarily unavailable.")
        if response.status_code >= 400:
            raise HTTPException(status_code=400, detail="Sign-up failed. Check the email, password and account requirements.")
        return response.json()
    except httpx.HTTPError:
        raise HTTPException(status_code=503, detail="Authentication provider is temporarily unreachable.")


@app.post("/v1/auth/signin")
async def auth_signin(payload: AuthCredentials):
    """Exchange email/password for a Supabase user session."""
    base_url = os.getenv("SUPABASE_URL", "").rstrip("/")
    anon_key = os.getenv("SUPABASE_ANON_KEY", "")
    if not base_url or not anon_key:
        raise HTTPException(status_code=503, detail="Supabase authentication is not configured.")
    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            response = await client.post(
                f"{base_url}/auth/v1/token?grant_type=password",
                headers={"apikey": anon_key, "Content-Type": "application/json"},
                json={"email": payload.email, "password": payload.password},
            )
        if response.status_code == 400 or response.status_code == 401:
            raise HTTPException(status_code=401, detail="Email or password is incorrect.")
        if response.status_code >= 500:
            raise HTTPException(status_code=502, detail="Authentication provider is temporarily unavailable.")
        if response.status_code >= 400:
            raise HTTPException(status_code=400, detail="Sign-in failed.")
        return response.json()
    except httpx.HTTPError:
        raise HTTPException(status_code=503, detail="Authentication provider is temporarily unreachable.")


@app.post("/v1/auth/refresh")
async def auth_refresh(payload: RefreshCredentials):
    """Rotate a Supabase refresh token without exposing provider keys to the app."""
    base_url = os.getenv("SUPABASE_URL", "").rstrip("/")
    anon_key = os.getenv("SUPABASE_ANON_KEY", "")
    if not base_url or not anon_key:
        raise HTTPException(status_code=503, detail="Supabase authentication is not configured.")
    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            response = await client.post(
                f"{base_url}/auth/v1/token?grant_type=refresh_token",
                headers={"apikey": anon_key, "Content-Type": "application/json"},
                json={"refresh_token": payload.refresh_token},
            )
        if response.status_code in (400, 401):
            raise HTTPException(status_code=401, detail="Session expired. Please sign in again.")
        if response.status_code >= 500:
            raise HTTPException(status_code=502, detail="Authentication provider is temporarily unavailable.")
        if response.status_code >= 400:
            raise HTTPException(status_code=401, detail="Unable to refresh session. Please sign in again.")
        return response.json()
    except httpx.HTTPError:
        raise HTTPException(status_code=503, detail="Authentication provider is temporarily unreachable.")


class QuestionAnswerIn(BaseModel):
    answer_given: str = Field(min_length=1, max_length=200)
    elapsed_ms: int = Field(ge=0, le=3600000)
    confidence: int | None = Field(default=None, ge=1, le=5)


def choose_question_strategy(weakest_topic: dict | None, topic_question_count: int, limit: int) -> tuple[str, str]:
    if not weakest_topic:
        return "baseline", "baseline_not_established"
    if topic_question_count >= limit:
        return "weak_topic_focus", "sufficient_verified_topic_coverage"
    return "mixed_baseline", "insufficient_verified_questions_for_full_set"


@app.get("/v1/questions")
async def list_verified_questions(
    request: Request,
    exam_id: str = "rrb_ntpc",
    limit: int = Query(default=10, ge=1, le=50),
    offset: int = Query(default=0, ge=0),
):
    """Return only active, source-verified questions and optionally focus on a weak topic."""
    base_url = os.getenv("SUPABASE_URL", "").rstrip("/")
    anon_key = os.getenv("SUPABASE_ANON_KEY", "")
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    if not base_url or not service_key:
        raise HTTPException(status_code=503, detail="Verified question service is not configured.")

    authorization = request.headers.get("authorization", "").strip()
    token = ""
    if authorization:
        scheme, _, supplied_token = authorization.partition(" ")
        if scheme.lower() != "bearer" or not supplied_token.strip():
            raise HTTPException(status_code=401, detail="A valid Bearer access token is required.")
        if not anon_key:
            raise HTTPException(status_code=503, detail="Authentication is not configured.")
        token = supplied_token.strip()

    admin_headers = {"apikey": service_key, "Authorization": f"Bearer {service_key}"}
    strategy = "baseline"
    strategy_reason = "baseline_not_established"
    focus_topic = None
    focus_topic_id = None

    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            if token:
                user_response = await client.get(
                    f"{base_url}/auth/v1/user",
                    headers={"apikey": anon_key, "Authorization": f"Bearer {token}"},
                )
                if user_response.status_code in (401, 403):
                    raise HTTPException(status_code=401, detail="Invalid or expired access token.")
                user_response.raise_for_status()
                user_id = user_response.json().get("id")
                if not user_id:
                    raise HTTPException(status_code=401, detail="Supabase did not return a user.")

                history_response = await client.get(
                    f"{base_url}/rest/v1/attempts",
                    params={
                        "select": "is_correct,elapsed_ms,created_at,question_id,questions!inner(exam_id,topic_id,topics(name,slug))",
                        "user_id": f"eq.{user_id}",
                    "questions.exam_id": f"eq.{exam_id}",
                        "order": "created_at.desc",
                        # Bound adaptive history reads; recent performance drives the current practice strategy.
                        "limit": "200",
                    },
                    headers=admin_headers,
                )
                history_response.raise_for_status()
                summary = summarize_attempt_rows(history_response.json())
                focus_topic = summary.get("weakest_topic")
                if focus_topic:
                    topic_response = await client.get(
                        f"{base_url}/rest/v1/topics",
                        params={
                            "select": "id",
                            "exam_id": f"eq.{exam_id}",
                            "slug": f"eq.{focus_topic['slug']}",
                            "limit": "1",
                        },
                        headers=admin_headers,
                    )
                    topic_response.raise_for_status()
                    topics = topic_response.json()
                    if topics:
                        focus_topic_id = topics[0].get("id")
                if focus_topic_id:
                    count_response = await client.get(
                        f"{base_url}/rest/v1/questions",
                        params={
                            "select": "id",
                            "exam_id": f"eq.{exam_id}",
                            "topic_id": f"eq.{focus_topic_id}",
                            "source_verified": "eq.true",
                            "active": "eq.true",
                            "limit": "1",
                        },
                        headers={**admin_headers, "Prefer": "count=exact"},
                    )
                    count_response.raise_for_status()
                    content_range = count_response.headers.get("content-range", "")
                    try:
                        topic_question_count = int(content_range.rsplit("/", 1)[1])
                    except (IndexError, ValueError):
                        topic_question_count = 0
                    strategy, strategy_reason = choose_question_strategy(
                        focus_topic, topic_question_count, limit
                    )
                    if strategy != "weak_topic_focus":
                        focus_topic_id = None

            params = {
                "select": "id,exam_id,topic_id,question_text,options,source_document,source_page,difficulty,syllabus_weight",
                "exam_id": f"eq.{exam_id}",
                "source_verified": "eq.true",
                "active": "eq.true",
                "order": "id.asc",
                "limit": str(limit),
                "offset": str(offset),
            }
            if focus_topic_id and strategy == "weak_topic_focus":
                params["topic_id"] = f"eq.{focus_topic_id}"
            response = await client.get(
                f"{base_url}/rest/v1/questions",
                params=params,
                headers={**admin_headers, "Prefer": "count=exact"},
            )
            if response.status_code >= 500:
                raise HTTPException(status_code=502, detail="Question database is temporarily unavailable.")
            response.raise_for_status()
            questions = response.json()
            content_range = getattr(response, "headers", {}).get("content-range", "")
            try:
                total_count = int(content_range.rsplit("/", 1)[1])
            except (IndexError, ValueError):
                total_count = offset + len(questions)

        public_fields = (
            "id", "exam_id", "topic_id", "question_text", "options",
            "source_document", "source_page", "difficulty", "syllabus_weight",
        )
        safe_questions = [
            {field: question[field] for field in public_fields if field in question}
            for question in questions
        ]
        return {
            "exam_id": exam_id,
            "questions": safe_questions,
            "limit": limit,
            "offset": offset,
            "total_count": total_count,
            "strategy": strategy,
            "strategy_reason": strategy_reason,
            "focus_topic": focus_topic,
        }
    except HTTPException:
        raise
    except httpx.HTTPStatusError:
        raise HTTPException(status_code=502, detail="Question database request failed.")
    except httpx.HTTPError:
        raise HTTPException(status_code=503, detail="Question database is temporarily unreachable.")


@app.post("/v1/questions/{question_id}/answer")
async def answer_verified_question(
    question_id: UUID,
    payload: QuestionAnswerIn,
    request: Request,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
):
    """Grade on the server and save an attempt; answer keys never come from the client."""
    authorization = request.headers.get("authorization", "")
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        raise HTTPException(status_code=401, detail="Bearer access token required.")
    if not idempotency_key:
        raise HTTPException(status_code=400, detail="Idempotency-Key header is required.")
    try:
        idempotency_key = str(UUID(idempotency_key))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Idempotency-Key must be a UUID.") from exc

    base_url = os.getenv("SUPABASE_URL", "").rstrip("/")
    anon_key = os.getenv("SUPABASE_ANON_KEY", "")
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    if not base_url or not anon_key or not service_key:
        raise HTTPException(status_code=503, detail="Question and attempt services are not configured.")

    user_headers = {"apikey": anon_key, "Authorization": f"Bearer {token}"}
    admin_headers = {"apikey": service_key, "Authorization": f"Bearer {service_key}"}
    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            user_response = await client.get(f"{base_url}/auth/v1/user", headers=user_headers)
            if user_response.status_code in (401, 403):
                raise HTTPException(status_code=401, detail="Invalid or expired access token.")
            user_response.raise_for_status()
            user_id = user_response.json().get("id")
            if not user_id:
                raise HTTPException(status_code=401, detail="Supabase did not return a user.")

            question_response = await client.get(
                f"{base_url}/rest/v1/questions",
                params={
                    "select": "id,answer_key,solution_steps,source_document,source_page,active,source_verified",
                    "id": f"eq.{question_id}",
                    "active": "eq.true",
                    "source_verified": "eq.true",
                    "limit": "1",
                },
                headers=admin_headers,
            )
            question_response.raise_for_status()
            matches = question_response.json()
            if not matches:
                raise HTTPException(status_code=404, detail="Verified question not found.")
            question = matches[0]
            is_correct = payload.answer_given == str(question["answer_key"])

            # Ignore duplicate keys so a client retry cannot create a second attempt.
            attempt_response = await client.post(
                f"{base_url}/rest/v1/attempts",
                params={"on_conflict": "user_id,idempotency_key"},
                headers={
                    **user_headers,
                    "Content-Type": "application/json",
                    "Prefer": "resolution=ignore-duplicates,return=representation",
                },
                json={
                    "user_id": user_id,
                    "question_id": question_id,
                    "idempotency_key": str(idempotency_key),
                    "is_correct": is_correct,
                    "elapsed_ms": payload.elapsed_ms,
                    "confidence": payload.confidence,
                    "answer_given": payload.answer_given,
                },
            )
            if attempt_response.status_code in (401, 403):
                raise HTTPException(status_code=403, detail="Attempt was rejected by database access policies.")
            attempt_response.raise_for_status()
            saved_rows = attempt_response.json() if attempt_response.content else []
            if not saved_rows:
                # A concurrent duplicate request may have won the insert; return its saved result.
                existing_response = await client.get(
                    f"{base_url}/rest/v1/attempts",
                    params={
                        "select": "idempotency_key,is_correct,answer_given",
                        "user_id": f"eq.{user_id}",
                        "idempotency_key": f"eq.{idempotency_key}",
                        "limit": "1",
                    },
                    headers=user_headers,
                )
                existing_response.raise_for_status()
                saved_rows = existing_response.json()
                if not saved_rows:
                    raise HTTPException(status_code=503, detail="Attempt save could not be confirmed; retry safely.")
                is_correct = bool(saved_rows[0]["is_correct"])
    except HTTPException:
        raise
    except httpx.HTTPStatusError:
        raise HTTPException(status_code=502, detail="Question or attempt database request failed.")
    except httpx.HTTPError:
        raise HTTPException(status_code=503, detail="Question or attempt service is temporarily unreachable.")

    return {
        "saved": True,
        "is_correct": is_correct,
        "answer_key": question["answer_key"],
        "solution_steps": question.get("solution_steps") or [],
        "source_document": question.get("source_document"),
        "source_page": question.get("source_page"),
    }


def summarize_attempt_rows(rows: list[dict]) -> dict:
    total = len(rows)
    correct = sum(1 for row in rows if row.get("is_correct") is True)
    last_five = rows[:5]
    last_five_correct = sum(1 for row in last_five if row.get("is_correct") is True)
    average_elapsed_ms = round(sum(int(row.get("elapsed_ms") or 0) for row in rows) / total) if total else None

    topic_stats = {}
    seen_questions = set()
    repeat_rows = []
    for row in rows:
        question_id = row.get("question_id")
        if question_id:
            if question_id in seen_questions:
                repeat_rows.append(row)
            else:
                seen_questions.add(question_id)
        question = row.get("questions") or {}
        topic = question.get("topics") or {}
        topic_slug = topic.get("slug") or str(question.get("topic_id") or "unclassified")
        topic_name = topic.get("name") or ("Unclassified" if topic_slug == "unclassified" else topic_slug)
        stats = topic_stats.setdefault(topic_slug, {"topic": topic_name, "attempts": 0, "correct": 0, "elapsed_ms": 0})
        stats["attempts"] += 1
        stats["correct"] += 1 if row.get("is_correct") is True else 0
        stats["elapsed_ms"] += int(row.get("elapsed_ms") or 0)

    topic_performance = []
    for slug, stats in topic_stats.items():
        topic_performance.append({
            "slug": slug,
            "topic": stats["topic"],
            "attempts": stats["attempts"],
            "accuracy_pct": round(stats["correct"] * 100 / stats["attempts"], 1),
            "average_time_seconds": round(stats["elapsed_ms"] / stats["attempts"] / 1000, 1),
        })
    topic_performance.sort(key=lambda item: (item["accuracy_pct"], -item["attempts"]))
    eligible_weak_topics = [topic for topic in topic_performance if topic["attempts"] >= 3]
    repeat_correct = sum(1 for row in repeat_rows if row.get("is_correct") is True)

    return {
        "total_attempts": total,
        "overall_accuracy_pct": round(correct * 100 / total, 1) if total else None,
        "last_5_accuracy_pct": round(last_five_correct * 100 / len(last_five), 1) if last_five else None,
        "average_time_seconds": round(average_elapsed_ms / 1000, 1) if average_elapsed_ms is not None else None,
        "repeat_accuracy_pct": round(repeat_correct * 100 / len(repeat_rows), 1) if repeat_rows else None,
        "recent_attempts": len(last_five),
        "weakest_topic": eligible_weak_topics[0] if eligible_weak_topics else None,
        "topic_performance": topic_performance,
        "data_window": "latest 1000 attempts",
    }


@app.get("/v1/attempts/history")
async def attempts_history(
    request: Request,
    exam_id: str = "rrb_ntpc",
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    """Return a paginated, user-scoped answer history without exposing answer keys."""
    authorization = request.headers.get("authorization", "")
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        raise HTTPException(status_code=401, detail="Bearer access token required.")

    base_url = os.getenv("SUPABASE_URL", "").rstrip("/")
    anon_key = os.getenv("SUPABASE_ANON_KEY", "")
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    if not base_url or not anon_key or not service_key:
        raise HTTPException(status_code=503, detail="Attempt history is not configured.")

    user_headers = {"apikey": anon_key, "Authorization": f"Bearer {token}"}
    admin_headers = {"apikey": service_key, "Authorization": f"Bearer {service_key}"}
    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            user_response = await client.get(f"{base_url}/auth/v1/user", headers=user_headers)
            if user_response.status_code in (401, 403):
                raise HTTPException(status_code=401, detail="Invalid or expired access token.")
            user_response.raise_for_status()
            user_id = user_response.json().get("id")
            if not user_id:
                raise HTTPException(status_code=401, detail="Supabase did not return a user.")
            response = await client.get(
                f"{base_url}/rest/v1/attempts",
                params={
                    "select": "question_id,answer_given,is_correct,elapsed_ms,created_at,questions!inner(exam_id,topic_id,question_text,source_document,source_page,topics(name,slug))",
                    "user_id": f"eq.{user_id}",
                    "questions.exam_id": f"eq.{exam_id}",
                    "order": "created_at.desc",
                    "limit": str(limit),
                    "offset": str(offset),
                },
                headers=admin_headers,
            )
            response.raise_for_status()
            rows = response.json()
    except HTTPException:
        raise
    except httpx.HTTPStatusError:
        raise HTTPException(status_code=502, detail="Attempt history database request failed.")
    except httpx.HTTPError:
        raise HTTPException(status_code=503, detail="Attempt history database is temporarily unreachable.")

    history = []
    for row in rows:
        question = row.get("questions") or {}
        topic = question.get("topics") or {}
        history.append({
            "question_id": row.get("question_id"),
            "question_text": question.get("question_text"),
            "topic": topic.get("name") or topic.get("slug") or "Unclassified",
            "is_correct": row.get("is_correct") is True,
            "answer_given": row.get("answer_given"),
            "elapsed_ms": row.get("elapsed_ms"),
            "created_at": row.get("created_at"),
            "source_document": question.get("source_document"),
            "source_page": question.get("source_page"),
        })
    return {"exam_id": exam_id, "attempts": history, "limit": limit, "offset": offset}


@app.get("/v1/attempts/summary")
async def attempts_summary(request: Request, exam_id: str = "rrb_ntpc"):
    """Compute user-only accuracy, speed and topic signals after verifying the Supabase session."""
    authorization = request.headers.get("authorization", "")
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        raise HTTPException(status_code=401, detail="Bearer access token required.")
    base_url = os.getenv("SUPABASE_URL", "").rstrip("/")
    anon_key = os.getenv("SUPABASE_ANON_KEY", "")
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    if not base_url or not anon_key or not service_key:
        raise HTTPException(status_code=503, detail="Attempt history is not configured.")

    user_headers = {"apikey": anon_key, "Authorization": f"Bearer {token}"}
    admin_headers = {"apikey": service_key, "Authorization": f"Bearer {service_key}"}
    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            user_response = await client.get(f"{base_url}/auth/v1/user", headers=user_headers)
            if user_response.status_code in (401, 403):
                raise HTTPException(status_code=401, detail="Invalid or expired access token.")
            user_response.raise_for_status()
            user_id = user_response.json().get("id")
            if not user_id:
                raise HTTPException(status_code=401, detail="Supabase did not return a user.")
            response = await client.get(
                f"{base_url}/rest/v1/attempts",
                params={
                    "select": "is_correct,elapsed_ms,created_at,question_id,questions!inner(exam_id,topic_id,topics(name,slug))",
                    "user_id": f"eq.{user_id}",
                    "questions.exam_id": f"eq.{exam_id}",
                    "order": "created_at.desc",
                    "limit": "1000",
                },
                headers=admin_headers,
            )
            if response.status_code in (401, 403):
                raise HTTPException(status_code=502, detail="Attempt history access was rejected.")
            if response.status_code >= 500:
                raise HTTPException(status_code=502, detail="Attempt history database is temporarily unavailable.")
            response.raise_for_status()
            rows = response.json()
    except HTTPException:
        raise
    except httpx.HTTPStatusError:
        raise HTTPException(status_code=502, detail="Attempt history request failed.")
    except httpx.HTTPError:
        raise HTTPException(status_code=503, detail="Attempt history service is temporarily unreachable.")

    summary = summarize_attempt_rows(rows)
    summary["exam_id"] = exam_id
    return summary
