import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  FileText, 
  Mic, 
  UserCheck, 
  Video, 
  BarChart3, 
  ShieldCheck, 
  ArrowRight,
  Zap,
  Globe,
  Users
} from "lucide-react";
import { Link } from "react-router-dom";
import { ThemeToggle } from "@/components/theme-toggle";

const features = [
  {
    title: "Resume Analysis",
    description: "Deep learning based ATS scoring and skill extraction from any resume format.",
    icon: FileText,
    color: "text-blue-500",
    bg: "bg-blue-500/10"
  },
  {
    title: "Speech Intelligence",
    description: "Analyze fluency, sentiment, and keyword coverage in real-time during interviews.",
    icon: Mic,
    color: "text-purple-500",
    bg: "bg-purple-500/10"
  },
  {
    title: "Voice Authentication",
    description: "Cosine similarity based voice matching to prevent candidate impersonation.",
    icon: UserCheck,
    color: "text-cyan-500",
    bg: "bg-cyan-500/10"
  },
  {
    title: "AI Interview Evaluation",
    description: "Automated scoring based on content, confidence, and role compatibility.",
    icon: Video,
    color: "text-indigo-500",
    bg: "bg-indigo-500/10"
  },
  {
    title: "Webcam Proctoring",
    description: "Face detection, eye tracking, and tab-switch monitoring for total security.",
    icon: ShieldCheck,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10"
  },
  {
    title: "Final Candidate Scoring",
    description: "Aggregated intelligence report with weighted scores across all parameters.",
    icon: BarChart3,
    color: "text-orange-500",
    bg: "bg-orange-500/10"
  }
];

