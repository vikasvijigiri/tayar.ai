import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as SecureStore from "expo-secure-store";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import * as Crypto from "expo-crypto";

const API_BASE_URL = "https://tayar-ai-api.onrender.com";
const DEFAULT_REQUEST_TIMEOUT_MS = 30000;

async function apiFetch(
  url: string,
  init: Parameters<typeof fetch>[1] = {},
  timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

// This key is an idempotency identifier, not an authentication secret.
function createIdempotencyKey(): string {
  return Crypto.randomUUID();
}
const C = {
  bg: "#0A1020", panel: "#121C30", panel2: "#17243B", text: "#F4F7FC",
  muted: "#9AAAC3", teal: "#53E0C1", blue: "#85A9FF", amber: "#FFC76A",
  border: "#263650", red: "#FF7D86",
};

type ApiStatus = "checking" | "online" | "offline";
type AppScreen = "Home" | "Practice" | "Analytics" | "Revision" | "Services";
type ServiceCheck = { status: "checking" | "online" | "attention"; detail: string };
type QuestionOption = string | { key?: string; label?: string; text?: string; value?: string };
type Question = { id: string; question_text: string; options: QuestionOption[]; source_document: string; source_page?: string | null; difficulty?: number | null };
type AnswerFeedback = { is_correct: boolean; answer_key: string; solution_steps: string[]; source_document?: string; source_page?: string | null };
type TopicPerformance = { slug: string; topic: string; attempts: number; accuracy_pct: number; average_time_seconds: number };
type AttemptSummary = { total_attempts: number; overall_accuracy_pct: number | null; last_5_accuracy_pct: number | null; average_time_seconds: number | null; repeat_accuracy_pct: number | null; recent_attempts: number; weakest_topic: TopicPerformance | null; topic_performance: TopicPerformance[] };
type AttemptHistoryItem = { question_id: string; question_text: string; topic: string; is_correct: boolean; answer_given: string | null; elapsed_ms: number | null; created_at: string | null; source_document: string | null; source_page: string | null };

export default function App() {
  const [screen, setScreen] = useState<AppScreen>("Home");
  const [serviceChecks, setServiceChecks] = useState<Record<string, ServiceCheck>>({});
  const [serviceCheckLoading, setServiceCheckLoading] = useState(false);
  const [apiStatus, setApiStatus] = useState<ApiStatus>("checking");
  const [token, setToken] = useState<string | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const otpLastSentAt = useRef(0);
  const [authLoading, setAuthLoading] = useState(false);
  const [authMessage, setAuthMessage] = useState("");
  const [authError, setAuthError] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [totalQuestionCount, setTotalQuestionCount] = useState(0);
  const [testOffset, setTestOffset] = useState(0);
  const [currentTestSize, setCurrentTestSize] = useState(0);
  const [questionLoading, setQuestionLoading] = useState(false);
  const [questionError, setQuestionError] = useState("");
  const [selectedAnswer, setSelectedAnswer] = useState("");
  const [answerLoading, setAnswerLoading] = useState(false);
  const [feedback, setFeedback] = useState<AnswerFeedback | null>(null);
  const [hint, setHint] = useState("");
  const [hintLoading, setHintLoading] = useState(false);
  const [summary, setSummary] = useState<AttemptSummary | null>(null);
  const [attemptHistory, setAttemptHistory] = useState<AttemptHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(480);
  const [questionStrategy, setQuestionStrategy] = useState<"baseline" | "mixed_baseline" | "weak_topic_focus">("baseline");
  const [focusTopic, setFocusTopic] = useState<{ slug: string; topic: string; attempts: number; accuracy_pct: number } | null>(null);
  const questionStartedAt = useRef(Date.now());
  const sessionDeadline = useRef<number | null>(null);
  const answerRequestKeys = useRef<Map<string, string>>(new Map());
  // Keep hint results for this app session to avoid repeated paid inference for the same question.
  const hintCache = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    let active = true;
    const restoreSession = async () => {
      try {
        const [savedAccess, savedRefresh] = await Promise.all([
          SecureStore.getItemAsync("tayar_access_token"),
          SecureStore.getItemAsync("tayar_refresh_token"),
        ]);
        if (!savedAccess) return;
        if (savedRefresh) {
          try {
            const response = await apiFetch(`${API_BASE_URL}/v1/auth/refresh`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ refresh_token: savedRefresh }),
            });
            if (response.ok) {
              const data = await response.json();
              if (data.access_token) {
                await SecureStore.setItemAsync("tayar_access_token", data.access_token);
                if (data.refresh_token) await SecureStore.setItemAsync("tayar_refresh_token", data.refresh_token);
                if (active) setToken(data.access_token);
                return;
              }
            }
            if (response.status >= 500) {
              if (active) setToken(savedAccess);
              return;
            }
            await SecureStore.deleteItemAsync("tayar_access_token");
            await SecureStore.deleteItemAsync("tayar_refresh_token");
          } catch {
            // Keep the saved access token for this launch if the refresh service is temporarily unreachable.
            if (active) setToken(savedAccess);
          }
        } else if (active) {
          setToken(savedAccess);
        }
      } finally {
        if (active) setSessionLoading(false);
      }
    };
    restoreSession().catch(() => { if (active) { setToken(null); setSessionLoading(false); } });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    const check = async () => {
      try {
        const response = await apiFetch(`${API_BASE_URL}/health`);
        if (!response.ok) throw new Error("API health check failed");
        const data = await response.json();
        if (data.status !== "ok") throw new Error("Unexpected health response");
        if (active) setApiStatus("online");
      } catch {
        if (active) setApiStatus("offline");
      }
    };
    check();
    return () => { active = false; };
  }, []);

  const authConfig = async (): Promise<{ url: string; anonKey: string }> => {
    const response = await apiFetch(API_BASE_URL + "/v1/config", {}, 10000);
    if (!response.ok) throw new Error("Sign-in unavailable.");
    const data = await response.json();
    if (typeof data.supabase_url !== "string" || typeof data.supabase_anon_key !== "string" || !data.supabase_url.startsWith("https://") || !data.supabase_anon_key) throw new Error("Sign-in is not configured.");
    return { url: data.supabase_url.replace(/\/$/, ""), anonKey: data.supabase_anon_key };
  };

  const authRequest = async (path: string, body: Record<string, unknown>) => {
    const cfg = await authConfig();
    const response = await apiFetch(cfg.url + "/auth/v1/" + path, { method: "POST", headers: { apikey: cfg.anonKey, "Content-Type": "application/json" }, body: JSON.stringify(body) }, 15000);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 429) throw new Error("Too many attempts. Try again later.");
      if (response.status === 400 || response.status === 401) throw new Error("Check your details and try again.");
      throw new Error("Sign-in failed. Try again.");
    }
    return data;
  };

  const storeSession = async (data: { access_token?: unknown; refresh_token?: unknown }) => {
    if (typeof data.access_token !== "string" || typeof data.refresh_token !== "string") throw new Error("Sign-in did not return a valid session.");
    try {
      await SecureStore.setItemAsync("tayar_refresh_token", data.refresh_token);
      await SecureStore.setItemAsync("tayar_access_token", data.access_token);
    } catch (error) {
      await SecureStore.deleteItemAsync("tayar_access_token");
      await SecureStore.deleteItemAsync("tayar_refresh_token");
      throw error;
    }
    setToken(data.access_token); setAuthMessage(""); setAuthError(false); setOtp("");
  };

  const sendOtp = async () => {
    setAuthMessage(""); setAuthError(false);
    const normalizedPhone = phone.trim().replace(/[\s().-]/g, "");
    if (!/^\+[1-9]\d{7,14}$/.test(normalizedPhone)) { setAuthError(true); setAuthMessage("Enter phone with country code, e.g. +91…"); return; }
    const waitMs = 30000 - (Date.now() - otpLastSentAt.current);
    if (waitMs > 0) { setAuthError(true); setAuthMessage("Wait " + Math.ceil(waitMs / 1000) + "s before requesting another code."); return; }
    setAuthLoading(true);
    try { await authRequest("otp", { phone: normalizedPhone, create_user: true }); otpLastSentAt.current = Date.now(); setPhone(normalizedPhone); setOtpSent(true); setAuthMessage("Code sent."); }
    catch (error) { setAuthError(true); setAuthMessage(error instanceof Error ? error.message : "Could not send code."); }
    finally { setAuthLoading(false); }
  };

  const verifyOtp = async () => {
    setAuthMessage(""); setAuthError(false);
    const normalizedOtp = otp.trim();
    if (!/^\d{4,10}$/.test(normalizedOtp)) { setAuthError(true); setAuthMessage("Enter the SMS code."); return; }
    setAuthLoading(true);
    try { const data = await authRequest("verify", { phone: phone.trim().replace(/[\s().-]/g, ""), token: normalizedOtp, type: "sms" }); await storeSession(data); }
    catch (error) { setAuthError(true); setAuthMessage(error instanceof Error ? error.message : "Code verification failed."); }
    finally { setAuthLoading(false); }
  };

  const signInWithGoogle = async () => {
    setAuthMessage(""); setAuthError(false); setAuthLoading(true);
    try {
      const cfg = await authConfig();
      const redirectTo = Linking.createURL("auth/callback");
      const random = await Crypto.getRandomBytesAsync(32);
      const verifier = Array.from(random, (byte) => byte.toString(16).padStart(2, "0")).join("");
      const digestHex = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier);
      const digestBytes = (digestHex.match(/.{2}/g) || []).map((part) => parseInt(part, 16));
      const challenge = btoa(String.fromCharCode(...digestBytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
      await SecureStore.setItemAsync("tayar_oauth_verifier", verifier);
      const authorize = cfg.url + "/auth/v1/authorize?provider=google&redirect_to=" + encodeURIComponent(redirectTo) + "&code_challenge=" + challenge + "&code_challenge_method=s256";
      const result = await WebBrowser.openAuthSessionAsync(authorize, redirectTo);
      if (result.type === "cancel" || result.type === "dismiss") { await SecureStore.deleteItemAsync("tayar_oauth_verifier"); return; }
      if (result.type !== "success") throw new Error("Google sign-in was interrupted.");
      const params = Linking.parse(result.url).queryParams || {};
      const code = typeof params.code === "string" ? params.code : null;
      if (typeof params.error_description === "string") throw new Error("Google sign-in could not be completed.");
      if (!code) throw new Error("Google sign-in returned no authorization code.");
      const savedVerifier = await SecureStore.getItemAsync("tayar_oauth_verifier");
      await SecureStore.deleteItemAsync("tayar_oauth_verifier");
      if (!savedVerifier) throw new Error("Sign-in expired. Try again.");
      await storeSession(await authRequest("token?grant_type=pkce", { auth_code: code, code_verifier: savedVerifier }));
    } catch (error) { await SecureStore.deleteItemAsync("tayar_oauth_verifier"); setAuthError(true); setAuthMessage(error instanceof Error ? error.message : "Google sign-in failed."); }
    finally { setAuthLoading(false); }
  };

    const signOut = async () => {
    const access = await SecureStore.getItemAsync("tayar_access_token");
    if (access) {
      try {
        const cfg = await authConfig();
        await apiFetch(cfg.url + "/auth/v1/logout", { method: "POST", headers: { apikey: cfg.anonKey, Authorization: "Bearer " + access } }, 5000);
      } catch { /* Local logout still succeeds during provider outages. */ }
    }
    await SecureStore.deleteItemAsync("tayar_access_token");
    await SecureStore.deleteItemAsync("tayar_refresh_token");
    await SecureStore.deleteItemAsync("tayar_oauth_verifier");
    setToken(null);
    setAuthMessage("");
    setAuthError(false);
  };

  useEffect(() => {
    if (!token) return;
    let active = true;
    const loadQuestions = async () => {
      setQuestionLoading(true);
      setQuestionError("");
      try {
        const response = await apiFetch(API_BASE_URL + "/v1/questions?exam_id=rrb_ntpc&limit=10&offset=0", { headers: { Authorization: "Bearer " + token } });
        const data = await response.json();
        if (!response.ok) throw new Error(typeof data.detail === "string" ? data.detail : "Unable to load verified questions.");
        if (active) {
          setQuestions(Array.isArray(data.questions) ? data.questions : []);
          setQuestionIndex(0);
          setTestOffset(0);
          setCurrentTestSize(Array.isArray(data.questions) ? data.questions.length : 0);
          setTotalQuestionCount(Number(data.total_count) || (Array.isArray(data.questions) ? data.questions.length : 0));
          setQuestionStrategy(data.strategy || "baseline");
          setFocusTopic(data.focus_topic || null);
        }
      } catch (error) {
        if (active) setQuestionError(error instanceof Error ? error.message : "Unable to load verified questions.");
      } finally {
        if (active) setQuestionLoading(false);
      }
    };
    loadQuestions();
    return () => { active = false; };
  }, [token]);

  useEffect(() => {
    if (!token) return;
    let active = true;
    const loadSummary = async () => {
      try {
        const response = await apiFetch(API_BASE_URL + "/v1/attempts/summary", {
          headers: { Authorization: "Bearer " + token },
        });
        if (!response.ok) throw new Error("Attempt summary is not available yet.");
        const data = await response.json();
        if (active) setSummary(data as AttemptSummary);
      } catch {
        if (active) setSummary(null);
      }
    };
    loadSummary();
    return () => { active = false; };
  }, [token]);

  useEffect(() => {
    if (!token) { setAttemptHistory([]); return; }
    let active = true;
    const loadHistory = async () => {
      setHistoryLoading(true);
      try {
        const response = await apiFetch(API_BASE_URL + "/v1/attempts/history?exam_id=rrb_ntpc&limit=20&offset=0", {
          headers: { Authorization: "Bearer " + token },
        });
        if (!response.ok) throw new Error("Attempt history is not available.");
        const data = await response.json();
        if (active) setAttemptHistory(Array.isArray(data.attempts) ? data.attempts : []);
      } catch {
        if (active) setAttemptHistory([]);
      } finally {
        if (active) setHistoryLoading(false);
      }
    };
    loadHistory();
    return () => { active = false; };
  }, [token]);

  useEffect(() => {
    sessionDeadline.current = null;
    setRemainingSeconds(480);
  }, [token]);

  useEffect(() => {
    if (!token || questions.length === 0) return;
    if (sessionDeadline.current === null) {
      sessionDeadline.current = Date.now() + 8 * 60 * 1000;
      setRemainingSeconds(480);
    }
    const tick = () => {
      const deadline = sessionDeadline.current;
      if (deadline !== null) {
        setRemainingSeconds(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [token, questions.length]);

  useEffect(() => {
    setSelectedAnswer("");
    setFeedback(null);
    setHint("");
    questionStartedAt.current = Date.now();
  }, [questionIndex]);


  if (sessionLoading) {
    return <SafeAreaView style={s.safe}><StatusBar barStyle="light-content" backgroundColor={C.bg}/><View style={s.loadingScreen}><ActivityIndicator color={C.teal} size="large"/><Text style={s.statusText}>Preparing your secure session…</Text></View></SafeAreaView>;
  }

  if (!token) {
    return (
      <SafeAreaView style={s.safe}>
        <StatusBar barStyle="light-content" backgroundColor={C.bg}/>
        <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView contentContainerStyle={s.authPage} keyboardShouldPersistTaps="handled">
            <View style={s.minimalAuth}>
              <Text style={s.brand}>TAYAR<Text style={{color:C.teal}}>.AI</Text></Text>
              <View style={s.card}>
                {!otpSent ? <>
                  <TextInput value={phone} onChangeText={setPhone} placeholder="+91 Phone number" placeholderTextColor="#71829D" keyboardType="phone-pad" autoCapitalize="none" autoCorrect={false} textContentType="telephoneNumber" accessibilityLabel="Phone number with country code" style={s.input} editable={!authLoading} onSubmitEditing={sendOtp} returnKeyType="next"/>
                  <TouchableOpacity onPress={sendOtp} disabled={authLoading} accessibilityRole="button" style={[s.primaryButton,authLoading&&s.dimmed]}>{authLoading ? <ActivityIndicator color={C.bg}/> : <Text style={s.primaryButtonText}>Continue</Text>}</TouchableOpacity>
                </> : <>
                  <TextInput value={otp} onChangeText={(value) => setOtp(value.replace(/\D/g, "").slice(0,10))} placeholder="SMS code" placeholderTextColor="#71829D" keyboardType="number-pad" autoCapitalize="none" autoCorrect={false} textContentType="oneTimeCode" accessibilityLabel="SMS verification code" style={s.input} editable={!authLoading} onSubmitEditing={verifyOtp} returnKeyType="done"/>
                  <TouchableOpacity onPress={verifyOtp} disabled={authLoading} accessibilityRole="button" style={[s.primaryButton,authLoading&&s.dimmed]}>{authLoading ? <ActivityIndicator color={C.bg}/> : <Text style={s.primaryButtonText}>Verify</Text>}</TouchableOpacity>
                  <TouchableOpacity onPress={sendOtp} disabled={authLoading} style={s.modeSwitch} accessibilityRole="button"><Text style={s.modeText}>Resend code</Text></TouchableOpacity>
                  <TouchableOpacity onPress={() => {setOtpSent(false);setOtp("");setAuthMessage("");setAuthError(false);}} style={s.modeSwitch} accessibilityRole="button"><Text style={s.modeText}>Change number</Text></TouchableOpacity>
                </>}
                <View style={s.authDivider}><View style={s.authDividerLine}/><Text style={s.authDividerText}>OR</Text><View style={s.authDividerLine}/></View>
                <TouchableOpacity onPress={signInWithGoogle} disabled={authLoading} accessibilityRole="button" style={[s.googleButton,authLoading&&s.dimmed]}><Text style={s.googleButtonText}>Continue with Google</Text></TouchableOpacity>
                {authMessage !== "" && <Text accessibilityRole="alert" style={[s.authMessage,{color:authError?C.red:C.teal}]}>{authMessage}</Text>}
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  const submitAnswer = async () => {
    const question = questions[questionIndex];
    if (!question || !selectedAnswer || !token || feedback) return;
    if (remainingSeconds <= 0) {
      setQuestionError("This 8-minute practice set has ended. Restart the set to continue.");
      return;
    }
    setAnswerLoading(true);
    setQuestionError("");
    try {
      // Reuse the same key after a timeout/network error; remove it only after a confirmed success.
      let idempotencyKey = answerRequestKeys.current.get(question.id);
      if (!idempotencyKey) {
        idempotencyKey = createIdempotencyKey();
        answerRequestKeys.current.set(question.id, idempotencyKey);
      }
      const response = await apiFetch(API_BASE_URL + "/v1/questions/" + question.id + "/answer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          answer_given: selectedAnswer,
          elapsed_ms: Math.max(0, Date.now() - questionStartedAt.current),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 401) {
          await signOut();
          throw new Error("Your session expired. Please sign in again.");
        }
        throw new Error(typeof data.detail === "string" ? data.detail : "Unable to submit this answer.");
      }
      answerRequestKeys.current.delete(question.id);
      setFeedback(data as AnswerFeedback);
      try {
        // Fetch independent analytics endpoints concurrently to reduce post-answer wait time.
        const [summaryResponse, historyResponse] = await Promise.all([
          apiFetch(API_BASE_URL + "/v1/attempts/summary", {
            headers: { Authorization: "Bearer " + token },
          }),
          apiFetch(API_BASE_URL + "/v1/attempts/history?exam_id=rrb_ntpc&limit=20&offset=0", {
            headers: { Authorization: "Bearer " + token },
          }),
        ]);
        if (summaryResponse.ok) setSummary(await summaryResponse.json() as AttemptSummary);
        if (historyResponse.ok) {
          const historyData = await historyResponse.json();
          setAttemptHistory(Array.isArray(historyData.attempts) ? historyData.attempts : []);
        }
      } catch {
        // Keep the last known summary if analytics are temporarily unavailable.
      }
    } catch (error) {
      setQuestionError(error instanceof Error ? error.message : "Unable to submit this answer.");
    } finally {
      setAnswerLoading(false);
    }
  };

  const requestHint = async () => {
    const question = questions[questionIndex];
    if (!question || !token || hintLoading || hint) return;
    const cacheKey = question.id + ":nudge";
    const cachedHint = hintCache.current.get(cacheKey);
    if (cachedHint) {
      setHint(cachedHint);
      return;
    }
    setHintLoading(true);
    setQuestionError("");
    try {
      const response = await apiFetch(API_BASE_URL + "/v1/ai/hint", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ question_id: question.id, hint_level: "nudge" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(typeof data.detail === "string" ? data.detail : "Hint is temporarily unavailable.");
      const resolvedHint = data.hint || "A verified hint is not available for this question yet.";
      hintCache.current.set(cacheKey, resolvedHint);
      setHint(resolvedHint);
    } catch (error) {
      setQuestionError(error instanceof Error ? error.message : "Hint is temporarily unavailable.");
    } finally {
      setHintLoading(false);
    }
  };

  const loadMoreQuestions = async () => {
    if (questionLoading) return;
    if (remainingSeconds <= 0) {
      setQuestionError("This 8-minute practice set has ended. Restart the set to continue.");
      return;
    }
    setQuestionLoading(true);
    setQuestionError("");
    try {
      const response = await apiFetch(API_BASE_URL + "/v1/questions?exam_id=rrb_ntpc&limit=10&offset=" + questions.length, { headers: { Authorization: "Bearer " + token } });
      const data = await response.json();
      if (!response.ok) throw new Error(typeof data.detail === "string" ? data.detail : "Unable to load more questions.");
      const next = Array.isArray(data.questions) ? data.questions as Question[] : [];
      setTotalQuestionCount(Number(data.total_count) || Math.max(totalQuestionCount, questions.length + next.length));
      setQuestionStrategy(data.strategy || "baseline");
      setFocusTopic(data.focus_topic || null);
      if (next.length) {
        setQuestions(current => [...current, ...next]);
        setQuestionIndex(current => current + 1);
      } else {
        setQuestionError("You've reached the end of the currently published verified questions.");
      }
    } catch (error) {
      setQuestionError(error instanceof Error ? error.message : "Unable to load more questions.");
    } finally {
      setQuestionLoading(false);
    }
  };

  const startNewTest = async () => {
    if (!token || questionLoading) return;
    setScreen("Practice"); setQuestionLoading(true); setQuestionError("");
    try {
      const nextOffset = totalQuestionCount > 0 ? (testOffset + currentTestSize) % totalQuestionCount : 0;
      const response = await apiFetch(API_BASE_URL + "/v1/questions?exam_id=rrb_ntpc&limit=10&offset=" + nextOffset, { headers: { Authorization: "Bearer " + token } });
      const data = await response.json();
      if (!response.ok) throw new Error(typeof data.detail === "string" ? data.detail : "Unable to start a new test.");
      const nextQuestions = Array.isArray(data.questions) ? data.questions : [];
      setQuestions(nextQuestions); setQuestionIndex(0);
      setTestOffset(nextOffset); setCurrentTestSize(nextQuestions.length);
      setTotalQuestionCount(Number(data.total_count) || Math.max(totalQuestionCount, nextOffset + nextQuestions.length));
      setQuestionStrategy(data.strategy || "baseline"); setFocusTopic(data.focus_topic || null);
      if (nextQuestions.length === 0) throw new Error("No additional verified questions are available in this test cycle.");
      setSelectedAnswer(""); setFeedback(null); setHint(""); sessionDeadline.current = Date.now() + 480000;
      setRemainingSeconds(480); questionStartedAt.current = Date.now();
    } catch (error) { setQuestionError(error instanceof Error ? error.message : "Unable to start a new test."); }
    finally { setQuestionLoading(false); }
  };

  const checkService = async (key: string, path: string) => {
    setServiceChecks(current => ({ ...current, [key]: { status: "checking", detail: "Checking endpoint…" } }));
    try {
      const response = await apiFetch(API_BASE_URL + path, token ? { headers: { Authorization: "Bearer " + token } } : {}, 12000);
      const ok = response.ok;
      const notReady = path === "/health/ready" && response.status === 503;
      setServiceChecks(current => ({ ...current, [key]: { status: ok ? "online" : "attention", detail: response.ok ? `HTTP ${response.status} · reachable` : notReady ? "HTTP 503 · endpoint reachable, but a dependency is not ready" : `HTTP ${response.status} · check service configuration` } }));
      if (key === "health") setApiStatus(response.ok ? "online" : "offline");
    } catch {
      setServiceChecks(current => ({ ...current, [key]: { status: "attention", detail: "No response · check network or backend availability" } }));
      if (key === "health") setApiStatus("offline");
    }
  };

  const checkAllServices = async () => {
    setServiceCheckLoading(true);
    await Promise.all([checkService("health","/health"),checkService("ready","/health/ready"),checkService("config","/v1/config"),checkService("metrics","/metrics")]);
    setServiceCheckLoading(false);
  };

  const timerLabel = `${Math.floor(remainingSeconds / 60)}:${String(remainingSeconds % 60).padStart(2, "0")}`;
  const lastFiveAccuracy = summary?.last_5_accuracy_pct == null ? "—" : String(summary.last_5_accuracy_pct) + "%";
  const overallAccuracy = summary?.overall_accuracy_pct == null ? "—" : String(summary.overall_accuracy_pct) + "%";
  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg}/>
      <ScrollView contentContainerStyle={s.page}>
        <View style={s.top}>
          <View><Text style={s.brand}>TAYAR<Text style={{color:C.teal}}>.AI</Text></Text><Text style={s.kicker}>YOUR PERSONAL EXAM INTELLIGENCE</Text></View>
          <TouchableOpacity onPress={signOut} style={s.avatar}><Text style={{color:C.teal,fontWeight:"800"}}>OUT</Text></TouchableOpacity>
        </View>
        <ServiceStatus status={apiStatus}/>
        <View style={s.navigation}>{(["Home","Practice","Analytics","Revision","Services"] as AppScreen[]).map(item=><TouchableOpacity key={item} accessibilityRole="button" accessibilityState={{selected:screen===item}} onPress={() => setScreen(item)} style={[s.navigationItem,screen===item&&s.navigationActive]}><Text style={[s.navigationText,screen===item&&s.navigationTextActive]}>{item}</Text></TouchableOpacity>)}</View>
        {screen === "Home" && <>
        <Text style={s.eyebrow}>YOUR PREPARATION SPACE</Text>
        <Text style={s.heading}>Make every{"\n"}attempt count.</Text>
        <Text style={s.sub}>RRB NTPC · Adaptive practice</Text>
        <View style={s.hero}><Text style={s.label}>PRACTICE BASELINE</Text><Text style={s.heroTitle}>{summary && summary.total_attempts > 0 ? `${summary.total_attempts} answers recorded` : "Your first practice session starts the baseline"}</Text><View style={s.track}><View style={[s.fill,{width:percentWidth(summary ? Math.min(100, summary.total_attempts * 2) : 0)}]}/></View><Text style={s.small}>Progress indicator: completed answers, capped at 50 attempts. It is not an exam-readiness prediction.</Text></View>
        <Text style={s.section}>Your learning signals</Text>
        <View style={s.grid}>
          <Metric label="OVERALL ACCURACY" value={overallAccuracy} color={C.teal}/>
          <Metric label="LAST 5 ATTEMPTS" value={lastFiveAccuracy} color={C.blue}/>
          <Metric label="WEAKEST TOPIC" value={summary?.weakest_topic?.topic || "Not enough data"} color={C.amber}/>
          <Metric label="ATTEMPTS LOGGED" value={summary ? String(summary.total_attempts) : "—"} color={C.teal}/>
          <Metric label="AVG. RESPONSE TIME" value={summary?.average_time_seconds == null ? "—" : String(summary.average_time_seconds) + "s"} color={C.blue}/>
        </View>
        <Text style={s.section}>Always-available shortcuts</Text>
        <View style={s.shortcutGrid}>
          <Shortcut title="Start a new test" detail="Fresh 8-minute set" onPress={startNewTest}/>
          <Shortcut title="View analytics" detail="Accuracy and topic trends" onPress={() => setScreen("Analytics")}/>
          <Shortcut title="Revise weak topic" detail={summary?.weakest_topic?.topic || "Build your baseline first"} onPress={() => setScreen("Revision")}/>
          <Shortcut title="Check services" detail="API, readiness and metrics" onPress={() => { setScreen("Services"); checkAllServices(); }}/>
        </View>
        <Text style={s.section}>Your next best action</Text>
        <View style={s.card}>
          <Text style={s.cardTitle}>{summary?.weakest_topic ? `Review ${summary.weakest_topic.topic}` : summary && summary.total_attempts >= 10 ? "Broaden your topic coverage" : "Establish your baseline"}</Text>
          <Text style={s.body}>{summary?.weakest_topic ? `${summary.weakest_topic.topic} currently has your lowest tracked accuracy (${summary.weakest_topic.accuracy_pct}%). Review the solution steps, then revisit missed questions after a short gap.` : summary && summary.total_attempts >= 10 ? `You have logged ${summary.total_attempts} answers. Keep building accuracy and retention across the verified topic bank.` : "Complete a short timed diagnostic to establish your baseline. Practice uses source-verified questions only."}</Text>
          <TouchableOpacity onPress={startNewTest} style={s.secondaryButton}><Text style={s.secondaryButtonText}>Start / restart test →</Text></TouchableOpacity>
        </View>
        </>}
        {screen === "Practice" && <>
        <Text style={s.eyebrow}>RRB NTPC · QUANTITATIVE APTITUDE</Text>
        <Text style={s.heading}>Practice with purpose.</Text>
        <Text style={s.sub}>Timed sets · verified questions · worked solutions</Text>
        <View style={s.card}>
          <Text style={s.tag}>SOURCE-VERIFIED CONTENT</Text>
          <Text style={s.small}>{questionStrategy === "weak_topic_focus" && focusTopic ? `Adaptive focus · ${focusTopic.topic} · ${focusTopic.accuracy_pct}% recent accuracy` : questionStrategy === "mixed_baseline" && focusTopic ? `Mixed set · ${focusTopic.topic} needs attention; the verified bank is still too small for a full focused set.` : "Mixed verified practice · question focus adapts as your attempt history grows."}</Text>
          {questions.length > 0 && <>
            <View style={s.timerRow}>
              <View><Text style={s.timerCaption}>8-MINUTE PRACTICE SET</Text><Text style={[s.timerValue,remainingSeconds<=60&&{color:C.red}]}>{timerLabel}</Text></View>
              <TouchableOpacity onPress={() => {sessionDeadline.current=Date.now()+8*60*1000;setRemainingSeconds(480);setQuestionIndex(0);setSelectedAnswer("");setFeedback(null);setHint("");setQuestionError("");questionStartedAt.current=Date.now();}} style={s.timerReset}><Text style={s.hintButtonText}>Restart set</Text></TouchableOpacity>
            </View>
            {remainingSeconds===0&&<Text style={[s.authMessage,{color:C.red}]}>Time is up. Restart the set to continue practicing.</Text>}
          </>}
          {questionLoading && questions.length === 0 ? <ActivityIndicator color={C.teal} style={{marginTop:18}}/> :
            questionError && questions.length === 0 ? <Text style={[s.body,{marginTop:12}]}>{questionError}</Text> :
            questions.length === 0 ? <Text style={[s.body,{marginTop:12}]}>No verified active questions are published yet. This workspace will only show questions verified against the uploaded railway PDFs.</Text> :
            <>
              <Text style={s.small}>QUESTION {questionIndex + 1} OF {questions.length}</Text>
              <Text style={s.cardTitle}>{questions[questionIndex].question_text}</Text>
              {!feedback && <TouchableOpacity onPress={requestHint} disabled={hintLoading||!!hint} style={s.hintButton}>{hintLoading?<ActivityIndicator color={C.teal}/>:<Text style={s.hintButtonText}>{hint?"Hint used":"Need a hint?"}</Text>}</TouchableOpacity>}
              {hint!==""&&<View style={s.hintPanel}><Text style={s.tag}>HINT</Text><Text style={s.body}>{hint}</Text></View>}
              {(questions[questionIndex].options || []).map((option, idx) => {
                const raw = typeof option === "string" ? option : (option.text || option.value || option.label || option.key || "");
                const match = typeof option === "string" ? option.match(/^\s*([A-Za-z0-9]+)[.)：:]?\s*/) : null;
                const key = typeof option === "string" ? ((match || [])[1] || raw) : (option.key || option.label || String.fromCharCode(65 + idx));
                return <TouchableOpacity key={idx} disabled={!!feedback || answerLoading} onPress={() => setSelectedAnswer(key)} style={[s.option,selectedAnswer===key&&s.optionSelected]}>
                  <Text style={[s.optionText,selectedAnswer===key&&s.optionTextSelected]}>{raw}</Text>
                </TouchableOpacity>;
              })}
              {feedback && <View style={[s.feedback,{borderColor:feedback.is_correct?C.teal:C.red}]}>
                <Text style={[s.feedbackTitle,{color:feedback.is_correct?C.teal:C.red}]}>{feedback.is_correct?"Correct answer":"Not quite — review the method"}</Text>
                <Text style={s.body}>Answer: {feedback.answer_key}</Text>
                {feedback.solution_steps?.map((step,i)=><Text key={i} style={s.body}>{i+1}. {step}</Text>)}
                <Text style={s.small}>Source: {feedback.source_document}{feedback.source_page?" · page "+feedback.source_page:""}</Text>
              </View>}
              {questionError!==""&&<Text style={[s.authMessage,{color:C.red}]}>{questionError}</Text>}
              {!feedback ? <TouchableOpacity disabled={!selectedAnswer||answerLoading||remainingSeconds===0} onPress={submitAnswer} style={[s.primaryButton,(!selectedAnswer||answerLoading)&&s.dimmed]}>{answerLoading?<ActivityIndicator color={C.bg}/>:<Text style={s.primaryButtonText}>Submit answer</Text>}</TouchableOpacity> :
                <TouchableOpacity onPress={questionIndex+1<questions.length?()=>setQuestionIndex(i=>i+1):loadMoreQuestions} disabled={questionLoading} style={s.primaryButton}>{questionLoading?<ActivityIndicator color={C.bg}/>:<Text style={s.primaryButtonText}>{questionIndex+1<questions.length?"Next question":"Load more questions"}</Text>}</TouchableOpacity>}
            </>
          }
          {questionError!==""&&questions.length===0&&<Text style={[s.authMessage,{color:C.red}]}>{questionError}</Text>}
          <TouchableOpacity onPress={startNewTest} style={s.secondaryButton}><Text style={s.secondaryButtonText}>Start a new test / restart set ↻</Text></TouchableOpacity>
          <View style={s.crossLinks}><TouchableOpacity onPress={() => setScreen("Analytics")} style={s.crossLink}><Text style={s.crossLinkText}>View analytics →</Text></TouchableOpacity><TouchableOpacity onPress={() => setScreen("Revision")} style={s.crossLink}><Text style={s.crossLinkText}>Revision plan →</Text></TouchableOpacity></View>
        </View>
        </>}
        {screen === "Analytics" && <>
          <Text style={s.eyebrow}>PERFORMANCE CENTRE</Text><Text style={s.heading}>Your analytics.</Text><Text style={s.sub}>Recorded attempts only · no guessed scores</Text>
          <View style={s.grid}><Metric label="OVERALL ACCURACY" value={overallAccuracy} color={C.teal}/><Metric label="LAST 5 ATTEMPTS" value={lastFiveAccuracy} color={C.blue}/><Metric label="ATTEMPTS LOGGED" value={summary?String(summary.total_attempts):"—"} color={C.teal}/><Metric label="AVG. RESPONSE TIME" value={summary?.average_time_seconds==null?"—":String(summary.average_time_seconds)+"s"} color={C.blue}/><Metric label="REPEAT ACCURACY" value={summary?.repeat_accuracy_pct==null?"—":String(summary.repeat_accuracy_pct)+"%"} color={C.amber}/></View>
          <View style={s.card}><Text style={s.cardTitle}>Topic performance</Text>{summary?.topic_performance?.length?summary.topic_performance.map(topic=><View key={topic.slug} style={s.topicRow}><View style={s.topicHeader}><Text style={s.topicName}>{topic.topic}</Text><Text style={s.topicAccuracy}>{topic.accuracy_pct}%</Text></View><View style={s.topicTrack}><View style={[s.topicFill,{width:percentWidth(topic.accuracy_pct)}]}/></View><Text style={s.small}>{topic.attempts} attempts · {topic.average_time_seconds}s average response time</Text></View>):<Text style={s.body}>Topic analytics appear after verified answers have been submitted and saved.</Text>}<Text style={[s.small,{marginTop:12}]}>Repeat accuracy is a simple signal from repeated questions, not a formal memory-retention score.</Text></View>
          <View style={s.card}>
            <View style={s.serviceHeading}><Text style={s.cardTitle}>Recent answer history</Text><TouchableOpacity onPress={() => { setScreen("Services"); checkService("history","/v1/attempts/history?exam_id=rrb_ntpc&limit=20&offset=0"); }}><Text style={s.crossLinkText}>Check API →</Text></TouchableOpacity></View>
            {historyLoading ? <ActivityIndicator color={C.teal} style={{marginTop:12}}/> : attemptHistory.length ? attemptHistory.slice(0,10).map((attempt,index)=><View key={attempt.question_id + "-" + index} style={s.historyRow}>
              <View style={s.serviceHeading}><Text style={[s.historyResult,{color:attempt.is_correct?C.teal:C.red}]}>{attempt.is_correct?"CORRECT":"REVIEW"}</Text><Text style={s.small}>{attempt.elapsed_ms==null?"—":(attempt.elapsed_ms/1000).toFixed(1)+"s"}</Text></View>
              <Text style={s.cardTitle}>{attempt.topic}</Text>
              <Text style={s.body}>{attempt.question_text}</Text>
              <Text style={s.small}>Your answer: {attempt.answer_given || "—"} · Source: {attempt.source_document || "verified source"}{attempt.source_page ? " · page " + attempt.source_page : ""}</Text>
            </View>) : <Text style={s.body}>Your answer history will appear here after the first saved response. If it stays empty, check service readiness and sign-in status.</Text>}
            <TouchableOpacity onPress={() => setScreen("Practice")} style={s.secondaryButton}><Text style={s.secondaryButtonText}>Practice again →</Text></TouchableOpacity>
          </View>
          <View style={s.crossLinks}><TouchableOpacity onPress={startNewTest} style={s.crossLink}><Text style={s.crossLinkText}>Practice another set →</Text></TouchableOpacity><TouchableOpacity onPress={() => setScreen("Revision")} style={s.crossLink}><Text style={s.crossLinkText}>Review weak topics →</Text></TouchableOpacity></View>
        </>}
        {screen === "Revision" && <>
          <Text style={s.eyebrow}>REVISION WORKSPACE</Text><Text style={s.heading}>Make weak areas stronger.</Text><Text style={s.sub}>Use recorded performance to choose what to revisit.</Text>
          <View style={s.card}><Text style={s.tag}>CURRENT PRIORITY</Text><Text style={s.cardTitle}>{summary?.weakest_topic?summary.weakest_topic.topic:"Build a reliable baseline"}</Text><Text style={s.body}>{summary?.weakest_topic?`Tracked accuracy: ${summary.weakest_topic.accuracy_pct}% across ${summary.weakest_topic.attempts} attempts. Review worked solutions and practise again after a short gap.`:"Answer verified questions first. Once enough attempts are recorded, this page highlights your lowest-accuracy topic."}</Text><TouchableOpacity onPress={startNewTest} style={s.primaryButton}><Text style={s.primaryButtonText}>Start revision practice</Text></TouchableOpacity><TouchableOpacity onPress={() => setScreen("Analytics")} style={s.secondaryButton}><Text style={s.secondaryButtonText}>See topic analytics →</Text></TouchableOpacity></View>
          <View style={s.card}><Text style={s.cardTitle}>Revision routine</Text><Text style={s.body}>1. Re-read solution steps after a mistake.</Text><Text style={s.body}>2. Attempt another verified question without looking.</Text><Text style={s.body}>3. Return after a gap and compare accuracy and time.</Text><Text style={s.small}>This is a study workflow, not a claim that formal retention is already measured.</Text></View><TouchableOpacity onPress={() => setScreen("Practice")} style={s.secondaryButton}><Text style={s.secondaryButtonText}>Go to practice workspace →</Text></TouchableOpacity>
        </>}
        {screen === "Services" && <>
          <Text style={s.eyebrow}>SERVICE CENTRE</Text><Text style={s.heading}>Learning services.</Text><Text style={s.sub}>Check endpoints when something feels stuck.</Text>
          <View style={s.card}><Text style={s.cardTitle}>Backend API</Text><Text style={s.body}>{API_BASE_URL}</Text><TouchableOpacity disabled={serviceCheckLoading} onPress={checkAllServices} style={s.primaryButton}>{serviceCheckLoading?<ActivityIndicator color={C.bg}/>:<Text style={s.primaryButtonText}>Test all public endpoints</Text>}</TouchableOpacity></View>
          {[
            {key:"health",label:"Liveness",path:"/health",description:"Is the API process responding?"},
            {key:"ready",label:"Readiness",path:"/health/ready",description:"Is the database dependency configured?"},
            {key:"config",label:"App configuration",path:"/v1/config",description:"Which exam and metrics are supported?"},
            {key:"metrics",label:"Prometheus metrics",path:"/metrics",description:"Request counts and response-time metrics."},
            {key:"questions",label:"Verified question bank",path:"/v1/questions?exam_id=rrb_ntpc&limit=1&offset=0",description:"Can the signed-in user retrieve published verified questions?"},
            {key:"summary",label:"Analytics summary",path:"/v1/attempts/summary?exam_id=rrb_ntpc",description:"Can the API retrieve this user's exam-specific analytics?"},
            {key:"history",label:"Attempt history",path:"/v1/attempts/history?exam_id=rrb_ntpc&limit=5&offset=0",description:"Can the API retrieve recent saved answers for this user?"},
          ].map(item=>{const result=serviceChecks[item.key];return <View key={item.key} style={s.card}><View style={s.serviceHeading}><Text style={s.cardTitle}>{item.label}</Text><Text style={[s.serviceBadge,{color:result?.status==="online"?C.teal:result?.status==="attention"?C.red:C.muted}]}>{result?.status==="online"?"ONLINE":result?.status==="attention"?"CHECK":result?.status==="checking"?"TESTING":"NOT TESTED"}</Text></View><Text style={s.body}>{item.description}</Text><Text style={s.endpoint}>{item.path}</Text>{result&&<Text style={s.small}>{result.detail}</Text>}<TouchableOpacity onPress={() => checkService(item.key,item.path)} style={s.secondaryButton}><Text style={s.secondaryButtonText}>Test endpoint ↻</Text></TouchableOpacity></View>})}
          <View style={s.crossLinks}><TouchableOpacity onPress={() => setScreen("Practice")} style={s.crossLink}><Text style={s.crossLinkText}>Back to practice →</Text></TouchableOpacity><TouchableOpacity onPress={() => setScreen("Analytics")} style={s.crossLink}><Text style={s.crossLinkText}>Open analytics →</Text></TouchableOpacity></View>
        </>}
        <View style={s.nav}>{(["Home","Practice","Analytics","Revision","Services"] as AppScreen[]).map(item=><TouchableOpacity key={item} onPress={() => setScreen(item)} style={[s.navItem,screen===item&&s.active]}><Text style={{color:screen===item?C.teal:C.muted,fontWeight:"700"}}>{item}</Text></TouchableOpacity>)}</View>
        <Text style={s.footer}>Built for consistency, not empty streaks · v0.1.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function percentWidth(value:number): `${number}%` {
  return `${Math.max(0, Math.min(100, value))}%`;
}

function Shortcut({title,detail,onPress}:{title:string,detail:string,onPress:()=>void}) {
  return <TouchableOpacity accessibilityRole="button" onPress={onPress} style={s.shortcut}><Text style={s.shortcutTitle}>{title}</Text><Text style={s.shortcutDetail}>{detail}</Text></TouchableOpacity>;
}
function ServiceStatus({status}:{status:ApiStatus}) {
  return <View style={s.statusRow}><View style={[s.statusDot,{backgroundColor:status==="online"?C.teal:status==="offline"?C.red:C.amber}]}/><Text style={s.statusText}>{status==="online"?"Learning services connected":status==="offline"?"Service unavailable · retry later":"Connecting to learning services…"}</Text></View>;
}
function Metric({label,value,color}:{label:string,value:string,color:string}) {
  return <View style={s.metric}><View style={{width:7,height:7,borderRadius:4,backgroundColor:color,marginBottom:10}}/><Text style={s.metricLabel}>{label}</Text><Text style={s.metricValue}>{value}</Text></View>;
}

const s=StyleSheet.create({
  flex:{flex:1},safe:{flex:1,backgroundColor:C.bg},loadingScreen:{flex:1,alignItems:"center",justifyContent:"center",gap:14},
  authPage:{paddingHorizontal:22,paddingTop:24,paddingBottom:24,flexGrow:1,justifyContent:"center"},
  minimalAuth:{width:"100%",maxWidth:420,alignSelf:"center"},
  authDivider:{flexDirection:"row",alignItems:"center",gap:10,marginVertical:16},authDividerLine:{flex:1,height:1,backgroundColor:C.border},authDividerText:{color:C.muted,fontSize:10,fontWeight:"700"},
  googleButton:{alignItems:"center",justifyContent:"center",minHeight:48,borderRadius:12,borderWidth:1,borderColor:C.border,backgroundColor:C.panel2,paddingHorizontal:14},googleButtonText:{color:C.text,fontSize:14,fontWeight:"700"},
  brandBlock:{marginBottom:30},brand:{color:C.text,fontSize:24,fontWeight:"900",letterSpacing:1.3},kicker:{color:C.muted,fontSize:9,letterSpacing:1.2,marginTop:4,fontWeight:"700"},
  authHero:{marginBottom:22},eyebrow:{color:C.teal,fontSize:10,fontWeight:"800",letterSpacing:1.7,marginBottom:10},authTitle:{color:C.text,fontSize:31,lineHeight:37,fontWeight:"800",letterSpacing:-.6,marginBottom:12},
  body:{color:C.muted,fontSize:12,lineHeight:19},card:{padding:18,borderRadius:19,backgroundColor:C.panel,borderWidth:1,borderColor:C.border,marginBottom:20},
  section:{color:C.text,fontSize:16,fontWeight:"800",marginBottom:14},fieldLabel:{color:C.muted,fontSize:10,fontWeight:"800",letterSpacing:1,marginTop:10,marginBottom:7},
  input:{color:C.text,backgroundColor:C.bg,borderWidth:1,borderColor:C.border,borderRadius:12,paddingHorizontal:13,paddingVertical:13,fontSize:14},
  topicRow:{marginTop:13},topicHeader:{flexDirection:"row",justifyContent:"space-between",alignItems:"center"},topicName:{color:C.text,fontSize:12,fontWeight:"700"},topicAccuracy:{color:C.teal,fontSize:12,fontWeight:"800"},topicTrack:{height:5,borderRadius:8,backgroundColor:"#263650",marginTop:8,marginBottom:6,overflow:"hidden"},topicFill:{height:5,backgroundColor:C.teal,borderRadius:8},progressRow:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",paddingVertical:11,borderBottomWidth:1,borderBottomColor:C.border},progressValue:{color:C.text,fontSize:13,fontWeight:"800"},
  timerRow:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginTop:14,marginBottom:6,padding:12,borderRadius:13,backgroundColor:C.bg,borderWidth:1,borderColor:C.border},timerCaption:{color:C.muted,fontSize:9,fontWeight:"800",letterSpacing:1},timerValue:{color:C.teal,fontSize:23,fontWeight:"900",marginTop:4,fontVariant:["tabular-nums"]},timerReset:{paddingVertical:10,paddingHorizontal:12,borderRadius:10,borderWidth:1,borderColor:C.border},hintButton:{alignSelf:"flex-start",paddingVertical:9,paddingHorizontal:12,borderRadius:10,borderWidth:1,borderColor:C.border,marginTop:4,marginBottom:6},hintButtonText:{color:C.teal,fontSize:12,fontWeight:"800"},hintPanel:{padding:12,borderRadius:12,backgroundColor:C.panel2,marginTop:8,marginBottom:8,gap:6},
  option:{padding:13,borderRadius:12,borderWidth:1,borderColor:C.border,marginTop:9,backgroundColor:C.bg},optionSelected:{borderColor:C.teal,backgroundColor:"#173C3D"},optionText:{color:C.muted,fontSize:13,lineHeight:19},optionTextSelected:{color:C.text,fontWeight:"700"},feedback:{borderWidth:1,borderRadius:12,padding:13,marginTop:14,gap:6},feedbackTitle:{fontSize:13,fontWeight:"800",marginBottom:4},
  authMessage:{fontSize:12,lineHeight:18,marginTop:12},primaryButton:{backgroundColor:C.teal,borderRadius:13,paddingVertical:14,alignItems:"center",justifyContent:"center",marginTop:18,minHeight:48},primaryButtonText:{color:C.bg,fontWeight:"900",fontSize:14},dimmed:{opacity:.65},
  modeSwitch:{paddingVertical:15,alignItems:"center"},modeText:{color:C.blue,fontSize:12,fontWeight:"700"},statusRow:{flexDirection:"row",alignItems:"center",marginBottom:16},statusDot:{width:7,height:7,borderRadius:4,marginRight:8},statusText:{color:C.muted,fontSize:11},
  page:{paddingHorizontal:20,paddingTop:18,paddingBottom:30},top:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",marginBottom:20},
  avatar:{width:42,height:42,borderRadius:15,backgroundColor:C.panel2,alignItems:"center",justifyContent:"center",borderWidth:1,borderColor:C.border},
  heading:{color:C.text,fontSize:35,lineHeight:40,fontWeight:"800",letterSpacing:-1},sub:{color:C.muted,fontSize:14,marginTop:10,marginBottom:22},
  hero:{backgroundColor:C.panel,borderRadius:22,padding:18,borderWidth:1,borderColor:C.border,marginBottom:26},label:{color:C.muted,fontSize:10,letterSpacing:1.2,fontWeight:"800"},heroTitle:{color:C.text,fontSize:18,fontWeight:"700",marginTop:8},
  track:{height:6,borderRadius:8,backgroundColor:"#263650",marginTop:20,marginBottom:12,overflow:"hidden"},fill:{height:6,width:"8%",backgroundColor:C.teal},small:{color:C.muted,fontSize:11,lineHeight:16},
  grid:{flexDirection:"row",flexWrap:"wrap",justifyContent:"space-between",marginBottom:22},metric:{width:"48.2%",minHeight:122,padding:13,borderRadius:17,backgroundColor:C.panel,borderWidth:1,borderColor:C.border,marginBottom:10},
  metricLabel:{color:C.muted,fontSize:9,fontWeight:"800",letterSpacing:.5},metricValue:{color:C.text,fontSize:16,fontWeight:"800",marginTop:9,marginBottom:5},
  cardTitle:{color:C.text,fontSize:15,fontWeight:"800",marginTop:10,marginBottom:8},tag:{color:C.teal,fontSize:9,fontWeight:"900",letterSpacing:1},
  disabled:{borderRadius:12,padding:12,alignItems:"center",backgroundColor:"#202D43",marginTop:18},
  navigation:{flexDirection:"row",flexWrap:"wrap",gap:6,backgroundColor:C.panel,borderRadius:16,borderWidth:1,borderColor:C.border,padding:6,marginBottom:22},navigationItem:{flexGrow:1,paddingVertical:10,paddingHorizontal:9,alignItems:"center",borderRadius:11},navigationActive:{backgroundColor:"#173C3D"},navigationText:{color:C.muted,fontSize:10,fontWeight:"800"},navigationTextActive:{color:C.teal},
  nav:{flexDirection:"row",flexWrap:"wrap",gap:4,backgroundColor:C.panel,borderRadius:16,borderWidth:1,borderColor:C.border,padding:5,marginTop:8,marginBottom:14},navItem:{flexGrow:1,paddingVertical:12,paddingHorizontal:7,alignItems:"center",borderRadius:12},active:{backgroundColor:"#173C3D"},footer:{color:"#61728C",fontSize:10,lineHeight:16,textAlign:"center",marginTop:8},
  historyRow:{paddingVertical:12,borderBottomWidth:1,borderBottomColor:C.border,gap:5},historyResult:{fontSize:9,fontWeight:"900",letterSpacing:1},
  shortcutGrid:{flexDirection:"row",flexWrap:"wrap",justifyContent:"space-between",marginBottom:22},shortcut:{width:"48.2%",minHeight:98,padding:13,borderRadius:15,backgroundColor:C.panel,borderWidth:1,borderColor:C.border,marginBottom:10,justifyContent:"space-between"},shortcutTitle:{color:C.text,fontSize:12,fontWeight:"800"},shortcutDetail:{color:C.muted,fontSize:10,lineHeight:15,marginTop:8},secondaryButton:{borderRadius:12,borderWidth:1,borderColor:C.border,paddingVertical:12,paddingHorizontal:14,alignItems:"center",marginTop:12},secondaryButtonText:{color:C.teal,fontSize:12,fontWeight:"800"},crossLinks:{flexDirection:"row",flexWrap:"wrap",gap:10,marginBottom:18},crossLink:{paddingVertical:9,paddingHorizontal:12,borderRadius:10,backgroundColor:C.panel2},crossLinkText:{color:C.blue,fontSize:11,fontWeight:"800"},serviceHeading:{flexDirection:"row",alignItems:"center",justifyContent:"space-between"},serviceBadge:{fontSize:9,fontWeight:"900",letterSpacing:1},endpoint:{color:C.teal,fontSize:12,fontWeight:"800",marginTop:8}
});
