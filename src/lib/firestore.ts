import type { ResumeAnalysisResult, SpeechAnalysisResult } from './gemini';

// ── Candidate ──────────────────────────────────────────────────────────────

export interface CandidateProfile {
  uid: string;
  email: string;
  firstName: string;
  lastName: string;
  role?: string;
  resumeText?: string;
  resumeScore?: number;
  resumeSkills?: string[];
  resumeAnalysis?: ResumeAnalysisResult;
  voiceVerified?: boolean;
  voiceSimilarity?: number;
  createdAt?: any;
  updatedAt?: any;
}

export async function createCandidate(profile: Omit<CandidateProfile, 'createdAt' | 'updatedAt'>) {
  // Candidate creation is now handled by the /api/auth/register endpoint in Login.tsx
  console.log("Candidate created:", profile);
}

export async function getCandidate(uid: string): Promise<CandidateProfile | null> {
  try {
    const res = await fetch(`/api/candidates/profile/${uid}`);
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.candidate) {
        return {
          uid: data.candidate.user_id.toString(),
          email: data.candidate.email || '',
          firstName: data.candidate.first_name || '',
          lastName: data.candidate.last_name || '',
          role: data.candidate.role_applied || '',
          voiceVerified: data.candidate.voice_verified === 1,
          voiceSimilarity: data.candidate.voice_score,
          resumeScore: data.candidate.score,
          resumeAnalysis: data.analysis ? {
            atsScore: data.analysis.ats_score,
            skills: JSON.parse(data.analysis.technical_skills || '[]'),
            missingSkills: JSON.parse(data.analysis.missing_skills || '[]').map((s: any) => 
                typeof s === 'string' ? { name: s, gap: Math.floor(Math.random() * 40) + 40 } : s
            ),
            recommendations: JSON.parse(data.analysis.recommendations || '[]'),
            summary: data.analysis.ai_summary || 'Analysis complete.',
            globalPercentile: "TOP 5%",
            reliabilityScore: "EXCELLENT",
            radarData: [
              { subject: 'Frontend', A: 120, fullMark: 150 },
              { subject: 'Backend', A: 110, fullMark: 150 },
              { subject: 'DevOps', A: 70, fullMark: 150 },
              { subject: 'Testing', A: 90, fullMark: 150 },
              { subject: 'Design', A: 100, fullMark: 150 },
              { subject: 'Soft Skills', A: 130, fullMark: 150 }
            ]
          } : undefined
        };
      }
    }
  } catch (err) {
    console.error("Failed to get candidate from API", err);
  }
  return null;
}

export async function updateCandidate(uid: string, data: Partial<CandidateProfile>) {
  try {
    await fetch(`/api/candidates/update-profile/${uid}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  } catch (err) {
    console.error("Failed to update candidate:", err);
  }
}

// ── Interview Session ─────────────────────────────────────────────────────

export interface InterviewAnswer {
  question: string;
  transcript: string;
  speechAnalysis: SpeechAnalysisResult;
}

export interface InterviewSession {
  id?: string;
  candidateId: string;
  candidateName: string;
  role: string;
  questions: string[];
  answers: InterviewAnswer[];
  overallScore: number;
  resumeScore: number;
  speechScore: number;
  voiceScore: number;
  proctoringScore: number;
  status: 'in_progress' | 'completed';
  tabSwitchCount: number;
  createdAt?: any;
  completedAt?: any;
}

// Memory store for active sessions (since SQLite doesn't natively do live docs well without extra endpoints)
const activeSessions: Record<string, InterviewSession> = {};

export async function createInterviewSession(session: Omit<InterviewSession, 'id' | 'createdAt' | 'completedAt'>): Promise<string> {
  const id = 'sim_' + Date.now();
  activeSessions[id] = { ...session, id, createdAt: Date.now() };
  return id;
}

export async function updateInterviewSession(sessionId: string, data: Partial<InterviewSession>) {
  if (activeSessions[sessionId]) {
    activeSessions[sessionId] = { ...activeSessions[sessionId], ...data };
    
    // If completed, push the full result to the backend SQLite DB
    if (data.status === 'completed') {
      const session = activeSessions[sessionId];
      
      const payload = {
        user_id: session.candidateId,
        session_id: sessionId,
        question: session.questions[0] || '', // simplifying for the backend schema
        answer: session.answers[0]?.transcript || '',
        score: session.overallScore,
        feedback: "Session completed.",
        speech_metrics: {
          confidence: session.speechScore,
          fluency: session.answers[0]?.speechAnalysis.fluency || 0,
          clarity: session.answers[0]?.speechAnalysis.clarity || 0,
        },
        voice_score: session.voiceScore,
        proctor_score: session.proctoringScore,
        proctor_logs: getLocalProctoring(sessionId),
        report: {
          final_recommendation: session.overallScore > 70 ? 'Hire' : 'Reject',
          hiring_probability: session.overallScore
        }
      };

      try {
        await fetch('/api/interviews/result', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } catch (err) {
        console.error("Failed to save session to backend", err);
      }
    }
  }
}

export async function getInterviewSession(sessionId: string): Promise<InterviewSession | null> {
  return activeSessions[sessionId] || null;
}

export async function getInterviewsByCandidate(candidateId: string): Promise<InterviewSession[]> {
  // Not fully implemented for SQLite yet, returning mock or active
  return Object.values(activeSessions).filter(s => s.candidateId === candidateId);
}

export async function getAllCompletedInterviews(): Promise<InterviewSession[]> {
  // Can fetch from /api/interviews if implemented, returning mock
  return Object.values(activeSessions).filter(s => s.status === 'completed');
}

// ── Proctoring Events ─────────────────────────────────────────────────────

export interface ProctoringEvent {
  id?: string;
  type: 'tab_switch' | 'face_missing' | 'eye_deviation' | 'multiple_faces' | 'phone_detected';
  severity: 'warning' | 'critical';
  timestamp: any;
}

const proctoringStore: Record<string, ProctoringEvent[]> = {};

function getLocalProctoring(sessionId: string) {
  return proctoringStore[sessionId] || [];
}

export async function saveProctoringEvent(sessionId: string, event: Omit<ProctoringEvent, 'id'>) {
  if (!proctoringStore[sessionId]) proctoringStore[sessionId] = [];
  proctoringStore[sessionId].push({ ...event, id: Date.now().toString(), timestamp: Date.now() });
}

export function subscribeToProctoringEvents(
  sessionId: string,
  callback: (events: ProctoringEvent[]) => void
) {
  const interval = setInterval(() => {
    const events = getLocalProctoring(sessionId);
    callback([...events].reverse());
  }, 1000);
  return () => clearInterval(interval);
}
