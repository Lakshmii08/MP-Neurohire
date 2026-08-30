import { GoogleGenAI } from '@google/genai';

// Support both Vite env and process.env for maximum compatibility
const API_KEY = (import.meta as any).env?.VITE_GEMINI_API_KEY || 
                (import.meta as any).env?.GEMINI_API_KEY || 
                process.env.GEMINI_API_KEY || 
                process.env.VITE_GEMINI_API_KEY;

let ai: GoogleGenAI | null = null;

function getAI(): GoogleGenAI {
  if (!ai) {
    if (!API_KEY || API_KEY === 'MY_GEMINI_API_KEY') {
      console.warn('GEMINI_API_KEY not found in environment. Using mock responses.');
      // We still throw if someone tries to use it without a key, 
      // but let's be more descriptive.
      throw new Error('MISSING_API_KEY');
    }
    ai = new GoogleGenAI({ apiKey: API_KEY });
  }
  return ai;
}

export interface ContactInfo {
  email?: string;
  phone?: string;
  location?: string;
  linkedin?: string;
  github?: string;
}

export interface QualificationItem {
  degree: string;
  institution: string;
  year: string;
  fieldOfStudy?: string;
}

export interface ExperienceItem {
  role: string;
  company: string;
  duration: string;
  description: string;
}

export interface ProjectItem {
  name: string;
  description: string;
  technologies?: string[];
}

export interface CertificationItem {
  name: string;
  issuer: string;
  year?: string;
}

export interface JobMatchItem {
  id: number;
  title: string;
  company: string;
  location: string;
  type: string;
  salary: string;
  experience_level: string;
  description: string;
  requiredSkills: string[];
  matchingSkills: string[];
  missingSkills: string[];
  matchScore: number;
  matchBadge: 'Strong Match' | 'Good Match' | 'Potential Match';
  applicants: number;
  status: string;
}

export interface ResumeAnalysisResult {
  atsScore: number;
  skills: string[];
  softSkills?: string[];
  missingSkills: { name: string; gap: number }[];
  qualifications?: QualificationItem[];
  experience?: ExperienceItem[];
  projects?: ProjectItem[];
  certifications?: CertificationItem[];
  contactInfo?: ContactInfo;
  strengths?: string[];
  weaknesses?: string[];
  recommendations: string[];
  summary: string;
  globalPercentile: string;
  reliabilityScore: string;
  radarData: { subject: string; A: number; fullMark: number }[];
}

export interface InterviewQuestion {
  question: string;
  category: string;
}

export interface SpeechAnalysisResult {
  transcript: string;
  confidence: number;
  fluency: number;
  clarity: number;
  keywords: string[];
  score: number;
  feedback: string;
}

export async function analyzeResume(resumeText: string, role = 'Software Engineer'): Promise<ResumeAnalysisResult> {
  try {
    const ai = getAI();

    const prompt = `You are an expert ATS (Applicant Tracking System) and technical recruiter AI. Analyze the following resume for a ${role} position.
    Extract ALL candidate credentials dynamically.
    Respond ONLY with a valid JSON object.
    
    Resume Text: ${resumeText.slice(0, 8000)}

    Format:
    {
      "atsScore": 82,
      "globalPercentile": "TOP 10%",
      "reliabilityScore": "EXCELLENT",
      "contactInfo": { "email": "...", "phone": "...", "location": "...", "linkedin": "...", "github": "..." },
      "skills": ["skill1", ...],
      "softSkills": ["skill1", ...],
      "qualifications": [{"degree": "...", "institution": "...", "year": "...", "fieldOfStudy": "..."}],
      "experience": [{"role": "...", "company": "...", "duration": "...", "description": "..."}],
      "projects": [{"name": "...", "description": "...", "technologies": ["..."]}],
      "certifications": [{"name": "...", "issuer": "...", "year": "..."}],
      "missingSkills": [{"name": "skill", "gap": 50}],
      "strengths": ["..."],
      "weaknesses": ["..."],
      "recommendations": ["rec1", ...],
      "summary": "2-sentence summary",
      "radarData": [{"subject": "area", "A": 120, "fullMark": 150}]
    }`;

    const result = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt
    });
    const text = result.text;
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned) as ResumeAnalysisResult;
  } catch (error) {
    console.error('Gemini Resume Analysis Error:', error);
    return getMockResumeAnalysis();
  }
}

export async function generateInterviewQuestions(role: string, skills: string[]): Promise<InterviewQuestion[]> {
  try {
    const ai = getAI();
    
    const prompt = `Generate exactly 5 interview questions for a ${role} with skills: ${skills.join(', ')}.
    Respond ONLY with a JSON array: [{"question": "...", "category": "Technical|Behavioral|Problem Solving"}]`;

    const result = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt
    });
    const text = result.text;
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned) as InterviewQuestion[];
  } catch (error) {
    console.error('Gemini Question Generation Error:', error);
    return [
      { question: "Tell us about a complex project you've led.", category: "Behavioral" },
      { question: "How do you optimize application performance?", category: "Technical" },
      { question: "Describe a time you handled a difficult team conflict.", category: "Behavioral" },
      { question: "Explain the architectural principles you follow.", category: "Technical" },
      { question: "What is your process for debugging production issues?", category: "Problem Solving" }
    ];
  }
}

