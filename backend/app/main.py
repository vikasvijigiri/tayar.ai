import os
from typing import Literal
import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI(title="Tayar.ai Adaptive API", version="0.1.0",
              description="Exam-agnostic adaptive learning API; RRB NTPC is the first exam.")
origins = [x.strip() for x in os.getenv("CORS_ORIGINS", "*").split(",") if x.strip()]
app.add_middleware(CORSMiddleware, allow_origins=origins or ["*"],
                   allow_credentials=False, allow_methods=["GET", "POST"],
                   allow_headers=["Content-Type", "Authorization"])

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

@app.get("/v1/config")
def config():
    return {"supported_exams": [{"id": "rrb_ntpc", "name": "RRB NTPC"}],
            "adaptive_metrics": ["overall_accuracy", "last_5_accuracy", "weakness", "retention", "time_efficiency"],
            "ai_enabled": any(os.getenv(k) for k in ("GROQ_API_KEY", "GEMINI_API_KEY", "CEREBRAS_API_KEY"))}

@app.post("/v1/attempts/preview")
def preview_attempt(payload: AttemptIn):
    return {"accepted": True, "attempt": payload.model_dump(),
            "note": "Preview only; configure authentication and persistence before production use."}

PROVIDERS = {
    "groq": ("GROQ_API_KEY", "https://api.groq.com/openai/v1/chat/completions", "GROQ_MODEL", "llama-3.3-70b-versatile"),
    "gemini": ("GEMINI_API_KEY", "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", "GEMINI_MODEL", "gemini-2.0-flash"),
    "cerebras": ("CEREBRAS_API_KEY", "https://api.cerebras.ai/v1/chat/completions", "CEREBRAS_MODEL", "llama3.1-8b"),
}

async def provider_completion(provider: str, system_prompt: str, user_prompt: str) -> str:
    key_env, url, model_env, default_model = PROVIDERS[provider]
    key = os.getenv(key_env)
    if not key:
        raise RuntimeError(f"{provider} not configured")
    body = {"model": os.getenv(model_env, default_model),
            "messages": [{"role": "system", "content": system_prompt},
                         {"role": "user", "content": user_prompt}],
            "temperature": 0.2, "max_tokens": 500}
    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.post(url, json=body, headers={"Authorization": f"Bearer {key}"})
        response.raise_for_status()
        data = response.json()
    return data["choices"][0]["message"]["content"]

@app.post("/v1/ai/hint")
async def get_hint(payload: HintIn):
    order = [p.strip().lower() for p in os.getenv("AI_PROVIDER_ORDER", "groq,gemini,cerebras").split(",")]
    system = ("You are a careful exam tutor. Never invent or change an answer key. Use only supplied stored solution steps. "
              "If insufficient, say a verified solution is needed. Be concise.")
    user = f"Topic: {payload.topic}\nHint level: {payload.hint_level}\nStored verified solution steps: {payload.stored_solution_steps}\nGive a useful hint based only on this information."
    errors = []
    for provider in order:
        if provider not in PROVIDERS or not os.getenv(PROVIDERS[provider][0]):
            continue
        try:
            return {"provider": provider, "hint": await provider_completion(provider, system, user)}
        except (httpx.HTTPError, KeyError, RuntimeError, ValueError) as exc:
            errors.append(f"{provider}: {type(exc).__name__}")
    if errors:
        raise HTTPException(status_code=503, detail={"message": "AI providers unavailable", "providers": errors})
    raise HTTPException(status_code=503, detail="No AI provider configured.")
