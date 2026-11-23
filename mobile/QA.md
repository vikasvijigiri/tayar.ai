# Tayar.ai mobile and cloud QA

## Recommended architecture

| Layer | Tool | Responsibility |
|---|---|---|
| Cloud development | GitHub Codespaces | Browser-based editor, Node 22, Python 3.12, Java 17, API development and mobile source work |
| Repository automation | GitHub Actions | Builds APKs, runs backend/mobile checks and starts a hosted Android emulator |
| UI automation | Maestro CLI and YAML | Deterministic smoke, validation and authenticated navigation tests |
| Assistant-to-repository work | Connected GitHub integration | ChatGPT can inspect, edit and commit repository files without access to a personal laptop |
| Optional diagnostics | Manos MCP | Add later only if we need interactive device logs, network capture or accessibility exploration |

**Important:** Android emulators and USB-connected phones are not supported inside GitHub Codespaces. Do not try to install a nested emulator there. The default, free-first device test path is the GitHub-hosted Android emulator in `.github/workflows/mobile-e2e.yml`. Maestro MCP is useful when an MCP client has a live ADB-accessible device; it is not configured as a no-device MCP in Codespaces. Maestro Cloud is optional and may require a paid plan.

## Start the cloud development environment

1. Open [Tayar.ai Codespaces on the QA branch](https://codespaces.new/vikasvijigiri/tayar.ai?ref=qa/mobile-maestro-cloud).
2. Select the 2-core machine.
3. Wait for `.devcontainer/post-create.sh` to install the backend development requirements and locked mobile dependencies.
4. Start the API from the repository root:

   ```bash
   cd backend
   ../backend/.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
   ```

5. In a second terminal, run mobile source checks:

   ```bash
   cd mobile
   npm run typecheck
   npm test
   npx expo install --check
   ```

Codespaces forwards port 8000 for FastAPI and 8081 for Expo Metro. Codespaces is the cloud editing/build-preparation environment; Android UI tests run in GitHub Actions.

For a strict no-spend setup, keep Codespaces spending disabled or set the Codespaces budget to $0. GitHub Free personal accounts currently include 120 core-hours and 15 GB-month storage; a 2-core Codespace uses two core-hours per active hour. Stop the Codespace when finished. See [GitHub's included usage documentation](https://docs.github.com/en/codespaces/troubleshooting/troubleshooting-included-usage).

## Maestro installation and MCP

Maestro CLI includes its MCP server. Install it only in an environment that has Java 17+ and a reachable Android emulator/device:

```bash
curl -fsSL "https://get.maestro.mobile.dev" | bash
export PATH="$HOME/.maestro/bin:$PATH"
maestro --version
maestro mcp
```

Register the MCP server in a compatible coding agent using:

```json
{
  "mcpServers": {
    "maestro": {
      "command": "maestro",
      "args": ["mcp"]
    }
  }
}
```

For Codex CLI, the equivalent `~/.codex/config.toml` entry is:

```toml
[mcp_servers.maestro]
command = "maestro"
args = ["mcp"]
```

Restart the coding agent after changing MCP configuration. The MCP needs a live device visible to ADB. Codespaces does not provide that device, so use the hosted-emulator GitHub Actions workflow for this project. Do not expose ADB over a public network.

Manos MCP is intentionally optional. If later needed in a Linux environment with an attached test device, install it with `npm install -g manos-mcp`, then run `manos doctor` and `manos devices`. It adds exploratory diagnostics, logs, network capture and accessibility inspection; it is not required for the current automated suite.

## GitHub Actions: hosted Android emulator

The Mobile E2E workflow:

- Builds an x86_64 release APK with the JavaScript bundle embedded, so Maestro can launch the app without a separate Metro server.
- Starts a Pixel 2 / Android 11 (API 30) x86_64 emulator using `reactivecircus/android-emulator-runner`.
- Installs Maestro CLI.
- Runs the smoke and malformed-phone validation flows.
- Runs authenticated navigation only when both test secrets are configured.
- Runs a checked-in Bash harness that waits for Android framework readiness, then uploads JUnit results, filtered Android logs and a final screenshot. Keeping the multi-line control flow in a repository script avoids shell truncation in the emulator action's single-command script input.

Default smoke and validation tests do not need paid Maestro Cloud or any credentials. The emulator is ephemeral and runs only during the GitHub Actions job.

### Optional authenticated journey

Use a separate, non-production Supabase project and dedicated test user. Add these GitHub Actions repository secrets:

- `TEST_PHONE`: dedicated test phone in E.164 format.
- `TEST_OTP`: fixed test OTP supported by that test project.

Never use personal OTPs or production learner accounts. Do not place secrets in the repository, Codespaces files, screenshots, logs or mobile bundle. The default smoke suite continues to run if these optional secrets are absent.

## Physical Android device (optional)

A physical device is not required for the cloud-first workflow. If later needed, register a private self-hosted GitHub Actions runner with labels `self-hosted`, `linux`, `android-device`, connect a dedicated test handset and authorize it with ADB. The manual-only workflow at `.github/workflows/physical-android.yml` builds, installs and runs the smoke/validation flows. Keep the runner private and restrict its repository access. Never expose ADB to the public internet.

## Checked-in flow inventory

- `.maestro/smoke.yaml`: launches the app and checks the unauthenticated entry controls.
- `.maestro/auth-validation.yaml`: enters a malformed phone number and checks local validation.
- `.maestro/authenticated-navigation.yaml`: signs in with the dedicated test account, visits Today/Learn/Practice/Progress/Services and signs out.
- `.maestro/config.yaml`: selects flows, controls execution order and artifact output.

## Full test scenario matrix

### Authentication and session
- Valid, malformed, invalid and expired phone/OTP combinations.
- Resend cooldown, provider rate limiting and retry.
- Session persistence after relaunch.
- Token refresh, revoked refresh token and secure sign-out.
- Google OAuth success, cancellation and failure.

### Navigation and UI
- Cold launch, warm launch and app relaunch.
- Today, Learn, Practice, Progress and Services navigation.
- Keyboard visibility, small screens, large font scale, long content and scroll boundaries.
- Accessibility labels, touch target size, contrast and TalkBack focus order.

### Practice and source integrity
- Only source-verified questions appear in learner practice.
- Preserve exact question wording, numbers, units and original options.
- Verify question-list API responses never contain `answer_key`.
- Preserve source PDF/page/shift metadata.
- Test empty bank, malformed payload, pagination and timeouts.
- Option selection, submit, correct/incorrect feedback, next question and timer expiry/reset.
- Retry the same answer after a simulated timeout and verify idempotency (one saved attempt).

### Analytics and persistence
- Zero-attempt state and populated progress summary.
- Topic accuracy, speed and recent history.
- Persistence after relaunch and user-data isolation under RLS.

### Hints and network resilience
- Successful hint, cache hit, provider timeout, 429 and 500.
- Offline launch, reconnect, slow network and connection loss during submission.
- API 401/403/404/429/500 handling and retry behaviour.

### Reliability and security
- Background/foreground, force-stop during practice and repeated navigation.
- Crash/ANR inspection.
- No passwords, OTPs, tokens, answer keys, service-role keys or AI-provider keys in logs or APK.
- Authenticated writes and RLS isolation.

## Source-integrity rule

Questions used in fixtures and UI tests must be verified directly against the uploaded railway exam PDFs. Never fabricate or paraphrase an exam question, silently alter an option or answer key, or claim repetition without source evidence. AI hints may explain stored solution steps but must never modify the authoritative answer key.

## Current limitations

- Checked-in UI flows are a starter regression suite, not full end-to-end acceptance coverage.
- The authenticated journey needs a dedicated test Supabase project and fixed test OTP configuration.
- Google OAuth, live SMS delivery, provider-failure handling and RLS/user-isolation require dedicated integration fixtures.
- Codespaces does not run Android emulators or attach USB phones. The GitHub-hosted emulator workflow covers the default cloud test path.
- Physical-device testing requires a separate private self-hosted runner and is optional.
- Maestro Cloud is an optional paid expansion for additional device/OS coverage.
