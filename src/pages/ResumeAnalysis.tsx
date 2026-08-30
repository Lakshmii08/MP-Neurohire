import React, { useState, useRef, useEffect } from "react";
import { motion } from "motion/react";
import {
  Upload, FileText, CheckCircle2, AlertCircle, Zap,
  Brain, Cpu, Target, ArrowLeft,
  GraduationCap, Briefcase, FolderGit2, Mail, Phone, MapPin, Linkedin, Github, Award,
  Sparkles, Layers, ShieldCheck, BriefcaseBusiness, Search, Building2, DollarSign,
  TrendingUp, Check, ArrowRight, RefreshCw, Compass
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from "recharts";
import { useAuth } from "@/contexts/AuthContext";
import { type ResumeAnalysisResult, type JobMatchItem } from "@/lib/gemini";
import { toast } from "sonner";
import { Link, useNavigate } from "react-router-dom";

export default function ResumeAnalysis() {
  const navigate = useNavigate();
  const { currentUser, candidateData, refreshCandidate } = useAuth();
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [resultReady, setResultReady] = useState(!!candidateData?.resumeAnalysis);
  const [result, setResult] = useState<ResumeAnalysisResult | null>(candidateData?.resumeAnalysis ?? null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [suggestedJobs, setSuggestedJobs] = useState<JobMatchItem[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [jobSearch, setJobSearch] = useState("");
  const [jobFilter, setJobFilter] = useState<"all" | "strong" | "good" | "remote">("all");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const progressSteps = [
    { label: "Document Ingestion & File Parsing", threshold: 20 },
    { label: "Entity Extraction & Credential Mining", threshold: 50 },
    { label: "Neural Vectoring & Skill Mapping", threshold: 80 },
    { label: "ATS Alignment Consensus", threshold: 95 },
  ];

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setSelectedFile(file);
  };

  const parseSafeJson = (jsonStr: any, fallback: any = []) => {
    if (!jsonStr) return fallback;
    if (typeof jsonStr === 'object') return jsonStr;
    try {
      return JSON.parse(jsonStr);
    } catch (e) {
      return fallback;
    }
  };

  const fetchJobMatches = async (skills: string[] = [], roleApplied = '', atsScore = 75) => {
    setLoadingJobs(true);
    try {
      if (skills && skills.length > 0) {
        const res = await fetch('/api/candidates/suggested-jobs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ skills, candidateRole: roleApplied, atsScore })
        });
        const data = await res.json();
        if (data.success && data.suggestedJobs) {
          setSuggestedJobs(data.suggestedJobs);
          return;
        }
      }

      if (currentUser?.uid) {
        const res = await fetch(`/api/candidates/matches/${currentUser.uid}`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            setSuggestedJobs(data);
          }
        }
      }
    } catch (err) {
      console.error("Error fetching job suggestions:", err);
    } finally {
      setLoadingJobs(false);
    }
  };

  const loadAnalysisData = async () => {
    if (!currentUser?.uid) return;
    try {
      const profRes = await fetch(`/api/candidates/profile/${currentUser.uid}`);
      const profData = await profRes.json();
      if (profData.success && profData.analysis) {
        const a = profData.analysis;
        const mSkills = parseSafeJson(a.missing_skills, []);
        const formattedSkills = Array.isArray(mSkills)
          ? mSkills.map((s: any) => typeof s === 'string' ? { name: s, gap: 50 } : s)
          : [];

        const techSkills = parseSafeJson(a.technical_skills, []);
        const atsScore = a.ats_score || 75;

        const parsedResult: ResumeAnalysisResult = {
          atsScore: atsScore,
          skills: techSkills,
          softSkills: parseSafeJson(a.soft_skills, []),
          missingSkills: formattedSkills,
          qualifications: parseSafeJson(a.qualifications, []),
          experience: parseSafeJson(a.experience, []),
          projects: parseSafeJson(a.projects, []),
          certifications: parseSafeJson(a.certifications, []),
          contactInfo: parseSafeJson(a.contact_info, {}),
          strengths: parseSafeJson(a.strengths, []),
          weaknesses: parseSafeJson(a.weaknesses, []),
          recommendations: parseSafeJson(a.recommendations, []),
          summary: a.ai_summary || "Dynamic resume analysis completed.",
          globalPercentile: a.global_percentile || "TOP 10%",
          reliabilityScore: a.reliability_score || "EXCELLENT",
          radarData: parseSafeJson(a.radar_data, [
            { subject: 'Frontend', A: 120, fullMark: 150 },
            { subject: 'Backend', A: 110, fullMark: 150 },
            { subject: 'DevOps', A: 80, fullMark: 150 },
            { subject: 'Testing', A: 90, fullMark: 150 },
            { subject: 'Design', A: 100, fullMark: 150 },
            { subject: 'Soft Skills', A: 130, fullMark: 150 }
          ])
        };

        setResult(parsedResult);
        setResultReady(true);
        fetchJobMatches(techSkills, profData.candidate?.role_applied || '', atsScore);
      } else {
        fetchJobMatches([], '', 75);
      }
    } catch (e) {
      console.error("Error loading analysis data:", e);
    }
  };

  useEffect(() => {
    loadAnalysisData();
  }, [currentUser]);

  const startAnalysis = async () => {
    if (!selectedFile && !candidateData?.resumeText) {
      toast.error("Please select a resume file to analyze.");
      return;
    }

    setAnalyzing(true);
    setProgress(0);
    setResultReady(false);

    const interval = setInterval(() => {
      setProgress(v => {
        if (v >= 90) { clearInterval(interval); return 90; }
        return v + 4;
      });
    }, 120);

    try {
      if (selectedFile && currentUser) {
        const formData = new FormData();
        formData.append('resume', selectedFile);
        formData.append('user_id', currentUser.uid);

        const res = await fetch('/api/candidates/resume', {
          method: 'POST',
          body: formData,
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || data.message || "Failed to analyze resume on backend");
        }
      }
      
      await refreshCandidate();
      await loadAnalysisData();

      clearInterval(interval);
      setProgress(100);
      setAnalyzing(false);
      toast.success("Dynamic resume analysis complete!");
    } catch (err: any) {
      clearInterval(interval);
      setAnalyzing(false);
      setProgress(0);
      toast.error("Analysis failed: " + err.message);
    }
  };

  const handleReset = () => {
    setResultReady(false);
    setResult(null);
    setSelectedFile(null);
    setProgress(0);
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 p-6 md:p-12 relative overflow-hidden font-sans">
      {/* Background glow graphics */}
      <div className="absolute -z-10 top-[-200px] right-[-100px] w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[140px]" />
      <div className="absolute -z-10 bottom-[-200px] left-[-100px] w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-[140px]" />

      <div className="max-w-7xl mx-auto space-y-10 relative z-10">
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-white/10 pb-8">
          <div className="space-y-2">
            <Link to="/candidate" className="flex items-center gap-2 text-slate-400 hover:text-cyan-400 text-xs font-bold uppercase tracking-widest transition-colors">
              <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
            </Link>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-blue-600/20 border border-blue-500/30">
                <Brain className="h-7 w-7 text-blue-400" />
              </div>
              <div>
                <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-cyan-400 bg-clip-text text-transparent">
                  Neural Resume Parser & Digest
                </h1>
                <p className="text-xs uppercase font-mono tracking-widest text-slate-400 mt-0.5">
                  Dynamic Multi-Layer AI Credential Extractor · Gemini 2.5 Flash Engine
                </p>
              </div>
            </div>
          </div>

          {resultReady && (
            <div className="flex gap-4">
              <button
                onClick={handleReset}
                className="h-12 px-6 bg-white/5 border border-white/10 rounded-2xl text-slate-300 text-xs font-bold uppercase tracking-widest hover:bg-white/10 hover:border-cyan-500/30 transition-all flex items-center gap-3 shadow-lg"
              >
                <Upload className="h-4 w-4 text-cyan-400" /> Analyze Another Resume
              </button>
            </div>
          )}
        </header>

        {!resultReady ? (
          /* Upload / Ingestion Panel */
          <div className="bg-white/5 border-2 border-dashed border-white/10 rounded-[36px] py-20 px-6 backdrop-blur-xl relative group max-w-3xl mx-auto">
            <div className="absolute inset-0 bg-blue-600/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-[36px]" />
            <div className="flex flex-col items-center justify-center space-y-8 relative">
              {!analyzing ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center space-y-8 max-w-xl mx-auto"
                >
                  <div className="w-24 h-24 rounded-3xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center mx-auto shadow-2xl relative">
                    <div className="absolute inset-0 bg-blue-500 blur-xl opacity-25 animate-pulse" />
                    <Upload className="h-10 w-10 text-cyan-400 relative z-10" />
                  </div>
                  
                  <div className="space-y-3">
                    <h2 className="text-3xl font-bold tracking-tight">Upload Candidate Resume</h2>
                    <p className="text-slate-400 text-sm leading-relaxed">
                      Upload PDF, DOCX, or TXT format. Our Gemini neural engine will dynamically parse qualifications, education, work experience, projects, skills, and contact metadata.
                    </p>
                  </div>

                  {/* File Upload Selector */}
                  <div className="space-y-4 w-full">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.txt,.doc,.docx"
                      className="hidden"
                      onChange={handleFileSelect}
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full py-5 border-2 border-dashed border-white/15 rounded-2xl text-sm font-semibold text-slate-300 hover:border-cyan-500/50 hover:text-white transition-all flex items-center justify-center gap-3 bg-white/2 hover:bg-white/5"
                    >
                      <FileText className="h-5 w-5 text-cyan-400" />
                      {selectedFile ? (
                        <span className="text-cyan-400 font-bold">Selected: {selectedFile.name}</span>
                      ) : (
                        "Click to Browse Resume File (.pdf, .docx, .txt)"
                      )}
                    </button>
                    {!selectedFile && candidateData?.resumeText && (
                      <p className="text-xs text-slate-400 text-center">
                        Or re-analyze your previously uploaded resume text
                      </p>
                    )}
                  </div>

                  <button
                    className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold py-4 rounded-2xl shadow-xl shadow-blue-600/20 transition-all uppercase tracking-widest text-sm disabled:opacity-50"
                    onClick={startAnalysis}
                    disabled={!selectedFile && !candidateData?.resumeText}
                  >
                    Initiate Dynamic Deep Extraction
                  </button>
                </motion.div>
              ) : (
                /* Scanning state */
                <div className="w-full max-w-md space-y-10 py-6">
                  <div className="flex flex-col items-center space-y-4">
                    <div className="relative">
                      <Zap className="h-14 w-14 text-cyan-400 animate-pulse" />
                      <div className="absolute inset-0 blur-xl bg-cyan-400 opacity-40 animate-ping" />
                    </div>
                    <h3 className="text-2xl font-bold tracking-tight">Extracting Credentials...</h3>
                    <p className="text-xs font-mono text-slate-400 uppercase tracking-widest">
                      Gemini 2.5 AI Neural Extraction in Progress
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="h-2.5 w-full bg-white/10 rounded-full overflow-hidden shadow-inner border border-white/5">
                      <div
                        className="h-full bg-gradient-to-r from-blue-600 via-cyan-400 to-green-400 transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs font-mono text-slate-400 font-bold">
                      <span>PARSING_NEURAL_NODES...</span>
                      <span className="text-cyan-400">{progress}%</span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {progressSteps.map((step, i) => (
                      <div
                        key={i}
                        className={`flex items-center gap-4 text-xs font-semibold tracking-wider transition-all ${
                          progress > step.threshold ? "text-green-400" : "text-slate-500"
                        }`}
                      >
                        {progress > step.threshold ? (
                          <div className="w-5 h-5 rounded-lg bg-green-500/20 border border-green-500/30 flex items-center justify-center">
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
                          </div>
                        ) : (
                          <div className="w-5 h-5 rounded-lg border border-white/10 flex items-center justify-center">
                            <div className="w-1.5 h-1.5 rounded-full bg-slate-600 animate-pulse" />
                          </div>
                        )}
                        {step.label}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : result ? (
          /* Analysis Results View */
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
            
            {/* Top Cards: ATS Gauge & Contact / Metadata */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* ATS Gauge Card */}
              <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-2xl flex flex-col justify-between relative overflow-hidden">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-bold text-white">ATS Role Score</h3>
                    <p className="text-xs text-slate-400">Match Accuracy Score</p>
                  </div>
                  <Badge className="bg-green-500/10 text-green-400 border-green-500/20 text-[10px] uppercase tracking-wider font-bold">
                    {result.reliabilityScore}
                  </Badge>
                </div>

                <div className="flex items-center justify-center py-4">
                  <div className="relative h-44 w-44">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle cx="88" cy="88" r="72" stroke="rgba(255,255,255,0.08)" strokeWidth="12" fill="transparent" />
                      <circle
                        cx="88" cy="88" r="72" stroke="currentColor" strokeWidth="12" fill="transparent"
                        strokeDasharray={452}
                        strokeDashoffset={452 - (452 * (result.atsScore || 75)) / 100}
                        className="text-cyan-400 transition-all duration-1000"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-5xl font-extrabold font-mono text-white tracking-tight">
                        {result.atsScore}
                      </span>
                      <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mt-1">
                        / 100 ATS Points
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 border-t border-white/10 pt-4">
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block">Percentile</span>
                    <span className="text-base font-mono font-bold text-cyan-400">{result.globalPercentile}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block">Status</span>
                    <span className="text-base font-mono font-bold text-green-400">Verified</span>
                  </div>
                </div>
              </div>

              {/* Extracted Contact Info Card */}
              <div className="md:col-span-2 bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-2xl flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
                      <Sparkles className="h-5 w-5 text-cyan-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">Extracted Candidate Contact & Links</h3>
                      <p className="text-xs text-slate-400">Metadata identified dynamically by AI parser</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-3.5 rounded-2xl bg-white/2 border border-white/5 flex items-center gap-3">
                      <Mail className="h-4 w-4 text-cyan-400 shrink-0" />
                      <div className="overflow-hidden">
                        <p className="text-[10px] uppercase text-slate-400 font-bold">Email Address</p>
                        <p className="text-xs font-mono font-medium text-slate-200 truncate">
                          {result.contactInfo?.email || currentUser?.email || "Not specified in resume"}
                        </p>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-white/2 border border-white/5 flex items-center gap-3">
                      <Phone className="h-4 w-4 text-cyan-400 shrink-0" />
                      <div className="overflow-hidden">
                        <p className="text-[10px] uppercase text-slate-400 font-bold">Phone Number</p>
                        <p className="text-xs font-mono font-medium text-slate-200 truncate">
                          {result.contactInfo?.phone || "Not specified in resume"}
                        </p>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-white/2 border border-white/5 flex items-center gap-3">
                      <MapPin className="h-4 w-4 text-cyan-400 shrink-0" />
                      <div className="overflow-hidden">
                        <p className="text-[10px] uppercase text-slate-400 font-bold">Location</p>
                        <p className="text-xs font-mono font-medium text-slate-200 truncate">
                          {result.contactInfo?.location || "Not specified in resume"}
                        </p>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-white/2 border border-white/5 flex items-center gap-3">
                      <Linkedin className="h-4 w-4 text-cyan-400 shrink-0" />
                      <div className="overflow-hidden">
                        <p className="text-[10px] uppercase text-slate-400 font-bold">LinkedIn / Web</p>
                        <p className="text-xs font-mono font-medium text-cyan-400 truncate">
                          {result.contactInfo?.linkedin || "Not detected"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-white/10">
                  <p className="text-xs text-slate-300 italic leading-relaxed">
                    <span className="font-bold text-cyan-400">AI Digest: </span>
                    "{result.summary}"
                  </p>
                </div>
              </div>
            </div>

            {/* Structured Content Tabs */}
            <Tabs defaultValue="overview" className="w-full space-y-6">
              <TabsList className="bg-white/5 border border-white/10 p-1.5 rounded-2xl flex flex-wrap gap-2 h-auto">
                <TabsTrigger
                  value="overview"
                  className="rounded-xl px-5 py-2.5 text-xs font-bold uppercase tracking-wider data-[state=active]:bg-blue-600 data-[state=active]:text-white transition-all flex items-center gap-2"
                >
                  <Cpu className="h-4 w-4" /> Overview & Vectoring
                </TabsTrigger>
                <TabsTrigger
                  value="education"
                  className="rounded-xl px-5 py-2.5 text-xs font-bold uppercase tracking-wider data-[state=active]:bg-blue-600 data-[state=active]:text-white transition-all flex items-center gap-2"
                >
                  <GraduationCap className="h-4 w-4" /> Education & Qualifications
                </TabsTrigger>
                <TabsTrigger
                  value="experience"
                  className="rounded-xl px-5 py-2.5 text-xs font-bold uppercase tracking-wider data-[state=active]:bg-blue-600 data-[state=active]:text-white transition-all flex items-center gap-2"
                >
                  <Briefcase className="h-4 w-4" /> Work Experience & Projects
                </TabsTrigger>
                <TabsTrigger
                  value="skills"
                  className="rounded-xl px-5 py-2.5 text-xs font-bold uppercase tracking-wider data-[state=active]:bg-blue-600 data-[state=active]:text-white transition-all flex items-center gap-2"
                >
                  <Target className="h-4 w-4" /> Skills & Intelligence Gaps
                </TabsTrigger>
                <TabsTrigger
                  value="recommendations"
                  className="rounded-xl px-5 py-2.5 text-xs font-bold uppercase tracking-wider data-[state=active]:bg-blue-600 data-[state=active]:text-white transition-all flex items-center gap-2"
                >
                  <Zap className="h-4 w-4" /> AI Recommendations
                </TabsTrigger>
                <TabsTrigger
                  value="jobs"
                  className="rounded-xl px-5 py-2.5 text-xs font-bold uppercase tracking-wider data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-cyan-600 data-[state=active]:text-white transition-all flex items-center gap-2 ring-1 ring-cyan-500/30"
                >
                  <BriefcaseBusiness className="h-4 w-4 text-cyan-300" /> Suggested Job Matches
                  {suggestedJobs.length > 0 && (
                    <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] bg-cyan-400/20 text-cyan-300 font-mono font-bold border border-cyan-400/30">
                      {suggestedJobs.length}
                    </span>
                  )}
                </TabsTrigger>
              </TabsList>

              {/* OVERVIEW TAB */}
              <TabsContent value="overview" className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Radar Chart */}
                  <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-2xl">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-bold">Neural Vector Breakdown</h3>
                        <p className="text-xs text-slate-400">Radar Analysis Across Domains</p>
                      </div>
                      <Badge className="bg-blue-600/20 text-blue-400 border-blue-500/30 text-xs">Radar V2</Badge>
                    </div>
                    <div className="h-[320px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={result.radarData}>
                          <PolarGrid stroke="rgba(255,255,255,0.08)" />
                          <PolarAngleAxis dataKey="subject" tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: 600 }} />
                          <Radar name="Skill Level" dataKey="A" stroke="#38bdf8" fill="#0284c7" fillOpacity={0.4} strokeWidth={2.5} />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Strengths & Weaknesses */}
                  <div className="space-y-6">
                    <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-2xl space-y-4">
                      <div className="flex items-center gap-2 text-green-400 font-bold text-sm uppercase tracking-wider">
                        <CheckCircle2 className="h-4 w-4" /> Extracted Candidate Strengths
                      </div>
                      <div className="space-y-2.5">
                        {result.strengths && result.strengths.length > 0 ? (
                          result.strengths.map((str, idx) => (
                            <div key={idx} className="p-3 rounded-xl bg-green-500/5 border border-green-500/10 text-xs text-slate-200 font-medium flex items-start gap-2.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0 mt-1.5" />
                              {str}
                            </div>
                          ))
                        ) : (
                          <p className="text-xs text-slate-400 italic">No explicit strengths captured.</p>
                        )}
                      </div>
                    </div>

                    <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-2xl space-y-4">
                      <div className="flex items-center gap-2 text-amber-400 font-bold text-sm uppercase tracking-wider">
                        <AlertCircle className="h-4 w-4" /> Areas for Growth / Weaknesses
                      </div>
                      <div className="space-y-2.5">
                        {result.weaknesses && result.weaknesses.length > 0 ? (
                          result.weaknesses.map((wk, idx) => (
                            <div key={idx} className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/10 text-xs text-slate-200 font-medium flex items-start gap-2.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0 mt-1.5" />
                              {wk}
                            </div>
                          ))
                        ) : (
                          <p className="text-xs text-slate-400 italic">No critical weaknesses identified.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* EDUCATION & QUALIFICATIONS TAB */}
              <TabsContent value="education" className="space-y-6">
                <div className="bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-2xl space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20">
                      <GraduationCap className="h-6 w-6 text-purple-400" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold">Extracted Educational Qualifications</h3>
                      <p className="text-xs text-slate-400">Academic degrees, institutions, and graduation records extracted by AI</p>
                    </div>
                  </div>

                  {result.qualifications && result.qualifications.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {result.qualifications.map((q, idx) => (
                        <div key={idx} className="p-6 rounded-2xl bg-white/2 border border-white/10 hover:border-purple-500/40 transition-all space-y-3 relative group">
                          <div className="flex justify-between items-start">
                            <Badge className="bg-purple-500/10 text-purple-300 border-purple-500/20 text-xs font-mono font-bold">
                              {q.year || "Graduated"}
                            </Badge>
                          </div>
                          <div>
                            <h4 className="text-lg font-bold text-white group-hover:text-purple-300 transition-colors">{q.degree}</h4>
                            <p className="text-sm font-semibold text-cyan-400 mt-0.5">{q.institution}</p>
                            {q.fieldOfStudy && (
                              <p className="text-xs text-slate-400 mt-1">Field of Study: {q.fieldOfStudy}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 text-center border border-white/5 rounded-2xl bg-white/2">
                      <GraduationCap className="h-10 w-10 text-slate-600 mx-auto mb-3" />
                      <p className="text-sm text-slate-400">No explicit degree records detected in the resume text.</p>
                    </div>
                  )}

                  {/* Certifications section if present */}
                  {result.certifications && result.certifications.length > 0 && (
                    <div className="pt-6 border-t border-white/10 space-y-4">
                      <h4 className="text-base font-bold text-white flex items-center gap-2">
                        <Award className="h-5 w-5 text-amber-400" /> Extracted Certifications
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {result.certifications.map((c, i) => (
                          <div key={i} className="p-4 rounded-xl bg-white/2 border border-white/5 space-y-1">
                            <p className="text-xs font-bold text-white">{c.name}</p>
                            <p className="text-[11px] text-slate-400">{c.issuer} {c.year ? `· ${c.year}` : ''}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* WORK EXPERIENCE & PROJECTS TAB */}
              <TabsContent value="experience" className="space-y-6">
                <div className="bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-2xl space-y-8">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20">
                      <Briefcase className="h-6 w-6 text-blue-400" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold">Extracted Work Experience Timeline</h3>
                      <p className="text-xs text-slate-400">Career history, employment roles, and responsibilities</p>
                    </div>
                  </div>

                  {result.experience && result.experience.length > 0 ? (
                    <div className="space-y-6 border-l-2 border-blue-500/30 pl-6 ml-3">
                      {result.experience.map((exp, idx) => (
                        <div key={idx} className="relative space-y-2 group">
                          <div className="absolute -left-[31px] top-1.5 w-4 h-4 rounded-full bg-blue-500 border-4 border-[#020617] group-hover:scale-125 transition-transform" />
                          <div className="flex flex-wrap justify-between items-baseline gap-2">
                            <h4 className="text-lg font-bold text-white group-hover:text-blue-400 transition-colors">{exp.role}</h4>
                            <span className="text-xs font-mono font-bold text-cyan-400 bg-cyan-500/10 px-3 py-1 rounded-full border border-cyan-500/20">
                              {exp.duration}
                            </span>
                          </div>
                          <p className="text-sm font-semibold text-slate-300">{exp.company}</p>
                          <p className="text-xs text-slate-400 leading-relaxed pt-1">{exp.description}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 text-center border border-white/5 rounded-2xl bg-white/2">
                      <Briefcase className="h-10 w-10 text-slate-600 mx-auto mb-3" />
                      <p className="text-sm text-slate-400">No explicit work experience timeline detected in resume text.</p>
                    </div>
                  )}

                  {/* Projects Section */}
                  {result.projects && result.projects.length > 0 && (
                    <div className="pt-8 border-t border-white/10 space-y-6">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
                          <FolderGit2 className="h-5 w-5 text-cyan-400" />
                        </div>
                        <h4 className="text-lg font-bold text-white">Extracted Key Projects</h4>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {result.projects.map((proj, idx) => (
                          <div key={idx} className="p-5 rounded-2xl bg-white/2 border border-white/5 space-y-3">
                            <h5 className="text-sm font-bold text-white">{proj.name}</h5>
                            <p className="text-xs text-slate-400 leading-relaxed">{proj.description}</p>
                            {proj.technologies && proj.technologies.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 pt-2">
                                {proj.technologies.map((t, i) => (
                                  <Badge key={i} variant="outline" className="bg-white/5 text-slate-300 border-white/10 text-[10px]">
                                    {t}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* SKILLS & GAPS TAB */}
              <TabsContent value="skills" className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Extracted Technical & Soft Skills */}
                  <div className="lg:col-span-2 bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-2xl space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-xl font-bold">Extracted Tech Stack & Skills</h3>
                        <p className="text-xs text-slate-400">Parsed technical proficiencies and soft skills</p>
                      </div>
                      <Badge className="bg-green-500/10 text-green-400 border-green-500/20 text-xs">
                        {result.skills.length} Tech Skills Extracted
                      </Badge>
                    </div>

                    <div className="space-y-4">
                      <h4 className="text-xs uppercase font-bold text-slate-400 tracking-wider">Technical Skills</h4>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {result.skills.map((skill, idx) => (
                          <div key={idx} className="p-3 rounded-xl bg-white/2 border border-white/5 flex items-center justify-between group hover:border-cyan-500/30 transition-all">
                            <span className="text-xs font-semibold text-slate-200">{skill}</span>
                            <CheckCircle2 className="h-3.5 w-3.5 text-cyan-400 opacity-60 group-hover:opacity-100" />
                          </div>
                        ))}
                      </div>
                    </div>

                    {result.softSkills && result.softSkills.length > 0 && (
                      <div className="space-y-4 pt-4 border-t border-white/10">
                        <h4 className="text-xs uppercase font-bold text-slate-400 tracking-wider">Soft Skills & Competencies</h4>
                        <div className="flex flex-wrap gap-2">
                          {result.softSkills.map((ss, idx) => (
                            <Badge key={idx} className="bg-blue-600/10 text-blue-300 border-blue-500/20 text-xs py-1.5 px-3">
                              {ss}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Intelligence Skill Gap Chart */}
                  <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-2xl flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 rounded-xl bg-red-500/10 border border-red-500/20">
                          <Target className="h-5 w-5 text-red-400" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold">Skill Shortage Gaps</h3>
                          <p className="text-[10px] uppercase font-mono text-slate-400">Target Role Gaps</p>
                        </div>
                      </div>

                      <div className="h-[220px] w-full mt-4">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={result.missingSkills} layout="vertical">
                            <XAxis type="number" hide />
                            <YAxis type="category" dataKey="name" width={95} tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: 600 }} axisLine={false} tickLine={false} />
                            <Tooltip cursor={{ fill: 'rgba(255,255,255,0.03)' }} contentStyle={{ backgroundColor: 'rgba(15,23,42,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '12px' }} />
                            <Bar dataKey="gap" radius={[0, 6, 6, 0]} barSize={16}>
                              {result.missingSkills.map((_, index) => (
                                <Cell key={`cell-${index}`} fill={index === 0 ? '#ef4444' : '#f59e0b'} fillOpacity={0.85} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-300 font-medium leading-relaxed mt-4 flex gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                      Adding certifications or projects in these gap areas will boost ATS score.
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* AI RECOMMENDATIONS TAB */}
              <TabsContent value="recommendations" className="space-y-6">
                <div className="bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-2xl space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
                      <Zap className="h-6 w-6 text-cyan-400" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold">Actionable Optimization Recommendations</h3>
                      <p className="text-xs text-slate-400">AI suggestions to maximize recruitment and ATS ranking</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {result.recommendations && result.recommendations.length > 0 ? (
                      result.recommendations.map((rec, i) => (
                        <div key={i} className="p-5 rounded-2xl bg-white/2 border border-white/5 hover:border-cyan-500/30 transition-all flex gap-4 items-start">
                          <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0 text-cyan-400 font-mono font-bold text-xs">
                            0{i + 1}
                          </div>
                          <p className="text-sm text-slate-200 font-medium leading-relaxed pt-1">{rec}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-400 italic">No additional recommendations recorded.</p>
                    )}
                  </div>
                </div>
              </TabsContent>
              {/* SUGGESTED JOBS & SKILL MATCHES TAB */}
              <TabsContent value="jobs" className="space-y-6">
                <div className="bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-2xl space-y-8">
                  {/* Header */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-white/10">
                    <div className="flex items-center gap-3">
                      <div className="p-3 rounded-2xl bg-gradient-to-tr from-blue-600 to-cyan-500 shadow-lg shadow-cyan-500/20">
                        <BriefcaseBusiness className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-white flex items-center gap-2">
                          Skill-Based Job Recommendations
                          <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 font-mono font-bold border border-cyan-500/30">
                            Neural Match Engine
                          </span>
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Cross-referencing {result.skills.length} extracted resume skills with live recruiter job profiles
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => fetchJobMatches(result.skills, candidateData?.role, result.atsScore)}
                        disabled={loadingJobs}
                        className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-slate-300 transition-all flex items-center gap-2"
                      >
                        <RefreshCw className={`h-3.5 w-3.5 ${loadingJobs ? 'animate-spin text-cyan-400' : ''}`} />
                        Re-calculate Matches
                      </button>
                    </div>
                  </div>

                  {/* Search and Filters */}
                  <div className="flex flex-col sm:flex-row gap-4 justify-between items-stretch sm:items-center">
                    <div className="relative flex-1 max-w-md">
                      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                      <input
                        type="text"
                        placeholder="Search roles, required skills (e.g. React, Python)..."
                        value={jobSearch}
                        onChange={(e) => setJobSearch(e.target.value)}
                        className="w-full h-11 pl-10 pr-4 bg-white/5 border border-white/10 rounded-xl text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
                      />
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => setJobFilter("all")}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                          jobFilter === "all"
                            ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                            : "bg-white/5 text-slate-400 hover:text-white border border-white/5"
                        }`}
                      >
                        All Roles ({suggestedJobs.length})
                      </button>
                      <button
                        onClick={() => setJobFilter("strong")}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                          jobFilter === "strong"
                            ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
                            : "bg-white/5 text-slate-400 hover:text-emerald-400 border border-white/5"
                        }`}
                      >
                        Strong Matches (85%+)
                      </button>
                      <button
                        onClick={() => setJobFilter("good")}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                          jobFilter === "good"
                            ? "bg-cyan-600 text-white shadow-md shadow-cyan-600/20"
                            : "bg-white/5 text-slate-400 hover:text-cyan-400 border border-white/5"
                        }`}
                      >
                        Good Matches (70%+)
                      </button>
                      <button
                        onClick={() => setJobFilter("remote")}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                          jobFilter === "remote"
                            ? "bg-purple-600 text-white shadow-md shadow-purple-600/20"
                            : "bg-white/5 text-slate-400 hover:text-purple-400 border border-white/5"
                        }`}
                      >
                        Remote Only
                      </button>
                    </div>
                  </div>

                  {/* Jobs List */}
                  {loadingJobs ? (
                    <div className="py-16 text-center space-y-4">
                      <div className="w-12 h-12 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin mx-auto" />
                      <p className="text-sm font-medium text-slate-400">Comparing extracted skills with live database openings...</p>
                    </div>
                  ) : (
                    (() => {
                      const filtered = suggestedJobs.filter(job => {
                        const matchesSearch = 
                          job.title.toLowerCase().includes(jobSearch.toLowerCase()) ||
                          job.company.toLowerCase().includes(jobSearch.toLowerCase()) ||
                          job.requiredSkills.some(s => s.toLowerCase().includes(jobSearch.toLowerCase())) ||
                          job.matchingSkills.some(s => s.toLowerCase().includes(jobSearch.toLowerCase()));

                        if (!matchesSearch) return false;
                        if (jobFilter === "strong") return job.matchScore >= 85;
                        if (jobFilter === "good") return job.matchScore >= 70 && job.matchScore < 85;
                        if (jobFilter === "remote") return job.location.toLowerCase().includes("remote");
                        return true;
                      });

                      if (filtered.length === 0) {
                        return (
                          <div className="p-12 text-center border border-white/5 rounded-2xl bg-white/2 space-y-3">
                            <Compass className="h-10 w-10 text-slate-600 mx-auto" />
                            <p className="text-sm font-semibold text-slate-300">No matching jobs found with the current filter.</p>
                            <p className="text-xs text-slate-500">Try adjusting your search keyword or switching to 'All Roles'.</p>
                          </div>
                        );
                      }

                      return (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {filtered.map((job) => {
                            const isStrong = job.matchScore >= 85;
                            const isGood = job.matchScore >= 70 && job.matchScore < 85;
                            const badgeColor = isStrong
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                              : isGood
                              ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/30"
                              : "bg-amber-500/10 text-amber-400 border-amber-500/30";

                            const ringColor = isStrong ? "text-emerald-400" : isGood ? "text-cyan-400" : "text-amber-400";

                            return (
                              <div
                                key={job.id}
                                className="p-6 rounded-2xl bg-white/2 border border-white/10 hover:border-cyan-500/40 transition-all flex flex-col justify-between space-y-5 relative group"
                              >
                                <div className="space-y-4">
                                  {/* Top Row: Company & Match Badge */}
                                  <div className="flex justify-between items-start gap-3">
                                    <div>
                                      <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
                                        <Building2 className="h-3.5 w-3.5 text-cyan-400" />
                                        <span>{job.company}</span>
                                        <span>•</span>
                                        <span>{job.location}</span>
                                      </div>
                                      <h4 className="text-lg font-bold text-white group-hover:text-cyan-300 transition-colors mt-1">
                                        {job.title}
                                      </h4>
                                    </div>

                                    {/* Match Circular Indicator */}
                                    <div className="flex flex-col items-end shrink-0">
                                      <Badge className={`${badgeColor} text-xs font-mono font-bold px-3 py-1`}>
                                        {job.matchScore}% Match
                                      </Badge>
                                      <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mt-1">
                                        {job.matchBadge}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Badges: Salary, Experience, Type */}
                                  <div className="flex flex-wrap gap-2">
                                    <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/5 text-[11px] font-mono text-slate-300 flex items-center gap-1">
                                      <DollarSign className="h-3 w-3 text-green-400" />
                                      {job.salary}
                                    </span>
                                    <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/5 text-[11px] font-medium text-slate-300">
                                      Exp: {job.experience_level}
                                    </span>
                                    <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/5 text-[11px] font-medium text-slate-300">
                                      {job.type}
                                    </span>
                                  </div>

                                  {/* Description */}
                                  <p className="text-xs text-slate-300 leading-relaxed">
                                    {job.description}
                                  </p>

                                  {/* Matched Skills */}
                                  <div className="space-y-2 pt-2 border-t border-white/5">
                                    <div className="flex items-center justify-between text-[11px]">
                                      <span className="font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                                        <Check className="h-3.5 w-3.5" /> Skills Matched ({job.matchingSkills.length}/{job.requiredSkills.length})
                                      </span>
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                      {job.matchingSkills.map((skill, i) => (
                                        <Badge
                                          key={i}
                                          className="bg-emerald-500/10 text-emerald-300 border-emerald-500/20 text-[10px] font-mono font-medium py-0.5"
                                        >
                                          ✓ {skill}
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>

                                  {/* Missing Skills / Growth Gaps */}
                                  {job.missingSkills.length > 0 && (
                                    <div className="space-y-1.5 pt-1">
                                      <div className="text-[11px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1">
                                        <TrendingUp className="h-3.5 w-3.5" /> Growth Gaps ({job.missingSkills.length})
                                      </div>
                                      <div className="flex flex-wrap gap-1.5">
                                        {job.missingSkills.map((skill, i) => (
                                          <Badge
                                            key={i}
                                            variant="outline"
                                            className="bg-amber-500/5 text-amber-300 border-amber-500/20 text-[10px] font-mono py-0.5"
                                          >
                                            + {skill}
                                          </Badge>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>

                                {/* Action Buttons */}
                                <div className="pt-4 border-t border-white/5 flex gap-3">
                                  <button
                                    onClick={() => navigate(`/candidate/interview?role=${encodeURIComponent(job.title)}`)}
                                    className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold py-3 px-4 rounded-xl text-xs uppercase tracking-wider transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 group-hover:scale-[1.01]"
                                  >
                                    <Zap className="h-4 w-4" /> Start AI Interview for this Role
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </motion.div>
        ) : null}
      </div>
    </div>
  );
}
