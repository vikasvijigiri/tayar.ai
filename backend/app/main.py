import os
from time import perf_counter
from typing import Literal

import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from prometheus_client import CONTENT_TYPE_LATEST, Counter, Histogram, generate_latest
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
    allow_headers=["Content-Type", "Authorization"],
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


@app.middleware("http")
async def observe_requests(request: Request, call_next):
    started = perf_counter()
    response = await call_next(request)
    route_obj = request.scope.get("route")
    route = getattr(route_obj, "path", "unmatched")
    if route != "/metrics":
        REQUEST_COUNT.labels(request.method, route, str(response.status_code)).inc()
        REQUEST_LATENCY.labels(request.method, route).observe(perf_counter() - started)
    return response


class AttemptIn(BaseModel):
    question_id: str
    exam_id: str = "rrb_ntpc"
    topic_id: str
    is_correct: bool
    elapsed_ms: int = Field(ge=0, le=3600000)
    confidence: int | None = Field(default=None, ge=1, le=5)


class HintIn(BaseModel):
    question_id: str
    topic: str
    stored_solution_steps: list[str] = Field(default_factory=list, max_length=12)
    hint_level: Literal["nudge", "method", "steps"] = "nudge"


@app.get("/health")
def health():
    return {"status": "ok", "service": "tayar-ai-api", "version": app.version}


@app.get("/metrics", include_in_schema=False)
def metrics():
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)


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
    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.post(
            url, json=body, headers={"Authorization": f"Bearer {key}"}
        )
        response.raise_for_status()
        data = response.json()
    return data["choices"][0]["message"]["content"]


@app.post("/v1/ai/hint")
async def get_hint(payload: HintIn):
    order = [
        p.strip().lower()
        for p in os.getenv("AI_PROVIDER_ORDER", "groq,gemini,cerebras").split(",")
    ]
    system = (
        "You are a careful exam tutor. Never invent or change an answer key. "
        "Use only supplied stored solution steps. If insufficient, say a verified solution is needed. "
        "Be concise."
    )
    user = (
        f"Topic: {payload.topic}\nHint level: {payload.hint_level}\n"
        f"Stored verified solution steps: {payload.stored_solution_steps}\n"
        "Give a useful hint based only on this information."
    )
    errors = []
    for provider in order:
        if provider not in PROVIDERS or not os.getenv(PROVIDERS[provider][0]):
            continue
        try:
            return {
                "provider": provider,
                "hint": await provider_completion(provider, system, user),
            }
        except (httpx.HTTPError, KeyError, RuntimeError, ValueError) as exc:
            errors.append(f"{provider}: {type(exc).__name__}")
    if errors:
        raise HTTPException(
            status_code=503,
            detail={"message": "AI providers unavailable", "providers": errors},
        )
    raise HTTPException(status_code=503, detail="No AI provider configured.")


class AttemptSaveIn(BaseModel):
    question_id: str = Field(pattern=r"^[0-9a-fA-F-]{36}$")
    is_correct: bool
    elapsed_ms: int = Field(ge=0, le=3600000)
    confidence: int | None = Field(default=None, ge=1, le=5)
    answer_given: str | None = Field(default=None, max_length=200)


@app.post("/v1/attempts", status_code=201)
async def save_attempt(payload: AttemptSaveIn, request: Request):
    """Persist an attempt using the signed-in user's Supabase JWT and RLS."""
    authorization = request.headers.get("authorization", "")
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        raise HTTPException(status_code=401, detail="Bearer access token required.")

    base_url = os.getenv("SUPABASE_URL", "").rstrip("/")
    anon_key = os.getenv("SUPABASE_ANON_KEY", "")
    if not base_url or not anon_key:
        raise HTTPException(status_code=503, detail="Supabase is not configured.")

    headers = {"apikey": anon_key, "Authorization": f"Bearer {token}"}
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            user_response = await client.get(f"{base_url}/auth/v1/user", headers=headers)
            if user_response.status_code in (401, 403):
                raise HTTPException(status_code=401, detail="Invalid or expired access token.")
            user_response.raise_for_status()
            user = user_response.json()
            user_id = user.get("id")
            if not user_id:
                raise HTTPException(status_code=401, detail="Supabase did not return a user.")
            row = {
                "user_id": user_id,
                "question_id": payload.question_id,
                "is_correct": payload.is_correct,
                "elapsed_ms": payload.elapsed_ms,
                "confidence": payload.confidence,
                "answer_given": payload.answer_given,
            }
            response = await client.post(
                f"{base_url}/rest/v1/attempts",
                headers={**headers, "Content-Type": "application/json", "Prefer": "return=minimal"},
                json=row,
            )
            if response.status_code in (401, 403):
                raise HTTPException(status_code=403, detail="Attempt was rejected by database access policies.")
            response.raise_for_status()
        except HTTPException:
            raise
        except httpx.HTTPStatusError:
            raise HTTPException(status_code=502, detail="Supabase request failed.")
        except httpx.HTTPError:
            raise HTTPException(status_code=503, detail="Supabase is temporarily unreachable.")
    return {"saved": True, "question_id": payload.question_id}


class AuthCredentials(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=8, max_length=128)


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
