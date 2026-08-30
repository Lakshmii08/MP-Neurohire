import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { ThemeProvider } from '@/components/theme-provider';
import { AuthProvider } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import Landing from '@/pages/Landing';
import Login from '@/pages/Login';
import CandidateDashboard from '@/pages/CandidateDashboard';
import ResumeAnalysis from '@/pages/ResumeAnalysis';
import InterviewScreen from '@/pages/InterviewScreen';
import VoiceAuth from '@/pages/VoiceAuth';
import ProctoringDashboard from '@/pages/ProctoringDashboard';
import RecruiterDashboard from '@/pages/RecruiterDashboard';
import RecruiterJobs from '@/pages/RecruiterJobs';
import RecruiterAuth from '@/pages/RecruiterAuth';
import CandidateReport from '@/pages/CandidateReport';
import Analytics from '@/pages/Analytics';

export default function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="neurohire-theme">
      <AuthProvider>
        <Router>
          <div className="min-h-screen bg-background font-sans antialiased">
            <Routes>
              {/* Public routes */}
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/recruiter/auth" element={<RecruiterAuth />} />

              {/* Protected candidate routes */}
              <Route path="/candidate" element={<ProtectedRoute><CandidateDashboard /></ProtectedRoute>} />
              <Route path="/candidate/resume" element={<ProtectedRoute><ResumeAnalysis /></ProtectedRoute>} />
              <Route path="/candidate/voice-auth" element={<ProtectedRoute><VoiceAuth /></ProtectedRoute>} />
              <Route path="/candidate/interview" element={<ProtectedRoute><InterviewScreen /></ProtectedRoute>} />

              {/* Recruiter routes (auth handled internally) */}
              <Route path="/recruiter" element={<RecruiterDashboard />} />
              <Route path="/recruiter/jobs" element={<RecruiterJobs />} />
              <Route path="/recruiter/proctoring" element={<ProctoringDashboard />} />
              <Route path="/recruiter/analytics" element={<Analytics />} />

              {/* Report — accessible by recruiters */}
              <Route path="/report/:candidateId" element={<CandidateReport />} />
            </Routes>
            <Toaster position="top-right" />
          </div>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}
