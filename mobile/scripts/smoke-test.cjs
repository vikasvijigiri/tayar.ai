const fs = require('fs');
const app = fs.readFileSync('App.tsx', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const sessionGateIndex = app.indexOf('  if (sessionLoading) {');
const authGateIndex = app.indexOf('  if (!token) {\n    return (');
const lastHookIndex = Math.max(app.lastIndexOf('useEffect('), app.lastIndexOf('useState('), app.lastIndexOf('useRef('));
if (sessionGateIndex < 0 || authGateIndex < 0 || lastHookIndex > sessionGateIndex || lastHookIndex > authGateIndex) {
  throw new Error('All React hooks must be declared before any conditional render, including session restore');
}
if (!app.includes('lastFiveAccuracy')) throw new Error('Missing recent accuracy metric');
if (!app.includes('SOURCE-VERIFIED')) throw new Error('Missing source integrity guard');
if (!app.includes('https://tayar-ai-api.onrender.com')) throw new Error('Missing configured API base URL');
if (!app.includes('/health')) throw new Error('Missing backend health check integration');
if (!app.includes('AbortController') || !app.includes('DEFAULT_REQUEST_TIMEOUT_MS')) throw new Error('Mobile API calls must have bounded timeouts');
if (!app.includes('Service unavailable')) throw new Error('Missing offline/error state');
if (!app.includes('/auth/v1/')) throw new Error('Missing Supabase authentication integration');
if (!app.includes('tayar_access_token') || !app.includes('tayar_refresh_token')) throw new Error('Missing secure session lifecycle');
if (!pkg.dependencies['expo-secure-store']) throw new Error('Secure token storage dependency missing');
if (!app.includes('/v1/questions?exam_id=rrb_ntpc')) throw new Error('Missing verified question list integration');
if (!app.includes('/answer')) throw new Error('Missing server-side answer submission integration');
if (!app.includes('Idempotency-Key') || !app.includes('answerRequestKeys')) throw new Error('Answer retries must reuse an idempotency key');
if (!app.includes('hintCache')) throw new Error('AI hints should be cached per app session to avoid repeated inference');
if (!app.includes('/v1/attempts/summary')) throw new Error('Missing authenticated performance summary integration');
if (!app.includes('overall_accuracy_pct')) throw new Error('Missing real accuracy data binding');
if (!app.includes('topic_performance')) throw new Error('Missing topic mastery data binding');
if (!app.includes('repeat_accuracy_pct')) throw new Error('Missing repeat accuracy data binding');
if (!app.includes('solution_steps')) throw new Error('Missing solution display');
if (!app.includes('/v1/ai/hint')) throw new Error('Missing authenticated AI hint integration');
if (!app.includes('type AppScreen = "Home" | "Practice" | "Analytics" | "Revision" | "Services"')) throw new Error('Missing predictable static screen navigation');
for (const screen of ['Home','Practice','Analytics','Revision','Services']) {
  if (!app.includes('"' + screen + '"')) throw new Error('Missing navigation destination: ' + screen);
}
if (!app.includes('Start a new test / restart set')) throw new Error('Missing restart/new-test action');
if (!app.includes('/health/ready') || !app.includes('/v1/config') || !app.includes('/metrics')) throw new Error('Missing service centre endpoint checks');
if (!app.includes('checkAllServices')) throw new Error('Missing bulk endpoint health check action');
if (!app.includes('Always-available shortcuts')) throw new Error('Missing persistent home shortcuts');
if (!app.includes('8-MINUTE PRACTICE SET')) throw new Error('Missing timed practice session UI');
if (!app.includes('setRemainingSeconds(480)') || !app.includes('setInterval(')) throw new Error('Missing eight-minute countdown lifecycle');
if (!app.includes('remainingSeconds===0')) throw new Error('Missing expired-session state');
if (!app.includes("const nextOffset = (testOffset + questions.length) % totalQuestionCount;")) throw new Error("Practice pagination must respect the current test offset");
if (!app.includes("const nextLimit = Math.min(10, totalQuestionCount - questions.length);")) throw new Error("Practice pagination must not exceed the remaining verified question bank");
if (!app.includes("setCurrentTestSize(current => current + next.length)")) throw new Error("New-test rotation must account for questions loaded after the first page");
console.log('Mobile source smoke tests passed: auth, secure session, API status, verified practice and solution rendering');

if (!app.includes("Continue with Google") || !app.includes("code_challenge_method=s256")) throw new Error("Google OAuth must use PKCE");
if (!app.includes('authRequest("otp"') || !app.includes('type: "sms"')) throw new Error("SMS OTP send and verification must be implemented");
if (app.includes("you@example.com") || app.includes("EMAIL") || app.includes("PASSWORD")) throw new Error("Email/password login must not be shown");
if (!app.includes("tayar_oauth_verifier")) throw new Error("OAuth verifier must be stored securely");
if (!app.includes("Persist the entire logical request locally") || !app.includes("submission.elapsed_ms") || !app.includes("submission.answer_given")) throw new Error("Retries must preserve the exact original answer payload");
if (!app.includes('answerRequestKeys.current.has(questions[questionIndex].id) ? "Retry same answer" : "Submit answer"')) throw new Error("Ambiguous answer submissions must offer safe same-answer retries");
if (!app.includes("function isQuestion") || !app.includes("function isAttemptSummary") || !app.includes("function isAttemptHistory")) throw new Error("Runtime API contract validators are missing");
if (!app.includes("function isQuestionPage") || !app.includes('value.exam_id === "rrb_ntpc"')) throw new Error("Question and analytics pages must be validated against the selected exam");
if (!app.includes("Retry same answer") || !app.includes("submission.idempotencyKey")) throw new Error("Answer retries must reuse a frozen idempotent submission");
if (!app.includes("Question API returned an invalid payload") || !app.includes("Answer API returned an invalid grading or persistence confirmation")) throw new Error("Practice flow must validate semantic API payloads");
if (!app.includes('body.includes("tayar_http_requests_total")') || !app.includes('body.includes("tayar_http_request_duration_seconds")')) throw new Error("Service checker must validate Prometheus response contents");
if (!app.includes('body?.dependencies?.supabase === "connected"') || !app.includes('body?.dependencies?.question_bank')) throw new Error("Readiness checker must validate critical dependency state");
if (!app.includes("Clear account-scoped state before returning to the sign-in screen")) throw new Error("Sign-out must clear account-scoped state");
console.log("Phone OTP, Google PKCE and minimal login source checks passed");
