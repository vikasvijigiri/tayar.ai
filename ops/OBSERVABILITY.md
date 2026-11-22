# Tayar.ai observability and live API checks

## Current deployment

- API: https://tayar-ai-api.onrender.com
- Host: Render Web Service, Free plan, Oregon, one instance
- Database/Auth: Supabase PostgreSQL 17, Tokyo region (`ap-northeast-1`)
- Render deploy source: GitHub `main`, root directory `backend`
- Liveness probe: `/health`
- Dependency readiness probe: `/health/ready`
- Prometheus exposition: `/metrics`

## Synthetic checks

`ops/live_api_smoke.py` checks the public API contract without creating users or writing attempts:

- `GET /health`, `GET /health/ready`, `GET /v1/config`
- `GET /v1/questions`: validates source attribution, four options and no answer-key/solution leakage
- `GET /metrics`: validates Prometheus exposition
- The developer-only attempt preview must remain disabled (HTTP 404)
- Protected endpoints without credentials must reject access: attempts history/summary, AI hint and answer submission
- Refresh-token request validation is checked without contacting Supabase Auth

GitHub Actions runs this every 30 minutes and on manual dispatch. Successful OTP login, authenticated history/analytics, paid AI inference and answer persistence are intentionally excluded from scheduled checks. Use `backend/scripts/live_auth_smoke.py` locally for the interactive OTP flow. The optional `--include-write-test` flag creates a permanent attempt and must only be used deliberately.

## Prometheus metrics

The API already exports:

- `tayar_http_requests_total{method,route,status}`
- `tayar_http_request_duration_seconds_bucket{method,route,le}`
- `tayar_ai_provider_requests_total{provider,outcome}`
- `tayar_ai_provider_request_duration_seconds_bucket{provider,le}`

Import `ops/grafana-dashboard.json` into Grafana after connecting a Prometheus-compatible data source.

### Protecting the metrics endpoint

The API now supports optional bearer protection. Before connecting an external scraper:

1. Generate a long random token locally (do not paste it into chat).
2. Add `METRICS_BEARER_TOKEN` to the Render service environment.
3. Add the exact same value as a GitHub Actions repository secret named `METRICS_BEARER_TOKEN`.
4. Redeploy the Render service. The scheduled GitHub monitor will then authenticate its scrape automatically.

Until that variable is set in Render, `/metrics` remains public for backwards compatibility. Do not treat the endpoint as private until the variable is configured and the protected request has been verified.

Grafana Cloud still needs a telemetry collector/scraper or OTLP exporter to send the API's metrics to its hosted Prometheus service. That collector is not deployed or connected yet; the dashboard JSON is a ready-to-import dashboard, not evidence that Grafana ingestion is active.

## Free-tier stack

- **Grafana Cloud Free:** metrics up to 10,000 active series with 14-day retention; logs up to 50 GB/month with 14-day retention. Use for dashboards and alerting. Usage limits apply.
- **Better Stack Free:** 10 uptime monitors, 10 heartbeats and one status page with 3-minute checks. Monitor `/health` and `/health/ready`.
- **Sentry Developer:** optional exception/error tracking. It requires a Sentry project and DSN; no Sentry SDK or DSN is configured in this repository yet.

## Operational caveats

- Render Free services spin down after 15 minutes without inbound traffic and can take about one minute to wake. Render explicitly recommends not using Free instances for production applications. See https://render.com/docs/free.
- The Render service is in Oregon while Supabase is in Tokyo. Recent Supabase edge logs showed roughly 0.3–0.66 seconds origin time for the readiness and question-bank requests. Aligning the API and database regions should reduce cross-region latency, but moving regions requires a planned migration/redeployment.
- The hint cache, per-user hint rate limiter and per-key locks are process-local. They are appropriate only for the current single-instance deployment; move them to shared Redis/Key Value before horizontal scaling.
- Render metrics currently contain too few data points for meaningful CPU/latency baselines. Establish a traffic baseline before setting strict SLO thresholds.
- Do not remove the indexes reported as unused until representative production traffic has exercised the workload.
