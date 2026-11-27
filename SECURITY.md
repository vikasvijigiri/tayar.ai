# Security policy

## Supported versions

Security fixes are applied to the current default branch. Releases that are no longer supported should not be assumed to receive security updates.

## Reporting a vulnerability

Please do not report exploitable vulnerabilities in public GitHub issues, discussions, or pull requests.

Use GitHub's **Report a vulnerability** action on this repository to submit a private vulnerability report (Security tab / Advisories). Include:
- affected commit, release, endpoint, or component;
- impact and realistic attack prerequisites;
- minimal reproduction steps or a proof of concept;
- any suggested mitigation.

Do not include real user records, credentials, access tokens, OTPs, or production secrets in a report. Redact sensitive material.

If private vulnerability reporting is unavailable in the repository UI, contact the repository owner through the public GitHub profile and request a private security-reporting channel. Do not publish exploit details while waiting for a response.

## Response expectations

The maintainer should acknowledge a report, assess severity and affected versions, coordinate a fix, and publish a security advisory after a mitigation is available. Do not assume a fixed response-time SLA until one is explicitly published.

## Security boundaries

- Supabase service-role keys and AI provider keys are server-side secrets and must never be embedded in the mobile application.
- Authentication and authorization must be enforced by the backend and database policies, not by client-side visibility checks.
- Production data must not be used for destructive integration tests.
- Logs, traces, metrics, screenshots, and CI artifacts must not contain credentials, OTPs, access tokens, or unnecessary personal data.
