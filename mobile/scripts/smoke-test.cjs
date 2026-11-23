const fs = require('fs');
const app = fs.readFileSync('App.tsx', 'utf8');
const contracts = fs.readFileSync('src/domain/contracts.ts', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const appComponent = app.slice(0, app.indexOf('\nfunction Metric('));
const sessionGateIndex = appComponent.indexOf('  if (sessionLoading) {');
const authGateIndex = appComponent.indexOf('  if (!token) {\n    return (');
const lastHookIndex = Math.max(appComponent.lastIndexOf('useEffect('), appComponent.lastIndexOf('useState('), appComponent.lastIndexOf('useRef('));
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
if (!app.includes('type AppScreen = "Today" | "Learn" | "Practice" | "Progress" | "Revision" | "Services"')) throw new Error('Missing four-tab learner navigation and secondary screens');
for (const screen of ['Today','Learn','Practice','Progress','Revision','Services']) {
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
if (!contracts.includes("export function isQuestion") || !contracts.includes("export function isAttemptSummary") || !contracts.includes("export function isAttemptHistory")) throw new Error("Shared runtime API contract validators are missing");
if (!contracts.includes("export function isQuestionPage") || !contracts.includes('value.exam_id === "rrb_ntpc"')) throw new Error("Question and analytics payloads must be validated against the selected exam");
if (!app.includes("Retry same answer") || !app.includes("submission.idempotencyKey")) throw new Error("Answer retries must reuse a frozen idempotent submission");
if (!app.includes("Question API returned an invalid payload") || !app.includes("Answer API returned an invalid grading or persistence confirmation")) throw new Error("Practice flow must validate semantic API payloads");
if (!app.includes('body.includes("tayar_http_requests_total")') || !app.includes('body.includes("tayar_http_request_duration_seconds")')) throw new Error("Service checker must validate Prometheus response contents");
if (!app.includes('body?.dependencies?.supabase === "connected"') || !app.includes('body?.dependencies?.question_bank')) throw new Error("Readiness checker must validate critical dependency state");
if (!app.includes("Clear account-scoped state before returning to the sign-in screen")) throw new Error("Sign-out must clear account-scoped state");
console.log("Phone OTP, Google PKCE and minimal login source checks passed");

if (!app.includes("const authenticatedFetch") || !app.includes("refreshSession()")) throw new Error("Authenticated requests must refresh and retry expired sessions");
const submitAnswerSource = app.slice(app.indexOf("const submitAnswer = async () => {"), app.indexOf("const requestHint = async () => {"));
if (/response\.status === 401[\s\S]*await signOut\(\)/.test(submitAnswerSource)) throw new Error("Answer submission must not force logout after a transient refresh failure; authenticatedFetch owns session cleanup");
if (!app.includes("refreshInFlight.current")) throw new Error("Session refresh must be single-flight");
if (!app.includes("sessionEpoch.current")) throw new Error("Logout must invalidate an in-flight refresh");
if (!app.includes("const verifyOtp = async () => {\n    sessionEpoch.current += 1;") || !app.includes("const signInWithGoogle = async () => {\n    sessionEpoch.current += 1;")) throw new Error("New sign-in must invalidate stale in-flight refreshes");
if (!app.includes("tokenRef.current = token") || !app.includes("const currentToken = tokenRef.current")) throw new Error("Authenticated requests must use the latest access token");
if (!app.includes("lastSent?.phone === normalizedPhone") || !app.includes("at: Date.now()")) throw new Error("OTP resend cooldown must be scoped to the destination phone");
if (!app.includes("expiresAt: Date.now() + 5 * 60 * 1000")) throw new Error("Supabase public configuration must have a short cache lifetime");
console.log("Auth resilience checks passed: refresh rotation, single-flight, logout race, token freshness and per-phone OTP cooldown");

if (!app.includes('useState<AppScreen>("Today")')) throw new Error("App must open on Today after sign-in");
for (const tab of ['label:"Today"','label:"Learn"','label:"Practice"','label:"Progress"']) if (!app.includes(tab)) throw new Error("Missing four-tab item: "+tab);
if (!app.includes('screen === "Learn"') || !app.includes('screen === "Progress"')) throw new Error("Learner and progress screens must be present");
if (!app.includes("Animated.spring(screenMotion")) throw new Error("Tab transitions must animate smoothly");
if (!app.includes("Animated.spring(scale")) throw new Error("Progress metrics must animate");
if (!app.includes("accessibilityLabel={item.label}")) throw new Error("Bottom tabs need accessible labels");
if (!app.includes("SSC CGL") || !app.includes("SSC CHSL")) throw new Error("SSC course discovery cards are missing");
if (!app.includes("NIZAMABAD · TELANGANA")) throw new Error("Nizamabad offline classroom card is missing");
console.log("Learner experience checks passed: four tabs, icons, transitions, animated metrics, beginner onboarding, RRB/SSC discovery and Nizamabad classroom");
if (!app.includes("useWindowDimensions")) throw new Error("Layouts must respond to actual device viewport changes");
if (!app.includes("layout.compactBreakpoint") || !app.includes("layout.regularBreakpoint")) throw new Error("Compact and standard phone breakpoints must use shared design tokens");
if (!app.includes("fontScale")) throw new Error("Bottom navigation must account for accessibility font scaling");
if (!app.includes("layout.contentMaxWidth") || !app.includes("layout.comfortableReadingWidth")) throw new Error("Content columns must use shared width tokens");
if (!app.includes("layout.minimumTouchTarget") || !app.includes("layout.minimumTabHeight")) throw new Error("Bottom navigation touch targets must use shared accessible-size tokens");
console.log("Responsive layout checks passed: compact phones, font scale, constrained wide layouts and touch target sizing");
const touchableTags = [...app.matchAll(/<TouchableOpacity\b[^>]*>/gs)].map(([tag]) => tag);
if (touchableTags.length === 0) throw new Error("No interactive touch surfaces found; accessibility audit must not pass vacuously");
const missingButtonRole = touchableTags.filter((tag) => !/\baccessibilityRole="button"/.test(tag));
if (missingButtonRole.length > 0) {
  throw new Error("Found " + missingButtonRole.length + " TouchableOpacity elements without accessibilityRole=button out of " + touchableTags.length);
}
console.log("Accessibility checks passed: " + touchableTags.length + " touch surfaces expose button semantics");

if (!app.includes('from "./src/theme/tokens"')) throw new Error("App must consume the shared design token module");
const theme = fs.readFileSync('src/theme/tokens.ts', 'utf8');
for (const token of ['background', 'surfaceRaised', 'textPrimary', 'accentPrimary', 'spacing', 'radii', 'typography', 'layout', 'motion']) {
  if (!theme.includes(token)) throw new Error("Missing shared design token group or semantic token: " + token);
}
console.log("Design system checks passed: centralized semantic colors, spacing, radii, type, layout and motion tokens");

if (!app.includes('from "./src/components/PageHeader"')) throw new Error("Learner screens must use the shared page header");
if ((app.match(/<PageHeader\b/g) || []).length !== 7) throw new Error("All seven learner screen headings must use the shared page header");
const pageHeader = fs.readFileSync('src/components/PageHeader.tsx', 'utf8');
if (!pageHeader.includes('accessibilityRole="header"') || !pageHeader.includes('titleCompact') || !pageHeader.includes("leadingContent?: ReactNode") || !pageHeader.includes("{leadingContent}")) throw new Error("Page headers must expose heading semantics, compact-phone typography and optional leading content");
console.log("Shared UI checks passed: seven screen headers use accessible responsive typography");

if ((app.match(/<SurfaceCard\b/g) || []).length !== 11 || (app.match(/<\/SurfaceCard>/g) || []).length !== 11) throw new Error("All eleven shared content cards must use SurfaceCard with balanced wrappers");
if (!app.includes('from "./src/components/SurfaceCard"')) throw new Error("App must consume the shared SurfaceCard component");
const surfaceCard = fs.readFileSync('src/components/SurfaceCard.tsx', 'utf8');
if (!surfaceCard.includes('colors.surface') || !surfaceCard.includes('radii.lg') || !surfaceCard.includes('spacing.lg')) throw new Error("SurfaceCard must use shared design tokens");
console.log("Shared surface checks passed: eleven content cards use the tokenized SurfaceCard");

if ((app.match(/<ActionButton\b/g) || []).length !== 8) throw new Error("Static learner actions must use the shared ActionButton");
if (!app.includes('from "./src/components/ActionButton"')) throw new Error("App must consume the shared ActionButton");
const actionButton = fs.readFileSync('src/components/ActionButton.tsx', 'utf8');
if (!actionButton.includes('accessibilityRole="button"') || !actionButton.includes('accessibilityLabel={accessibilityLabel || label}') || !actionButton.includes('accessibilityState')) throw new Error("ActionButton must expose accessible name and state");
console.log("Shared action checks passed: eight learner actions use accessible button variants");

if (!app.includes('from "./src/components/FormField"')) throw new Error("Auth forms must use the shared FormField component");
if ((app.match(/<FormField\b/g) || []).length !== 2) throw new Error("Phone and OTP forms must use the shared FormField component");
if (app.includes('<TextInput value={phone}') || app.includes('<TextInput value={otp}')) throw new Error("Auth screens must not bypass the shared field primitive");
const formField = fs.readFileSync('src/components/FormField.tsx', 'utf8');
for (const requirement of ['accessibilityLabel', 'accessibilityHint', 'keyboardType', 'textContentType', 'selectionColor', 'cursorColor', 'minHeight: 56', 'colors.surfaceRaised']) {
  if (!formField.includes(requirement)) throw new Error("FormField missing accessibility, platform or design requirement: " + requirement);
}
console.log("Shared form checks passed: phone and OTP fields use accessible, tokenized native inputs");

if (!app.includes('from "./src/components/ScreenContainer"')) throw new Error("App screens must use the shared ScreenContainer");
if ((app.match(/<ScreenContainer\b/g) || []).length !== 2 || (app.match(/<\/ScreenContainer>/g) || []).length !== 2) throw new Error("Auth and learner views must use balanced shared ScreenContainer wrappers");
if (/<ScrollView\b/.test(app)) throw new Error("Screens must not bypass the shared scrolling container");
const screenContainer = fs.readFileSync('src/components/ScreenContainer.tsx', 'utf8');
for (const requirement of ['keyboardShouldPersistTaps', 'keyboardDismissMode="on-drag"', 'showsVerticalScrollIndicator', 'overScrollMode="never"', 'colors.background']) {
  if (!screenContainer.includes(requirement)) throw new Error("ScreenContainer missing keyboard, scroll or theme behavior: " + requirement);
}
console.log("Shared screen layout checks passed: auth and learner views use the keyboard-safe scrolling shell");