export default function Landing() {
  return (
    <div className="flex flex-col min-h-screen bg-[#020617] text-slate-100 overflow-hidden relative">
      {/* Background Glows */}
      <div className="absolute -z-10 top-[-200px] left-[-100px] w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[120px] animate-pulse"></div>
      <div className="absolute -z-10 bottom-0 right-[-100px] w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-[120px] animate-pulse"></div>
      <div className="absolute -z-10 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-cyan-600/5 rounded-full blur-[150px]"></div>

      {/* Navigation */}
      <header className="px-4 lg:px-12 h-20 flex items-center bg-white/5 border-b border-white/5 backdrop-blur-xl sticky top-0 z-50">
        <Link to="/" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Zap className="h-6 w-6 text-white" />
          </div>
          <span className="text-2xl font-heading font-bold tracking-tight text-white">NeuroHire</span>
        </Link>
        <nav className="ml-auto hidden md:flex gap-8 items-center">
          <Link to="/login" className="text-sm font-bold uppercase tracking-widest text-slate-400 hover:text-cyan-400 transition-colors">Candidate Sign In</Link>
          <Link to="/recruiter/auth" className="text-sm font-bold uppercase tracking-widest text-slate-400 hover:text-cyan-400 transition-colors">Recruiter Sign In</Link>
          <ThemeToggle />
        </nav>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="w-full py-20 md:py-32 lg:py-48 flex justify-center relative">
          <div className="container px-4 md:px-6 relative z-10">
            <div className="flex flex-col items-center space-y-8 text-center max-w-4xl mx-auto">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
                className="space-y-6"
              >
                <div className="inline-flex items-center gap-2 rounded-full bg-white/5 border border-white/10 px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-400 backdrop-blur-md">
                   <Globe className="w-3 h-3" /> Next-Gen Recruitment Framework
                </div>
                <h1 className="text-4xl font-heading font-bold tracking-tighter sm:text-6xl md:text-7xl lg:text-8xl leading-tight">
                  Intelligent <span className="text-gradient">Hiring</span> 
                  <br className="hidden md:block" /> at Scale
                </h1>
                <p className="mx-auto max-w-[700px] text-slate-400 font-medium md:text-xl lg:text-2xl leading-relaxed">
                  Evaluate candidates using neural speech analysis, cognitive intelligence mapping, and zero-trust proctoring.
                </p>
              </motion.div>

            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="w-full py-24 md:py-32 lg:py-48 flex justify-center">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center justify-center space-y-4 text-center mb-20">
              <div className="space-y-4">
                <p className="text-[10px] uppercase font-bold tracking-[0.3em] text-blue-500">Platform Capabilities</p>
                <h2 className="text-4xl font-heading font-bold tracking-tighter sm:text-6xl">Intelligence Architecture</h2>
                <p className="max-w-[700px] text-slate-400 md:text-lg leading-relaxed">
                  NeuroHire integrates multi-layered AI nodes to provide the industry's most granular candidate evaluation.
                </p>
              </div>
            </div>
            <div className="mx-auto grid max-w-7xl items-center gap-6 py-12 lg:grid-cols-3">
              {features.map((feature, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, scale: 0.95 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="h-full"
                >
                  <div className="h-full p-8 bg-white/5 border border-white/10 rounded-3xl backdrop-blur-lg hover:bg-white/10 hover:border-white/20 transition-all group relative overflow-hidden">
                    <div className="absolute -right-4 -bottom-4 w-32 h-32 bg-blue-600/5 rounded-full blur-2xl group-hover:bg-blue-600/10 transition-colors"></div>
                    <div className={`w-14 h-14 rounded-2xl ${feature.bg} flex items-center justify-center mb-6 ring-1 ring-white/10 group-hover:scale-110 group-hover:rotate-3 transition-all`}>
                      <feature.icon className={`h-7 w-7 ${feature.color}`} />
                    </div>
                    <h3 className="text-2xl font-bold font-heading mb-4 text-white">{feature.title}</h3>
                    <p className="text-slate-400 leading-relaxed text-sm">
                      {feature.description}
                    </p>
                    <div className="mt-8 flex items-center text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-cyan-400 cursor-pointer transition-colors border-t border-white/5 pt-6">
                       Learn Architecture <ArrowRight className="ml-2 h-3 w-3" />
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Workflow Timeline */}
        <section className="w-full py-24 md:py-32 lg:py-48 border-t border-white/5 relative">
          <div className="absolute inset-0 bg-gradient-to-b from-blue-600/5 to-transparent pointer-events-none"></div>
          <div className="container px-4 md:px-6 mx-auto relative z-10">
             <div className="flex flex-col items-center text-center mb-24">
                <p className="text-[10px] uppercase font-bold tracking-[0.3em] text-purple-500 mb-4">Pipeline Logic</p>
                <h2 className="text-4xl font-heading font-bold tracking-tighter sm:text-6xl">Operational Workflow</h2>
             </div>
             
             <div className="relative space-y-12 before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-blue-600/20 before:via-cyan-500 before:to-purple-600/20">
                {[
                  { title: "Candidate Onboarding", text: "Resume ingestion with neural skill mapping and identity verification.", step: "01" },
                  { title: "Cognitive Assessment", text: "Technical challenges powered by AI to evaluate problem-solving logic.", step: "02" },
                  { title: "Neural Interview", text: "Voice-driven video interaction with real-time biometric proctoring.", step: "03" },
                  { title: "Aggregated Intelligence", text: "Comprehensive profile generation with multi-point scoring metrics.", step: "04" }
                ].map((item, idx) => (
                  <div key={idx} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
                    <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-slate-900 border border-white/10 text-cyan-400 font-bold shadow-xl shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 group-hover:scale-110 group-hover:bg-blue-600 group-hover:text-white transition-all duration-500 z-10">
                      {item.step}
                    </div>
                    <div className="w-[calc(100%-4rem)] md:w-[calc(50%-3rem)] p-8 rounded-3xl border border-white/5 bg-white/5 backdrop-blur-xl group-hover:bg-white/10 transition-all shadow-2xl relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                         <div className="text-6xl font-bold font-heading">{item.step}</div>
                      </div>
                      <div className="font-bold font-heading text-2xl text-white mb-2 group-hover:text-cyan-400 transition-colors">{item.title}</div>
                      <div className="text-slate-400 leading-relaxed">{item.text}</div>
                    </div>
                  </div>
                ))}
             </div>
          </div>
        </section>
      </main>

      <footer className="w-full py-12 bg-slate-950 border-t border-white/5 relative">
        <div className="container px-4 md:px-12 mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
               <Zap className="h-4 w-4 text-cyan-400" />
             </div>
            <span className="font-bold text-xl font-heading text-white">NeuroHire</span>
          </div>
          <div className="flex gap-12">
            <div className="space-y-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Product</p>
              <ul className="space-y-2 text-sm text-slate-400">
                <li className="hover:text-white cursor-pointer transition-colors">Architecture</li>
                <li className="hover:text-white cursor-pointer transition-colors">Pricing</li>
                <li className="hover:text-white cursor-pointer transition-colors">Security</li>
              </ul>
            </div>
            <div className="space-y-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Legal</p>
              <ul className="space-y-2 text-sm text-slate-400">
                <li className="hover:text-white cursor-pointer transition-colors">Privacy</li>
                <li className="hover:text-white cursor-pointer transition-colors">Compliance</li>
                <li className="hover:text-white cursor-pointer transition-colors">GDPR</li>
              </ul>
            </div>
          </div>
          <div className="text-right">
             <p className="text-sm text-slate-500">© 2024 NeuroHire Intelligence Systems.</p>
             <p className="text-[10px] text-slate-600 uppercase tracking-widest mt-1">Hiring infrastructure for the future.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
