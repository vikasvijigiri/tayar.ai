# Tayar.ai mobile QA

## Layers

- **Maestro MCP**: AI-assisted exploration, screen hierarchy inspection, screenshots, authoring and running repeatable UI flows.
- **Manos MCP**: exploratory device control, device conditions, crash/ANR logs, network capture and accessibility audits.
- **GitHub-hosted Android emulator**: repeatable cloud CI execution through reactivecircus/android-emulator-runner. Maestro Cloud remains an optional paid device-matrix expansion.
- **Physical Android device**: run the same Maestro flows on an ADB-connected device using a persistent self-hosted runner or a compatible device farm.
- **Backend**: retain pytest/HTTPX coverage for API contracts, auth, idempotency, grading and persistence. UI tests do not replace backend integration tests.

## MCP installation (Linux cloud workspace)

Prerequisites: Java 17+, Node.js 20+, Android SDK (platform-tools, platform and build-tools), ANDROID_HOME/ANDROID_SDK_ROOT, and an MCP-capable coding agent.

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

## GitHub Actions emulator setup

The Mobile E2E workflow uses the GitHub-hosted Linux runner and reactivecircus/android-emulator-runner to boot a Pixel 7 Pro / Android 15 emulator. It builds an x86_64 debug APK, installs Maestro CLI, executes the smoke and phone-validation flows, optionally runs authenticated navigation, and uploads JUnit/log/screenshot evidence.

No Maestro Cloud account is required for the default emulator CI. Add these repository Actions secrets only if you want the authenticated journey:

- TEST_PHONE — dedicated non-production Supabase test user phone number in E.164 format.
- TEST_OTP — fixed test OTP configured in that dedicated Supabase project.

The smoke and local-validation tests run without secrets. Never use production accounts or personal OTPs. Maestro Cloud can be added later if you want a wider hosted device matrix; its GitHub Actions integration requires a Maestro Cloud plan.

## Running flows locally

```bash
maestro test .maestro/smoke.yaml
maestro test .maestro/auth-validation.yaml
# Only with a dedicated Supabase test project and fixed test OTP:
maestro test -e TEST_PHONE=+910000000000 -e TEST_OTP=123456 .maestro/authenticated-navigation.yaml
```

## Physical-device execution

Connect a dedicated Android phone to a persistent self-hosted GitHub Actions runner with Android platform-tools and Maestro installed. Register the runner with labels self-hosted, linux and android-device. Confirm adb devices -l lists the handset in state device. The manual-only workflow at .github/workflows/physical-android.yml builds and installs the debug APK, runs the smoke and input-validation flows, optionally runs the authenticated journey, and uploads filtered crash diagnostics plus a screenshot.

Keep the runner private and restrict which repositories/workflows can execute on it. Do not expose ADB over an unrestricted public network. A cloud-hosted device farm is an alternative; confirm it supports Maestro execution before purchasing.

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

The checked-in flows cover unauthenticated launch, local phone validation and (when test OTP secrets are configured) authenticated navigation across Today, Learn, Practice, Progress and Services, followed by sign-out. They are not a complete acceptance suite. Live SMS delivery, Google OAuth, AI-provider failure modes, persistent test-user lifecycle and backend idempotency require dedicated test fixtures and backend integration tests. The GitHub-hosted emulator workflow does not require an external device-farm account. Physical-device execution requires a private self-hosted runner with an authorized Android handset; the workflow is manual-only and does not provision hardware. Maestro Cloud is an optional paid expansion for additional device/OS combinations.


## Checked-in flow inventory

- .maestro/smoke.yaml — tag smoke; launches the unauthenticated app and checks the Continue and Continue with Google controls.
- .maestro/auth-validation.yaml — tag smoke; submits a malformed phone number and verifies local validation.
- .maestro/authenticated-navigation.yaml — tag authenticated; signs in with a configured test phone and fixed test OTP, navigates Today/Learn/Practice/Progress/Services, then signs out.
- .maestro/config.yaml — selects the three flows, stops the suite on failure, stores Maestro artifacts and disables Android system animations on Maestro Cloud.

## Required GitHub Actions secrets

- TEST_PHONE — dedicated non-production Supabase test user phone number in E.164 format.
- TEST_OTP — fixed test OTP configured in that dedicated Supabase project.

The Mobile E2E workflow runs smoke and phone-validation flows on a GitHub-hosted Pixel 7 Pro / Android 15 emulator. The authenticated flow is run only when TEST_PHONE and TEST_OTP are configured; otherwise it is skipped with a note in the JUnit/step evidence. Never use production accounts or personal OTPs.

## Expanded acceptance scenarios

Authentication: malformed/valid phone, invalid/expired OTP, resend cooldown, provider rate limit, token refresh, revoked refresh token, session restoration after relaunch, Google OAuth success/cancel/failure and secure sign-out.

Practice: source-verified question delivery, exactly four options, no answer_key in question-list payload, source document/page preservation, empty bank, malformed payload, timeout, option selection, answer submission, correct/incorrect feedback, retry with same idempotency key, duplicate-submit protection, timer expiry/reset and pagination.

Analytics: zero-attempt state, populated summary, topic accuracy, recent history, user isolation and persisted state after relaunch.

Hints: successful response, cache hit, timeout, provider 429/500 and malformed response.

Network: offline launch, reconnect, slow network, connection loss during submission, API 401/403/404/429/500 and request timeout.

Layout/accessibility: 320–360 dp screens, font scale 1.0/1.3/1.5/2.0, keyboard overlap, long question/solution text, scrolling, TalkBack focus order, labels, contrast and touch target size.

Reliability/security: background/foreground, force-stop during practice, crash/ANR inspection, repeated navigation, no tokens/OTP/passwords/answer keys in logs, no service-role or AI-provider secrets in the APK, authenticated writes and RLS isolation.

Manos exploratory loop: list devices → inspect screen → screenshot → interact using semantic selectors → set offline/slow network or font scale → inspect logs and accessibility audit → record the session → export a Maestro flow and review it before committing. Use response mocking only with a dedicated debug/test backend, never production learner traffic.


## Headless emulator in a cloud workspace

If your cloud IDE provides a Linux VM with hardware virtualization or a supported software-rendered emulator, install an Android system image and start an AVD. Example for API 35:

    sdkmanager "platform-tools" "platforms;android-35" "build-tools;35.0.0" "emulator" "system-images;android-35;google_apis;x86_64"
    avdmanager create avd -n Tayar_QA_API_35 -k "system-images;android-35;google_apis;x86_64" -d pixel_7
    emulator -avd Tayar_QA_API_35 -no-window -no-audio -no-boot-anim -gpu swiftshader_indirect &
    adb wait-for-device
    adb devices -l

Some hosted workspaces do not expose KVM/virtualization; in that case use Maestro Cloud for emulator execution instead of trying to launch a nested emulator. Manos and Maestro MCP can control the emulator only after it appears in adb devices.
