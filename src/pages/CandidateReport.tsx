import { useParams, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import {
  Zap, Download, Printer, FileText, Mic, UserCheck,
  ShieldCheck, Brain, ArrowLeft, Loader2
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInterviewSession, getCandidate, type InterviewSession, type CandidateProfile } from "@/lib/firestore";

export default function CandidateReport() {
  const { candidateId } = useParams<{ candidateId: string }>();
  const [session, setSession] = useState<InterviewSession | null>(null);
  const [candidate, setCandidate] = useState<CandidateProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!candidateId) return;
    async function load() {
      try {
        let sess = await getInterviewSession(candidateId!);
        let cand = null;

        if (sess) {
          cand = await getCandidate(sess.candidateId);
        } else {
          // Attempt to fetch from backend profile / candidates DB
          const res = await fetch(`/api/candidates/profile/${candidateId}`);
          if (res.ok) {
            const data = await res.json();
            if (data.success && data.candidate) {
              const c = data.candidate;
              cand = {
                uid: String(c.user_id),
                email: c.email || '',
                firstName: c.first_name || '',
                lastName: c.last_name || '',
                role: c.role_applied || 'Software Engineer',
                voiceVerified: c.voice_verified === 1,
                voiceSimilarity: c.voice_score || 92,
                resumeScore: c.score || 88,
              };

              sess = {
                id: candidateId,
                candidateId: String(c.user_id),
                candidateName: `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Candidate',
                role: c.role_applied || 'Software Engineer',
                questions: ["Technical Architecture and Experience", "Core Problem Solving Methodology"],
                answers: [],
                overallScore: c.score || 88,
                resumeScore: c.score || 88,
                speechScore: c.voice_score || 92,
                voiceScore: c.voice_score || 92,
                proctoringScore: c.proctor_score || 100,
                status: 'completed' as const,
                tabSwitchCount: 0,
                completedAt: { seconds: Math.floor(Date.now() / 1000) }
              };
            }
          }
        }

        if (!sess) {
          setError("Candidate report not found.");
          return;
        }

        setSession(sess);
        setCandidate(cand);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [candidateId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 text-blue-600 animate-spin" />
          <p className="text-slate-500 font-medium">Loading report...</p>
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-red-500 font-bold">{error ?? "Report not found."}</p>
          <Link to="/candidate" className="text-blue-600 hover:underline text-sm">← Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  const name = candidate ? `${candidate.firstName} ${candidate.lastName}` : session.candidateName;
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase();

  const status =
    session.overallScore >= 85 ? "Recommended" :
    session.overallScore >= 65 ? "Moderate" :
    "Needs Review";

  const statusColors = {
    "Recommended": "bg-green-100 text-green-700",
    "Moderate": "bg-amber-100 text-amber-700",
    "Needs Review": "bg-red-100 text-red-700",
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 p-8 md:p-12">
      <div className="max-w-4xl mx-auto space-y-12">
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b pb-8">
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20 ring-4 ring-slate-100">
              <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div className="space-y-1">
              <Link to="/candidate" className="flex items-center gap-1 text-slate-400 hover:text-blue-600 text-xs font-bold uppercase tracking-widest mb-1 transition-colors">
                <ArrowLeft className="h-3 w-3" /> Dashboard
              </Link>
              <h1 className="text-3xl font-heading font-bold">{name}</h1>
              <p className="text-slate-500 font-medium">{session.role}</p>
              <div className="flex items-center gap-2 pt-1">
                <Badge className={`${statusColors[status as keyof typeof statusColors]} hover:opacity-90 border-none px-3 font-bold uppercase tracking-wider text-[10px]`}>
                  {status}
                </Badge>
                <span className="text-[10px] text-slate-400 font-mono">ID: NH-{session.id?.slice(0, 8).toUpperCase()}</span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2 border-slate-200" onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> Print
            </Button>
          </div>
        </header>

        {/* Score Summary */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <Card className="md:col-span-1 bg-slate-950 text-white border-none shadow-2xl p-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/20 rounded-full -mr-16 -mt-16 blur-3xl" />
            <p className="text-xs uppercase font-bold tracking-[0.2em] text-slate-400 mb-4">Neural Score</p>
            <div className="space-y-2">
              <h2 className="text-7xl font-heading font-bold">{session.overallScore}</h2>
              <p className="text-blue-400 font-bold px-2 py-1 bg-blue-500/10 rounded-md inline-block text-sm">
                {session.overallScore >= 85 ? 'High Confidence Match' : session.overallScore >= 65 ? 'Moderate Match' : 'Developing Candidate'}
              </p>
            </div>
            <div className="mt-8 pt-8 border-t border-white/10 space-y-2">
              <div className="flex justify-between text-xs text-slate-400">
                <span>Tab Switches</span>
                <span className={session.tabSwitchCount > 0 ? 'text-orange-400 font-bold' : 'text-green-400 font-bold'}>
                  {session.tabSwitchCount} detected
                </span>
              </div>
              <div className="flex justify-between text-xs text-slate-400">
                <span>Questions Answered</span>
                <span className="text-cyan-400 font-bold">{session.answers.length}/{session.questions.length}</span>
              </div>
            </div>
          </Card>

          <div className="md:col-span-2 space-y-6">
            <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400">Score Breakdown</h3>
            <div className="grid grid-cols-1 gap-6">
              {[
                { label: "Resume Intelligence", icon: FileText, score: session.resumeScore, color: "bg-blue-500" },
                { label: "Speech & Analysis", icon: Mic, score: session.speechScore, color: "bg-purple-500" },
                { label: "Voice Verification", icon: UserCheck, score: session.voiceScore, color: "bg-cyan-500" },
                { label: "Smart Proctoring", icon: ShieldCheck, score: session.proctoringScore, color: "bg-green-500" },
              ].map((s, idx) => (
                <div key={idx} className="space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <div className="flex items-center gap-2 font-bold text-slate-700">
                      <s.icon className="h-4 w-4" /> {s.label}
                    </div>
                    <span className="font-mono font-bold">{s.score}%</span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full ${s.color} rounded-full transition-all duration-1000`} style={{ width: `${s.score}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Q&A Breakdown */}
        {session.answers.length > 0 && (
          <section className="space-y-6">
            <h3 className="text-lg font-heading font-bold flex items-center gap-2">
              <Mic className="h-5 w-5 text-purple-500" /> Interview Q&A Analysis
            </h3>
            <div className="space-y-4">
              {session.answers.map((ans, idx) => (
                <Card key={idx} className="border-slate-100 shadow-sm">
                  <CardContent className="p-6 space-y-4">
                    <div className="flex items-start justify-between gap-4">
                      <p className="text-sm font-bold text-slate-700">Q{idx + 1}: {ans.question}</p>
                      <Badge className="bg-blue-50 text-blue-600 border-none font-bold shrink-0">
                        {ans.speechAnalysis.score}%
                      </Badge>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-4">
                      <p className="text-xs font-bold text-slate-400 uppercase mb-1">Candidate Response</p>
                      <p className="text-sm text-slate-600 italic leading-relaxed">
                        "{ans.transcript || 'No response captured'}"
                      </p>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      {[
                        { label: "Confidence", val: ans.speechAnalysis.confidence },
                        { label: "Fluency", val: ans.speechAnalysis.fluency },
                        { label: "Clarity", val: ans.speechAnalysis.clarity },
                      ].map((m, i) => (
                        <div key={i} className="text-center p-3 bg-slate-50 rounded-xl">
                          <p className="text-[10px] font-bold text-slate-400 uppercase">{m.label}</p>
                          <p className="text-lg font-bold text-slate-900">{m.val}%</p>
                        </div>
                      ))}
                    </div>
                    {ans.speechAnalysis.keywords.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {ans.speechAnalysis.keywords.map((kw, i) => (
                          <Badge key={i} variant="secondary" className="bg-green-50 text-green-700 border-none font-bold">{kw}</Badge>
                        ))}
                      </div>
                    )}
                    {ans.speechAnalysis.feedback && (
                      <p className="text-xs text-slate-500 italic border-l-2 border-blue-200 pl-3">
                        AI Feedback: {ans.speechAnalysis.feedback}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Proctoring Summary */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-12 pt-8">
          <div className="space-y-6">
            <h3 className="text-lg font-heading font-bold flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-green-500" /> Proctoring Integrity
            </h3>
            <Card className="border-slate-100 shadow-sm">
              <CardContent className="p-0">
                {[
                  { event: "Tab Switch Detected", count: session.tabSwitchCount, status: session.tabSwitchCount === 0 ? "Clean" : "Warning" },
                  { event: "Voice Verification Match", count: `${session.voiceScore}%`, status: session.voiceScore >= 70 ? "Passed" : "Failed" },
                  { event: "Session Completed", count: session.answers.length, status: "Verified" },
                ].map((item, idx) => (
                  <div key={idx} className="px-6 py-4 border-b last:border-0 flex justify-between items-center group cursor-default hover:bg-slate-50 transition-colors">
                    <span className="text-sm font-medium text-slate-600">{item.event}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-mono font-bold text-slate-400">{item.count}</span>
                      <Badge className={item.status === "Clean" || item.status === "Passed" || item.status === "Verified"
                        ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}>{item.status}</Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <h3 className="text-lg font-heading font-bold flex items-center gap-2">
              <Brain className="h-5 w-5 text-blue-500" /> Final AI Recommendation
            </h3>
            <Card className="bg-slate-50 border-none p-6">
              <p className="text-slate-600 leading-relaxed text-sm">
                {session.overallScore >= 85
                  ? "NeuroHire strongly recommends proceeding with this candidate. Their technical skills, communication clarity, and assessment integrity all indicate a high-potential hire."
                  : session.overallScore >= 65
                  ? "NeuroHire suggests a follow-up interview. The candidate shows promise but some areas require further evaluation."
                  : "NeuroHire recommends reviewing other candidates. This candidate may benefit from additional preparation before moving forward."
                }
              </p>
              <div className="flex gap-3 mt-6">
                <Link to="/recruiter" className="flex-1">
                  <Button className="w-full bg-blue-600 hover:bg-blue-700 font-bold h-11">
                    Back to Recruiter Dashboard
                  </Button>
                </Link>
              </div>
            </Card>
          </div>
        </section>

        <footer className="pt-20 text-center space-y-4">
          <div className="flex items-center justify-center gap-2 opacity-50 grayscale">
            <Zap className="h-5 w-5" />
            <span className="font-heading font-bold text-lg">NeuroHire Report Engine</span>
          </div>
          <p className="text-[10px] text-slate-400 uppercase tracking-[0.3em] font-bold">Confident Intelligent Assessment Platform</p>
        </footer>
      </div>
    </div>
  );
}
