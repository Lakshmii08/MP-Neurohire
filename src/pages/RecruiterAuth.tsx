import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Building, Globe, Users, CheckCircle, ShieldCheck, Mail, Lock, User, ArrowRight, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

export default function RecruiterAuth() {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { setCurrentUser } = useAuth();

  // Login state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Signup state
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [companyWebsite, setCompanyWebsite] = useState("");
  const [companySize, setCompanySize] = useState("");
  const [recruiterName, setRecruiterName] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword })
      });
      const data = await res.json();
      
      if (data.success && (data.user.role === 'recruiter' || data.user.role === 'admin')) {
        toast.success(`Welcome back, ${data.user.name || 'Recruiter'}!`);
        setCurrentUser({ uid: data.user.id.toString(), email: data.user.email, name: data.user.name, role: data.user.role });
        navigate('/recruiter');
      } else if (data.success) {
        toast.error("Account found, but you are not registered as a Recruiter or Admin.");
      } else {
        toast.error(data.message || "Invalid credentials.");
      }
    } catch (error: any) {
      toast.error("Network error connecting to database.");
    } finally {
      setLoading(false);
    }
  };

  const handleDemoRecruiterLogin = async () => {
    setLoginEmail("recruiter@neurohire.com");
    setLoginPassword("recruiter123");
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: "recruiter@neurohire.com", password: "recruiter123" })
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Logged in as Verified Recruiter!");
        setCurrentUser({ uid: data.user.id.toString(), email: data.user.email, name: data.user.name, role: data.user.role });
        navigate('/recruiter');
      } else {
        toast.error(data.message || "Demo login failed");
      }
    } catch (err) {
      toast.error("Connection error");
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName || !signupEmail || !signupPassword) {
      toast.error("Please fill in all required company fields.");
      return;
    }

    setLoading(true);
    try {
      const trimmedWebsite = companyWebsite.trim();
      const normalizedWebsite = trimmedWebsite
        ? (/^https?:\/\//i.test(trimmedWebsite) ? trimmedWebsite : `https://${trimmedWebsite}`)
        : "https://neurohire.com";

      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: signupEmail,
          password: signupPassword,
          company_name: companyName,
          company_size: companySize || "100-500 Units",
          scale_factor: companySize || "100-500 Units",
          website: normalizedWebsite,
          recruiter_name: recruiterName || companyName,
          role: "recruiter"
        })
      });
      const data = await res.json();

      if (data.success) {
        toast.success("Company profile created and verified in database! Welcome to Recruiter Dashboard.");
        setCurrentUser({ uid: data.user.id.toString(), email: data.user.email, name: data.user.name, role: data.user.role });
        navigate('/recruiter');
      } else {
        toast.error(data.message || "Registration failed.");
      }
    } catch (error: any) {
      toast.error("Network error connecting to database.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#020617] p-4 pt-16 relative overflow-hidden">
      <div className="absolute -z-10 top-[-100px] left-[-100px] w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px]"></div>
      <div className="absolute -z-10 bottom-[-100px] right-[-100px] w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[120px]"></div>

      <div className="w-full max-w-lg relative">
        <div className="flex flex-col items-center justify-center gap-2 mb-10">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/20 mb-3 transition-transform hover:scale-105">
            <Building className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-4xl font-heading font-bold text-white tracking-tight">Recruiter Portal</h1>
          <p className="text-[10px] uppercase font-bold tracking-[0.3em] text-slate-500 mt-1">Enterprise Intelligence Suite</p>
        </div>

        <Tabs defaultValue="login" className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-white/5 border border-white/10 rounded-2xl p-1 mb-8">
            <TabsTrigger value="login" className="data-[state=active]:bg-white/10 py-3 rounded-xl transition-all font-bold text-xs uppercase tracking-widest">Recruiter Login</TabsTrigger>
            <TabsTrigger value="signup" className="data-[state=active]:bg-white/10 py-3 rounded-xl transition-all font-bold text-xs uppercase tracking-widest">Company Signup</TabsTrigger>
          </TabsList>

          {/* Recruiter Login */}
          <TabsContent value="login">
            <form onSubmit={handleLogin} className="bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-xl shadow-2xl relative overflow-hidden space-y-6">
              <div>
                 <h2 className="text-2xl font-heading font-bold text-white">Recruiter Access</h2>
                 <p className="text-slate-400 text-xs mt-1">Sign in with your enterprise credentials</p>
              </div>
              <div className="space-y-4">
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 group-focus-within:text-blue-500 transition-colors" />
                  <Input 
                    required 
                    type="email" 
                    placeholder="Work Email Address" 
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="h-13 pl-12 bg-white/5 border-white/10 text-slate-100 placeholder:text-slate-600 rounded-2xl focus-visible:ring-blue-500/50" 
                  />
                </div>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 group-focus-within:text-blue-500 transition-colors" />
                  <Input 
                    required 
                    type="password" 
                    placeholder="Password" 
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="h-13 pl-12 bg-white/5 border-white/10 text-slate-100 placeholder:text-slate-600 rounded-2xl focus-visible:ring-blue-500/50" 
                  />
                </div>
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold h-13 rounded-2xl shadow-lg shadow-blue-600/20 transition-all text-xs uppercase tracking-widest mt-2"
                >
                  {loading ? "Authenticating..." : "Sign In to Recruiter Dashboard"}
                </Button>

                <div className="relative flex py-2 items-center">
                  <div className="flex-grow border-t border-white/10"></div>
                  <span className="flex-shrink mx-4 text-[10px] uppercase font-bold text-slate-500 tracking-widest">Or Instant Demo Login</span>
                  <div className="flex-grow border-t border-white/10"></div>
                </div>

                <Button 
                  type="button"
                  onClick={handleDemoRecruiterLogin}
                  disabled={loading}
                  variant="outline"
                  className="w-full bg-white/5 hover:bg-white/10 border-white/10 text-cyan-300 font-bold h-12 rounded-2xl transition-all text-xs uppercase tracking-widest flex items-center justify-center gap-2"
                >
                  <ShieldCheck className="h-4 w-4 text-cyan-400" />
                  1-Click Demo Recruiter Login (Sarah Jenkins)
                </Button>

                <div className="flex justify-between items-center pt-2">
                  <Link to="/login" className="text-[11px] text-cyan-400 uppercase tracking-widest font-bold hover:underline">
                    ← Candidate Portal
                  </Link>
                  <span className="text-[10px] text-slate-500 uppercase tracking-widest">Database Synced</span>
                </div>
              </div>
            </form>
          </TabsContent>

          {/* Company Signup */}
          <TabsContent value="signup">
            <form onSubmit={handleSignup} className="bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-xl shadow-2xl space-y-5">
              <div>
                <h2 className="text-2xl font-heading font-bold text-white">Company Registration</h2>
                <p className="text-slate-400 text-xs mt-1">Register your organization with scale factor and corporate website</p>
              </div>
              
              <div className="space-y-4">
                <div className="relative group">
                  <Building className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 group-focus-within:text-purple-500 transition-colors" />
                  <Input 
                    required 
                    placeholder="Company Legal Name (e.g. Acme Tech Labs)" 
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="h-12 pl-12 bg-white/5 border-white/10 text-slate-100 rounded-xl focus-visible:ring-purple-500/50" 
                  />
                </div>
                <div className="relative group">
                  <Globe className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 group-focus-within:text-purple-500 transition-colors" />
                  <Input
                    required
                    type="text"
                    placeholder="Corporate Website (e.g. https://acmetech.com or acmetech.com)"
                    value={companyWebsite}
                    onChange={(e) => setCompanyWebsite(e.target.value)}
                    className="h-12 pl-12 bg-white/5 border-white/10 text-slate-100 rounded-xl focus-visible:ring-purple-500/50"
                  />
                </div>
                <div className="relative group">
                  <Users className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 group-focus-within:text-purple-500 transition-colors" />
                  <Input 
                    required 
                    placeholder="Company Scale Factor (e.g. 100-500 Employees)" 
                    value={companySize}
                    onChange={(e) => setCompanySize(e.target.value)}
                    className="h-12 pl-12 bg-white/5 border-white/10 text-slate-100 rounded-xl focus-visible:ring-purple-500/50" 
                  />
                </div>

                <div className="pt-3 border-t border-white/5 space-y-3">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Administrator Credentials</h3>
                  <div className="relative group">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 group-focus-within:text-blue-500 transition-colors" />
                    <Input 
                      required 
                      placeholder="Recruiter / Administrator Name" 
                      value={recruiterName}
                      onChange={(e) => setRecruiterName(e.target.value)}
                      className="h-12 pl-12 bg-white/5 border-white/10 text-slate-100 rounded-xl focus-visible:ring-blue-500/50" 
                    />
                  </div>
                  <div className="relative group">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 group-focus-within:text-blue-500 transition-colors" />
                    <Input 
                      required 
                      type="email" 
                      placeholder="Verified Work Email" 
                      value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                      className="h-12 pl-12 bg-white/5 border-white/10 text-slate-100 rounded-xl focus-visible:ring-blue-500/50" 
                    />
                  </div>
                  <div className="relative group">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 group-focus-within:text-blue-500 transition-colors" />
                    <Input 
                      required 
                      type="password" 
                      placeholder="Password (min 6 characters)" 
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                      className="h-12 pl-12 bg-white/5 border-white/10 text-slate-100 rounded-xl focus-visible:ring-blue-500/50" 
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 text-xs font-semibold text-emerald-400 p-3.5 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 leading-relaxed">
                <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0" />
                <span>Instant Enterprise Activation: Your organization and verified scale factor are immediately recorded in the database.</span>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-600 via-purple-600 to-cyan-500 hover:opacity-90 text-white font-bold h-13 rounded-2xl shadow-xl shadow-blue-600/30 transition-all text-xs uppercase tracking-widest"
              >
                {loading ? "Registering & Connecting..." : "Create Verified Recruiter Account"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
