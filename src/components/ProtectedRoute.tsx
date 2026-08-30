import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Zap } from 'lucide-react';

function LoadingScreen() {
  return (
    <div className="h-screen bg-[#020617] flex items-center justify-center">
      <div className="w-16 h-16 rounded-2xl bg-blue-600/20 flex items-center justify-center animate-pulse">
        <Zap className="h-8 w-8 text-blue-500" />
      </div>
    </div>
  );
}

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { currentUser, candidateData, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  // Not logged in at all — send to login.
  if (!currentUser) return <Navigate to="/login" replace />;
  // Logged in, but the candidate profile fetch (kicked off right after login)
  // hasn't resolved yet — show a loading state instead of bouncing back to
  // /login, which would otherwise happen on every fresh sign-in.
  if (!candidateData) return <LoadingScreen />;
  return <>{children}</>;
}

export function RecruiterRoute({ children }: { children: ReactNode }) {
  const { loading } = useAuth();
  if (loading) return <LoadingScreen />;
  // Recruiter auth is handled inside RecruiterDashboard via its own useEffect
  return <>{children}</>;
}
