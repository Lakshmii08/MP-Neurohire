import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import {
  Briefcase, Plus, MapPin, DollarSign, Users, Building2,
  X, CheckCircle2, ArrowRight
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import RecruiterSidebar from "@/components/RecruiterSidebar";

interface Job {
  id: number;
  title: string;
  company: string;
  location: string;
  type: string;
  salary: string;
  experience_level: string;
  required_skills: string;
  description: string;
  applicants: number;
  status: string;
}

const emptyForm = {
  title: "",
  location: "Remote",
  type: "Full-time",
  salary: "",
  experience_level: "",
  required_skills: "",
  description: "",
};

export default function RecruiterJobs() {
  const navigate = useNavigate();
  const { currentUser, loading: authLoading } = useAuth();
  const [recruiterData, setRecruiterData] = useState<any>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(emptyForm);

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
    fetchJobs();
  }, [currentUser, authLoading, navigate]);

  const fetchJobs = () => {
    setLoading(true);
    fetch('/api/jobs')
      .then(res => res.json())
      .then(data => setJobs(Array.isArray(data) ? data : []))
      .catch(() => toast.error("Failed to load job postings."))
      .finally(() => setLoading(false));
  };

  const parseSkills = (raw: string): string[] => {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const handlePostJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      toast.error("Job title is required.");
      return;
    }
    const skillsArray = form.required_skills
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    setSubmitting(true);
    try {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title.trim(),
          company: recruiterData?.companyName || 'NeuroHire Tech',
          location: form.location.trim() || 'Remote',
          type: form.type.trim() || 'Full-time',
          salary: form.salary.trim() || '$120k - $160k',
          experience_level: form.experience_level.trim() || 'Mid-Senior',
          required_skills: skillsArray,
          description: form.description.trim() || 'Join our team building next-generation intelligent platforms.',
          status: 'Open',
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Job posted! It will now be recommended to matching candidates.");
        setForm(emptyForm);
        setShowForm(false);
        fetchJobs();
      } else {
        toast.error(data.message || "Failed to post job.");
      }
    } catch {
      toast.error("Network error connecting to database.");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleStatus = async (job: Job) => {
    const nextStatus = job.status === 'Open' ? 'Closed' : 'Open';
    try {
      const res = await fetch(`/api/jobs/${job.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Job marked as ${nextStatus}.`);
        setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: nextStatus } : j));
      } else {
        toast.error(data.message || "Failed to update job status.");
      }
    } catch {
      toast.error("Network error connecting to database.");
    }
  };

  if (loading && jobs.length === 0) {
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

      {/* Sidebar */}
      <RecruiterSidebar recruiterEmail={recruiterData?.email} />

      {/* Main */}
      <main className="flex-1 overflow-y-auto flex flex-col">
        <header className="h-20 px-8 flex items-center justify-between bg-white/2 backdrop-blur-md border-b border-white/5 sticky top-0 z-20">
          <div>
            <h1 className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-300">
              Job Postings
            </h1>
            <p className="text-[11px] text-slate-400 font-mono mt-0.5">
              {recruiterData?.companyName ?? 'NeuroHire'} • Skill-matched candidate recommendations
            </p>
          </div>
          <Button
            type="button"
            onClick={() => setShowForm(v => !v)}
            className="bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-2xl shadow-lg shadow-blue-600/20 text-xs uppercase tracking-widest px-5 h-11 flex items-center gap-2"
          >
            {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showForm ? "Cancel" : "Post New Job"}
          </Button>
        </header>

        <div className="p-8 space-y-8">
          {showForm && (
            <form onSubmit={handlePostJob} className="bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-xl space-y-5">
              <div>
                <h2 className="text-xl font-heading font-bold text-white">New Job Posting</h2>
                <p className="text-slate-400 text-xs mt-1">
                  Candidates are automatically recommended this role based on skills extracted from their resume analysis.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  required
                  placeholder="Job Title (e.g. Senior Backend Engineer)"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  className="h-12 bg-white/5 border-white/10 text-slate-100 rounded-xl md:col-span-2"
                />
                <Input
                  placeholder="Location (e.g. Remote / Bengaluru)"
                  value={form.location}
                  onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                  className="h-12 bg-white/5 border-white/10 text-slate-100 rounded-xl"
                />
                <Input
                  placeholder="Job Type (e.g. Full-time)"
                  value={form.type}
                  onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                  className="h-12 bg-white/5 border-white/10 text-slate-100 rounded-xl"
                />
                <Input
                  placeholder="Salary Range (e.g. $120k - $160k)"
                  value={form.salary}
                  onChange={e => setForm(f => ({ ...f, salary: e.target.value }))}
                  className="h-12 bg-white/5 border-white/10 text-slate-100 rounded-xl"
                />
                <Input
                  placeholder="Experience Level (e.g. 2-4 Years)"
                  value={form.experience_level}
                  onChange={e => setForm(f => ({ ...f, experience_level: e.target.value }))}
                  className="h-12 bg-white/5 border-white/10 text-slate-100 rounded-xl"
                />
                <Input
                  placeholder="Required Skills, comma-separated (e.g. React, Node.js, PostgreSQL)"
                  value={form.required_skills}
                  onChange={e => setForm(f => ({ ...f, required_skills: e.target.value }))}
                  className="h-12 bg-white/5 border-white/10 text-slate-100 rounded-xl md:col-span-2"
                />
                <textarea
                  placeholder="Job description and responsibilities..."
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={3}
                  className="h-24 md:col-span-2 bg-white/5 border border-white/10 text-slate-100 placeholder:text-slate-600 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                />
              </div>

              <Button
                type="submit"
                disabled={submitting}
                className="w-full bg-gradient-to-r from-blue-600 via-purple-600 to-cyan-500 hover:opacity-90 text-white font-bold h-13 rounded-2xl shadow-xl shadow-blue-600/30 text-xs uppercase tracking-widest"
              >
                {submitting ? "Posting..." : "Post Job & Enable Matching"}
              </Button>
            </form>
          )}

          <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden backdrop-blur-md">
            <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
              <h3 className="font-semibold text-lg">Your Job Postings</h3>
              <span className="text-xs text-slate-500">{jobs.length} total</span>
            </div>
            {jobs.length === 0 ? (
              <div className="p-12 text-center space-y-2">
                <p className="text-slate-500">No job postings yet.</p>
                <p className="text-slate-600 text-sm">Post a role to start getting skill-matched candidate recommendations.</p>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {jobs.map(job => {
                  const skills = parseSkills(job.required_skills);
                  return (
                    <div key={job.id} className="p-6 flex flex-col md:flex-row md:items-center gap-4 hover:bg-white/5 transition-colors">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-3 flex-wrap">
                          <h4 className="font-bold text-slate-100">{job.title}</h4>
                          <Badge variant="outline" className={`text-[10px] font-bold uppercase tracking-widest ${
                            job.status === 'Open'
                              ? 'bg-green-500/10 text-green-400 border-green-500/20'
                              : 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                          }`}>
                            {job.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-slate-400 flex-wrap">
                          <span className="flex items-center gap-1"><Building2 className="h-3 w-3" /> {job.company}</span>
                          <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {job.location}</span>
                          <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" /> {job.salary}</span>
                          <Link
                            to={`/recruiter/jobs/${job.id}/applicants`}
                            className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 hover:underline transition-colors"
                          >
                            <Users className="h-3 w-3" /> {job.applicants} applicant{job.applicants === 1 ? '' : 's'}
                          </Link>
                        </div>
                        {skills.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {skills.map((s, i) => (
                              <Badge key={i} variant="outline" className="text-[10px] bg-cyan-500/5 text-cyan-300 border-cyan-500/20">
                                {s}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col gap-2 shrink-0">
                        <Link to={`/recruiter/jobs/${job.id}/applicants`}>
                          <Button
                            type="button"
                            className="w-full h-10 rounded-xl text-xs font-bold uppercase tracking-widest px-4 flex items-center gap-2 bg-cyan-600/10 hover:bg-cyan-600/20 border border-cyan-500/20 text-cyan-300"
                          >
                            View Applicants <ArrowRight className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                        <Button
                          type="button"
                          onClick={() => toggleStatus(job)}
                          className={`h-10 rounded-xl text-xs font-bold uppercase tracking-widest px-4 flex items-center gap-2 ${
                            job.status === 'Open'
                              ? 'bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300'
                              : 'bg-blue-600 hover:bg-blue-500 text-white'
                          }`}
                        >
                          {job.status === 'Open' ? <X className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                          {job.status === 'Open' ? 'Close Role' : 'Reopen Role'}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
