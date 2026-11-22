import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
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
  useWindowDimensions,
} from "react-native";
import * as SecureStore from "expo-secure-store";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import * as Crypto from "expo-crypto";
import { C } from "./src/theme/tokens";
import { PageHeader } from "./src/components/PageHeader";

const API_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL || "https://tayar-ai-api.onrender.com").replace(/\/+$/, "");
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

type ApiStatus = "checking" | "online" | "offline";
type AppScreen = "Today" | "Learn" | "Practice" | "Progress" | "Revision" | "Services";
type ServiceCheck = { status: "checking" | "online" | "attention"; detail: string };
type QuestionOption = string | { key?: string; label?: string; text?: string; value?: string };
type Question = { id: string; exam_id: "rrb_ntpc"; question_text: string; options: QuestionOption[]; source_document: string; source_page?: string | null; difficulty?: number | null };
type QuestionPage = { exam_id: "rrb_ntpc"; questions: Question[]; total_count: number; strategy: "baseline" | "mixed_baseline" | "weak_topic_focus"; focus_topic: { slug: string; topic: string; attempts: number; accuracy_pct: number } | null };
type AnswerFeedback = { saved: true; is_correct: boolean; answer_key: string; solution_steps: string[]; source_document?: string; source_page?: string | null };
type TopicPerformance = { slug: string; topic: string; attempts: number; accuracy_pct: number; average_time_seconds: number };
type AttemptSummary = { exam_id: "rrb_ntpc"; total_attempts: number; overall_accuracy_pct: number | null; last_5_accuracy_pct: number | null; average_time_seconds: number | null; repeat_accuracy_pct: number | null; recent_attempts: number; weakest_topic: TopicPerformance | null; topic_performance: TopicPerformance[] };
type AttemptHistoryItem = { question_id: string; question_text: string; topic: string; is_correct: boolean; answer_given: string | null; elapsed_ms: number | null; created_at: string | null; source_document: string | null; source_page: string | null };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isQuestion(value: unknown): value is Question {
  if (!isRecord(value)) return false;
  const options = value.options;
  return value.exam_id === "rrb_ntpc" && typeof value.id === "string" && value.id.length > 0
    && typeof value.question_text === "string" && value.question_text.trim().length > 0
    && Array.isArray(options) && options.length === 4
    && options.every((option) => typeof option === "string" && option.trim().length > 0
      || isRecord(option) && [option.label, option.text, option.value, option.key].some((part) => typeof part === "string" && part.trim().length > 0))
    && typeof value.source_document === "string" && value.source_document.trim().length > 0
    && typeof value.source_page === "string" && value.source_page.trim().length > 0
    && !("answer_key" in value);
}

function isQuestionPage(value: unknown): value is QuestionPage {
  if (!isRecord(value) || value.exam_id !== "rrb_ntpc" || !Array.isArray(value.questions)
    || value.questions.length === 0 || !value.questions.every(isQuestion)
    || !Number.isInteger(value.total_count) || Number(value.total_count) < value.questions.length
    || !["baseline", "mixed_baseline", "weak_topic_focus"].includes(String(value.strategy))) return false;
  return value.focus_topic === null || isRecord(value.focus_topic)
    && typeof value.focus_topic.slug === "string" && typeof value.focus_topic.topic === "string"
    && Number.isInteger(value.focus_topic.attempts) && Number(value.focus_topic.attempts) >= 0
    && typeof value.focus_topic.accuracy_pct === "number"
    && value.focus_topic.accuracy_pct >= 0 && value.focus_topic.accuracy_pct <= 100;
}

function isTopicPerformance(value: unknown): value is TopicPerformance {
  return isRecord(value) && typeof value.slug === "string" && typeof value.topic === "string"
    && Number.isInteger(value.attempts) && Number(value.attempts) >= 0
    && typeof value.accuracy_pct === "number" && value.accuracy_pct >= 0 && value.accuracy_pct <= 100
    && typeof value.average_time_seconds === "number" && value.average_time_seconds >= 0;
}

function isAttemptSummary(value: unknown): value is AttemptSummary {
  if (!isRecord(value)) return false;
  const validPercent = (part: unknown) => part === null || typeof part === "number" && part >= 0 && part <= 100;
  return value.exam_id === "rrb_ntpc" && Number.isInteger(value.total_attempts) && Number(value.total_attempts) >= 0
    && validPercent(value.overall_accuracy_pct) && validPercent(value.last_5_accuracy_pct)
    && validPercent(value.repeat_accuracy_pct)
    && (value.average_time_seconds === null || typeof value.average_time_seconds === "number" && value.average_time_seconds >= 0)
    && Number.isInteger(value.recent_attempts) && Number(value.recent_attempts) >= 0
    && (value.weakest_topic === null || isTopicPerformance(value.weakest_topic))
    && Array.isArray(value.topic_performance) && value.topic_performance.every(isTopicPerformance);
}

function isAttemptHistory(value: unknown): value is { attempts: AttemptHistoryItem[] } {
  return isRecord(value) && value.exam_id === "rrb_ntpc" && Array.isArray(value.attempts)
    && Number.isInteger(value.limit) && Number.isInteger(value.offset)
    && value.attempts.every((item) => isRecord(item)
      && typeof item.question_id === "string" && typeof item.question_text === "string"
      && typeof item.topic === "string" && typeof item.is_correct === "boolean"
      && (item.answer_given === null || typeof item.answer_given === "string")
      && (item.elapsed_ms === null || typeof item.elapsed_ms === "number" && item.elapsed_ms >= 0)
      && (item.created_at === null || typeof item.created_at === "string")
      && (item.source_document === null || typeof item.source_document === "string")
      && (item.source_page === null || typeof item.source_page === "string")
      && !("answer_key" in item));
}

function isAnswerFeedback(value: unknown): value is AnswerFeedback {
  return isRecord(value) && value.saved === true && typeof value.is_correct === "boolean"
    && typeof value.answer_key === "string" && value.answer_key.length > 0
    && Array.isArray(value.solution_steps) && value.solution_steps.every((step) => typeof step === "string")
    && typeof value.source_document === "string" && value.source_document.length > 0;
}

