import { motion } from "motion/react";
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  ShieldCheck, 
  Filter, 
  Download, 
  Calendar, 
  Layers, 
  Search, 
  ArrowUpRight, 
  Zap, 
  LayoutDashboard,
  Brain,
  Video,
  FileText
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  LineChart, 
  Line, 
  CartesianGrid, 
  ScatterChart, 
  Scatter, 
  ZAxis,
  Legend,
  Cell
} from "recharts";
import { Link } from "react-router-dom";

const resumeVsSpeechData = [
  { x: 85, y: 72, z: 200, name: 'Anay Hire' },
  { x: 92, y: 88, z: 260, name: 'Sarah Connor' },
  { x: 65, y: 45, z: 400, name: 'Jack Sparrow' },
  { x: 78, y: 92, z: 280, name: 'Ellen Ripley' },
  { x: 45, y: 30, z: 500, name: 'James Bond' },
  { x: 88, y: 85, z: 300, name: 'Gordon Freeman' },
  { x: 74, y: 68, z: 220, name: 'Lara Croft' },
  { x: 55, y: 95, z: 180, name: 'Tony Stark' },
];

const violationData = [
  { name: 'Tab Switch', count: 42, color: '#3B82F6' },
  { name: 'Eye Deviation', count: 68, color: '#8B5CF6' },
  { name: 'Identity Risk', count: 12, color: '#EF4444' },
  { name: 'Voice Match', count: 25, color: '#F59E0B' },
  { name: 'Device Detection', count: 31, color: '#22D3EE' },
];

const performanceData = [
  { day: 'Mon', candidates: 120, avgScore: 82 },
  { day: 'Tue', candidates: 156, avgScore: 78 },
  { day: 'Wed', candidates: 210, avgScore: 85 },
  { day: 'Thu', candidates: 180, avgScore: 91 },
  { day: 'Fri', candidates: 240, avgScore: 88 },
  { day: 'Sat', candidates: 90, avgScore: 92 },
  { day: 'Sun', candidates: 65, avgScore: 94 },
];

