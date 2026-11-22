# Tayar.ai mobile QA

## Layers

- **Maestro MCP**: AI-assisted exploration, screen hierarchy inspection, screenshots, authoring and running repeatable UI flows.
- **Manos MCP**: exploratory device control, device conditions, crash/ANR logs, network capture and accessibility audits.
- **Maestro Cloud**: hosted Android UI regression in GitHub Actions.
- **Physical Android device**: run the same Maestro flows on an ADB-connected device using a persistent self-hosted runner or a compatible device farm.
- **Backend**: retain pytest/HTTPX coverage for API contracts, auth, idempotency, grading and persistence. UI tests do not replace backend integration tests.

## MCP installation (Linux cloud workspace)

Prerequisites: Java 17+, Node.js 20+, Android SDK platform-tools and an MCP-capable coding agent.

```bash
curl -fsSL "https://get.maestro.mobile.dev" | bash
export PATH="$HOME/.maestro/bin:$PATH"
npm install -g manos-mcp
maestro --version
adb version
manos doctor
adb devices -l
```

Register in the MCP client (JSON format):

```json
{
  "mcpServers": {
    "maestro": { "command": "maestro", "args": ["mcp"] },
    "manos": { "command": "npx", "args": ["-y", "manos-mcp", "serve"] }
  }
}
```

Codex CLI users can instead add this to `~/.codex/config.toml`:

```toml
[mcp_servers.maestro]
command = "maestro"
args = ["mcp"]

[mcp_servers.manos]
command = "npx"
args = ["-y", "manos-mcp", "serve"]
```

Restart the coding agent after changing MCP configuration. A cloud workspace must have an ADB-accessible emulator/device for local device-control tools. A remote phone must be exposed through a secure ADB connection or a persistent self-hosted runner; do not expose ADB's TCP port publicly.

## Maestro Cloud setup

1. Create a Maestro account/project and obtain its API key and project ID.
2. In GitHub repository Settings → Secrets and variables → Actions, add:
   - `MAESTRO_CLOUD_API_KEY`
   - `MAESTRO_PROJECT_ID`
3. The `Mobile E2E` workflow builds a debug APK and uploads it with the flows in `.maestro/`.
4. Review the Maestro Console run from the workflow summary.

Maestro Cloud requires an eligible Cloud plan. Do not put API keys, OTPs, user passwords or Supabase service-role keys in flow YAML or source control.

## Running flows locally

```bash
maestro test .maestro/smoke.yaml
maestro test .maestro/practice-navigation.yaml
```

## Physical-device execution

Connect a dedicated Android phone to a persistent self-hosted GitHub Actions runner with Android platform-tools and Maestro installed. Confirm `adb devices -l` lists the device. Run:

```bash
maestro test .maestro/
```

Keep the runner private and restrict which repositories/workflows can execute on it. Do not expose ADB over an unrestricted public network. A cloud-hosted device farm is an alternative; confirm it supports the required Android models and Maestro execution before purchasing.

## Test coverage plan

- App launch, cold start, relaunch and navigation across Today, Learn, Practice, Progress and Services.
- Practice: verified question delivery, four options, answer selection, submission, grading feedback, next question and timer restart.
- Persistence: answer history, progress summary and session restore after force-stop/relaunch.
- Idempotency: retry the same answer after a simulated timeout; verify exactly one saved attempt.
- Auth: valid/invalid/expired OTP, rate limiting, token refresh, logout and revoked session. Use a dedicated test Supabase project and a test OTP provider/fixture; never use a personal account.
- Hints: cache hit, provider timeout, provider 429/500 and graceful UI recovery.
- Network: offline launch, slow connection, connection loss during answer submission and reconnect.
- Layout: compact device, large font scale, keyboard open, long content and orientation changes where supported.
- Accessibility: labels/roles, touch target size, contrast and TalkBack navigation.
- Security: no answer key in question-list responses, no service-role/AI secrets in the APK, logs or network-visible client configuration.
- Reliability: crash/ANR review, repeated navigation, background/foreground and app termination during an active practice set.

## Source integrity

Questions shown in tests must come from the reviewed source-verified question bank. Do not put invented exam questions in fixtures or use UI tests to silently rewrite question text, options, answer keys or source metadata. Validate the API contract separately: question-list responses must not contain `answer_key`, and source document/page metadata must remain available.

## Current limitations

The two starter flows are smoke-level checks, not a complete acceptance suite. The app's live OTP, AI-provider failure modes, persistent test-user lifecycle and backend idempotency require dedicated test fixtures and backend integration tests. Physical-device execution is not enabled by the cloud workflow until a secure device runner or compatible device-farm integration is configured.
