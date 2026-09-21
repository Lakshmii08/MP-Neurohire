import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Briefcase, Building2, MapPin, FileText, Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import RecruiterSidebar from "@/components/RecruiterSidebar";

interface Job {
  id: number;
  title: string;
  company: string;
  location: string;
  status: string;
}

interface Applicant {
  id: number;
  user_id: number;
  name: string;
  role: string;
  score: number;
  status: string;
  voice: number;
  proctor: number;
  applied_at: string;
}

// The real applicant pipeline for one job — only candidates who actually
// applied to THIS job (via job_applications), not every candidate in the
// system. Reachable from the "View Applicants" link on RecruiterJobs.tsx.
export default function JobApplicants() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const { currentUser, loading: authLoading } = useAuth();
  const [recruiterData, setRecruiterData] = useState<any>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!currentUser || (currentUser.role !== 'recruiter' && currentUser.role !== 'admin')) {
      navigate('/recruiter/auth');
      return;
    }
    fetch(`/api/recruiter/${currentUser.uid}`)
      .then(res => res.json())
      .then(data => { if (data.success) setRecruiterData(data.recruiter); })
      .catch(() => {});
  }, [currentUser, authLoading, navigate]);

  useEffect(() => {
    if (!jobId) return;
    setLoading(true);
    fetch(`/api/jobs/${jobId}/applicants`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setJob(data.job);
          setApplicants(Array.isArray(data.applicants) ? data.applicants : []);
        } else {
          setNotFound(true);
        }
      })
      .catch(() => toast.error("Failed to load applicants."))
      .finally(() => setLoading(false));
  }, [jobId]);

  if (loading) {
    return (
      <div className="h-screen bg-[#020617] flex items-center justify-center">
        <div className="w-16 h-16 rounded-2xl bg-blue-600/20 flex items-center justify-center animate-pulse">
          <Briefcase className="h-8 w-8 text-blue-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#020617] text-slate-100 font-sans overflow-hidden selection:bg-cyan-500/30 relative">
      <div className="absolute -z-10 top-[-200px] left-[-100px] w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px]" />
      <div className="absolute -z-10 bottom-[-200px] right-[-100px] w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[120px]" />

      <RecruiterSidebar recruiterEmail={recruiterData?.email} />

      <main className="flex-1 overflow-y-auto flex flex-col">
        <header className="h-20 px-8 flex items-center justify-between bg-white/2 backdrop-blur-md border-b border-white/5 sticky top-0 z-20">
          <div>
            <Link to="/recruiter/jobs" className="flex items-center gap-1 text-slate-500 hover:text-cyan-400 text-[10px] font-bold uppercase tracking-widest mb-1 transition-colors">
              <ArrowLeft className="h-3 w-3" /> Job Postings
            </Link>
            <h1 className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-300">
              {job ? `Applicants — ${job.title}` : 'Applicants'}
            </h1>
          </div>
        </header>

        <div className="p-8 space-y-8">
          {notFound ? (
            <div className="p-12 text-center space-y-2">
              <p className="text-slate-500">Job not found.</p>
              <Link to="/recruiter/jobs" className="text-cyan-400 hover:underline text-sm">← Back to Job Postings</Link>
            </div>
          ) : (
            <>
              {job && (
                <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-md flex flex-wrap items-center gap-6">
                  <div className="p-3 rounded-2xl bg-blue-600/10 border border-blue-500/20">
                    <Briefcase className="h-6 w-6 text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-[200px]">
                    <h2 className="text-lg font-bold text-white">{job.title}</h2>
                    <div className="flex items-center gap-4 text-xs text-slate-400 mt-1">
                      <span className="flex items-center gap-1"><Building2 className="h-3 w-3" /> {job.company}</span>
                      <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {job.location}</span>
                    </div>
                  </div>
                  <Badge variant="outline" className={`text-[10px] font-bold uppercase tracking-widest ${
                    job.status === 'Open'
                      ? 'bg-green-500/10 text-green-400 border-green-500/20'
                      : 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                  }`}>
                    {job.status}
                  </Badge>
                  <div className="flex items-center gap-2 text-sm font-bold text-cyan-400">
                    <Users className="h-4 w-4" /> {applicants.length} applicant{applicants.length === 1 ? '' : 's'}
                  </div>
                </div>
              )}

              <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden backdrop-blur-md flex flex-col">
                <div className="px-6 py-4 border-b border-white/5">
                  <h3 className="font-semibold text-lg">Candidate Pipeline</h3>
                </div>
                {applicants.length === 0 ? (
                  <div className="p-12 text-center space-y-2">
                    <p className="text-slate-500">No one has applied to this job yet.</p>
                    <p className="text-slate-600 text-sm">Candidates apply by starting the interview for this role from their recommendations.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-white/5">
                        <TableRow className="border-b border-white/5 hover:bg-transparent">
                          <TableHead className="font-bold text-slate-400 uppercase tracking-widest text-[10px]">Candidate</TableHead>
                          <TableHead className="font-bold text-slate-400 uppercase tracking-widest text-[10px]">Score</TableHead>
                          <TableHead className="font-bold text-slate-400 uppercase tracking-widest text-[10px]">Voice</TableHead>
                          <TableHead className="font-bold text-slate-400 uppercase tracking-widest text-[10px]">Proctoring</TableHead>
                          <TableHead className="font-bold text-slate-400 uppercase tracking-widest text-[10px]">Status</TableHead>
                          <TableHead className="text-right font-bold text-slate-400 uppercase tracking-widest text-[10px]">Report</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {applicants
                          .sort((a, b) => b.score - a.score)
                          .map(a => (
                            <TableRow key={a.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                              <TableCell className="flex items-center gap-3 py-4">
                                <Avatar className="h-10 w-10 ring-1 ring-white/10">
                                  <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${a.name}`} />
                                  <AvatarFallback>{a.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="text-sm font-bold text-slate-200">{a.name}</p>
                                  <p className="text-[10px] text-slate-500 uppercase tracking-widest">
                                    Applied {a.applied_at ? new Date(a.applied_at).toLocaleDateString() : 'recently'}
                                  </p>
                                </div>
                              </TableCell>
                              <TableCell>
                                <span className="font-mono font-bold text-xs text-cyan-400">{a.score}%</span>
                              </TableCell>
                              <TableCell className="text-sm text-slate-400 font-mono">{a.voice}%</TableCell>
                              <TableCell className="text-sm text-slate-400 font-mono">{a.proctor}%</TableCell>
                              <TableCell>
                                <Badge variant="outline" className="bg-white/5 text-slate-300 border-white/10 text-[10px] font-bold uppercase tracking-widest">
                                  {a.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <Link to={`/report/${a.user_id}`} className="p-2 rounded-lg hover:bg-cyan-500/10 text-slate-400 hover:text-cyan-400 transition-colors inline-flex">
                                  <FileText className="h-4 w-4" />
                                </Link>
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
