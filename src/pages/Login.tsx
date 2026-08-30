import React, { useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { Zap, Mail, Lock, User, Upload, Mic, Camera, CheckCircle, ShieldCheck, Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

export default function Login() {
  const navigate = useNavigate();

  // Login state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPwd, setShowLoginPwd] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);

  // Signup state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [role, setRole] = useState("");
  const [showSignupPwd, setShowSignupPwd] = useState(false);
  const [signupLoading, setSignupLoading] = useState(false);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { setCurrentUser } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) {
      toast.error("Please fill in all fields.");
      return;
    }
    setLoginLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword })
      });
      const data = await res.json();
      if (data.success) {
        setCurrentUser({ uid: data.user.id.toString(), email: data.user.email, name: data.user.name, role: data.user.role });
        if (data.user.role === 'recruiter' || data.user.role === 'admin') {
          toast.success(`Welcome back, ${data.user.name || 'Recruiter'}!`);
          navigate("/recruiter");
        } else if (data.user.voice_verified === 1) {
          toast.success("Welcome back! Voice identity verified.");
          navigate("/candidate");
        } else {
          toast.success("Welcome back! Initiating voice authentication...");
          navigate("/candidate/voice-auth");
        }
      } else {
        toast.error(data.message || "Invalid credentials.");
      }
    } catch (err: any) {
      toast.error("Network error.");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName || !lastName || !signupEmail || !signupPassword) {
      toast.error("Please fill in all required fields.");
      return;
    }
    if (signupPassword.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    setSignupLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: signupEmail,
          password: signupPassword,
          first_name: firstName,
          last_name: lastName,
          role: "user",
          role_applied: role || "Software Engineer"
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Profile created! Proceeding to voice authentication...");
        setCurrentUser({ uid: data.user.id.toString(), email: data.user.email, name: data.user.name, role: data.user.role });
        navigate("/candidate/voice-auth");
      } else {
        toast.error(data.message || "Registration failed.");
      }
    } catch (err: any) {
      toast.error("Network error connecting to database.");
    } finally {
      setSignupLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#020617] p-4 pt-16 relative overflow-hidden">
      <div className="absolute -z-10 top-[-100px] left-[-100px] w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px]" />
      <div className="absolute -z-10 bottom-[-100px] right-[-100px] w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[120px]" />

      <div className="w-full max-w-lg relative">
        <div className="flex flex-col items-center justify-center gap-2 mb-12">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/20 mb-4">
            <Zap className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-4xl font-heading font-bold text-gradient">NeuroHire</h1>
          <p className="text-[10px] uppercase font-bold tracking-[0.3em] text-slate-500 mt-2">Intelligence Driven Authentication</p>
        </div>

        <Tabs defaultValue="login" className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-white/5 border border-white/10 rounded-2xl p-1 mb-8">
            <TabsTrigger value="login" className="data-[state=active]:bg-white/10 rounded-xl transition-all">Login</TabsTrigger>
            <TabsTrigger value="signup" className="data-[state=active]:bg-white/10 rounded-xl transition-all">Candidate Signup</TabsTrigger>
          </TabsList>

          {/* ── LOGIN TAB ── */}
          <TabsContent value="login">
            <form onSubmit={handleLogin} className="bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-xl shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                <Lock className="h-20 w-20" />
              </div>
              <div className="mb-8">
                <h2 className="text-2xl font-heading font-bold text-white">Welcome Back</h2>
                <p className="text-slate-500 text-sm mt-1">Access your recruitment intelligence dashboard</p>
              </div>
              <div className="space-y-6">
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <Input
                    required
                    type="email"
                    placeholder="Email Address"
                    value={loginEmail}
                    onChange={e => setLoginEmail(e.target.value)}
                    className="h-14 pl-12 bg-white/5 border-white/10 text-slate-100 placeholder:text-slate-600 rounded-2xl focus-visible:ring-blue-500/50"
                  />
                </div>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <Input
                    required
                    type={showLoginPwd ? "text" : "password"}
                    placeholder="Password"
                    value={loginPassword}
                    onChange={e => setLoginPassword(e.target.value)}
                    className="h-14 pl-12 pr-12 bg-white/5 border-white/10 text-slate-100 placeholder:text-slate-600 rounded-2xl focus-visible:ring-blue-500/50"
                  />
                  <button type="button" onClick={() => setShowLoginPwd(v => !v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                    {showLoginPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <button
                  type="submit"
                  disabled={loginLoading}
                  className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold h-14 rounded-2xl shadow-lg shadow-blue-600/20 transition-all text-sm uppercase tracking-widest"
                >
                  {loginLoading ? "Authenticating..." : "Initiate Secure Login"}
                </button>

                <div className="pt-2 text-center border-t border-white/5">
                  <Link to="/recruiter/auth" className="text-xs text-cyan-400 font-bold hover:underline">
                    Are you a Recruiter or Hiring Manager? Access Recruiter Portal →
                  </Link>
                </div>
              </div>
            </form>
          </TabsContent>

          {/* ── SIGNUP TAB ── */}
          <TabsContent value="signup">
            <form onSubmit={handleSignup} className="bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-xl shadow-2xl space-y-6">
              <div>
                <h2 className="text-2xl font-heading font-bold text-white">Create Profile</h2>
                <p className="text-slate-500 text-sm mt-1">Initialize your neural evaluation record</p>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                    <Input
                      required
                      placeholder="First Name"
                      value={firstName}
                      onChange={e => setFirstName(e.target.value)}
                      className="h-12 pl-10 bg-white/5 border-white/10 rounded-xl text-slate-100 placeholder:text-slate-600"
                    />
                  </div>
                  <Input
                    required
                    placeholder="Last Name"
                    value={lastName}
                    onChange={e => setLastName(e.target.value)}
                    className="h-12 bg-white/5 border-white/10 rounded-xl text-slate-100 placeholder:text-slate-600"
                  />
                </div>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <Input
                    required
                    type="email"
                    placeholder="Email Address"
                    value={signupEmail}
                    onChange={e => setSignupEmail(e.target.value)}
                    className="h-12 pl-12 bg-white/5 border-white/10 rounded-xl text-slate-100 placeholder:text-slate-600"
                  />
                </div>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <Input
                    required
                    type={showSignupPwd ? "text" : "password"}
                    placeholder="Password (min. 6 chars)"
                    value={signupPassword}
                    onChange={e => setSignupPassword(e.target.value)}
                    className="h-12 pl-12 pr-12 bg-white/5 border-white/10 rounded-xl text-slate-100 placeholder:text-slate-600"
                  />
                  <button type="button" onClick={() => setShowSignupPwd(v => !v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                    {showSignupPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <Input
                  placeholder="Target Role (e.g. Software Engineer)"
                  value={role}
                  onChange={e => setRole(e.target.value)}
                  className="h-12 bg-white/5 border-white/10 rounded-xl text-slate-100 placeholder:text-slate-600"
                />

                {/* Resume Upload — Optional */}
                <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-3 hover:bg-white/10 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-widest font-bold flex items-center gap-2 text-slate-400">
                      <Upload className="h-4 w-4 text-blue-500" /> Resume Upload
                    </span>
                    <Badge variant="outline" className="text-slate-500 border-white/10 text-[9px] font-bold">OPTIONAL</Badge>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx,.txt"
                    className="hidden"
                    onChange={e => setResumeFile(e.target.files?.[0] ?? null)}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-3 border-2 border-dashed border-white/10 rounded-xl text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:border-blue-500/50 hover:text-blue-400 transition-all"
                  >
                    {resumeFile ? `✓ ${resumeFile.name}` : "Click to Upload Resume"}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3 text-[9px] font-bold uppercase tracking-widest text-slate-500 p-4 bg-blue-600/5 rounded-2xl border border-blue-500/10 leading-relaxed">
                <ShieldCheck className="h-5 w-5 text-blue-500 shrink-0" />
                <span>Your data is encrypted and used for evaluation purposes only.</span>
              </div>

              <button
                type="submit"
                disabled={signupLoading}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold h-14 rounded-2xl shadow-xl shadow-blue-600/20 transition-all text-sm uppercase tracking-widest"
              >
                {signupLoading ? "Creating Profile..." : "Finalize Neural Onboarding"}
              </button>
            </form>
          </TabsContent>
        </Tabs>

        <p className="text-center text-slate-600 text-xs mt-6">
          Recruiter?{" "}
          <Link to="/recruiter/auth" className="text-cyan-500 hover:text-cyan-300 font-bold transition-colors">
            Sign in here →
          </Link>
        </p>
      </div>
    </div>
  );
}
