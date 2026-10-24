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

const API_BASE_URL = "https://tayar-ai-api.onrender.com";
const C = {
  bg: "#0A1020", panel: "#121C30", panel2: "#17243B", text: "#F4F7FC",
  muted: "#9AAAC3", teal: "#53E0C1", blue: "#85A9FF", amber: "#FFC76A",
  border: "#263650", red: "#FF7D86",
};

type ApiStatus = "checking" | "online" | "offline";
type AuthMode = "signin" | "signup";
type QuestionOption = string | { key?: string; label?: string; text?: string; value?: string };
type Question = { id: string; question_text: string; options: QuestionOption[]; source_document: string; source_page?: string | null; difficulty?: number | null };
type AnswerFeedback = { is_correct: boolean; answer_key: string; solution_steps: string[]; source_document?: string; source_page?: string | null };
type AttemptSummary = { total_attempts: number; overall_accuracy_pct: number | null; last_5_accuracy_pct: number | null; average_time_seconds: number | null; recent_attempts: number };

export default function App() {
  const [tab, setTab] = useState("Today");
  const [apiStatus, setApiStatus] = useState<ApiStatus>("checking");
  const [token, setToken] = useState<string | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMode, setAuthMode] = useState<AuthMode>("signin");
  const [authLoading, setAuthLoading] = useState(false);
  const [authMessage, setAuthMessage] = useState("");
  const [authError, setAuthError] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [questionLoading, setQuestionLoading] = useState(false);
  const [questionError, setQuestionError] = useState("");
  const [selectedAnswer, setSelectedAnswer] = useState("");
  const [answerLoading, setAnswerLoading] = useState(false);
  const [feedback, setFeedback] = useState<AnswerFeedback | null>(null);
  const [hint, setHint] = useState("");
  const [hintLoading, setHintLoading] = useState(false);
  const [summary, setSummary] = useState<AttemptSummary | null>(null);
  const questionStartedAt = useRef(Date.now());

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
            const response = await fetch(`${API_BASE_URL}/v1/auth/refresh`, {
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
        const response = await fetch(`${API_BASE_URL}/health`);
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

  const authenticate = async () => {
    setAuthMessage("");
    setAuthError(false);
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      setAuthError(true);
      setAuthMessage("Enter your email and password to continue.");
      return;
    }
    setAuthLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/v1/auth/${authMode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail, password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(typeof data.detail === "string" ? data.detail : "Authentication failed.");
      if (data.access_token) {
        await SecureStore.setItemAsync("tayar_access_token", data.access_token);
        if (data.refresh_token) await SecureStore.setItemAsync("tayar_refresh_token", data.refresh_token);
        setToken(data.access_token);
        setPassword("");
        setAuthMessage(authMode === "signup" ? "Account created. You're signed in." : "Welcome back.");
      } else {
        setAuthError(false);
        setAuthMessage("Check your email to confirm your account, then sign in.");
        setAuthMode("signin");
        setPassword("");
      }
    } catch (error) {
      setAuthError(true);
      setAuthMessage(error instanceof Error ? error.message : "Unable to connect. Please try again.");
    } finally {
      setAuthLoading(false);
    }
  };

  const signOut = async () => {
    await SecureStore.deleteItemAsync("tayar_access_token");
    await SecureStore.deleteItemAsync("tayar_refresh_token");
    setToken(null);
    setAuthMessage("You have signed out.");
    setAuthError(false);
  };

  if (sessionLoading) {
    return <SafeAreaView style={s.safe}><StatusBar barStyle="light-content" backgroundColor={C.bg}/><View style={s.loadingScreen}><ActivityIndicator color={C.teal} size="large"/><Text style={s.statusText}>Preparing your secure session…</Text></View></SafeAreaView>;
  }

  if (!token) {
    return (
      <SafeAreaView style={s.safe}>
        <StatusBar barStyle="light-content" backgroundColor={C.bg}/>
        <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView contentContainerStyle={s.authPage} keyboardShouldPersistTaps="handled">
            <View style={s.brandBlock}>
              <Text style={s.brand}>TAYAR<Text style={{color:C.teal}}>.AI</Text></Text>
              <Text style={s.kicker}>YOUR PERSONAL EXAM INTELLIGENCE</Text>
            </View>
            <View style={s.authHero}>
              <Text style={s.eyebrow}>RRB NTPC · ADAPTIVE PRACTICE</Text>
              <Text style={s.authTitle}>{authMode === "signin" ? "Your next attempt starts here." : "Build your learning profile."}</Text>
              <Text style={s.body}>Practice with verified source questions and build progress from your own attempts.</Text>
            </View>
            <View style={s.card}>
              <Text style={s.section}>{authMode === "signin" ? "Welcome back" : "Create your account"}</Text>
              <Text style={s.fieldLabel}>EMAIL</Text>
              <TextInput value={email} onChangeText={setEmail} placeholder="you@example.com" placeholderTextColor="#71829D" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} textContentType="emailAddress" style={s.input} />
              <Text style={s.fieldLabel}>PASSWORD</Text>
              <TextInput value={password} onChangeText={setPassword} placeholder="At least 8 characters" placeholderTextColor="#71829D" secureTextEntry autoCapitalize="none" textContentType={authMode === "signin" ? "password" : "newPassword"} style={s.input} onSubmitEditing={authenticate} />
              {authMessage !== "" && <Text style={[s.authMessage,{color:authError?C.red:C.teal}]}>{authMessage}</Text>}
              <TouchableOpacity onPress={authenticate} disabled={authLoading} style={[s.primaryButton,authLoading&&s.dimmed]}>
                {authLoading ? <ActivityIndicator color={C.bg}/> : <Text style={s.primaryButtonText}>{authMode === "signin" ? "Sign in securely" : "Create account"}</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={s.modeSwitch} onPress={() => {setAuthMode(authMode === "signin" ? "signup" : "signin");setAuthMessage("");setAuthError(false);}}>
                <Text style={s.modeText}>{authMode === "signin" ? "New to Tayar.ai? Create an account" : "Already have an account? Sign in"}</Text>
              </TouchableOpacity>
            </View>
            <ServiceStatus status={apiStatus}/>
            <Text style={s.footer}>Your password is sent only to the authentication endpoint over HTTPS. Session tokens are stored using Android secure storage.</Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }


  useEffect(() => {
    if (!token) return;
    let active = true;
    const loadQuestions = async () => {
      setQuestionLoading(true);
      setQuestionError("");
      try {
        const response = await fetch(API_BASE_URL + "/v1/questions?exam_id=rrb_ntpc&limit=10&offset=0");
        const data = await response.json();
        if (!response.ok) throw new Error(typeof data.detail === "string" ? data.detail : "Unable to load verified questions.");
        if (active) {
          setQuestions(Array.isArray(data.questions) ? data.questions : []);
          setQuestionIndex(0);
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
        const response = await fetch(API_BASE_URL + "/v1/attempts/summary", {
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
    setSelectedAnswer("");
    setFeedback(null);
    setHint("");
    questionStartedAt.current = Date.now();
  }, [questionIndex]);

  const submitAnswer = async () => {
    const question = questions[questionIndex];
    if (!question || !selectedAnswer || !token || feedback) return;
    setAnswerLoading(true);
    setQuestionError("");
    try {
      const response = await fetch(API_BASE_URL + "/v1/questions/" + question.id + "/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
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
      setFeedback(data as AnswerFeedback);
    } catch (error) {
      setQuestionError(error instanceof Error ? error.message : "Unable to submit this answer.");
    } finally {
      setAnswerLoading(false);
    }
  };

  const requestHint = async () => {
    const question = questions[questionIndex];
    if (!question || !token || hintLoading || hint) return;
    setHintLoading(true);
    setQuestionError("");
    try {
      const response = await fetch(API_BASE_URL + "/v1/ai/hint", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ question_id: question.id, hint_level: "nudge" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(typeof data.detail === "string" ? data.detail : "Hint is temporarily unavailable.");
      setHint(data.hint || "A verified hint is not available for this question yet.");
    } catch (error) {
      setQuestionError(error instanceof Error ? error.message : "Hint is temporarily unavailable.");
    } finally {
      setHintLoading(false);
    }
  };

  const loadMoreQuestions = async () => {
    if (questionLoading) return;
    setQuestionLoading(true);
    setQuestionError("");
    try {
      const response = await fetch(API_BASE_URL + "/v1/questions?exam_id=rrb_ntpc&limit=10&offset=" + questions.length);
      const data = await response.json();
      if (!response.ok) throw new Error(typeof data.detail === "string" ? data.detail : "Unable to load more questions.");
      const next = Array.isArray(data.questions) ? data.questions as Question[] : [];
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
        <Text style={s.eyebrow}>YOUR PREPARATION SPACE</Text>
        <Text style={s.heading}>Make every{"\n"}attempt count.</Text>
        <Text style={s.sub}>RRB NTPC · Adaptive practice</Text>
        <View style={s.hero}><Text style={s.label}>READINESS INDEX</Text><Text style={s.heroTitle}>{summary && summary.total_attempts > 0 ? "Your baseline is taking shape" : "Building your baseline"}</Text><View style={s.track}><View style={s.fill}/></View><Text style={s.small}>Complete verified practice sessions to unlock personalised insights.</Text></View>
        <Text style={s.section}>Your learning signals</Text>
        <View style={s.grid}>
          <Metric label="OVERALL ACCURACY" value={overallAccuracy} color={C.teal}/>
          <Metric label="LAST 5 ATTEMPTS" value={lastFiveAccuracy} color={C.blue}/>
          <Metric label="WEAKNESS RADAR" value="Not enough data" color={C.amber}/>
          <Metric label="ATTEMPTS LOGGED" value={summary ? String(summary.total_attempts) : "—"} color={C.teal}/>
          <Metric label="AVG. RESPONSE TIME" value={summary?.average_time_seconds == null ? "—" : String(summary.average_time_seconds) + "s"} color={C.blue}/>
        </View>
        <Text style={s.section}>Your next best action</Text>
        <View style={s.card}><Text style={s.cardTitle}>Establish your baseline</Text><Text style={s.body}>A short diagnostic identifies topics needing attention first. Practice will use verified source material only.</Text></View>
        <Text style={s.section}>Practice workspace</Text>
        <View style={s.card}>
          <Text style={s.tag}>SOURCE-VERIFIED CONTENT</Text>
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
              {!feedback ? <TouchableOpacity disabled={!selectedAnswer||answerLoading} onPress={submitAnswer} style={[s.primaryButton,(!selectedAnswer||answerLoading)&&s.dimmed]}>{answerLoading?<ActivityIndicator color={C.bg}/>:<Text style={s.primaryButtonText}>Submit answer</Text>}</TouchableOpacity> :
                <TouchableOpacity onPress={questionIndex+1<questions.length?()=>setQuestionIndex(i=>i+1):loadMoreQuestions} disabled={questionLoading} style={s.primaryButton}>{questionLoading?<ActivityIndicator color={C.bg}/>:<Text style={s.primaryButtonText}>{questionIndex+1<questions.length?"Next question":"Load more questions"}</Text>}</TouchableOpacity>}
            </>
          }
          {questionError!==""&&questions.length===0&&<Text style={[s.authMessage,{color:C.red}]}>{questionError}</Text>}
        </View>
        <View style={s.nav}>{["Today","Topics","Progress"].map(x=><TouchableOpacity key={x} onPress={()=>setTab(x)} style={[s.navItem,tab===x&&s.active]}><Text style={{color:tab===x?C.teal:C.muted,fontWeight:"700"}}>{x}</Text></TouchableOpacity>)}</View>
        {tab!=="Today"&&<View style={s.card}><Text style={s.cardTitle}>{tab==="Topics"?"Topic mastery":"Progress history"}</Text><Text style={s.body}>This view will populate from verified question attempts. No performance is fabricated.</Text></View>}
        <Text style={s.footer}>Built for consistency, not empty streaks · v0.1.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function ServiceStatus({status}:{status:ApiStatus}) {
  return <View style={s.statusRow}><View style={[s.statusDot,{backgroundColor:status==="online"?C.teal:status==="offline"?C.red:C.amber}]}/><Text style={s.statusText}>{status==="online"?"Learning services connected":status==="offline"?"Service unavailable · retry later":"Connecting to learning services…"}</Text></View>;
}
function Metric({label,value,color}:{label:string,value:string,color:string}) {
  return <View style={s.metric}><View style={{width:7,height:7,borderRadius:4,backgroundColor:color,marginBottom:10}}/><Text style={s.metricLabel}>{label}</Text><Text style={s.metricValue}>{value}</Text><Text style={s.small}>Awaiting practice</Text></View>;
}

const s=StyleSheet.create({
  flex:{flex:1},safe:{flex:1,backgroundColor:C.bg},loadingScreen:{flex:1,alignItems:"center",justifyContent:"center",gap:14},
  authPage:{paddingHorizontal:22,paddingTop:36,paddingBottom:28,flexGrow:1,justifyContent:"center"},
  brandBlock:{marginBottom:30},brand:{color:C.text,fontSize:24,fontWeight:"900",letterSpacing:1.3},kicker:{color:C.muted,fontSize:9,letterSpacing:1.2,marginTop:4,fontWeight:"700"},
  authHero:{marginBottom:22},eyebrow:{color:C.teal,fontSize:10,fontWeight:"800",letterSpacing:1.7,marginBottom:10},authTitle:{color:C.text,fontSize:31,lineHeight:37,fontWeight:"800",letterSpacing:-.6,marginBottom:12},
  body:{color:C.muted,fontSize:12,lineHeight:19},card:{padding:18,borderRadius:19,backgroundColor:C.panel,borderWidth:1,borderColor:C.border,marginBottom:20},
  section:{color:C.text,fontSize:16,fontWeight:"800",marginBottom:14},fieldLabel:{color:C.muted,fontSize:10,fontWeight:"800",letterSpacing:1,marginTop:10,marginBottom:7},
  input:{color:C.text,backgroundColor:C.bg,borderWidth:1,borderColor:C.border,borderRadius:12,paddingHorizontal:13,paddingVertical:13,fontSize:14},
  hintButton:{alignSelf:"flex-start",paddingVertical:9,paddingHorizontal:12,borderRadius:10,borderWidth:1,borderColor:C.border,marginTop:4,marginBottom:6},hintButtonText:{color:C.teal,fontSize:12,fontWeight:"800"},hintPanel:{padding:12,borderRadius:12,backgroundColor:C.panel2,marginTop:8,marginBottom:8,gap:6},
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
  disabled:{borderRadius:12,padding:12,alignItems:"center",backgroundColor:"#202D43",marginTop:18},nav:{flexDirection:"row",backgroundColor:C.panel,borderRadius:16,borderWidth:1,borderColor:C.border,padding:5,marginTop:2,marginBottom:14},
  navItem:{flex:1,paddingVertical:12,alignItems:"center",borderRadius:12},active:{backgroundColor:"#173C3D"},footer:{color:"#61728C",fontSize:10,lineHeight:16,textAlign:"center",marginTop:8}
});
