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
  // Must be logged in AND have a candidate profile
  if (!currentUser || !candidateData) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export function RecruiterRoute({ children }: { children: ReactNode }) {
  const { loading } = useAuth();
  if (loading) return <LoadingScreen />;
  // Recruiter auth is handled inside RecruiterDashboard via its own useEffect
  return <>{children}</>;
}
