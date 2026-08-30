import { useEffect, useState } from "react";
import { motion } from "motion/react";
import {
  FileText, Mic, UserCheck, ShieldAlert, Trophy,
  Plus, Calendar, History, ArrowUpRight, Monitor,
  Zap, Bell, Search, LogOut
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { getInterviewsByCandidate, type InterviewSession } from "@/lib/firestore";
import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { toast } from "sonner";

export default function CandidateDashboard() {
  const { currentUser, candidateData, loading } = useAuth();
  const navigate = useNavigate();
  const [interviews, setInterviews] = useState<InterviewSession[]>([]);
  const [loadingInterviews, setLoadingInterviews] = useState(true);

  useEffect(() => {
    if (!currentUser) return;
    getInterviewsByCandidate(currentUser.uid)
      .then(setInterviews)
      .catch(console.error)
      .finally(() => setLoadingInterviews(false));
  }, [currentUser]);

  const [recommendedJobs, setRecommendedJobs] = useState<any[]>([]);

  useEffect(() => {
    if (!currentUser) return;
    fetch(`/api/candidates/matches/${currentUser.uid}`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setRecommendedJobs(data.slice(0, 4));
        }
      })
      .catch(console.error);
  }, [currentUser]);

  const handleLogout = async () => {
    await signOut(auth);
    localStorage.removeItem("neurohire_simulated_user");
    toast.success("Logged out successfully.");
    navigate("/login");
  };

  const latestInterview = interviews[0];
  const overallScore = latestInterview?.overallScore ?? candidateData?.resumeScore ?? 0;
  const name = candidateData ? `${candidateData.firstName} ${candidateData.lastName}` : "Candidate";
  const initials = candidateData ? `${candidateData.firstName[0]}${candidateData.lastName[0]}` : "C";

  const scores = [
    { name: "Resume Score", value: latestInterview?.resumeScore ?? candidateData?.resumeScore ?? 0, icon: FileText, color: "text-blue-500", bg: "bg-blue-500/10" },
    { name: "Speech Score", value: latestInterview?.speechScore ?? 0, icon: Mic, color: "text-purple-500", bg: "bg-purple-500/10" },
    { name: "Voice Match", value: latestInterview?.voiceScore ?? candidateData?.voiceSimilarity ?? 0, icon: UserCheck, color: "text-cyan-500", bg: "bg-cyan-500/10" },
    { name: "Proctoring", value: latestInterview?.proctoringScore ?? 100, icon: ShieldAlert, color: "text-green-500", bg: "bg-green-500/10" },
  ];

  return (
    <div className="flex min-h-screen bg-[#020617] text-slate-100 relative overflow-hidden">
      <div className="absolute -z-10 top-[-200px] left-[-100px] w-[600px] h-[600px] bg-blue-600/5 rounded-full blur-[120px]" />
      <div className="absolute -z-10 bottom-[-200px] right-[-100px] w-[600px] h-[600px] bg-purple-600/5 rounded-full blur-[120px]" />

      {/* Sidebar */}
      <aside className="hidden md:flex w-72 flex-col border-r border-white/5 bg-white/2 backdrop-blur-3xl relative z-20">
        <div className="p-8">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Zap className="h-6 w-6 text-white" />
            </div>
            <span className="text-2xl font-heading font-bold text-gradient tracking-tight">NeuroHire</span>
          </Link>
        </div>

        <nav className="flex-1 px-6 space-y-3">
          {[
            { icon: Monitor, label: "Neural Dashboard", active: true, to: "/candidate" },
            { icon: FileText, label: "Resume Analysis", to: "/candidate/resume" },
            { icon: UserCheck, label: "Voice Auth", to: "/candidate/voice-auth" },
            { icon: Calendar, label: "Start Interview", to: "/candidate/interview" },
            { icon: History, label: "History Logs", to: "#" },
          ].map((item, i) => (
            <Link
              key={i}
              to={item.to}
              className={`flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all font-medium group ${
                item.active
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                  : 'text-slate-500 hover:bg-white/5 hover:text-slate-300'
              }`}
            >
              <item.icon className="h-5 w-5" />
              <span className="text-sm uppercase tracking-widest font-bold text-[10px]">{item.label}</span>
            </Link>
          ))}
        </nav>

        {/* Next interview CTA */}
        <div className="p-8">
          <div className="bg-white/5 border border-white/10 rounded-3xl p-6 relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-1 h-full bg-cyan-500 opacity-20" />
            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">Next Protocol</p>
            <p className="text-sm font-bold text-white mb-4">
              {candidateData?.voiceVerified ? "Neural Interview Ready" : "Complete Voice Auth First"}
            </p>
            <Link
              to={candidateData?.voiceVerified ? "/candidate/interview" : "/candidate/voice-auth"}
              className="flex items-center justify-center w-full bg-cyan-600 hover:bg-cyan-500 text-white text-[10px] font-bold uppercase tracking-widest h-10 rounded-xl transition-all shadow-lg shadow-cyan-600/10 gap-2"
            >
              {candidateData?.voiceVerified ? "Join Protocol" : "Verify Voice"} <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3.5 rounded-2xl text-slate-600 hover:text-red-400 hover:bg-red-600/10 transition-all w-full mt-4 text-[10px] font-bold uppercase tracking-widest"
          >
            <LogOut className="h-4 w-4" /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        <header className="h-20 border-b border-white/5 flex items-center justify-between px-10 bg-white/2 sticky top-0 z-10 backdrop-blur-md">
          <div className="flex items-center gap-4 flex-1 max-w-xl">
            <div className="relative w-full group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 group-hover:text-cyan-400 transition-colors" />
              <Input placeholder="Search archives, interviews..." className="h-12 pl-12 bg-white/5 border-white/10 rounded-2xl text-slate-200 placeholder:text-slate-600 focus-visible:ring-cyan-500/50" />
            </div>
          </div>
          <div className="flex items-center gap-8 pl-8 border-l border-white/5 ml-8">
            <button className="relative p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
              <Bell className="h-5 w-5 text-slate-400" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-blue-500 rounded-full border-2 border-[#020617]" />
            </button>
            <div className="flex items-center gap-4 group cursor-pointer">
              <div className="text-right">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none">
                  {candidateData?.voiceVerified ? 'Verified' : 'Pending Auth'}
                </p>
                <p className="text-sm font-bold text-white group-hover:text-cyan-400 transition-colors">{name}</p>
              </div>
              <Avatar className="ring-2 ring-white/10 shadow-xl scale-110">
                <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`} />
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
            </div>
          </div>
        </header>

        <div className="p-10 space-y-12 max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-px bg-cyan-500" />
                <p className="font-mono text-cyan-400 text-xs font-bold uppercase tracking-widest">Neural Dashboard // Candidate v2.1</p>
              </div>
              <h1 className="text-5xl font-heading font-bold tracking-tight">
                Welcome, {candidateData?.firstName ?? 'Candidate'}.
              </h1>
              <p className="text-slate-500 font-medium max-w-2xl leading-relaxed">
                {latestInterview
                  ? `Your neural alignment score is ${overallScore}%. ${candidateData?.resumeSkills?.length ?? 0} skills have been mapped to your profile.`
                  : "Complete your voice authentication and upload your resume to get started."
                }
              </p>
            </motion.div>
            <div className="flex gap-4">
              <Link
                to="/candidate/resume"
                className="h-14 px-8 bg-white/5 border border-white/10 rounded-2xl text-slate-300 text-[11px] font-bold uppercase tracking-widest hover:bg-white/10 transition-all flex items-center gap-3"
              >
                <Plus className="h-4 w-4" /> Update Resume
              </Link>
              <Link
                to="/candidate/interview"
                className="h-14 px-8 bg-blue-600 text-white rounded-2xl text-[11px] font-bold uppercase tracking-widest hover:bg-blue-500 transition-all flex items-center gap-3 shadow-xl shadow-blue-600/20"
              >
                <Zap className="h-4 w-4" /> Start Interview
              </Link>
            </div>
          </div>

          {/* Score Grid */}
          {scores.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {scores.map((score, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
                  <div className="bg-white/2 border border-white/5 hover:border-blue-500/30 rounded-3xl p-6 backdrop-blur-xl group transition-all relative overflow-hidden">
                    <div className={`absolute top-0 right-0 w-24 h-24 rounded-full -mr-12 -mt-12 opacity-10 blur-2xl ${score.bg}`} />
                    <div className="flex justify-between items-start mb-6">
                      <div className={`p-4 rounded-2xl ${score.bg} ring-1 ring-white/5`}>
                        <score.icon className={`h-6 w-6 ${score.color}`} />
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="flex justify-between items-end">
                        <div>
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">{score.name}</p>
                          <p className="text-2xl font-mono font-bold text-white tracking-widest">{score.value}%</p>
                        </div>
                        <ArrowUpRight className="h-5 w-5 text-slate-600 group-hover:text-cyan-400 group-hover:translate-x-1 group-hover:-translate-y-1 transition-all" />
                      </div>
                      <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                        <div className={`h-full ${score.color.replace('text-', 'bg-')}`} style={{ width: `${score.value}%` }} />
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            {/* Main Score Card */}
            <div className="lg:col-span-2 bg-white/5 border border-white/10 rounded-[40px] p-10 backdrop-blur-3xl relative overflow-hidden shadow-2xl group">
              <div className="absolute inset-0 bg-radial-[at_100%_0%] from-blue-600/5 via-transparent to-transparent opacity-50" />
              <div className="flex flex-row items-center justify-between mb-10">
                <div>
                  <h3 className="text-3xl font-heading font-bold mb-2">Aggregate Neural Score</h3>
                  <p className="uppercase tracking-[0.3em] font-bold text-slate-500 text-[10px]">Comparative Biometric Alignment Report</p>
                </div>
                <div className="h-24 w-24 rounded-[32px] border-2 border-cyan-500/20 bg-white/5 flex items-center justify-center font-mono font-bold text-4xl text-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.1)] group-hover:bg-cyan-500 group-hover:text-white transition-all duration-500">
                  {overallScore || "--"}
                </div>
              </div>
              <div className="relative h-80 bg-slate-950/40 rounded-3xl flex items-center justify-center border border-white/5 shadow-inner overflow-hidden group/chart">
                <div className="relative z-10 text-center space-y-6">
                  <div className="relative inline-block">
                    <Trophy className="h-24 w-24 mx-auto text-cyan-400 opacity-50 group-hover/chart:opacity-100 transition-opacity" />
                    <div className="absolute inset-0 blur-2xl bg-cyan-400 opacity-20 animate-pulse" />
                  </div>
                  <div className="space-y-3">
                    {latestInterview ? (
                      <>
                        <p className="text-sm font-bold px-6 py-2 bg-cyan-500 text-slate-950 rounded-2xl shadow-lg shadow-cyan-500/20 inline-block uppercase tracking-widest">
                          Interview Complete
                        </p>
                        <Link
                          to={`/report/${latestInterview.id}`}
                          className="block text-slate-400 max-w-sm mx-auto text-[13px] px-8 leading-relaxed font-medium hover:text-cyan-400 transition-colors"
                        >
                          View your detailed candidate report →
                        </Link>
                      </>
                    ) : (
                      <>
                        <p className="text-sm font-bold px-6 py-2 bg-blue-600/20 text-blue-400 rounded-2xl inline-block uppercase tracking-widest border border-blue-500/20">
                          No interviews yet
                        </p>
                        <p className="text-slate-400 max-w-sm mx-auto text-[13px] px-8 leading-relaxed font-medium">
                          Complete voice authentication and start your first AI interview to generate your score.
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Right column */}
            <div className="space-y-10">
              {/* Interview History */}
              <div className="bg-white/5 border border-white/10 rounded-[32px] p-8 backdrop-blur-2xl">
                <div className="flex items-center gap-3 mb-8">
                  <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-400/20">
                    <History className="h-4 w-4 text-cyan-400" />
                  </div>
                  <h3 className="text-sm font-bold uppercase tracking-widest text-slate-300">Interview History</h3>
                </div>
                <div className="space-y-4">
                  {loadingInterviews ? (
                    <p className="text-slate-600 text-xs text-center py-4">Loading...</p>
                  ) : interviews.length === 0 ? (
                    <div className="text-center py-6 space-y-2">
                      <p className="text-slate-500 text-sm">No interviews yet</p>
                      <Link to="/candidate/interview" className="text-cyan-400 text-xs font-bold hover:underline">Start your first interview →</Link>
                    </div>
                  ) : (
                    interviews.slice(0, 3).map((item, idx) => (
                      <Link
                        key={idx}
                        to={`/report/${item.id}`}
                        className="flex items-center justify-between p-4 rounded-2xl hover:bg-white/5 transition-all cursor-pointer group border border-transparent hover:border-white/5 block"
                      >
                        <div>
                          <p className="text-sm font-bold text-white group-hover:text-cyan-400 transition-colors">{item.role}</p>
                          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                            {item.status === 'completed' ? 'Completed' : 'In Progress'} // {item.completedAt ? new Date((item.completedAt as any).seconds * 1000).toLocaleDateString() : 'Recent'}
                          </p>
                        </div>
                        <div className="px-3 py-1 bg-white/5 border border-white/10 rounded-lg font-mono text-[10px] font-bold text-cyan-400">
                          {item.overallScore}%
                        </div>
                      </Link>
                    ))
                  )}
                </div>
              </div>

              {/* Status card */}
              <div className="bg-gradient-to-br from-blue-600 to-purple-700 border border-white/10 rounded-[32px] p-8 shadow-2xl relative group overflow-hidden">
                <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full -mr-24 -mt-24 blur-3xl group-hover:scale-110 transition-transform" />
                <div className="relative z-10">
                  <h3 className="text-2xl font-heading font-bold text-white mb-2">Profile Status</h3>
                  <p className="text-white/60 text-[10px] font-bold uppercase tracking-widest mb-6 leading-relaxed">
                    Your Neural Profile
                  </p>
                  <div className="space-y-3 mb-6">
                    {[
                      { label: "Email Verified", done: true },
                      { label: "Resume Analyzed", done: !!candidateData?.resumeScore },
                      { label: "Voice Authenticated", done: !!candidateData?.voiceVerified },
                      { label: "Interview Complete", done: interviews.some(i => i.status === 'completed') },
                    ].map((step, i) => (
                      <div key={i} className={`flex items-center gap-3 text-xs font-bold ${step.done ? 'text-white' : 'text-white/40'}`}>
                        <div className={`w-4 h-4 rounded-full flex items-center justify-center ${step.done ? 'bg-white' : 'border border-white/30'}`}>
                          {step.done && <span className="text-blue-600 text-[10px]">✓</span>}
                        </div>
                        {step.label}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Recommended Job Openings Section */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-heading font-bold">Top Matched Job Openings</h3>
                <p className="text-xs text-slate-400">Intelligently ranked by skill alignment with your uploaded resume</p>
              </div>
              <Link
                to="/candidate/resume"
                className="text-xs font-bold uppercase tracking-wider text-cyan-400 hover:text-cyan-300 transition-colors flex items-center gap-1.5"
              >
                View All Matches in Resume Analysis →
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {recommendedJobs.length === 0 ? (
                <div className="col-span-full p-8 text-center bg-white/2 border border-white/5 rounded-3xl">
                  <p className="text-sm text-slate-400">Upload and analyze your resume to view real-time matching jobs.</p>
                </div>
              ) : (
                recommendedJobs.map((job, idx) => (
                  <div
                    key={idx}
                    className="p-6 rounded-3xl bg-white/2 border border-white/5 hover:border-cyan-500/30 transition-all flex flex-col justify-between space-y-4 group backdrop-blur-md"
                  >
                    <div className="space-y-3">
                      <div className="flex justify-between items-start">
                        <span className="text-[10px] uppercase font-bold text-slate-400 truncate max-w-[140px]">{job.company}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                          job.matchScore >= 85 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                        }`}>
                          {job.matchScore}% Match
                        </span>
                      </div>
                      <h4 className="text-base font-bold text-white group-hover:text-cyan-300 transition-colors leading-tight">
                        {job.title}
                      </h4>
                      <p className="text-[11px] text-slate-400 font-mono">{job.salary} • {job.location}</p>
                      
                      {job.matchingSkills && job.matchingSkills.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {job.matchingSkills.slice(0, 3).map((s: string, i: number) => (
                            <span key={i} className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-300 text-[9px] font-mono">
                              ✓ {s}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <Link
                      to={`/candidate/interview?role=${encodeURIComponent(job.title)}`}
                      className="w-full bg-white/5 hover:bg-blue-600 text-white font-bold py-2.5 rounded-xl text-[10px] uppercase tracking-wider text-center transition-all flex items-center justify-center gap-1.5 border border-white/5 hover:border-transparent group-hover:shadow-lg group-hover:shadow-blue-600/20"
                    >
                      <Zap className="h-3 w-3" /> Start Interview
                    </Link>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
