import React, { useEffect, useState } from "react";
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

  useEffect(() => {
    let active = true;
    SecureStore.getItemAsync("tayar_access_token")
      .then((saved) => { if (active) setToken(saved); })
      .catch(() => { if (active) setToken(null); })
      .finally(() => { if (active) setSessionLoading(false); });
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

  const lastFiveAccuracy = "—";
  const overallAccuracy = "—";
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
        <View style={s.hero}><Text style={s.label}>READINESS INDEX</Text><Text style={s.heroTitle}>Building your baseline</Text><View style={s.track}><View style={s.fill}/></View><Text style={s.small}>Complete verified practice sessions to unlock personalised insights.</Text></View>
        <Text style={s.section}>Your learning signals</Text>
        <View style={s.grid}>
          <Metric label="OVERALL ACCURACY" value={overallAccuracy} color={C.teal}/>
          <Metric label="LAST 5 ATTEMPTS" value={lastFiveAccuracy} color={C.blue}/>
          <Metric label="WEAKNESS RADAR" value="Not enough data" color={C.amber}/>
          <Metric label="MOMENTUM" value="Awaiting attempts" color={C.teal}/>
        </View>
        <Text style={s.section}>Your next best action</Text>
        <View style={s.card}><Text style={s.cardTitle}>Establish your baseline</Text><Text style={s.body}>A short diagnostic identifies topics needing attention first. Practice will use verified source material only.</Text></View>
        <Text style={s.section}>Practice workspace</Text>
        <View style={s.card}><Text style={s.tag}>SOURCE-VERIFIED CONTENT</Text><Text style={s.cardTitle}>Your verified question bank is being prepared.</Text><Text style={s.body}>No invented exam questions or answer keys. Each question will have source references, topic tags, verified answers and reusable solution steps.</Text><View style={s.disabled}><Text style={s.small}>Practice unlocks after content verification</Text></View></View>
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
