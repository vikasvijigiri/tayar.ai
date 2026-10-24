# Tayar.ai production monitoring

## Monitoring stack

The repository includes a self-hosted Prometheus + Blackbox Exporter + Grafana stack:

- `monitoring/docker-compose.yml` — local monitoring services; Grafana sign-up is disabled and an admin password is required through `GRAFANA_ADMIN_PASSWORD`.
- `monitoring/prometheus.yml` — scrapes the API metrics endpoint and probes liveness/readiness.
- `monitoring/blackbox.yml` — HTTP 200 probes.
- `monitoring/grafana/provisioning/datasources/prometheus.yml` — provisions Prometheus in Grafana.
- `monitoring/grafana/provisioning/dashboards/provider.yml` and `monitoring/grafana/tayar-api-reliability.json` — provisions the dashboard.

## API endpoints monitored

- `GET /health` — liveness.
- `GET /health/ready` — checks required Supabase configuration and connectivity without returning secrets.
- `GET /metrics` — Prometheus text exposition for request counters and latency histograms.
- The dashboard shows request rate, 5xx error ratio, p95 latency, requests by endpoint/status, and API liveness/readiness.

## Start locally

From the repository root, set a strong unique Grafana password in your shell and run:

```bash
export GRAFANA_ADMIN_PASSWORD='use-a-strong-local-password'
docker compose -f monitoring/docker-compose.yml up -d
```

Then open Grafana at `http://localhost:3000`. Check Prometheus targets at `http://localhost:9090/targets`. Do not commit credentials or expose these local admin endpoints publicly.

## Readiness limitation

A running local monitoring stack does not mean Grafana is hosted or continuously available. The current configuration must be started on a machine with Docker, and its scrape target requires the deployed API to be reachable. Render readiness will remain unhealthy until the required Supabase environment variables are correctly set and the database connectivity check passes.