export default function Analytics() {
  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 flex overflow-hidden selection:bg-cyan-500/30 relative">
      {/* Background Glows */}
      <div className="absolute -z-10 top-[-200px] left-[-100px] w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px]"></div>
      <div className="absolute -z-10 bottom-[-200px] right-[-100px] w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[120px]"></div>

      {/* Recruiter Sidebar */}
      <aside className="w-20 flex flex-col items-center py-8 gap-10 bg-slate-950/50 border-r border-white/5 backdrop-blur-xl shrink-0">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-purple-600 to-cyan-400 flex items-center justify-center shadow-lg shadow-blue-500/20">
          <div className="w-5 h-5 border-2 border-white rounded-full flex items-center justify-center">
            <div className="w-1 h-1 bg-white rounded-full"></div>
          </div>
        </div>
        <nav className="flex flex-col gap-6">
           <Link to="/recruiter" className="p-3 rounded-xl text-slate-500 hover:text-white transition-colors">
              <LayoutDashboard className="w-6 h-6" />
           </Link>
           <Link to="/recruiter/proctoring" className="p-3 rounded-xl text-slate-500 hover:text-white transition-colors">
              <Video className="w-6 h-6" />
           </Link>
           <div className="p-3 rounded-xl text-slate-500 hover:text-white transition-colors cursor-pointer">
              <FileText className="w-6 h-6" />
           </div>
           <div className="p-3 rounded-xl text-slate-500 hover:text-white transition-colors cursor-pointer">
              <Users className="w-6 h-6" />
           </div>
           <Link to="/recruiter/analytics" className="p-3 rounded-xl bg-white/10 text-cyan-400 shadow-inner group transition-all">
              <BarChart3 className="w-6 h-6" />
           </Link>
        </nav>
      </aside>

      {/* Main Analytics Content */}
      <main className="flex-1 overflow-y-auto p-8 space-y-12">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-white/5 pb-8">
           <div className="space-y-1">
              <h1 className="text-4xl font-heading font-bold text-gradient">Hiring Intelligence</h1>
              <p className="text-slate-500 uppercase tracking-[0.2em] text-[10px] font-bold">Cross-candidate Evaluation Insights</p>
           </div>
           <div className="flex gap-4">
              <button className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-slate-300 text-sm flex items-center gap-2 hover:bg-white/10 transition-colors">
                 <Filter className="h-4 w-4" /> Filter Data
              </button>
              <button className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg shadow-lg shadow-blue-500/30 transition-all flex items-center gap-2">
                 <Download className="h-4 w-4" /> Export Report
              </button>
           </div>
        </header>

        {/* Global Performance Summary */}
        <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
           {[
             { label: "Market Fit Index", val: "84.2", trend: "+5.4%", icon: TrendingUp, color: "text-blue-500" },
             { label: "Integrity Confidence", val: "92.8%", trend: "+1.2%", icon: ShieldCheck, color: "text-green-500" },
             { label: "Active Job Slots", val: "12", trend: "0.0%", icon: Zap, color: "text-orange-500" },
             { label: "Total Candidates", val: "1.2k+", trend: "+12.4%", icon: Users, color: "text-purple-500" },
           ].map((card, i) => (
             <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-md relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                   <card.icon className="h-12 w-12" />
                </div>
                <p className="text-[10px] uppercase font-bold text-slate-500 tracking-[0.2em] mb-1">{card.label}</p>
                <div className="flex items-end gap-3">
                   <h3 className="text-3xl font-bold">{card.val}</h3>
                   <span className={`text-[10px] font-bold mb-1.5 ${card.trend.startsWith('+') ? 'text-green-500' : 'text-slate-500'}`}>
                      {card.trend}
                   </span>
                </div>
             </div>
           ))}
        </section>

        {/* Advanced Charting Area */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
           {/* Scatter Plot: Resume vs Speech */}
           <div className="lg:col-span-2 bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-md">
              <div className="mb-6">
                 <h3 className="font-heading font-bold text-xl flex items-center gap-2">
                    <Brain className="h-5 w-5 text-cyan-400" /> Neural Mapping
                 </h3>
                 <p className="text-slate-500 text-xs uppercase tracking-widest mt-1">Resume Intel vs Speech Clarity</p>
              </div>
              <div className="h-96 w-full">
                 <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                       <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                       <XAxis type="number" dataKey="x" name="Resume Score" unit="%" stroke="#475569" tick={{ fontSize: 10 }} />
                       <YAxis type="number" dataKey="y" name="Speech Score" unit="%" stroke="#475569" tick={{ fontSize: 10 }} />
                       <ZAxis type="number" dataKey="z" range={[60, 400]} name="Confidence" />
                       <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ backgroundColor: '#020617', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }} />
                       <Legend />
                       <Scatter name="Selected Candidates" data={resumeVsSpeechData} fill="#2563EB">
                          {resumeVsSpeechData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.x > 80 && entry.y > 80 ? '#10B981' : '#2563EB'} />
                          ))}
                       </Scatter>
                    </ScatterChart>
                 </ResponsiveContainer>
              </div>
           </div>

           {/* Bar Chart: Proctoring Violations */}
           <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-md">
              <div className="mb-6">
                 <h3 className="font-heading font-bold text-xl flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-red-500" /> Integrity Audit
                 </h3>
                 <p className="text-slate-500 text-xs uppercase tracking-widest mt-1">Cohort Violation Distribution</p>
              </div>
              <div className="h-80 w-full mt-4">
                 <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={violationData} layout="vertical" margin={{ left: -20 }}>
                       <XAxis type="number" hide />
                       <YAxis dataKey="name" type="category" width={100} tick={{ fill: '#94A3B8', fontSize: 11 }} />
                       <Tooltip contentStyle={{ backgroundColor: '#020617', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }} />
                       <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                          {violationData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                       </Bar>
                    </BarChart>
                 </ResponsiveContainer>
              </div>
              <div className="mt-8 p-4 rounded-xl bg-red-500/5 border border-red-500/20 text-xs text-red-400 space-y-2">
                 <p className="font-bold uppercase tracking-widest flex items-center gap-2">
                    <ShieldCheck className="h-3 w-3" /> System Insight
                 </p>
                 <p className="leading-relaxed opacity-70">Identity Risk violations have decreased by 14% since implementation.</p>
              </div>
           </div>

           {/* Line Chart: Performance Trends */}
           <div className="lg:col-span-3 bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-md">
              <div className="flex flex-row items-center justify-between mb-8">
                 <div>
                    <h3 className="font-heading font-bold text-xl flex items-center gap-2">
                       <TrendingUp className="h-5 w-5 text-green-500" /> Market Trajectory
                    </h3>
                    <p className="text-slate-500 text-xs uppercase tracking-widest mt-1">Volume vs Aggregate Skill Score</p>
                 </div>
                 <Tabs defaultValue="week">
                    <TabsList className="bg-white/5 border border-white/10 p-1">
                       <TabsTrigger value="week" className="data-[state=active]:bg-white/10">1W</TabsTrigger>
                       <TabsTrigger value="month" className="data-[state=active]:bg-white/10">1M</TabsTrigger>
                       <TabsTrigger value="quarter" className="data-[state=active]:bg-white/10">1Q</TabsTrigger>
                    </TabsList>
                 </Tabs>
              </div>
              <div className="h-64 w-full pt-4">
                 <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={performanceData}>
                       <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                       <XAxis dataKey="day" stroke="#475569" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                       <YAxis stroke="#475569" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                       <Tooltip contentStyle={{ backgroundColor: '#020617', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }} />
                       <Line type="monotone" dataKey="candidates" stroke="#2563EB" strokeWidth={3} dot={{ fill: '#2563EB', strokeWidth: 2 }} activeDot={{ r: 8 }} />
                       <Line type="monotone" dataKey="avgScore" stroke="#10B981" strokeWidth={3} dot={{ fill: '#10B981', strokeWidth: 2 }} />
                    </LineChart>
                 </ResponsiveContainer>
              </div>
           </div>
        </section>
      </main>
    </div>
  );
}
