#!/usr/bin/env bash
set -Eeuo pipefail

ARTIFACT_DIR="qa-artifacts"
APK_PATH="mobile/android/app/build/outputs/apk/release/app-release.apk"
mkdir -p "$ARTIFACT_DIR"

capture_diagnostics() {
  local status=$?
  adb logcat -d -v time 2>/dev/null \
    | grep -E "FATAL EXCEPTION|AndroidRuntime|ReactNativeJS|tayar" \
    > "$ARTIFACT_DIR/android-crash-diagnostics.log" || true
  adb exec-out screencap -p > "$ARTIFACT_DIR/final-screen.png" 2>/dev/null || true
  if [[ $status -ne 0 ]]; then
    echo "Android UI regression failed (exit $status). Diagnostics were captured." \
      | tee -a "$GITHUB_STEP_SUMMARY"
  fi
  exit "$status"
}
trap capture_diagnostics EXIT

echo "Waiting for Android framework readiness..."
adb wait-for-device
ready=false
for attempt in $(seq 1 90); do
  boot_completed="$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r' || true)"
  if [[ "$boot_completed" == "1" ]] && adb shell pm path android >/dev/null 2>&1; then
    ready=true
    break
  fi
  sleep 5
done
if [[ "$ready" != "true" ]]; then
  echo "Android framework services did not become ready within 450 seconds." >&2
  adb shell getprop > "$ARTIFACT_DIR/android-properties.txt" 2>&1 || true
  exit 1
fi

test -f "$APK_PATH"
adb install -r "$APK_PATH"

maestro test --format junit --output "$ARTIFACT_DIR/smoke.xml" .maestro/smoke.yaml
maestro test --format junit --output "$ARTIFACT_DIR/auth-validation.xml" .maestro/auth-validation.yaml

if [[ -n "${TEST_PHONE:-}" && -n "${TEST_OTP:-}" ]]; then
  maestro test --format junit --output "$ARTIFACT_DIR/authenticated-navigation.xml" \
    -e TEST_PHONE="$TEST_PHONE" -e TEST_OTP="$TEST_OTP" \
    .maestro/authenticated-navigation.yaml
else
  echo "Authenticated journey skipped: configure TEST_PHONE and TEST_OTP using a dedicated non-production Supabase test project." \
    >> "$GITHUB_STEP_SUMMARY"
fi
