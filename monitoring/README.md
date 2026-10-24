# Tayar.ai production monitoring

## What is implemented in the API

- `GET /health`: liveness check.
- `GET /health/ready`: checks required Supabase configuration and connectivity without returning secrets.
- `GET /metrics`: Prometheus text exposition for request count and latency histograms.
- Request metrics are labelled by HTTP method, normalized route, and status code. The metrics endpoint itself is excluded from request counters to avoid self-scrape noise.

## Prometheus

The scrape configuration is in `monitoring/prometheus/prometheus.yml`. Add it to a Prometheus server (or merge its scrape job into the existing configuration). Load alert rules from `monitoring/prometheus/tayar-alerts.yml`.

The target is the public Render service `https://tayar-ai-api.onrender.com/metrics`. A successful local API health check does not prove that Prometheus is scraping it; verify the Prometheus target status after applying the config.

## Grafana

Import `monitoring/grafana/tayar-api-dashboard.json` into Grafana and select the Prometheus data source that scrapes the target. The dashboard covers request rate, 5xx rate, p95 latency, scrape health, per-route throughput, latency percentiles, and HTTP status distribution.

## Important limitation

Dashboard and alert definitions are checked into source control, but this alone does not create a Grafana Cloud stack, connect a data source, or send alert notifications. Those require a running Prometheus/Grafana instance and its own credentials/notification configuration. Do not commit Grafana, Prometheus, Render, or Supabase secrets to this repository.