export default function App() {
  const { width: viewportWidth, fontScale } = useWindowDimensions();
  const compactWidth = viewportWidth < 360;
  const pageGutter = viewportWidth < 360 ? 16 : viewportWidth < 430 ? 20 : 24;
  const contentMaxWidth = Math.min(viewportWidth, 760);
  const [screen, setScreen] = useState<AppScreen>("Today");
  const screenMotion = useRef(new Animated.Value(1)).current;
  const [serviceChecks, setServiceChecks] = useState<Record<string, ServiceCheck>>({});
  const [serviceCheckLoading, setServiceCheckLoading] = useState(false);
  const [apiStatus, setApiStatus] = useState<ApiStatus>("checking");
  const [token, setToken] = useState<string | null>(null);
  const tokenRef = useRef<string | null>(null);
  tokenRef.current = token;
  const refreshInFlight = useRef<Promise<{ accessToken: string | null; permanent: boolean }> | null>(null);
  const authConfigCache = useRef<{ url: string; anonKey: string; expiresAt: number } | null>(null);
  const sessionEpoch = useRef(0);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const otpLastSentAt = useRef<{ phone: string; at: number } | null>(null);
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
  const answerRequestKeys = useRef<Map<string, { idempotencyKey: string; answer_given: string; elapsed_ms: number }>>(new Map());
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
        if (savedRefresh) {
          try {
            const response = await apiFetch(`${API_BASE_URL}/v1/auth/refresh`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ refresh_token: savedRefresh }),
            });
            if (response.ok) {
              const data = await response.json();
              if (typeof data.access_token === "string" && data.access_token.length > 0 && typeof data.refresh_token === "string" && data.refresh_token.length > 0) {
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
        if (data.status !== "ok" || data.service !== "tayar-ai-api" || typeof data.version !== "string" || data.version.length === 0) throw new Error("Unexpected health response");
        if (active) setApiStatus("online");
      } catch {
        if (active) setApiStatus("offline");
      }
    };
    check();
    return () => { active = false; };
  }, []);

  const authConfig = async (): Promise<{ url: string; anonKey: string }> => {
    const cached = authConfigCache.current;
    if (cached && cached.expiresAt > Date.now()) return { url: cached.url, anonKey: cached.anonKey };
    const response = await apiFetch(API_BASE_URL + "/v1/config", {}, 10000);
    if (!response.ok) throw new Error("Sign-in unavailable.");
    const data = await response.json();
    if (typeof data.supabase_url !== "string" || typeof data.supabase_anon_key !== "string" || !data.supabase_url.startsWith("https://") || !data.supabase_anon_key) throw new Error("Sign-in is not configured.");
    const config = { url: data.supabase_url.replace(/\/$/, ""), anonKey: data.supabase_anon_key };
    authConfigCache.current = { ...config, expiresAt: Date.now() + 5 * 60 * 1000 };
    return config;
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
    const lastSent = otpLastSentAt.current;
    const waitMs = lastSent?.phone === normalizedPhone ? 30000 - (Date.now() - lastSent.at) : 0;
    if (waitMs > 0) { setAuthError(true); setAuthMessage("Wait " + Math.ceil(waitMs / 1000) + "s before requesting another code."); return; }
    setAuthLoading(true);
    try { await authRequest("otp", { phone: normalizedPhone, create_user: true }); otpLastSentAt.current = { phone: normalizedPhone, at: Date.now() }; setPhone(normalizedPhone); setOtpSent(true); setAuthMessage("Code sent."); }
    catch (error) { setAuthError(true); setAuthMessage(error instanceof Error ? error.message : "Could not send code."); }
    finally { setAuthLoading(false); }
  };

  const verifyOtp = async () => {
    sessionEpoch.current += 1;
    refreshInFlight.current = null;
    setAuthMessage(""); setAuthError(false);
    const normalizedOtp = otp.trim();
    if (!/^\d{4,10}$/.test(normalizedOtp)) { setAuthError(true); setAuthMessage("Enter the SMS code."); return; }
    setAuthLoading(true);
    try { const data = await authRequest("verify", { phone: phone.trim().replace(/[\s().-]/g, ""), token: normalizedOtp, type: "sms" }); await storeSession(data); }
    catch (error) { setAuthError(true); setAuthMessage(error instanceof Error ? error.message : "Code verification failed."); }
    finally { setAuthLoading(false); }
  };

  const signInWithGoogle = async () => {
    sessionEpoch.current += 1;
    refreshInFlight.current = null;
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
    sessionEpoch.current += 1;
    refreshInFlight.current = null;
    let access: string | null = null;
    try { access = await SecureStore.getItemAsync("tayar_access_token"); } catch { /* Continue local sign-out if storage is unavailable. */ }
    if (access) {
      try {
        const cfg = await authConfig();
        await apiFetch(cfg.url + "/auth/v1/logout", { method: "POST", headers: { apikey: cfg.anonKey, Authorization: "Bearer " + access } }, 5000);
      } catch { /* Local logout still proceeds during provider outages. */ }
    }
    const cleanup = await Promise.allSettled([
      SecureStore.deleteItemAsync("tayar_access_token"),
      SecureStore.deleteItemAsync("tayar_refresh_token"),
      SecureStore.deleteItemAsync("tayar_oauth_verifier"),
    ]);
    // Clear account-scoped state before returning to the sign-in screen.
    setQuestions([]);
    setQuestionIndex(0);
    setTotalQuestionCount(0);
    setTestOffset(0);
    setCurrentTestSize(0);
    setSelectedAnswer("");
    setFeedback(null);
    setHint("");
    setSummary(null);
    setAttemptHistory([]);
    setFocusTopic(null);
    setQuestionStrategy("baseline");
    setQuestionError("");
    setServiceChecks({});
    answerRequestKeys.current.clear();
    hintCache.current.clear();
    sessionDeadline.current = null;
    setRemainingSeconds(480);
    setToken(null);
    setAuthError(cleanup.some((result) => result.status === "rejected"));
    setAuthMessage(cleanup.some((result) => result.status === "rejected")
      ? "Signed out in this session, but secure storage cleanup failed. Restart the app before switching accounts."
      : "");
  };

  const refreshSession = async (): Promise<{ accessToken: string | null; permanent: boolean }> => {
    if (refreshInFlight.current) return refreshInFlight.current;
    const epoch = sessionEpoch.current;
    const pending = (async () => {
      let refreshToken: string | null = null;
      try {
        refreshToken = await SecureStore.getItemAsync("tayar_refresh_token");
      } catch {
        return { accessToken: null, permanent: false };
      }
      if (!refreshToken) return { accessToken: null, permanent: true };
      try {
        const response = await apiFetch(API_BASE_URL + "/v1/auth/refresh", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: refreshToken }),
        }, 15000);
        if (!response.ok) {
          return { accessToken: null, permanent: response.status === 400 || response.status === 401 };
        }
        const data = await response.json();
        if (epoch !== sessionEpoch.current) return { accessToken: null, permanent: true };
        if (typeof data.access_token !== "string" || !data.access_token
          || typeof data.refresh_token !== "string" || !data.refresh_token) {
          return { accessToken: null, permanent: true };
        }
        await storeSession(data);
        if (epoch !== sessionEpoch.current) {
          await Promise.allSettled([
            SecureStore.deleteItemAsync("tayar_access_token"),
            SecureStore.deleteItemAsync("tayar_refresh_token"),
          ]);
          return { accessToken: null, permanent: true };
        }
        return { accessToken: data.access_token, permanent: false };
      } catch {
        return { accessToken: null, permanent: false };
      }
    })();
    refreshInFlight.current = pending;
    try {
      return await pending;
    } finally {
      if (refreshInFlight.current === pending) refreshInFlight.current = null;
    }
  };

  const authenticatedFetch = async (
    url: string,
    init: Parameters<typeof fetch>[1] = {},
    timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
  ): Promise<Response> => {
    const requestEpoch = sessionEpoch.current;
    const currentToken = tokenRef.current || await SecureStore.getItemAsync("tayar_access_token");
    if (!currentToken) return apiFetch(url, init, timeoutMs);
    const withToken = (accessToken: string) => {
      const headers = new Headers(init.headers);
      headers.set("Authorization", "Bearer " + accessToken);
      return { ...init, headers };
    };
    const response = await apiFetch(url, withToken(currentToken), timeoutMs);
    if (response.status !== 401) return response;
    const refreshed = await refreshSession();
    if (!refreshed.accessToken) {
      if (refreshed.permanent && requestEpoch === sessionEpoch.current) await signOut();
      return response;
    }
    if (requestEpoch !== sessionEpoch.current) return response;
    const retried = await apiFetch(url, withToken(refreshed.accessToken), timeoutMs);
    if (retried.status === 401 && requestEpoch === sessionEpoch.current) await signOut();
    return retried;
  };

  useEffect(() => {
    screenMotion.setValue(0.94);
    Animated.spring(screenMotion, { toValue: 1, friction: 8, tension: 75, useNativeDriver: true }).start();
  }, [screen]);

  useEffect(() => {
    if (!token) return;
    let active = true;
    const loadQuestions = async () => {
      setQuestionLoading(true);
      setQuestionError("");
      try {
        const response = await authenticatedFetch(API_BASE_URL + "/v1/questions?exam_id=rrb_ntpc&limit=10&offset=0", { headers: { Authorization: "Bearer " + token } });
        const data: unknown = await response.json().catch(() => null);
        if (!response.ok) throw new Error(isRecord(data) && typeof data.detail === "string" ? data.detail : "Unable to load verified questions.");
        if (!isQuestionPage(data)) throw new Error("Question API returned an invalid payload or incomplete source attribution.");
        if (active) {
          setQuestions(data.questions);
          setQuestionIndex(0);
          setTestOffset(0);
          setCurrentTestSize(data.questions.length);
          setTotalQuestionCount(data.total_count);
          setQuestionStrategy(data.strategy);
          setFocusTopic(data.focus_topic);
        }
      } catch (error) {
        if (active) setQuestionError(error instanceof Error ? error.message : "Unable to load verified questions.");
      } finally {
        if (active) setQuestionLoading(false);
      }
    };
    loadQuestions();
    return () => { active = false; };
  }, [Boolean(token)]);

  useEffect(() => {
    if (!token) return;
    let active = true;
    const loadSummary = async () => {
      try {
        const response = await authenticatedFetch(API_BASE_URL + "/v1/attempts/summary", {
          headers: { Authorization: "Bearer " + token },
        });
        if (!response.ok) throw new Error("Attempt summary is not available yet.");
        const data: unknown = await response.json().catch(() => null);
        if (!isAttemptSummary(data)) throw new Error("Analytics API returned an invalid summary payload.");
        if (active) setSummary(data);
      } catch {
        if (active) setSummary(null);
      }
    };
    loadSummary();
    return () => { active = false; };
  }, [Boolean(token)]);

  useEffect(() => {
    if (!token) { setAttemptHistory([]); return; }
    let active = true;
    const loadHistory = async () => {
      setHistoryLoading(true);
      try {
        const response = await authenticatedFetch(API_BASE_URL + "/v1/attempts/history?exam_id=rrb_ntpc&limit=20&offset=0", {
          headers: { Authorization: "Bearer " + token },
        });
        if (!response.ok) throw new Error("Attempt history is not available.");
        const data: unknown = await response.json().catch(() => null);
        if (!isAttemptHistory(data)) throw new Error("History API returned an invalid payload.");
        if (active) setAttemptHistory(data.attempts);
      } catch {
        if (active) setAttemptHistory([]);
      } finally {
        if (active) setHistoryLoading(false);
      }
    };
    loadHistory();
    return () => { active = false; };
  }, [Boolean(token)]);

  useEffect(() => {
    sessionDeadline.current = null;
    setRemainingSeconds(480);
  }, [Boolean(token)]);

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
  }, [Boolean(token), questions.length]);

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
          <ScrollView contentContainerStyle={[s.authPage,{paddingHorizontal:pageGutter,width:"100%",maxWidth:520,alignSelf:"center"}]} keyboardShouldPersistTaps="handled">
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
                  <TouchableOpacity accessibilityRole="button" onPress={() => {setOtpSent(false);setOtp("");setAuthMessage("");setAuthError(false);}} style={s.modeSwitch}><Text style={s.modeText}>Change number</Text></TouchableOpacity>
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
    if (remainingSeconds <= 0 && !answerRequestKeys.current.has(question.id)) {
      setQuestionError("This 8-minute practice set has ended. Restart the set to continue.");
      return;
    }
    setAnswerLoading(true);
    setQuestionError("");
    try {
      // Persist the entire logical request locally so retries after a lost response
      // reuse both the idempotency key and the exact original payload.
      let submission = answerRequestKeys.current.get(question.id);
      if (!submission) {
        submission = {
          idempotencyKey: createIdempotencyKey(),
          answer_given: selectedAnswer,
          elapsed_ms: Math.max(0, Date.now() - questionStartedAt.current),
        };
        answerRequestKeys.current.set(question.id, submission);
      } else if (submission.answer_given !== selectedAnswer) {
        setQuestionError("A previous submission may already have been saved. Retry the same answer to confirm it before changing your response.");
        return;
      }
      const response = await authenticatedFetch(API_BASE_URL + "/v1/questions/" + question.id + "/answer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
          "Idempotency-Key": submission.idempotencyKey,
        },
        body: JSON.stringify({
          answer_given: submission.answer_given,
          elapsed_ms: submission.elapsed_ms,
        }),
      });
      const data: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        if (response.status === 401) {
          await signOut();
          throw new Error("Your session expired. Please sign in again.");
        }
        throw new Error(isRecord(data) && typeof data.detail === "string" ? data.detail : "Unable to submit this answer.");
      }
      if (!isAnswerFeedback(data)) throw new Error("Answer API returned an invalid grading or persistence confirmation.");
      answerRequestKeys.current.delete(question.id);
      setFeedback(data);
      try {
        // Fetch independent analytics endpoints concurrently to reduce post-answer wait time.
        const [summaryResponse, historyResponse] = await Promise.all([
          authenticatedFetch(API_BASE_URL + "/v1/attempts/summary", {
            headers: { Authorization: "Bearer " + token },
          }),
          authenticatedFetch(API_BASE_URL + "/v1/attempts/history?exam_id=rrb_ntpc&limit=20&offset=0", {
            headers: { Authorization: "Bearer " + token },
          }),
        ]);
        if (summaryResponse.ok) {
          const summaryData: unknown = await summaryResponse.json().catch(() => null);
          if (isAttemptSummary(summaryData)) setSummary(summaryData);
        }
        if (historyResponse.ok) {
          const historyData: unknown = await historyResponse.json().catch(() => null);
          if (isAttemptHistory(historyData)) setAttemptHistory(historyData.attempts);
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
      const response = await authenticatedFetch(API_BASE_URL + "/v1/ai/hint", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ question_id: question.id, hint_level: "nudge" }),
      });
      const data: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new Error(isRecord(data) && typeof data.detail === "string" ? data.detail : "Hint is temporarily unavailable.");
      if (!isRecord(data) || typeof data.hint !== "string" || data.hint.trim().length === 0
        || !(data.provider === null || typeof data.provider === "string")) {
        throw new Error("Hint API returned an invalid payload.");
      }
      const resolvedHint = data.hint;
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
    if (totalQuestionCount <= 0 || questions.length >= totalQuestionCount) {
      setQuestionError("You've reached the end of the currently published verified questions in this set.");
      return;
    }
    setQuestionLoading(true);
    setQuestionError("");
    try {
      // Paginate relative to this test's starting offset, not the absolute number
      // of questions loaded into memory. Cap the final page to the remaining bank.
      const nextOffset = (testOffset + questions.length) % totalQuestionCount;
      const nextLimit = Math.min(10, totalQuestionCount - questions.length);
      const response = await authenticatedFetch(API_BASE_URL + "/v1/questions?exam_id=rrb_ntpc&limit=" + nextLimit + "&offset=" + nextOffset, { headers: { Authorization: "Bearer " + token } });
      const data: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new Error(isRecord(data) && typeof data.detail === "string" ? data.detail : "Unable to load more questions.");
      if (!isQuestionPage(data)) throw new Error("Question API returned an invalid payload or incomplete source attribution.");
      const next = data.questions;
      setTotalQuestionCount(data.total_count);
      setQuestionStrategy(data.strategy);
      setFocusTopic(data.focus_topic);
      if (next.length) {
        setQuestions(current => [...current, ...next]);
        setCurrentTestSize(current => current + next.length);
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
    if (!token || questionLoading || answerLoading) return;
    const unresolvedQuestionIndex = questions.findIndex((item) => answerRequestKeys.current.has(item.id));
    if (unresolvedQuestionIndex >= 0) {
      const unresolvedQuestion = questions[unresolvedQuestionIndex];
      const pending = answerRequestKeys.current.get(unresolvedQuestion.id);
      setScreen("Practice");
      setQuestionIndex(unresolvedQuestionIndex);
      if (pending) setSelectedAnswer(pending.answer_given);
      setQuestionError("Confirm the pending answer using “Retry same answer” before starting another set.");
      return;
    }
    setScreen("Practice"); setQuestionLoading(true); setQuestionError("");
    try {
      const nextOffset = totalQuestionCount > 0 ? (testOffset + currentTestSize) % totalQuestionCount : 0;
      const response = await authenticatedFetch(API_BASE_URL + "/v1/questions?exam_id=rrb_ntpc&limit=10&offset=" + nextOffset, { headers: { Authorization: "Bearer " + token } });
      const data: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new Error(isRecord(data) && typeof data.detail === "string" ? data.detail : "Unable to start a new test.");
      if (!isQuestionPage(data)) throw new Error("Question API returned an invalid payload or incomplete source attribution.");
      const nextQuestions = data.questions;
      setQuestions(nextQuestions); setQuestionIndex(0);
      setTestOffset(nextOffset); setCurrentTestSize(nextQuestions.length);
      setTotalQuestionCount(data.total_count);
      setQuestionStrategy(data.strategy); setFocusTopic(data.focus_topic);
      if (nextQuestions.length === 0) throw new Error("No additional verified questions are available in this test cycle.");
      setSelectedAnswer(""); setFeedback(null); setHint(""); sessionDeadline.current = Date.now() + 480000;
      setRemainingSeconds(480); questionStartedAt.current = Date.now();
    } catch (error) { setQuestionError(error instanceof Error ? error.message : "Unable to start a new test."); }
    finally { setQuestionLoading(false); }
  };

  const checkService = async (key: string, path: string) => {
    setServiceChecks(current => ({ ...current, [key]: { status: "checking", detail: "Checking endpoint contract…" } }));
    try {
      const response = await (token ? authenticatedFetch(API_BASE_URL + path, { headers: { Authorization: "Bearer " + token } }, 12000) : apiFetch(API_BASE_URL + path, {}, 12000));
      let healthy = false;
      let detail = `HTTP ${response.status} · request failed`;

      if (!response.ok) {
        const notReady = path === "/health/ready" && response.status === 503;
        detail = response.status === 401
          ? "HTTP 401 · sign in to verify this protected endpoint"
          : notReady
            ? "HTTP 503 · dependency readiness check failed"
            : `HTTP ${response.status} · endpoint contract failed`;
      } else if (key === "metrics") {
        const body = await response.text();
        healthy = body.includes("tayar_http_requests_total") && body.includes("tayar_http_request_duration_seconds");
        detail = healthy ? "HTTP 200 · required Prometheus metrics are present" : "HTTP 200 · required Prometheus metrics are missing";
      } else {
        const body: any = await response.json().catch(() => null);
        if (key === "health") {
          healthy = body?.status === "ok" && body?.service === "tayar-ai-api";
          detail = healthy ? "HTTP 200 · liveness payload validated" : "HTTP 200 · unexpected liveness payload";
        } else if (key === "ready") {
          healthy = body?.status === "ready" && body?.dependencies?.supabase === "connected" && body?.dependencies?.question_bank === "available";
          detail = healthy
            ? body?.dependencies?.ai_provider_configured === false
              ? "HTTP 200 · database ready; no AI provider configured"
              : "HTTP 200 · database readiness payload validated"
            : "HTTP 200 · readiness contract failed or dependencies are not ready";
        } else if (key === "config") {
          const exams = body?.supported_exams;
          const metrics = body?.adaptive_metrics;
          healthy = Array.isArray(exams) && exams.some((exam: any) => exam?.id === "rrb_ntpc")
            && Array.isArray(metrics) && metrics.length > 0
            && typeof body?.supabase_url === "string" && body.supabase_url.startsWith("https://")
            && typeof body?.supabase_anon_key === "string" && body.supabase_anon_key.length > 0;
          detail = healthy ? "HTTP 200 · exam, adaptive metrics and auth configuration validated" : "HTTP 200 · required exam or auth configuration is missing";
        } else if (key === "questions") {
          const questions = body?.questions;
          healthy = body?.exam_id === "rrb_ntpc" && Array.isArray(questions) && questions.length === 1
            && Number.isInteger(body?.total_count) && body.total_count >= 1
            && typeof questions[0]?.question_text === "string" && questions[0].question_text.length > 0
            && typeof questions[0]?.source_document === "string" && questions[0].source_document.length > 0
            && !!questions[0]?.source_page && !("answer_key" in questions[0]);
          detail = healthy ? `HTTP 200 · verified question and source metadata validated (${body.total_count} available)` : "HTTP 200 · question payload, source attribution, count or answer-key protection failed";
        } else if (key === "summary") {
          healthy = Number.isInteger(body?.total_attempts) && Array.isArray(body?.topic_performance)
            && (body?.overall_accuracy_pct === null || (typeof body?.overall_accuracy_pct === "number" && body.overall_accuracy_pct >= 0 && body.overall_accuracy_pct <= 100))
            && body?.exam_id === "rrb_ntpc";
          detail = healthy ? "HTTP 200 · analytics schema and value ranges validated" : "HTTP 200 · analytics payload failed validation";
        } else if (key === "history") {
          const attempts = body?.attempts;
          healthy = body?.exam_id === "rrb_ntpc" && Array.isArray(attempts)
            && Number.isInteger(body?.limit) && Number.isInteger(body?.offset)
            && attempts.every((attempt: any) => typeof attempt?.question_text === "string"
              && typeof attempt?.is_correct === "boolean" && !("answer_key" in attempt));
          detail = healthy ? `HTTP 200 · history schema validated (${attempts.length} rows)` : "HTTP 200 · history payload or answer-key protection failed";
        }
      }

      setServiceChecks(current => ({ ...current, [key]: { status: healthy ? "online" : "attention", detail } }));
      if (key === "health") setApiStatus(healthy ? "online" : "offline");
    } catch {
      setServiceChecks(current => ({ ...current, [key]: { status: "attention", detail: "Network failure or invalid response · check service availability and logs" } }));
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
      <Animated.View style={{flex:1,opacity:screenMotion,transform:[{translateY:screenMotion.interpolate({inputRange:[0.94,1],outputRange:[12,0]})}]}}>
      <ScrollView style={s.contentScroll} contentContainerStyle={[s.page,{paddingHorizontal:pageGutter,width:"100%",maxWidth:contentMaxWidth,alignSelf:"center"}]} keyboardShouldPersistTaps="handled">
        <View style={s.top}>
          <View><Text style={s.brand}>TAYAR<Text style={{color:C.teal}}>.AI</Text></Text><Text style={s.kicker}>YOUR PERSONAL EXAM INTELLIGENCE</Text></View>
          <TouchableOpacity accessibilityRole="button" onPress={() => setScreen("Services")} accessibilityLabel="Open profile and settings" style={s.avatar}><Text style={{color:C.teal,fontWeight:"900",fontSize:17}}>V</Text></TouchableOpacity>
        </View>
        <ServiceStatus status={apiStatus}/>
        
        {screen === "Today" && <>
        
        <Text style={s.greeting}>{new Date().getHours()<12?"Good morning":new Date().getHours()<17?"Good afternoon":"Good evening"} 👋</Text>
        <PageHeader eyebrow="YOUR PREPARATION SPACE" title={"One step closer\nto your goal."} description="Your RRB & SSC preparation, made simpler." compact={compactWidth} />
        <View style={s.momentumCard}><View style={s.momentumIcon}><Text style={s.momentumGlyph}>✦</Text></View><View style={s.momentumCopy}><Text style={s.momentumTitle}>Your journey starts here</Text><Text style={s.momentumText}>{summary && summary.total_attempts > 0 ? `You have completed ${summary.total_attempts} answers. Keep your momentum going.` : "No pressure to know everything. Start with one short practice set and we’ll guide your next step."}</Text></View></View>
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
          <Shortcut title="View analytics" detail="Accuracy and topic trends" onPress={() => setScreen("Progress")}/>
          <Shortcut title="Revise weak topic" detail={summary?.weakest_topic?.topic || "Build your baseline first"} onPress={() => setScreen("Revision")}/>
          <Shortcut title="Check services" detail="API, readiness and metrics" onPress={() => { setScreen("Services"); checkAllServices(); }}/>
        </View>
        <Text style={s.section}>Your next best action</Text>
        <View style={s.card}>
          <Text style={s.cardTitle}>{summary?.weakest_topic ? `Review ${summary.weakest_topic.topic}` : summary && summary.total_attempts >= 10 ? "Broaden your topic coverage" : "Establish your baseline"}</Text>
          <Text style={s.body}>{summary?.weakest_topic ? `${summary.weakest_topic.topic} currently has your lowest tracked accuracy (${summary.weakest_topic.accuracy_pct}%). Review the solution steps, then revisit missed questions after a short gap.` : summary && summary.total_attempts >= 10 ? `You have logged ${summary.total_attempts} answers. Keep building accuracy and retention across the verified topic bank.` : "Complete a short timed diagnostic to establish your baseline. Practice uses source-verified questions only."}</Text>
          <TouchableOpacity accessibilityRole="button" onPress={startNewTest} style={s.secondaryButton}><Text style={s.secondaryButtonText}>Start / restart test →</Text></TouchableOpacity>
        </View>
        </>}
        {screen === "Learn" && <>
          <PageHeader eyebrow="YOUR LEARNING HUB" title="Learn at your pace." description="Start from the basics. Build confidence one topic at a time." compact={compactWidth} />
          <View style={s.learnHero}>
            <View style={s.learnBadge}><Text style={s.learnBadgeText}>START HERE</Text></View>
            <Text style={s.learnHeroTitle}>New to government exams?</Text>
            <Text style={s.learnHeroBody}>That’s okay. Begin with a short diagnostic, understand your strengths, then follow a simple study routine. You do not need to plan everything yourself.</Text>
            <TouchableOpacity accessibilityRole="button" onPress={startNewTest} activeOpacity={0.82} style={s.primaryButton}><Text style={s.primaryButtonText}>Find my starting level  →</Text></TouchableOpacity>
          </View>
          <Text style={s.section}>Choose your exam goal</Text>
          <TouchableOpacity accessibilityRole="button" onPress={() => setScreen("Practice")} activeOpacity={0.84} style={s.courseCard}>
            <View style={s.courseIcon}><Text style={s.courseGlyph}>▤</Text></View>
            <View style={s.courseCopy}><Text style={s.courseTitle}>RRB NTPC</Text><Text style={s.courseDescription}>Quantitative Aptitude · verified practice questions available now</Text><Text style={s.courseMeta}>AVAILABLE NOW  ·  START LEARNING →</Text></View>
          </TouchableOpacity>
          <View style={[s.courseCard,s.courseMuted]}><View style={s.courseIconMuted}><Text style={s.courseGlyphMuted}>▦</Text></View><View style={s.courseCopy}><Text style={s.courseTitle}>SSC CGL</Text><Text style={s.courseDescription}>Structured learning path and practice modules are being prepared.</Text><Text style={s.comingSoon}>COMING SOON</Text></View></View>
          <View style={[s.courseCard,s.courseMuted]}><View style={s.courseIconMuted}><Text style={s.courseGlyphMuted}>▦</Text></View><View style={s.courseCopy}><Text style={s.courseTitle}>SSC CHSL</Text><Text style={s.courseDescription}>A beginner-friendly course path is planned for this exam.</Text><Text style={s.comingSoon}>COMING SOON</Text></View></View>
          <Text style={s.section}>Your learning routine</Text>
          <View style={s.card}>
            {[
              {n:"01",title:"Learn one concept",detail:"Understand the method before memorising shortcuts."},
              {n:"02",title:"Try a few questions",detail:"Apply the concept with guided practice."},
              {n:"03",title:"Review every mistake",detail:"See why an answer is right and what to improve."},
              {n:"04",title:"Return and revise",detail:"Revisit difficult topics after a gap."},
            ].map((step,index)=><View key={step.n} style={s.learningStep}><View style={s.stepNumber}><Text style={s.stepNumberText}>{step.n}</Text></View><View style={s.stepCopy}><Text style={s.stepTitle}>{step.title}</Text><Text style={s.small}>{step.detail}</Text></View>{index<3&&<View style={s.stepConnector}/>}</View>)}
          </View>
          <Text style={s.section}>Learn with us in Nizamabad</Text>
          <View style={s.classroomCard}><Text style={s.classroomEyebrow}>OFFLINE + ONLINE LEARNING</Text><Text style={s.classroomTitle}>A teacher beside you. A plan in your pocket.</Text><Text style={s.classroomBody}>Use the app for daily practice and progress. Join classroom learning for guided teaching, doubt clearing and personal support at our Nizamabad coaching centre.</Text><View style={s.classroomPill}><Text style={s.classroomPillText}>NIZAMABAD · TELANGANA</Text></View></View>
        </>}
        {screen === "Practice" && <>
        <PageHeader eyebrow="RRB NTPC · QUANTITATIVE APTITUDE" title="Practice with purpose." description="Timed sets · verified questions · worked solutions" compact={compactWidth} />
        <View style={s.card}>
          <Text style={s.tag}>SOURCE-VERIFIED CONTENT</Text>
          <Text style={s.small}>{questionStrategy === "weak_topic_focus" && focusTopic ? `Adaptive focus · ${focusTopic.topic} · ${focusTopic.accuracy_pct}% recent accuracy` : questionStrategy === "mixed_baseline" && focusTopic ? `Mixed set · ${focusTopic.topic} needs attention; the verified bank is still too small for a full focused set.` : "Mixed verified practice · question focus adapts as your attempt history grows."}</Text>
          {questions.length > 0 && <>
            <View style={s.timerRow}>
              <View><Text style={s.timerCaption}>8-MINUTE PRACTICE SET</Text><Text style={[s.timerValue,remainingSeconds<=60&&{color:C.red}]}>{timerLabel}</Text></View>
              <TouchableOpacity accessibilityRole="button" onPress={() => {sessionDeadline.current=Date.now()+8*60*1000;setRemainingSeconds(480);setQuestionIndex(0);setSelectedAnswer("");setFeedback(null);setHint("");setQuestionError("");questionStartedAt.current=Date.now();}} style={s.timerReset}><Text style={s.hintButtonText}>Restart set</Text></TouchableOpacity>
            </View>
            {remainingSeconds===0&&<Text style={[s.authMessage,{color:C.red}]}>Time is up. Restart the set to continue practicing.</Text>}
          </>}
          {questionLoading && questions.length === 0 ? <ActivityIndicator color={C.teal} style={{marginTop:18}}/> :
            questionError && questions.length === 0 ? <Text style={[s.body,{marginTop:12}]}>{questionError}</Text> :
            questions.length === 0 ? <Text style={[s.body,{marginTop:12}]}>No verified active questions are published yet. This workspace will only show questions verified against the uploaded railway PDFs.</Text> :
            <>
              <Text style={s.small}>QUESTION {questionIndex + 1} OF {questions.length}</Text>
              <Text style={s.cardTitle}>{questions[questionIndex].question_text}</Text>
              {!feedback && <TouchableOpacity accessibilityRole="button" onPress={requestHint} disabled={hintLoading||!!hint} style={s.hintButton}>{hintLoading?<ActivityIndicator color={C.teal}/>:<Text style={s.hintButtonText}>{hint?"Hint used":"Need a hint?"}</Text>}</TouchableOpacity>}
              {hint!==""&&<View style={s.hintPanel}><Text style={s.tag}>HINT</Text><Text style={s.body}>{hint}</Text></View>}
              {(questions[questionIndex].options || []).map((option, idx) => {
                const raw = typeof option === "string" ? option : (option.text || option.value || option.label || option.key || "");
                const match = typeof option === "string" ? option.match(/^\s*([A-Za-z0-9]+)[.)：:]?\s*/) : null;
                const key = typeof option === "string" ? ((match || [])[1] || raw) : (option.key || option.label || String.fromCharCode(65 + idx));
                return <TouchableOpacity accessibilityRole="button" key={idx} disabled={!!feedback || answerLoading || answerRequestKeys.current.has(questions[questionIndex].id)} onPress={() => setSelectedAnswer(key)} style={[s.option,selectedAnswer===key&&s.optionSelected]}>
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
              {!feedback ? <TouchableOpacity accessibilityRole="button" disabled={!selectedAnswer||answerLoading||remainingSeconds===0} onPress={submitAnswer} style={[s.primaryButton,(!selectedAnswer||answerLoading)&&s.dimmed]}>{answerLoading?<ActivityIndicator color={C.bg}/>:<Text style={s.primaryButtonText}>{answerRequestKeys.current.has(questions[questionIndex].id) ? "Retry same answer" : "Submit answer"}</Text>}</TouchableOpacity> :
                <TouchableOpacity accessibilityRole="button" onPress={questionIndex+1<questions.length?()=>setQuestionIndex(i=>i+1):loadMoreQuestions} disabled={questionLoading} style={s.primaryButton}>{questionLoading?<ActivityIndicator color={C.bg}/>:<Text style={s.primaryButtonText}>{questionIndex+1<questions.length?"Next question":"Load more questions"}</Text>}</TouchableOpacity>}
            </>
          }
          {questionError!==""&&questions.length===0&&<Text style={[s.authMessage,{color:C.red}]}>{questionError}</Text>}
          <TouchableOpacity accessibilityRole="button" onPress={startNewTest} style={s.secondaryButton}><Text style={s.secondaryButtonText}>Start a new test / restart set ↻</Text></TouchableOpacity>
          <View style={s.crossLinks}><TouchableOpacity accessibilityRole="button" onPress={() => setScreen("Progress")} style={s.crossLink}><Text style={s.crossLinkText}>View analytics →</Text></TouchableOpacity><TouchableOpacity accessibilityRole="button" onPress={() => setScreen("Revision")} style={s.crossLink}><Text style={s.crossLinkText}>Revision plan →</Text></TouchableOpacity></View>
        </View>
        </>}
        {screen === "Progress" && <>
          <PageHeader eyebrow="YOUR GROWTH" title={"Look how far\nyou can go."} description="Real progress from your saved practice. Every attempt counts." compact={compactWidth} /><View style={s.progressWelcome}><Text style={s.progressWelcomeTitle}>{summary && summary.total_attempts > 0 ? "You are building consistency." : "Your progress story starts with one answer."}</Text><Text style={s.progressWelcomeText}>{summary && summary.total_attempts > 0 ? `${summary.total_attempts} answers recorded so far. Keep learning from every attempt.` : "Complete a short practice set to unlock your personal performance insights."}</Text></View>
          <View style={s.grid}><Metric label="OVERALL ACCURACY" value={overallAccuracy} color={C.teal}/><Metric label="LAST 5 ATTEMPTS" value={lastFiveAccuracy} color={C.blue}/><Metric label="QUESTIONS ANSWERED" value={summary?String(summary.total_attempts):"0"} color={C.teal}/><Metric label="AVG. RESPONSE TIME" value={summary?.average_time_seconds==null?"—":String(summary.average_time_seconds)+"s"} color={C.blue}/><Metric label="REPEAT ACCURACY" value={summary?.repeat_accuracy_pct==null?"—":String(summary.repeat_accuracy_pct)+"%"} color={C.amber}/></View><TouchableOpacity accessibilityRole="button" onPress={() => setScreen("Revision")} activeOpacity={0.82} style={s.revisionBanner}><View style={s.revisionIcon}><Text style={s.revisionGlyph}>↻</Text></View><View style={{flex:1}}><Text style={s.revisionTitle}>Your revision plan</Text><Text style={s.revisionText}>{summary?.weakest_topic ? `Focus on ${summary.weakest_topic.topic} next.` : "Your weak topics will appear here as you practise."}</Text></View><Text style={s.revisionArrow}>›</Text></TouchableOpacity>
          <View style={s.card}><Text style={s.cardTitle}>Topic performance</Text>{summary?.topic_performance?.length?summary.topic_performance.map(topic=><View key={topic.slug} style={s.topicRow}><View style={s.topicHeader}><Text style={s.topicName}>{topic.topic}</Text><Text style={s.topicAccuracy}>{topic.accuracy_pct}%</Text></View><View style={s.topicTrack}><View style={[s.topicFill,{width:percentWidth(topic.accuracy_pct)}]}/></View><Text style={s.small}>{topic.attempts} attempts · {topic.average_time_seconds}s average response time</Text></View>):<Text style={s.body}>Topic analytics appear after verified answers have been submitted and saved.</Text>}<Text style={[s.small,{marginTop:12}]}>Repeat accuracy is a simple signal from repeated questions, not a formal memory-retention score.</Text></View>
          <View style={s.card}>
            <View style={s.serviceHeading}><Text style={s.cardTitle}>Recent answer history</Text><TouchableOpacity accessibilityRole="button" onPress={() => { setScreen("Services"); checkService("history","/v1/attempts/history?exam_id=rrb_ntpc&limit=20&offset=0"); }}><Text style={s.crossLinkText}>Check API →</Text></TouchableOpacity></View>
            {historyLoading ? <ActivityIndicator color={C.teal} style={{marginTop:12}}/> : attemptHistory.length ? attemptHistory.slice(0,10).map((attempt,index)=><View key={attempt.question_id + "-" + index} style={s.historyRow}>
              <View style={s.serviceHeading}><Text style={[s.historyResult,{color:attempt.is_correct?C.teal:C.red}]}>{attempt.is_correct?"CORRECT":"REVIEW"}</Text><Text style={s.small}>{attempt.elapsed_ms==null?"—":(attempt.elapsed_ms/1000).toFixed(1)+"s"}</Text></View>
              <Text style={s.cardTitle}>{attempt.topic}</Text>
              <Text style={s.body}>{attempt.question_text}</Text>
              <Text style={s.small}>Your answer: {attempt.answer_given || "—"} · Source: {attempt.source_document || "verified source"}{attempt.source_page ? " · page " + attempt.source_page : ""}</Text>
            </View>) : <Text style={s.body}>Your answer history will appear here after the first saved response. If it stays empty, check service readiness and sign-in status.</Text>}
            <TouchableOpacity accessibilityRole="button" onPress={() => setScreen("Practice")} style={s.secondaryButton}><Text style={s.secondaryButtonText}>Practice again →</Text></TouchableOpacity>
          </View>
          <View style={s.crossLinks}><TouchableOpacity accessibilityRole="button" onPress={startNewTest} style={s.crossLink}><Text style={s.crossLinkText}>Practice another set →</Text></TouchableOpacity><TouchableOpacity accessibilityRole="button" onPress={() => setScreen("Revision")} style={s.crossLink}><Text style={s.crossLinkText}>Review weak topics →</Text></TouchableOpacity></View>
        </>}
        {screen === "Revision" && <>
          <PageHeader eyebrow="REVISION WORKSPACE" title="Make weak areas stronger." description="Use recorded performance to choose what to revisit." compact={compactWidth} />
          <View style={s.card}><Text style={s.tag}>CURRENT PRIORITY</Text><Text style={s.cardTitle}>{summary?.weakest_topic?summary.weakest_topic.topic:"Build a reliable baseline"}</Text><Text style={s.body}>{summary?.weakest_topic?`Tracked accuracy: ${summary.weakest_topic.accuracy_pct}% across ${summary.weakest_topic.attempts} attempts. Review worked solutions and practise again after a short gap.`:"Answer verified questions first. Once enough attempts are recorded, this page highlights your lowest-accuracy topic."}</Text><TouchableOpacity accessibilityRole="button" onPress={startNewTest} style={s.primaryButton}><Text style={s.primaryButtonText}>Start revision practice</Text></TouchableOpacity><TouchableOpacity accessibilityRole="button" onPress={() => setScreen("Progress")} style={s.secondaryButton}><Text style={s.secondaryButtonText}>See topic analytics →</Text></TouchableOpacity></View>
          <View style={s.card}><Text style={s.cardTitle}>Revision routine</Text><Text style={s.body}>1. Re-read solution steps after a mistake.</Text><Text style={s.body}>2. Attempt another verified question without looking.</Text><Text style={s.body}>3. Return after a gap and compare accuracy and time.</Text><Text style={s.small}>This is a study workflow, not a claim that formal retention is already measured.</Text></View><TouchableOpacity accessibilityRole="button" onPress={() => setScreen("Practice")} style={s.secondaryButton}><Text style={s.secondaryButtonText}>Go to practice workspace →</Text></TouchableOpacity>
        </>}
        {screen === "Services" && <>
          <PageHeader eyebrow="PROFILE & SUPPORT" title="Your space." description="Manage your learning experience and get help when needed." compact={compactWidth} /><View style={s.card}><Text style={s.cardTitle}>Tayar.ai learner account</Text><Text style={s.body}>Your practice history and progress are linked to your secure sign-in. Your answers remain private to your account.</Text><TouchableOpacity accessibilityRole="button" onPress={signOut} activeOpacity={0.82} style={s.signOutButton}><Text style={s.signOutText}>Sign out securely</Text></TouchableOpacity></View>
          <PageHeader eyebrow="SERVICE CENTRE" title="Learning services." description="Check endpoints when something feels stuck." compact={compactWidth} />
          <View style={s.card}><Text style={s.cardTitle}>Backend API</Text><Text style={s.body}>{API_BASE_URL}</Text><TouchableOpacity accessibilityRole="button" disabled={serviceCheckLoading} onPress={checkAllServices} style={s.primaryButton}>{serviceCheckLoading?<ActivityIndicator color={C.bg}/>:<Text style={s.primaryButtonText}>Test all public endpoints</Text>}</TouchableOpacity></View>
          {[
            {key:"health",label:"Liveness",path:"/health",description:"Is the API process responding?"},
            {key:"ready",label:"Readiness",path:"/health/ready",description:"Is the database dependency configured?"},
            {key:"config",label:"App configuration",path:"/v1/config",description:"Which exam and metrics are supported?"},
            {key:"metrics",label:"Prometheus metrics",path:"/metrics",description:"Request counts and response-time metrics."},
            {key:"questions",label:"Verified question bank",path:"/v1/questions?exam_id=rrb_ntpc&limit=1&offset=0",description:"Can the signed-in user retrieve published verified questions?"},
            {key:"summary",label:"Analytics summary",path:"/v1/attempts/summary?exam_id=rrb_ntpc",description:"Can the API retrieve this user's exam-specific analytics?"},
            {key:"history",label:"Attempt history",path:"/v1/attempts/history?exam_id=rrb_ntpc&limit=5&offset=0",description:"Can the API retrieve recent saved answers for this user?"},
          ].map(item=>{const result=serviceChecks[item.key];return <View key={item.key} style={s.card}><View style={s.serviceHeading}><Text style={s.cardTitle}>{item.label}</Text><Text style={[s.serviceBadge,{color:result?.status==="online"?C.teal:result?.status==="attention"?C.red:C.muted}]}>{result?.status==="online"?"ONLINE":result?.status==="attention"?"CHECK":result?.status==="checking"?"TESTING":"NOT TESTED"}</Text></View><Text style={s.body}>{item.description}</Text><Text style={s.endpoint}>{item.path}</Text>{result&&<Text style={s.small}>{result.detail}</Text>}<TouchableOpacity accessibilityRole="button" onPress={() => checkService(item.key,item.path)} style={s.secondaryButton}><Text style={s.secondaryButtonText}>Test endpoint ↻</Text></TouchableOpacity></View>})}
          <View style={s.crossLinks}><TouchableOpacity accessibilityRole="button" onPress={() => setScreen("Practice")} style={s.crossLink}><Text style={s.crossLinkText}>Back to practice →</Text></TouchableOpacity><TouchableOpacity accessibilityRole="button" onPress={() => setScreen("Progress")} style={s.crossLink}><Text style={s.crossLinkText}>Open analytics →</Text></TouchableOpacity></View>
        </>}
        <Text style={s.footer}>Small steps. Strong preparation. · Tayar.ai</Text>
      </ScrollView>
    </Animated.View>
      <View style={[s.bottomBar,{paddingBottom:Math.max(8,Math.round(8*fontScale)),paddingHorizontal:compactWidth?4:10}]}>{([{key:"Today",label:"Today",glyph:"⌂"},{key:"Learn",label:"Learn",glyph:"▤"},{key:"Practice",label:"Practice",glyph:"◎"},{key:"Progress",label:"Progress",glyph:"▥"}] as {key:AppScreen;label:string;glyph:string}[]).map(item=><TouchableOpacity key={item.key} accessibilityRole="button" accessibilityLabel={item.label} accessibilityState={{selected:screen===item.key}} onPress={()=>setScreen(item.key)} activeOpacity={0.78} style={[s.tabButton,{minWidth:48,minHeight:56}]}><View style={[s.tabIconWrap,screen===item.key&&s.tabIconActive]}><Text style={[s.tabGlyph,screen===item.key&&s.tabGlyphActive]}>{item.glyph}</Text></View><Text style={[s.tabLabel,screen===item.key&&s.tabLabelActive]}>{item.label}</Text></TouchableOpacity>)}</View>
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
  const scale = useRef(new Animated.Value(0.94)).current;
  const counter = useRef(new Animated.Value(0)).current;
  const [count,setCount] = useState(0);
  const numeric = /^-?\d+(?:\.\d+)?/.test(value) && value !== "—";
  const suffix = numeric ? value.replace(/^-?\d+(?:\.\d+)?/,"") : "";
  const target = numeric ? Number(value.match(/^-?\d+(?:\.\d+)?/)?.[0]) : 0;
  useEffect(() => {
    Animated.spring(scale,{toValue:1,friction:6,tension:90,useNativeDriver:true}).start();
    if (!numeric) return;
    counter.setValue(0);
    const listener = counter.addListener(({value:current}) => setCount(current));
    Animated.timing(counter,{toValue:target,duration:720,useNativeDriver:false}).start();
    return () => counter.removeListener(listener);
  },[value]);
  return <Animated.View style={[s.metric,{transform:[{scale}]}]}><View style={{width:7,height:7,borderRadius:4,backgroundColor:color,marginBottom:10}}/><Text style={s.metricLabel}>{label}</Text><Text style={s.metricValue}>{numeric ? Math.round(count*10)/10 + suffix : value}</Text></Animated.View>;
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
,
  contentArea:{flex:1},contentScroll:{flex:1},
  bottomBar:{flexDirection:"row",alignItems:"center",justifyContent:"space-around",paddingTop:8,paddingBottom:8,paddingHorizontal:10,backgroundColor:"#0D1729",borderTopWidth:1,borderTopColor:C.border},tabButton:{flex:1,alignItems:"center",justifyContent:"center",minHeight:54,gap:3},tabIconWrap:{width:40,height:30,borderRadius:12,alignItems:"center",justifyContent:"center"},tabIconActive:{backgroundColor:"#173C3D"},tabGlyph:{fontSize:20,color:"#8191AA",fontWeight:"700"},tabGlyphActive:{color:C.teal},tabLabel:{fontSize:10,color:"#8191AA",fontWeight:"700"},tabLabelActive:{color:C.teal,fontWeight:"900"},
  greeting:{color:C.teal,fontSize:13,fontWeight:"800",marginBottom:8},momentumCard:{flexDirection:"row",alignItems:"center",padding:15,borderRadius:19,backgroundColor:"#142B3C",borderWidth:1,borderColor:"#24505A",marginBottom:22,gap:12},momentumIcon:{width:42,height:42,borderRadius:15,backgroundColor:"#1C4550",alignItems:"center",justifyContent:"center"},momentumGlyph:{color:C.teal,fontSize:22},momentumCopy:{flex:1},momentumTitle:{color:C.text,fontSize:13,fontWeight:"900",marginBottom:5},momentumText:{color:"#B4C5D5",fontSize:11,lineHeight:17},
  learnHero:{padding:19,borderRadius:22,backgroundColor:"#1A2D4A",borderWidth:1,borderColor:"#304C70",marginBottom:24},learnBadge:{alignSelf:"flex-start",backgroundColor:"#25486A",paddingHorizontal:10,paddingVertical:6,borderRadius:8},learnBadgeText:{color:"#B8D5FF",fontSize:9,fontWeight:"900",letterSpacing:1},learnHeroTitle:{color:C.text,fontSize:19,fontWeight:"900",marginTop:18,marginBottom:8},learnHeroBody:{color:"#C1CDDE",fontSize:12,lineHeight:19},
  courseCard:{flexDirection:"row",alignItems:"center",gap:13,padding:15,borderRadius:18,backgroundColor:C.panel,borderWidth:1,borderColor:C.border,marginBottom:11},courseMuted:{opacity:.78},courseIcon:{width:48,height:48,borderRadius:16,backgroundColor:"#1B4050",alignItems:"center",justifyContent:"center"},courseGlyph:{fontSize:23,color:C.teal},courseIconMuted:{width:48,height:48,borderRadius:16,backgroundColor:C.panel2,alignItems:"center",justifyContent:"center"},courseGlyphMuted:{fontSize:21,color:C.muted},courseCopy:{flex:1},courseTitle:{color:C.text,fontSize:15,fontWeight:"900"},courseDescription:{color:C.muted,fontSize:11,lineHeight:17,marginTop:4},courseMeta:{color:C.teal,fontSize:9,fontWeight:"900",letterSpacing:.6,marginTop:9},comingSoon:{color:C.amber,fontSize:9,fontWeight:"900",letterSpacing:.8,marginTop:9},
  learningStep:{flexDirection:"row",alignItems:"center",gap:12,minHeight:62},stepNumber:{width:34,height:34,borderRadius:12,backgroundColor:"#1B4050",alignItems:"center",justifyContent:"center"},stepNumberText:{color:C.teal,fontSize:11,fontWeight:"900"},stepCopy:{flex:1},stepTitle:{color:C.text,fontSize:12,fontWeight:"800",marginBottom:3},stepConnector:{position:"absolute",left:16,top:48,width:1,height:16,backgroundColor:C.border},
  classroomCard:{padding:19,borderRadius:21,backgroundColor:"#172B3B",borderWidth:1,borderColor:"#2A4B58",marginBottom:18},classroomEyebrow:{color:C.teal,fontSize:9,fontWeight:"900",letterSpacing:1.2},classroomTitle:{color:C.text,fontSize:18,lineHeight:24,fontWeight:"900",marginTop:12,marginBottom:8},classroomBody:{color:"#B5C7D4",fontSize:12,lineHeight:19},classroomPill:{alignSelf:"flex-start",paddingHorizontal:10,paddingVertical:7,borderRadius:9,backgroundColor:"#24424D",marginTop:15},classroomPillText:{color:"#B9E8DE",fontSize:9,fontWeight:"900",letterSpacing:.8},
  progressWelcome:{padding:17,borderRadius:18,backgroundColor:"#172D3D",borderWidth:1,borderColor:"#2A4B58",marginBottom:17},progressWelcomeTitle:{color:C.text,fontSize:14,fontWeight:"900",marginBottom:6},progressWelcomeText:{color:"#B5C7D4",fontSize:11,lineHeight:17},
  revisionBanner:{flexDirection:"row",alignItems:"center",gap:12,padding:15,borderRadius:17,backgroundColor:C.panel2,borderWidth:1,borderColor:C.border,marginBottom:20},revisionIcon:{width:40,height:40,borderRadius:14,backgroundColor:"#23454C",alignItems:"center",justifyContent:"center"},revisionGlyph:{color:C.teal,fontSize:23},revisionTitle:{color:C.text,fontSize:13,fontWeight:"900"},revisionText:{color:C.muted,fontSize:11,marginTop:4},revisionArrow:{color:C.teal,fontSize:26,fontWeight:"700"},
  signOutButton:{alignItems:"center",justifyContent:"center",paddingVertical:13,borderRadius:12,borderWidth:1,borderColor:"#75414B",marginTop:16},signOutText:{color:"#FF9BA3",fontSize:12,fontWeight:"900"}
});
