import { useState, useEffect } from "react";
import { motion } from "motion/react";
import {
  ShieldAlert, Eye, Layout as TabIcon, Users, Activity,
  UserX, Camera, RefreshCw, Flag, AlertTriangle, Monitor, ScanFace
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import RecruiterSidebar from "@/components/RecruiterSidebar";

interface Session {
  id: string; // user_id — correlates with proctor_logs.user_id
  candidateName: string;
  role: string;
  overallScore: number;
  tabSwitchCount: number;
}

interface LogEntry {
  user_id: number;
  event: string;
  time: string;
  type: string;
  severity: string;
  tab_switching: number;
  multiple_face: number;
  no_face: number;
  suspicious_activity: number;
}

export default function ProctoringDashboard() {
  const { currentUser, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [interviews, setInterviews] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [allLogs, setAllLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!currentUser || (currentUser.role !== 'recruiter' && currentUser.role !== 'admin')) {
      navigate('/recruiter/auth');
    }
  }, [currentUser, authLoading, navigate]);

  // Real candidate list + real proctor_logs from the database — tab-switch
  // events are persisted the moment they happen (see InterviewScreen.tsx +
  // POST /api/interviews/proctor-event), so this reflects actual activity
  // rather than a per-browser-tab in-memory placeholder.
  const loadData = () => {
    return Promise.all([
      fetch('/api/candidates').then(r => r.json()),
      fetch('/api/logs').then(r => r.json()),
    ]).then(([candidates, logs]: [any[], any[]]) => {
      const logList: LogEntry[] = Array.isArray(logs) ? logs : [];
      setAllLogs(logList);
      const sessions: Session[] = (Array.isArray(candidates) ? candidates : []).map((c: any) => ({
        id: String(c.user_id),
        candidateName: c.name || 'Candidate',
        role: c.role || 'Candidate',
        overallScore: c.score || 0,
        tabSwitchCount: logList.filter(l => String(l.user_id) === String(c.user_id) && l.tab_switching === 1).length,
      }));
      setInterviews(prev => {
        // Keep the current selection stable across polling refreshes.
        setSelectedSession(current => {
          if (current) {
            return sessions.find(s => s.id === current.id) ?? sessions[0] ?? null;
          }
          return sessions[0] ?? null;
        });
        return sessions;
      });
    });
  };

  useEffect(() => {
    loadData().catch(console.error).finally(() => setLoading(false));
    // Light polling so tab-switch events from an in-progress interview show
    // up without requiring a manual page refresh.
    const interval = setInterval(() => loadData().catch(console.error), 15000);
    return () => clearInterval(interval);
  }, []);

  const proctoringLogs = selectedSession
    ? allLogs.filter(l => String(l.user_id) === selectedSession.id)
    : [];

  const formatTime = (time: string) => time || '--:--:--';

  const suspicionScore = selectedSession
    ? Math.min(100, Math.round((selectedSession.tabSwitchCount / 5) * 100))
    : 0;

  const logIconMap: Record<string, any> = {
    tab_switch: TabIcon,
    face_missing: UserX,
    eye_deviation: Eye,
    multiple_faces: Users,
    phone_detected: Monitor,
  };

  const noFaceCount = proctoringLogs.filter(l => l.no_face === 1).length;
  const multipleFaceCount = proctoringLogs.filter(l => l.multiple_face === 1).length;
  // suspicious_activity is a shared flag reused by three distinct signals
  // (gaze deviation, face-identity mismatch, and voice mismatch) — disambiguate
  // by event text rather than treating the boolean alone as "eye direction",
  // which used to conflate all three under one indicator.
  const gazeDeviationCount = proctoringLogs.filter(l => l.suspicious_activity === 1 && l.event?.toLowerCase().includes('gaze')).length;
  const identityMismatchCount = proctoringLogs.filter(l => l.suspicious_activity === 1 && l.event?.toLowerCase().includes('identity mismatch')).length;

  // Real proctor_logs rows use 'high'/'medium'/'low' severities (see
  // db.js seed data); events created directly by this app use 'warning'/
  // 'critical'. Map both conventions so real data renders with sensible
  // colors instead of falling back to generic gray.
  const logColorMap: Record<string, string> = {
    warning: 'text-orange-500',
    medium: 'text-orange-500',
    critical: 'text-red-500',
    high: 'text-red-500',
    low: 'text-slate-400',
  };

  const statusColorMap: Record<string, string> = {
    warning: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    medium: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    critical: 'bg-red-500/10 text-red-400 border-red-500/20',
    high: 'bg-red-500/10 text-red-400 border-red-500/20',
    low: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  };

  // Real indicators, backed by MediaPipe FaceLandmarker events persisted from
  // InterviewScreen.tsx (no_face / multiple_face / suspicious_activity
  // columns in proctor_logs) — no more hardcoded "Safe" placeholders for
  // Face Detected / Multiple Faces / Eye Direction / Identity Verification.
  // Phone Presence has no real detector behind it yet, so it's shown as
  // "Not Monitored" rather than a fake green status.
  const indicators = selectedSession ? [
    { label: "Face Detected", status: noFaceCount > 0 ? "Danger" : "Safe", icon: Camera, color: noFaceCount > 0 ? "text-red-400" : "text-green-400", bg: noFaceCount > 0 ? "bg-red-500/10" : "bg-green-500/10" },
    { label: "Eye Direction", status: gazeDeviationCount > 0 ? "Warning" : "Safe", icon: Eye, color: gazeDeviationCount > 0 ? "text-orange-400" : "text-green-400", bg: gazeDeviationCount > 0 ? "bg-orange-500/10" : "bg-green-500/10" },
    { label: "Identity Verification", status: identityMismatchCount > 0 ? "Danger" : "Safe", icon: ScanFace, color: identityMismatchCount > 0 ? "text-red-400" : "text-green-400", bg: identityMismatchCount > 0 ? "bg-red-500/10" : "bg-green-500/10" },
    { label: "Multiple Faces", status: multipleFaceCount > 0 ? "Danger" : "Safe", icon: Users, color: multipleFaceCount > 0 ? "text-red-400" : "text-green-400", bg: multipleFaceCount > 0 ? "bg-red-500/10" : "bg-green-500/10" },
    { label: "Tab Switching", status: selectedSession.tabSwitchCount > 0 ? "Danger" : "Safe", icon: TabIcon, color: selectedSession.tabSwitchCount > 0 ? "text-red-400" : "text-green-400", bg: selectedSession.tabSwitchCount > 0 ? "bg-red-500/10" : "bg-green-500/10" },
    { label: "Phone Presence", status: "Not Monitored", icon: Monitor, color: "text-slate-500", bg: "bg-slate-500/10" },
  ] : [];

  return (
    <div className="flex h-screen bg-[#020617] text-slate-100 overflow-hidden relative">
      <div className="absolute -z-10 top-[-200px] right-[-100px] w-[500px] h-[500px] bg-red-600/5 rounded-full blur-[120px]" />
      <div className="absolute -z-10 bottom-[-200px] left-[-100px] w-[500px] h-[500px] bg-blue-600/5 rounded-full blur-[120px]" />

      <RecruiterSidebar />

      <main className="flex-1 overflow-y-auto p-8 space-y-8">
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-white/5 pb-8">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-red-600/10 border border-red-500/20">
                <ShieldAlert className="h-6 w-6 text-red-500 animate-pulse" />
              </div>
              <h1 className="text-4xl font-heading font-bold text-gradient">Smart Proctoring</h1>
            </div>
            <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-slate-500">Real-time Biometric Integrity Monitoring</p>
          </div>
          <div className="flex gap-4">
            <div className="bg-white/5 border border-white/10 p-3 rounded-2xl flex items-center gap-4 backdrop-blur-md">
              <div className="text-right">
                <p className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">Global Suspicion</p>
                <p className={`text-xl font-mono font-bold ${suspicionScore > 30 ? 'text-red-400' : 'text-green-400'}`}>{suspicionScore}%</p>
              </div>
              <div className="w-24 h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div className={`h-full ${suspicionScore > 30 ? 'bg-red-500' : 'bg-green-500'} transition-all`} style={{ width: `${suspicionScore}%` }} />
              </div>
            </div>
          </div>
        </header>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-600/20 flex items-center justify-center animate-pulse mx-auto">
                <Activity className="h-6 w-6 text-blue-400" />
              </div>
              <p className="text-slate-500 text-sm">Loading proctoring data...</p>
            </div>
          </div>
        ) : interviews.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center space-y-4">
              <ShieldAlert className="h-16 w-16 text-slate-700 mx-auto" />
              <p className="text-slate-500 font-bold">No interview sessions recorded yet.</p>
              <p className="text-slate-600 text-sm">Proctoring data will appear here once candidates complete interviews.</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Left: Webcam + Indicators */}
            <div className="lg:col-span-3 space-y-8">
              {/* Session selector */}
              <div className="flex gap-3 overflow-x-auto pb-2">
                {interviews.slice(0, 5).map((sess, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedSession(sess)}
                    className={`flex-shrink-0 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${
                      selectedSession?.id === sess.id
                        ? 'bg-blue-600 text-white'
                        : 'bg-white/5 border border-white/10 text-slate-400 hover:bg-white/10'
                    }`}
                  >
                    {sess.candidateName.split(' ')[0]}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Webcam simulation */}
                <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden relative group aspect-video flex items-center justify-center backdrop-blur-md">
                  <div className="absolute inset-0 bg-slate-950/40 flex items-center justify-center">
                    <UserX className="h-20 w-20 text-slate-800" />
                  </div>
                  <div className="absolute top-1/4 left-1/3 w-1/3 h-1/2 border-2 border-cyan-400 rounded-2xl flex items-center justify-center shadow-[0_0_20px_rgba(34,211,238,0.2)]">
                    <div className="bg-cyan-400 text-slate-950 text-[10px] font-bold px-2 py-0.5 rounded-sm absolute -top-3 uppercase tracking-widest">
                      Face Detected (0.99)
                    </div>
                  </div>
                  <div className="absolute bottom-6 left-6 flex gap-2">
                    <div className="bg-black/60 border border-white/10 backdrop-blur-md rounded-lg px-2 py-1 text-[10px] font-bold text-white uppercase tracking-widest">
                      {selectedSession?.candidateName ?? 'No Session'}
                    </div>
                    <div className="bg-black/60 border border-white/10 backdrop-blur-md rounded-lg px-2 py-1 text-[10px] font-bold text-white uppercase tracking-widest">
                      Score: {selectedSession?.overallScore ?? 0}%
                    </div>
                  </div>
                  <div className="absolute top-6 left-6 px-3 py-1.5 rounded-lg bg-green-600/90 text-white font-bold text-[10px] uppercase tracking-[0.2em]">
                    SESSION COMPLETE
                  </div>
                  <Button size="icon" variant="ghost" className="absolute top-6 right-6 bg-white/5 backdrop-blur-md hover:bg-white/10 text-white border border-white/5">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>

                {/* Status Indicators */}
                <div className="grid grid-cols-2 gap-4">
                  {indicators.map((indicator, idx) => (
                    <div key={idx} className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col items-center justify-center text-center gap-3 backdrop-blur-md group hover:bg-white/10 transition-all">
                      <div className={`p-3 rounded-2xl ${indicator.bg} ring-1 ring-white/5 group-hover:scale-110 transition-transform`}>
                        <indicator.icon className={`h-6 w-6 ${indicator.color}`} />
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{indicator.label}</p>
                        <p className={`text-xs font-bold uppercase tracking-widest ${indicator.color}`}>{indicator.status}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Integrity Timeline */}
              <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-md">
                <div className="flex flex-row items-center justify-between mb-6">
                  <h3 className="font-heading font-bold text-xl">Integrity Timeline</h3>
                  <div className="flex gap-2">
                    <Badge variant="outline" className="text-green-400 bg-green-500/10 border-green-500/20 text-[9px] uppercase font-bold tracking-widest">Normal</Badge>
                    <Badge variant="outline" className="text-orange-400 bg-orange-500/10 border-orange-500/20 text-[9px] uppercase font-bold tracking-widest">Warning</Badge>
                    <Badge variant="outline" className="text-red-400 bg-red-500/10 border-red-500/20 text-[9px] uppercase font-bold tracking-widest">Critical</Badge>
                  </div>
                </div>
                <div className="h-24 w-full flex gap-1 items-end pt-4">
                  {Array.from({ length: 90 }).map((_, i) => {
                    const isTabSwitch = proctoringLogs.some((_, li) => li * 3 === i);
                    const isCritical = i % 25 === 0 && proctoringLogs.length > 0;
                    return (
                      <div
                        key={i}
                        className={`flex-1 rounded-t-sm transition-all duration-300 ${
                          isCritical ? 'bg-red-500 h-20' :
                          isTabSwitch ? 'bg-orange-500 h-10' :
                          'bg-white/5 h-6'
                        }`}
                      />
                    );
                  })}
                </div>
                <div className="flex justify-between mt-4 text-[9px] font-mono text-slate-500 uppercase font-bold tracking-widest">
                  <span>0:00 Start</span>
                  <span>{proctoringLogs.length} EVENTS LOGGED</span>
                </div>
              </div>
            </div>

            {/* Right: Violation Logs */}
            <div className="space-y-8 h-full">
              <div className="bg-white/5 border border-white/10 rounded-3xl p-0 backdrop-blur-md h-full flex flex-col">
                <div className="p-6 border-b border-white/5">
                  <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                    <Activity className="h-4 w-4 text-cyan-400" />
                    Violation Logs
                    {proctoringLogs.length > 0 && (
                      <span className="ml-auto text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full font-mono">
                        {proctoringLogs.length}
                      </span>
                    )}
                  </h3>
                </div>
                <div className="flex-1 overflow-y-auto max-h-64">
                  <div className="divide-y divide-white/5">
                    {proctoringLogs.length === 0 ? (
                      <div className="px-6 py-8 text-center">
                        <p className="text-slate-600 text-xs font-bold uppercase tracking-widest">No violations logged</p>
                      </div>
                    ) : (
                      proctoringLogs.map((log, idx) => {
                        const eventLower = (log.event || '').toLowerCase();
                        const IconComp = log.tab_switching ? TabIcon
                          : log.multiple_face ? Users
                          : log.no_face ? UserX
                          : eventLower.includes('identity mismatch') ? ScanFace
                          : log.suspicious_activity ? Eye
                          : (logIconMap[log.type] ?? AlertTriangle);
                        const severityKey = (log.severity || '').toLowerCase();
                        const colorClass = logColorMap[severityKey] ?? 'text-slate-500';
                        const statusClass = statusColorMap[severityKey] ?? 'bg-slate-500/10 text-slate-400 border-slate-500/20';
                        return (
                          <div key={idx} className="px-6 py-4 flex items-center justify-between hover:bg-white/5 transition-colors cursor-pointer group">
                            <div className="flex items-center gap-4">
                              <div className={`p-2 rounded-xl bg-white/5 group-hover:scale-110 transition-transform ${colorClass}`}>
                                <IconComp className="h-4 w-4" />
                              </div>
                              <div>
                                <p className="text-sm font-bold text-slate-200">{log.event || log.type}</p>
                                <p className="text-[10px] text-slate-500 font-mono">{formatTime(log.time)}</p>
                              </div>
                            </div>
                            <Badge variant="outline" className={`${statusClass} border text-[8px] uppercase tracking-widest font-bold`}>
                              {log.severity}
                            </Badge>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="p-6 border-t border-white/5 space-y-6">
                  {selectedSession && (
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-4">
                      <div className="flex items-center justify-between">
                        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Active Target</p>
                        <Avatar className="h-10 w-10 ring-2 ring-white/10 shadow-lg">
                          <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedSession.candidateName}`} />
                          <AvatarFallback>{selectedSession.candidateName.slice(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white">{selectedSession.candidateName}</p>
                        <p className="text-[10px] text-slate-500 uppercase tracking-widest">Score: {selectedSession.overallScore}%</p>
                        <p className="text-[10px] text-slate-600 uppercase tracking-widest mt-1">
                          Tab Switches: <span className={selectedSession.tabSwitchCount > 0 ? 'text-orange-400 font-bold' : 'text-green-400 font-bold'}>{selectedSession.tabSwitchCount}</span>
                        </p>
                      </div>
                      <Link to={`/report/${selectedSession.id}`}>
                        <button className="w-full text-[10px] font-bold uppercase tracking-widest h-10 border border-white/10 rounded-xl bg-white/5 hover:bg-blue-600/90 hover:text-white hover:border-transparent group transition-all">
                          <Flag className="inline-block mr-2 h-3 w-3 text-cyan-400 group-hover:text-white" />
                          View Full Report
                        </button>
                      </Link>
                    </div>
                  )}

                  <div className="space-y-3">
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">System Sensitivity</p>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-400">Core Engine</span>
                      <span className="text-[10px] font-mono text-cyan-400 font-bold">8.5 / 10</span>
                    </div>
                    <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-cyan-400" style={{ width: '85%' }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
