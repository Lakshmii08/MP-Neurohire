import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Mic, MicOff, Settings, Timer, AlertTriangle,
  CheckCircle, Zap, ArrowRight, Activity, Volume2, Shield
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { generateInterviewQuestions, analyzeSpeechFromAudio, type InterviewQuestion, type SpeechAnalysisResult } from "@/lib/gemini";
import { createInterviewSession, updateInterviewSession, saveProctoringEvent, type InterviewAnswer } from "@/lib/firestore";
import { toast } from "sonner";

// ── Audio Visualizer Component ──────────────────────────────────────────

function AudioWaves({ isRecording }: { isRecording: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    if (isRecording) {
      const initAudio = async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
          const analyser = audioContext.createAnalyser();
          const source = audioContext.createMediaStreamSource(stream);
          source.connect(analyser);
          analyser.fftSize = 256;
          
          const bufferLength = analyser.frequencyBinCount;
          const dataArray = new Uint8Array(bufferLength);
          const canvas = canvasRef.current;
          const ctx = canvas?.getContext('2d');

          const draw = () => {
            if (!ctx || !canvas) return;
            animationRef.current = requestAnimationFrame(draw);
            analyser.getByteFrequencyData(dataArray);
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            const centerX = canvas.width / 2;
            const centerY = canvas.height / 2;
            
            ctx.beginPath();
            ctx.lineWidth = 2;
            ctx.strokeStyle = 'rgba(6, 182, 212, 0.5)';
            
            for (let i = 0; i < bufferLength; i++) {
              const radius = (dataArray[i] / 255) * 50 + 20;
              const angle = (i / bufferLength) * Math.PI * 2;
              const x = centerX + Math.cos(angle) * radius;
              const y = centerY + Math.sin(angle) * radius;
              if (i === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.stroke();
          };
          draw();
          audioContextRef.current = audioContext;
        } catch (err) { console.error(err); }
      };
      initAudio();
    }
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (audioContextRef.current) audioContextRef.current.close();
    };
  }, [isRecording]);

  return <canvas ref={canvasRef} className="w-full h-full absolute inset-0 pointer-events-none" width={400} height={400} />;
}

// ── Main Component ──────────────────────────────────────────────────────