// Real, non-static speech analysis: sends the actual answer audio + transcript
// to our backend, which runs it through the ECAPA-TDNN confidence classifier
// (trained on synthetic_dataset) plus genuine acoustic/transcript features.
// See server/routes/interviews.js -> python_ml_service/app.py's /analyze-speech.
export async function analyzeSpeechFromAudio(
  audioBlob: Blob,
  transcript: string,
  question: string,
  avgSpeechRecognitionConfidence: number
): Promise<SpeechAnalysisResult> {
  try {
    const formData = new FormData();
    formData.append('answer_audio', audioBlob, 'answer.webm');
    formData.append('transcript', transcript);
    formData.append('question', question);

    const res = await fetch('/api/interviews/analyze-speech', { method: 'POST', body: formData });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || 'Speech analysis failed.');

    return {
      transcript,
      confidence: data.confidence,
      fluency: data.fluency,
      clarity: data.clarity,
      score: data.score,
      keywords: data.keywords || [],
      feedback: data.feedback || '',
    };
  } catch (error) {
    console.error('Speech analysis service unavailable, using transcript-only heuristic:', error);
    // No audio ML available — fall back to a heuristic computed purely from
    // real signals we still have (transcript + live browser STT confidence),
    // never a fixed literal, so scores still vary answer-to-answer.
    return transcriptOnlySpeechHeuristic(transcript, avgSpeechRecognitionConfidence);
  }
}

function transcriptOnlySpeechHeuristic(transcript: string, avgConfidence: number): SpeechAnalysisResult {
  const words = (transcript.trim().match(/[a-zA-Z']+/g) || []);
  const wordCount = words.length;
  const fillerWords = new Set(['um', 'uh', 'umm', 'uhh', 'like', 'actually', 'basically', 'literally']);
  const fillerCount = words.filter(w => fillerWords.has(w.toLowerCase())).length;
  const uniqueRatio = wordCount > 0 ? new Set(words.map(w => w.toLowerCase())).size / wordCount : 0;
  const fillerRatio = wordCount > 0 ? fillerCount / wordCount : 0;

  const baseConfidence = Math.round(Math.max(0, Math.min(100, avgConfidence * 100)));
  const clarity = Math.round(Math.max(0, Math.min(100, uniqueRatio * 100 - fillerRatio * 50)));
  const fluency = wordCount === 0
    ? 0
    : Math.round(Math.max(0, Math.min(100, 100 - fillerRatio * 200 - Math.max(0, 5 - wordCount) * 10)));
  const score = Math.round(baseConfidence * 0.4 + clarity * 0.3 + fluency * 0.3);

  return {
    transcript,
    confidence: baseConfidence,
    fluency,
    clarity,
    score,
    keywords: Array.from(new Set(words.filter(w => w.length > 5))).slice(0, 5),
    feedback: wordCount === 0
      ? 'No speech was transcribed for this answer.'
      : `Transcript-only estimate (speech ML service unavailable): ${wordCount} words, ${fillerCount} filler word(s) detected.`
  };
}

function getMockResumeAnalysis(): ResumeAnalysisResult {
  return {
    atsScore: 82,
    skills: ['React', 'Node.js', 'TypeScript', 'Docker', 'PostgreSQL'],
    softSkills: ['Team Leadership', 'Technical Communication', 'Problem Solving'],
    qualifications: [
      { degree: 'Bachelor of Technology', institution: 'State University', year: '2022', fieldOfStudy: 'Computer Science & Engineering' }
    ],
    experience: [
      { role: 'Full Stack Engineer', company: 'Tech Innovation Labs', duration: '2022 - Present', description: 'Engineered scalable web applications and integrated microservices.' }
    ],
    projects: [
      { name: 'AI Recruiting Engine', description: 'Built an intelligent ATS parser and neural matching engine.', technologies: ['React', 'TypeScript', 'Node.js', 'Gemini AI'] }
    ],
    certifications: [
      { name: 'AWS Certified Solutions Architect', issuer: 'Amazon Web Services', year: '2023' }
    ],
    contactInfo: {
      email: 'candidate@neurohire.com',
      phone: '+1 (555) 234-5678',
      location: 'San Francisco, CA',
      linkedin: 'linkedin.com/in/neurocandidate',
      github: 'github.com/neurocandidate'
    },
    missingSkills: [
      { name: 'Kubernetes', gap: 60 },
      { name: 'GraphQL', gap: 40 }
    ],
    strengths: ['Strong full stack foundation', 'Good software engineering practices'],
    weaknesses: ['Limited microservices orchestration experience at scale'],
    recommendations: ['Add system design metrics', 'Gain hands-on Kubernetes experience'],
    summary: 'Strong candidate with practical web development experience and solid technical fundamentals.',
    globalPercentile: 'TOP 10%',
    reliabilityScore: 'EXCELLENT',
    radarData: [
      { subject: 'Frontend', A: 120, fullMark: 150 },
      { subject: 'Backend', A: 110, fullMark: 150 },
      { subject: 'DevOps', A: 70, fullMark: 150 },
      { subject: 'Testing', A: 90, fullMark: 150 },
      { subject: 'Design', A: 100, fullMark: 150 },
      { subject: 'Soft Skills', A: 130, fullMark: 150 }
    ]
  };
}
