"""Bounded local concurrency smoke test; never load-test the free production service."""
import asyncio
import os
import subprocess
import sys
import time
from pathlib import Path

import httpx

BACKEND = Path(__file__).resolve().parents[1]
BASE_URL = "http://127.0.0.1:8765"
WORKERS = max(1, int(os.getenv("LOAD_WORKERS", "10")))
REQUESTS_PER_WORKER = max(1, int(os.getenv("LOAD_REQUESTS_PER_WORKER", "20")))
P95_LIMIT_SECONDS = max(0.1, float(os.getenv("LOAD_P95_LIMIT_SECONDS", "2.0")))
ENDPOINTS = [
    ("/health", 200),
    ("/v1/config", 200),
    ("/metrics", 200),
    ("/v1/attempts/summary", 401),
]


async def run_load() -> None:
    process = subprocess.Popen(
        [
            sys.executable,
            "-m",
            "uvicorn",
            "app.main:app",
            "--host",
            "127.0.0.1",
            "--port",
            "8765",
            "--log-level",
            "warning",
        ],
        cwd=BACKEND,
        env={**os.environ, "PYTHONPATH": str(BACKEND)},
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    latencies: list[float] = []
    failures: list[str] = []
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            for _ in range(40):
                if process.poll() is not None:
                    raise RuntimeError("Local API exited before becoming healthy")
                try:
                    response = await client.get(f"{BASE_URL}/health")
                    if response.status_code == 200:
                        break
                except httpx.HTTPError:
                    pass
                await asyncio.sleep(0.25)
            else:
                raise RuntimeError("Local API did not become healthy within 10 seconds")

            async def worker(worker_id: int) -> None:
                for index in range(REQUESTS_PER_WORKER):
                    path, expected_status = ENDPOINTS[(worker_id + index) % len(ENDPOINTS)]
                    started = time.perf_counter()
                    try:
                        response = await client.get(f"{BASE_URL}{path}")
                        elapsed = time.perf_counter() - started
                        latencies.append(elapsed)
                        if response.status_code != expected_status:
                            failures.append(
                                f"{path}: expected {expected_status}, got {response.status_code}"
                            )
                        if not response.headers.get("X-Request-ID"):
                            failures.append(f"{path}: missing X-Request-ID")
                        if path == "/v1/config" and not response.headers.get("Cache-Control", "").startswith("public"):
                            failures.append("/v1/config: expected safe public cache policy")
                        if path == "/v1/attempts/summary" and response.headers.get("Cache-Control") != "private, no-store":
                            failures.append("/v1/attempts/summary: sensitive response is not no-store")
                    except httpx.HTTPError as exc:
                        failures.append(f"{path}: {type(exc).__name__}")

            await asyncio.gather(*(worker(i) for i in range(WORKERS)))

        if failures:
            raise AssertionError("; ".join(failures[:10]))
        ordered = sorted(latencies)
        p95 = ordered[min(len(ordered) - 1, int(len(ordered) * 0.95))]
        if p95 > P95_LIMIT_SECONDS:
            raise AssertionError(
                f"Local API p95 latency {p95:.3f}s exceeded {P95_LIMIT_SECONDS:.3f}s"
            )
        print(
            f"Local concurrency smoke passed: {len(latencies)} requests, "
            f"{WORKERS} concurrent workers, p95={p95 * 1000:.1f}ms, "
            f"limit={P95_LIMIT_SECONDS * 1000:.0f}ms"
        )
    finally:
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=5)


if __name__ == "__main__":
    asyncio.run(run_load())