export default function InterviewScreen() {
  const { currentUser, candidateData } = useAuth();
  const navigate = useNavigate();

  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [timeLeft, setTimeLeft] = useState(120);
  const [isRecording, setIsRecording] = useState(false);
  const [loading, setLoading] = useState(true);
  const [processingAnswer, setProcessingAnswer] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);

  const [liveMetrics, setLiveMetrics] = useState({
    confidence: 0,
    fluency: 0,
    clarity: 0
  });

  const [answers, setAnswers] = useState<InterviewAnswer[]>([]);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");

  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [voiceMatchScores, setVoiceMatchScores] = useState<number[]>([]);
  const confidenceSamplesRef = useRef<number[]>([]);

  // ── Load questions ──────────────────────────────────────────────────
  useEffect(() => {
    async function loadQuestions() {
      try {
        const searchParams = new URLSearchParams(window.location.search);
        const queryRole = searchParams.get('role');
        const role = queryRole || candidateData?.role || 'Software Engineer';
        const skills = candidateData?.resumeSkills && candidateData.resumeSkills.length > 0
          ? candidateData.resumeSkills 
          : ['JavaScript', 'React', 'TypeScript', 'Node.js', 'Python', 'Git'];
        const qs = await generateInterviewQuestions(role, skills);
        setQuestions(qs);

        if (currentUser && candidateData) {
          const id = await createInterviewSession({
            candidateId: currentUser.uid,
            candidateName: `${candidateData.firstName} ${candidateData.lastName}`,
            role,
            questions: qs.map(q => q.question),
            answers: [],
            overallScore: 0,
            resumeScore: candidateData.resumeScore ?? 0,
            speechScore: 0,
            voiceScore: candidateData.voiceSimilarity ?? 0,
            proctoringScore: 100,
            status: 'in_progress',
            tabSwitchCount: 0,
          });
          setSessionId(id);
        }
      } catch (err) {
        toast.error("Failed to load interview questions.");
        setQuestions([
          { question: "Tell us about a time you solved a complex technical problem.", category: "Behavioral" },
          { question: "Describe your experience with high-performance web applications.", category: "Technical" },
          { question: "Why are you interested in this role?", category: "Behavioral" },
        ]);
      } finally {
        setLoading(false);
      }
    }
    loadQuestions();
  }, [currentUser, candidateData]);

  // ── Proctoring ─────────────────────────────────────────────────────
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden && sessionId) {
        setTabSwitchCount(prev => prev + 1);
        saveProctoringEvent(sessionId, { type: 'tab_switch', severity: 'warning', timestamp: new Date() }).catch(console.error);
        toast.warning("⚠️ Tab switch detected!");
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [sessionId]);

  // ── Timer ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (loading) return;
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(timerRef.current!); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [loading, currentQuestion]);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  // ── Real-time Recording ─────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Speech recognition not supported.");
      return;
    }
    
    // Start Audio Capture via MediaRecorder
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
      };

      mediaRecorder.start();
    } catch (err) {
      console.error("Error accessing microphone:", err);
      toast.error("Microphone access denied.");
      return;
    }
    
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      let finalStr = '';
      let interimStr = '';
      let avgConfidence = 0;
      let count = 0;

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const trans = event.results[i][0].transcript;
        const conf = event.results[i][0].confidence;
        if (event.results[i].isFinal) {
          finalStr += trans;
        } else {
          interimStr += trans;
        }
        avgConfidence += conf;
        count++;
      }

      setInterimTranscript(interimStr);
      setTranscript(prev => (prev + ' ' + finalStr).trim());

      // Update live metrics based on Speech API confidence
      if (count > 0) {
        confidenceSamplesRef.current.push(avgConfidence / count);
        const conf = Math.round((avgConfidence / count) * 100);
        setLiveMetrics({
          confidence: conf,
          fluency: Math.min(100, Math.round(conf * 1.1)), // Simulated live fluency
          clarity: Math.min(100, Math.round(conf * 0.9 + 10)) // Simulated live clarity
        });
      }
    };

    recognition.onerror = () => setIsRecording(false);
    recognition.onend = () => setIsRecording(false);
    recognition.start();
    setIsRecording(true);
  }, [transcript]);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
    setIsRecording(false);
    setInterimTranscript("");
  }, []);

  const toggleRecording = () => {
    if (isRecording) stopRecording();
    else startRecording();
  };

  // ── Next / Finish ──────────────────────────────────────────────────
  const handleNext = async () => {
    if (processingAnswer) return;
    setProcessingAnswer(true);
    stopRecording();

    // Wait a brief moment for mediaRecorder to stop and save chunks
    await new Promise(resolve => setTimeout(resolve, 300));

    const fullAnswer = (transcript + ' ' + interimTranscript).trim() || "(No response captured)";
    const question = questions[currentQuestion]?.question ?? "";

    const currentVoiceScores = [...voiceMatchScores];

    try {
      // Analyze with ECAPA-TDNN Backend for Voice Verification
      const currentBlob = audioChunksRef.current.length > 0 ? new Blob(audioChunksRef.current, { type: 'audio/webm' }) : null;
      if (currentBlob) {
        try {
          const verifyData = new FormData();
          verifyData.append("user_id", currentUser?.uid || "");
          verifyData.append("session_id", sessionId || "");
          verifyData.append("audio_chunk", currentBlob, "answer.webm");
          
          const verifyRes = await fetch("/api/interviews/verify-interview-voice", {
            method: "POST",
            body: verifyData
          });
          const vData = await verifyRes.json();
          if (vData.success) {
            const simScore = Math.round(vData.similarity * 100);
            setVoiceMatchScores(prev => [...prev, simScore]);
            currentVoiceScores.push(simScore);
            
            if (!vData.match) {
               toast.error(`🚨 SECURITY ALERT: Voice Mismatch Detected! (${simScore}% match)`, { duration: 5000 });
               setTabSwitchCount(prev => prev + 2); // Penalize proctoring score by treating as severe violation
            } else {
               toast.success(`Voice Authenticated (${simScore}% match)`);
            }
          }
        } catch (err) {
          console.error("Voice verification error:", err);
          toast.error("Could not verify voice identity.");
        }
      }

      const confSamples = confidenceSamplesRef.current;
      const avgSttConfidence = confSamples.length > 0
        ? confSamples.reduce((a, b) => a + b, 0) / confSamples.length
        : 0.5;
      const speechAnalysis = await analyzeSpeechFromAudio(
        currentBlob || new Blob([], { type: 'audio/webm' }),
        fullAnswer,
        question,
        avgSttConfidence
      );

      const newAnswer: InterviewAnswer = { question, transcript: fullAnswer, speechAnalysis };
      const allAnswers = [...answers, newAnswer];
      setAnswers(allAnswers);

      if (currentQuestion < questions.length - 1) {
        setCurrentQuestion(prev => prev + 1);
        setTimeLeft(120);
        setTranscript("");
        setInterimTranscript("");
        setLiveMetrics({ confidence: 0, fluency: 0, clarity: 0 });
        audioChunksRef.current = [];
        confidenceSamplesRef.current = [];
        setAudioBlob(null);
        setProcessingAnswer(false);
      } else {
        const avgSpeechScore = Math.round(allAnswers.reduce((sum, a) => sum + a.speechAnalysis.score, 0) / allAnswers.length);
        const proctoringScore = Math.max(0, 100 - tabSwitchCount * 15);
        const resumeScore = candidateData?.resumeScore ?? 70;
        const avgVoiceMatch = currentVoiceScores.length > 0 
          ? Math.round(currentVoiceScores.reduce((a, b) => a + b, 0) / currentVoiceScores.length)
          : candidateData?.voiceSimilarity ?? 80;
        const voiceScore = avgVoiceMatch;
        const overallScore = Math.round((resumeScore * 0.3 + avgSpeechScore * 0.4 + voiceScore * 0.2 + proctoringScore * 0.1));

        if (sessionId) {
          await updateInterviewSession(sessionId, {
            answers: allAnswers,
            speechScore: avgSpeechScore,
            proctoringScore,
            voiceScore,
            overallScore,
            tabSwitchCount,
            status: 'completed',
          });
          toast.success("Assessment Finalized! Generating neural report...");
          navigate(`/report/${sessionId}`);
        } else {
          navigate('/candidate');
        }
      }
    } catch (err) {
      toast.error("Error analyzing answer.");
      setProcessingAnswer(false);
    }
  };

  if (loading) {
    return (
      <div className="h-screen bg-[#020617] flex flex-col items-center justify-center gap-6">
        <Activity className="h-16 w-16 text-cyan-400 animate-spin" />
        <p className="text-slate-500 font-mono text-xs uppercase tracking-widest animate-pulse">Initializing Interview Protocol...</p>
      </div>
    );
  }

  const currentQ = questions[currentQuestion];

  return (
    <div className="h-screen w-full bg-[#020617] text-slate-100 flex overflow-hidden relative">
      <div className="absolute -z-10 top-[-200px] left-[-100px] w-[600px] h-[600px] bg-blue-600/5 rounded-full blur-[120px]" />
      <div className="absolute -z-10 bottom-[-200px] right-[-100px] w-[600px] h-[600px] bg-cyan-600/5 rounded-full blur-[120px]" />

      {/* Main Flow */}
      <div className="flex-1 flex flex-col relative">
        {/* Top Header */}
        <header className="h-20 flex items-center justify-between px-10 bg-white/2 border-b border-white/5 backdrop-blur-xl z-20">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center">
                <Zap className="h-5 w-5 text-white" />
              </div>
              <span className="font-heading font-bold text-lg tracking-tight">NeuroHire // Interview</span>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <div className={`px-4 py-1.5 rounded-xl border flex items-center gap-3 transition-colors ${timeLeft < 30 ? 'bg-red-500/10 border-red-500/20 text-red-500' : 'bg-white/5 border-white/10 text-slate-400'}`}>
              <Timer className={`h-4 w-4 ${timeLeft < 30 ? 'animate-pulse' : ''}`} />
              <span className="font-mono font-bold">{formatTime(timeLeft)}</span>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3 px-4 py-1.5 bg-white/5 border border-white/10 rounded-xl">
              <Shield className="h-4 w-4 text-green-400" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Proctoring: ACTIVE</span>
            </div>
            <button
              onClick={() => navigate('/candidate')}
              className="text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-red-400 transition-colors"
            >
              Abort Session
            </button>
          </div>
        </header>

        <div className="flex-1 flex p-10 gap-10 overflow-hidden">
          {/* Question Card */}
          <div className="w-[450px] space-y-8 flex flex-col">
            <div className="space-y-4">
              <Badge className="bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border-none px-3 py-1 font-bold uppercase tracking-widest text-[9px]">
                Protocol Q{currentQuestion + 1}
              </Badge>
              <h2 className="text-4xl font-heading font-bold text-white leading-[1.1]">
                {currentQ?.category} <span className="text-slate-500 italic">Assessment.</span>
              </h2>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-10 backdrop-blur-3xl relative overflow-hidden shadow-2xl flex-1 flex flex-col">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/10 rounded-full -mr-16 -mt-16 blur-3xl" />
              <AnimatePresence mode="wait">
                <motion.p
                  key={currentQuestion}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="text-2xl font-medium italic text-slate-200 leading-relaxed"
                >
                  "{currentQ?.question}"
                </motion.p>
              </AnimatePresence>

              <div className="mt-auto space-y-6">
                <div className="bg-black/40 rounded-2xl p-6 border border-white/5 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[9px] font-bold text-cyan-400 uppercase tracking-widest flex items-center gap-2">
                      <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" /> Neural Capture
                    </p>
                    <p className="text-[9px] font-mono text-slate-500">REALTIME_STT_v2.1</p>
                  </div>
                  <div className="h-[120px] overflow-y-auto custom-scrollbar pr-2">
                    <p className="text-sm font-medium leading-relaxed">
                      <span className="text-slate-200">{transcript}</span>
                      <span className="text-cyan-400/60 ml-1">{interimTranscript}</span>
                      {!transcript && !interimTranscript && <span className="text-slate-700 italic">Awaiting response...</span>}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Camera / Interaction Area */}
          <div className="flex-1 flex flex-col gap-10">
            <div className="flex-1 bg-white/2 border border-white/10 rounded-[3rem] relative overflow-hidden group">
              {/* Animated Backdrop */}
              <div className="absolute inset-0 bg-slate-950/40 flex items-center justify-center">
                <div className="w-full h-full flex items-center justify-center relative">
                  {/* Waveform Overlay */}
                  <AudioWaves isRecording={isRecording} />
                  
                  {/* Face Guide */}
                  <div className="w-64 h-80 border border-cyan-500/20 rounded-[100px] flex items-center justify-center">
                    <div className="text-center opacity-20">
                      <Volume2 className={`h-16 w-16 mx-auto mb-4 ${isRecording ? 'text-cyan-400 animate-pulse' : 'text-slate-600'}`} />
                      <p className="text-[10px] font-bold uppercase tracking-widest font-mono">
                        {isRecording ? 'CAPTURE_IN_PROGRESS' : 'STANDBY_MODE'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Status HUD */}
              <div className="absolute top-10 left-10 flex gap-4">
                <div className="bg-black/60 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${isRecording ? 'bg-red-500 animate-pulse shadow-[0_0_10px_red]' : 'bg-green-500'}`} />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white">
                    {isRecording ? 'Live Mic' : 'Biometric ID OK'}
                  </span>
                </div>
              </div>

              <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-8 px-10 py-6 rounded-[32px] bg-white/5 backdrop-blur-3xl border border-white/10 shadow-2xl z-30">
                <button
                  onClick={toggleRecording}
                  className={`h-20 w-20 rounded-3xl flex items-center justify-center transition-all duration-500 ${isRecording ? 'bg-red-600 shadow-[0_0_30px_rgba(220,38,38,0.3)] scale-110' : 'bg-white/10 hover:bg-white/20'}`}
                >
                  {isRecording ? <Mic className="h-10 w-10 text-white" /> : <MicOff className="h-10 w-10 text-slate-400" />}
                </button>
                <div className="h-12 w-px bg-white/10" />
                <button
                  onClick={handleNext}
                  disabled={processingAnswer}
                  className="h-20 px-12 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-3xl font-bold uppercase tracking-widest flex items-center gap-4 transition-all shadow-xl shadow-blue-600/20"
                >
                  {processingAnswer ? (
                    <>
                      <Activity className="h-6 w-6 animate-spin" />
                      Neural Audit...
                    </>
                  ) : (
                    <>
                      {currentQuestion === questions.length - 1 ? 'Finish Assessment' : 'Next Protocol'}
                      <ArrowRight className="h-6 w-6" />
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Bottom HUD: Live Telemetry */}
            <div className="h-32 grid grid-cols-3 gap-6">
              {[
                { label: "Capture Confidence", val: liveMetrics.confidence, icon: Zap, color: "text-blue-400", bg: "bg-blue-500/10" },
                { label: "Speech Fluency", val: liveMetrics.fluency, icon: Activity, color: "text-purple-400", bg: "bg-purple-500/10" },
                { label: "Lexical Clarity", val: liveMetrics.clarity, icon: Volume2, color: "text-cyan-400", bg: "bg-cyan-500/10" },
              ].map((m, i) => (
                <div key={i} className="bg-white/5 border border-white/10 rounded-3xl p-6 flex flex-col justify-between backdrop-blur-md group hover:bg-white/10 transition-all">
                  <div className="flex justify-between items-center">
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{m.label}</p>
                    <m.icon className={`h-4 w-4 ${m.color}`} />
                  </div>
                  <div className="flex items-end justify-between">
                    <p className="text-2xl font-mono font-bold text-white">{m.val}%</p>
                    <div className="w-24 h-1 bg-white/5 rounded-full overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${m.val}%` }} className={`h-full ${m.color.replace('text-', 'bg-')}`} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
