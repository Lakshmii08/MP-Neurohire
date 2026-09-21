import { Link, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Video, Briefcase, BarChart3, LogOut } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

// Shared across every recruiter-facing page (Dashboard, Jobs, Proctoring,
// Analytics) so navigation, active-state highlighting, and logout behave
// identically everywhere instead of each page hand-rolling its own copy —
// several of those copies had drifted (a broken Logout that never cleared
// the session, dead Reports/Candidates/Settings icons with no page behind
// them).
const NAV_ITEMS = [
  { to: "/recruiter", label: "Dashboard", icon: LayoutDashboard },
  { to: "/recruiter/jobs", label: "Job Postings", icon: Briefcase },
  { to: "/recruiter/proctoring", label: "Proctoring", icon: Video },
  { to: "/recruiter/analytics", label: "Analytics", icon: BarChart3 },
];

export default function RecruiterSidebar({ recruiterEmail }: { recruiterEmail?: string }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { setCurrentUser } = useAuth();

  const handleLogout = () => {
    setCurrentUser(null);
    toast.success("Logged out successfully");
    navigate('/recruiter/auth');
  };

  return (
    <aside className="w-20 flex flex-col items-center py-8 gap-10 bg-slate-950/50 border-r border-white/5 backdrop-blur-xl shrink-0">
      <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-purple-600 to-cyan-400 flex items-center justify-center shadow-lg shadow-blue-500/20">
        <div className="w-5 h-5 border-2 border-white rounded-full flex items-center justify-center">
          <div className="w-1 h-1 bg-white rounded-full" />
        </div>
      </div>
      <nav className="flex flex-col gap-6">
        {NAV_ITEMS.map(item => {
          const active = location.pathname === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              title={item.label}
              className={`p-3 rounded-xl transition-all ${active ? 'bg-white/10 text-cyan-400 shadow-inner' : 'text-slate-500 hover:text-white'}`}
            >
              <item.icon className="w-6 h-6" />
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto flex flex-col items-center gap-4">
        <button
          onClick={handleLogout}
          title="Logout"
          className="p-3 rounded-xl text-slate-500 hover:text-red-400 transition-colors"
        >
          <LogOut className="w-6 h-6" />
        </button>
        <div className="w-10 h-10 rounded-full border border-white/20 bg-slate-800 p-0.5">
          <Avatar className="w-full h-full">
            <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${recruiterEmail}`} />
            <AvatarFallback>RC</AvatarFallback>
          </Avatar>
        </div>
      </div>
    </aside>
  );
}
