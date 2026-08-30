import { useState, useEffect } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { toast } from "sonner";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "motion/react";
import {
  Users, Video, FileText, AlertCircle, Search, Bell,
  Target, TrendingUp, UserCheck, UserMinus, Settings,
  LayoutDashboard, BarChart3, ShieldCheck, Plus, LogOut, Building
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, PieChart, Pie, Cell } from "recharts";
import { getAllCompletedInterviews, type InterviewSession } from "@/lib/firestore";
import { useAuth } from "@/contexts/AuthContext";

export default function RecruiterDashboard() {
  const [loading, setLoading] = useState(true);
  const [recruiterData, setRecruiterData] = useState<any>(null);
  const [interviews, setInterviews] = useState<InterviewSession[]>([]);
  const [loadingInterviews, setLoadingInterviews] = useState(true);
  const navigate = useNavigate();

  const { currentUser, setCurrentUser } = useAuth();
  
  useEffect(() => {
    if (!currentUser || (currentUser.role !== 'recruiter' && currentUser.role !== 'admin')) {
      navigate('/recruiter/auth');
      return;
    }

    const fetchRecruiterData = async () => {
      try {
        const res = await fetch(`/api/recruiter/${currentUser.uid}`);
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            setRecruiterData(data.recruiter);
          } else {
            // Default fallback profile for recruiter
            setRecruiterData({
              companyName: 'NeuroHire Talent Labs',
              email: currentUser.email,
              status: 'verified'
            });
          }
        }
      } catch (err) {
        console.error("Error fetching recruiter:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchRecruiterData();
  }, [currentUser, navigate]);

  useEffect(() => {
    if (!loading) {
      // First try to get local active sessions
      getAllCompletedInterviews()
        .then(async (sessions) => {
          if (sessions && sessions.length > 0) {
            setInterviews(sessions);
          } else {
            // Fetch SQLite DB candidates
            const candRes = await fetch('/api/candidates');
            if (candRes.ok) {
              const dbCandidates = await candRes.json();
              if (Array.isArray(dbCandidates) && dbCandidates.length > 0) {
                const formatted = dbCandidates.map(c => ({
                  id: String(c.id),
                  candidateId: String(c.id),
                  candidateName: c.name || 'Candidate',
                  role: c.role || 'Software Engineer',
                  questions: [],
                  answers: [],
                  overallScore: c.score || 85,
                  resumeScore: c.score || 85,
                  speechScore: c.voice || 90,
                  voiceScore: c.voice || 90,
                  proctoringScore: c.proctor || 100,
                  status: 'completed' as const,
                  tabSwitchCount: 0,
                  completedAt: { seconds: Math.floor(Date.now() / 1000) }
                }));
                setInterviews(formatted);
              }
            }
          }
        })
        .catch(console.error)
        .finally(() => setLoadingInterviews(false));
    }
  }, [loading]);

  const handleLogout = async () => {
    setCurrentUser(null);
    toast.success("Logged out successfully");
    navigate('/recruiter/auth');
  };

  if (loading) {
    return (
      <div className="h-screen bg-[#020617] flex items-center justify-center">
        <div className="w-16 h-16 rounded-2xl bg-blue-600/20 flex items-center justify-center animate-pulse">
          <Building className="h-8 w-8 text-blue-500" />
        </div>
      </div>
    );
  }

  // Compute stats from real interviews
  const totalCandidates = interviews.length;
  const recommended = interviews.filter(i => i.overallScore >= 85).length;
  const flagged = interviews.filter(i => i.tabSwitchCount > 2).length;
  const avgScore = totalCandidates > 0
    ? Math.round(interviews.reduce((s, i) => s + i.overallScore, 0) / totalCandidates)
    : 0;

  const stats = [
    { label: "Total Candidates", val: String(totalCandidates), icon: Users, color: "text-purple-400", bg: "bg-purple-500/10" },
    { label: "Recommended", val: String(recommended), icon: UserCheck, color: "text-green-400", bg: "bg-green-500/10" },
    { label: "Flagged", val: String(flagged), icon: AlertCircle, color: "text-red-400", bg: "bg-red-500/10" },
    { label: "Avg Score", val: avgScore ? `${avgScore}%` : "--", icon: TrendingUp, color: "text-blue-400", bg: "bg-blue-500/10" },
  ];

  // Chart data — group by day
  const hiringData = (() => {
    const days: Record<string, { Applications: number; Passed: number }> = {};
    const now = Date.now();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now - i * 86400000);
      const key = d.toLocaleDateString('en-US', { weekday: 'short' });
      days[key] = { Applications: 0, Passed: 0 };
    }
    interviews.forEach(interview => {
      if (interview.completedAt) {
        const d = new Date((interview.completedAt as any).seconds * 1000);
        const key = d.toLocaleDateString('en-US', { weekday: 'short' });
        if (days[key]) {
          days[key].Applications++;
          if (interview.overallScore >= 70) days[key].Passed++;
        }
      }
    });
    return Object.entries(days).map(([Month, vals]) => ({ Month, ...vals }));
  })();

  const cleanCount = interviews.filter(i => i.tabSwitchCount === 0).length;
  const riskCount = interviews.length - cleanCount;
  const fraudData = [
    { name: 'Clean', value: cleanCount || 1 },
    { name: 'Risk', value: riskCount || 0 },
  ];

  return (
    <div className="flex h-screen bg-[#020617] text-slate-100 font-sans overflow-hidden selection:bg-cyan-500/30 relative">
      <div className="absolute -z-10 top-[-200px] left-[-100px] w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px]" />
      <div className="absolute -z-10 bottom-[-200px] right-[-100px] w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[120px]" />

      {/* Sidebar */}
      <aside className="w-20 flex flex-col items-center py-8 gap-10 bg-slate-950/50 border-r border-white/5 backdrop-blur-xl shrink-0">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-purple-600 to-cyan-400 flex items-center justify-center shadow-lg shadow-blue-500/20">
          <div className="w-5 h-5 border-2 border-white rounded-full flex items-center justify-center">
            <div className="w-1 h-1 bg-white rounded-full" />
          </div>
        </div>
        <nav className="flex flex-col gap-6">
          <Link to="/recruiter" className="p-3 rounded-xl bg-white/10 text-cyan-400 shadow-inner transition-all" title="Dashboard">
            <LayoutDashboard className="w-6 h-6" />
          </Link>
          <Link to="/recruiter/proctoring" className="p-3 rounded-xl text-slate-500 hover:text-white transition-colors" title="Proctoring">
            <Video className="w-6 h-6" />
          </Link>
          <div className="p-3 rounded-xl text-slate-500 hover:text-white transition-colors cursor-pointer" title="Reports">
            <FileText className="w-6 h-6" />
          </div>
          <div className="p-3 rounded-xl text-slate-500 hover:text-white transition-colors cursor-pointer" title="Candidates">
            <Users className="w-6 h-6" />
          </div>
          <Link to="/recruiter/analytics" className="p-3 rounded-xl text-slate-500 hover:text-white transition-colors" title="Analytics">
            <BarChart3 className="w-6 h-6" />
          </Link>
        </nav>
        <div className="mt-auto flex flex-col gap-4">
          <div className="p-3 rounded-xl text-slate-500 hover:text-red-400 transition-colors cursor-pointer" onClick={handleLogout} title="Logout">
            <LogOut className="w-6 h-6" />
          </div>
          <div className="p-3 rounded-xl text-slate-500 hover:text-white transition-colors cursor-pointer" title="Settings">
            <Settings className="w-6 h-6" />
          </div>
          <div className="w-10 h-10 rounded-full border border-white/20 bg-slate-800 p-0.5">
            <Avatar className="w-full h-full">
              <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${recruiterData?.email}`} />
              <AvatarFallback>RC</AvatarFallback>
            </Avatar>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto flex flex-col">
        <header className="h-20 px-8 flex items-center justify-between bg-white/2 backdrop-blur-md border-b border-white/5 sticky top-0 z-20">
          <div className="flex items-center gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-300">
                  {recruiterData?.companyName ?? 'NeuroHire'} Control Center
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  ✓ {recruiterData?.status ?? 'Verified'}
                </span>
                {recruiterData?.companySize && (
                  <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full text-[10px] font-mono text-cyan-300 bg-cyan-500/10 border border-cyan-500/20">
                    Scale: {recruiterData.companySize}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                {recruiterData?.recruiterName ? `${recruiterData.recruiterName} • ` : ''}{recruiterData?.email ?? currentUser?.email}
                {recruiterData?.website && (
                  <> • <a href={recruiterData.website} target="_blank" rel="noreferrer" className="text-cyan-400 hover:underline">{recruiterData.website.replace('https://', '')}</a></>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input type="text" placeholder="Search candidates..." className="bg-white/5 border border-white/10 rounded-full py-2 px-10 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500/50 w-64 text-white" />
            </div>
            <div className="relative p-2 rounded-lg bg-white/5 border border-white/10 cursor-pointer">
              <Bell className="h-5 w-5 text-slate-300" />
            </div>
          </div>
        </header>

        <div className="p-8 space-y-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
            <div>
              <h2 className="text-3xl font-heading font-bold">Recruitment Overview</h2>
              <p className="text-slate-400 text-sm">Real-time candidate intelligence and AI neural evaluation records.</p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {stats.map((stat, i) => (
              <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-md group hover:bg-white/10 transition-all">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-slate-400 text-xs uppercase tracking-widest font-bold">{stat.label}</p>
                  <div className={`p-2 rounded-xl ${stat.bg}`}>
                    <stat.icon className={`h-4 w-4 ${stat.color}`} />
                  </div>
                </div>
                <div className="text-3xl font-bold">{stat.val}</div>
              </div>
            ))}
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-md flex flex-col">
              <div className="flex flex-row items-center justify-between mb-6">
                <div>
                  <h3 className="font-semibold text-lg">Application Velocity</h3>
                  <p className="text-slate-500 text-xs uppercase tracking-widest">Neuro-filtered applicant flow (7 days)</p>
                </div>
                <div className="flex gap-4">
                  <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest">
                    <div className="w-2 h-2 rounded-full bg-blue-500" /> Applicants
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest">
                    <div className="w-2 h-2 rounded-full bg-purple-500" /> Passed
                  </div>
                </div>
              </div>
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={hiringData}>
                    <defs>
                      <linearGradient id="colorApps" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563EB" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorPassed" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#7C3AED" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#7C3AED" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="Month" stroke="#475569" strokeWidth={0} tick={{ fontSize: 10 }} />
                    <YAxis stroke="#475569" strokeWidth={0} tick={{ fontSize: 10 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#020617', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }} />
                    <Area type="monotone" dataKey="Applications" stroke="#2563EB" fillOpacity={1} fill="url(#colorApps)" strokeWidth={3} />
                    <Area type="monotone" dataKey="Passed" stroke="#7C3AED" fillOpacity={1} fill="url(#colorPassed)" strokeWidth={3} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-md flex flex-col">
              <div className="mb-4">
                <h3 className="font-semibold text-lg leading-none">Fraud & Identity</h3>
                <p className="text-slate-500 text-xs uppercase tracking-widest mt-1">NeuroVoice™ Result</p>
              </div>
              <div className="flex flex-col items-center flex-1">
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={fraudData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={10} dataKey="value">
                        <Cell fill="#10B981" />
                        <Cell fill="#EF4444" />
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: '#020617', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="w-full space-y-3">
                  <div className="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/5">
                    <div className="flex items-center gap-2 font-bold text-[10px] uppercase tracking-widest text-green-400">
                      <ShieldCheck className="h-4 w-4" /> Clean Profile
                    </div>
                    <span className="font-mono font-bold text-sm">{totalCandidates ? Math.round((cleanCount / totalCandidates) * 100) : 0}%</span>
                  </div>
                  <div className="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/5">
                    <div className="flex items-center gap-2 font-bold text-[10px] uppercase tracking-widest text-red-500">
                      <AlertCircle className="h-4 w-4" /> High Risk
                    </div>
                    <span className="font-mono font-bold text-sm">{totalCandidates ? Math.round((riskCount / totalCandidates) * 100) : 0}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Candidates Table */}
          <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden backdrop-blur-md flex flex-col">
            <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
              <h3 className="font-semibold text-lg">Top Ranking Candidates</h3>
              <span className="text-xs text-slate-500">{interviews.length} total interviews</span>
            </div>
            {loadingInterviews ? (
              <div className="p-12 text-center text-slate-500">Loading candidates...</div>
            ) : interviews.length === 0 ? (
              <div className="p-12 text-center space-y-2">
                <p className="text-slate-500">No completed interviews yet.</p>
                <p className="text-slate-600 text-sm">Candidates will appear here after completing the full interview flow.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-white/5">
                    <TableRow className="border-b border-white/5 hover:bg-transparent">
                      <TableHead className="font-bold text-slate-400 uppercase tracking-widest text-[10px]">Candidate</TableHead>
                      <TableHead className="font-bold text-slate-400 uppercase tracking-widest text-[10px]">Role</TableHead>
                      <TableHead className="font-bold text-slate-400 uppercase tracking-widest text-[10px]">Neural Score</TableHead>
                      <TableHead className="font-bold text-slate-400 uppercase tracking-widest text-[10px]">Status</TableHead>
                      <TableHead className="text-right font-bold text-slate-400 uppercase tracking-widest text-[10px]">Report</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {interviews
                      .sort((a, b) => b.overallScore - a.overallScore)
                      .slice(0, 10)
                      .map((c, i) => {
                        const status = c.overallScore >= 85 ? 'Recommended' : c.tabSwitchCount > 2 ? 'Flagged' : c.overallScore >= 65 ? 'Moderate' : 'Review';
                        return (
                          <TableRow key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                            <TableCell className="flex items-center gap-3 py-4">
                              <Avatar className="h-10 w-10 ring-1 ring-white/10">
                                <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${c.candidateName}`} />
                                <AvatarFallback>{c.candidateName.slice(0, 2).toUpperCase()}</AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="text-sm font-bold text-slate-200">{c.candidateName}</p>
                                <p className="text-[10px] text-slate-500 uppercase tracking-widest">
                                  {c.completedAt ? new Date((c.completedAt as any).seconds * 1000).toLocaleDateString() : 'Recent'}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-slate-400">{c.role}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="w-16 h-1.5 bg-white/5 rounded-full overflow-hidden">
                                  <div className="h-full bg-cyan-400 rounded-full" style={{ width: `${c.overallScore}%` }} />
                                </div>
                                <span className="font-mono font-bold text-xs text-cyan-400">{c.overallScore}%</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={`${
                                status === 'Recommended' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                                status === 'Flagged' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                                status === 'Moderate' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                                'bg-slate-500/10 text-slate-400 border-slate-500/20'
                              } px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest`}>
                                {status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Link to={`/report/${c.id}`} className="p-2 rounded-lg hover:bg-cyan-500/10 text-slate-400 hover:text-cyan-400 transition-colors inline-flex">
                                <FileText className="h-4 w-4" />
                              </Link>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
