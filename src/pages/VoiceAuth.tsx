import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Mic, CheckCircle2, Zap, AlertCircle, Volume2, Activity,
  Play, RefreshCw, ShieldCheck, Cpu, ArrowLeft, ArrowRight, Radio, ScanFace
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { useAuth } from "@/contexts/AuthContext";
import { updateCandidate } from "@/lib/firestore";
import { toast } from "sonner";
import { useNavigate, Link } from "react-router-dom";
import { getFaceLandmarker, analyzeVideoFrame } from "@/lib/videoMonitoring";
import { computeFaceSignature } from "@/lib/faceIdentity";

const REFERENCE_PHRASE = "The quick brown fox jumps over the lazy dog for NeuroHire assessment";

function computeSimilarity(spoken: string, reference: string): number {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/).filter(Boolean);
  const spokenWords = normalize(spoken);
  const refWords = normalize(reference);
  if (spokenWords.length === 0) return 0;
  const refSet = new Set(refWords);
  const matches = spokenWords.filter(w => refSet.has(w)).length;
  // Strict recall: no bonus padding — must match a real proportion of the phrase
  const recall = matches / refWords.length;
  return Math.min(100, Math.round(recall * 100));
}

// ── Audio Visualizer Component ──────────────────────────────────────────

function AudioVisualizer({ isListening }: { isListening: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    if (isListening) {
      const initAudio = async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
          const analyser = audioContext.createAnalyser();
          const source = audioContext.createMediaStreamSource(stream);
          source.connect(analyser);
          analyser.fftSize = 256;
          
          audioContextRef.current = audioContext;
          analyserRef.current = analyser;

          const bufferLength = analyser.frequencyBinCount;
          const dataArray = new Uint8Array(bufferLength);
          const canvas = canvasRef.current;
          const ctx = canvas?.getContext('2d');

          const draw = () => {
            if (!ctx || !canvas) return;
            animationRef.current = requestAnimationFrame(draw);
            analyser.getByteFrequencyData(dataArray);

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            const barWidth = (canvas.width / bufferLength) * 2.5;
            let barHeight;
            let x = 0;

            for (let i = 0; i < bufferLength; i++) {
              barHeight = (dataArray[i] / 255) * canvas.height;
              const gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
              gradient.addColorStop(0, '#2563EB');
              gradient.addColorStop(1, '#06B6D4');
              ctx.fillStyle = gradient;
              ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
              x += barWidth + 1;
            }
          };
          draw();
        } catch (err) {
          console.error("Visualizer error:", err);
        }
      };
      initAudio();
    } else {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (audioContextRef.current) audioContextRef.current.close();
    }
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (audioContextRef.current) audioContextRef.current.close();
    };
  }, [isListening]);

  return <canvas ref={canvasRef} className="w-full h-12 opacity-80" width={300} height={48} />;
}

// ── Main Component ──────────────────────────────────────────────────────

export default function VoiceAuth() {
  const { currentUser, candidateData, refreshCandidate } = useAuth();
  const navigate = useNavigate();
  const [similarity, setSimilarity] = useState(0);
  const [status, setStatus] = useState<'idle' | 'analyzing' | 'verified' | 'failed' | 'unsupported'>('idle');
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [saving, setSaving] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [mlConnected, setMlConnected] = useState<boolean | null>(null);
  
  // Verification test state
  const [verifying, setVerifying] = useState(false);
  const [testScore, setTestScore] = useState<number | null>(null);
  const [testMatch, setTestMatch] = useState<boolean | null>(null);

  // Facial identity snapshot — captured alongside the voice sample so the
  // interview can later confirm the same person is answering questions
  // (mirrors the voice-verification flow, but for face geometry).
  const [faceCaptureStatus, setFaceCaptureStatus] = useState<'idle' | 'capturing' | 'captured' | 'failed'>('idle');
  const faceVideoRef = useRef<HTMLVideoElement>(null);
  const faceCapturePromiseRef = useRef<Promise<number[] | null> | null>(null);

  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const similarityRef = useRef(0);
  const statusRef = useRef<string>('idle');

  const captureFaceSignature = async (): Promise<number[] | null> => {
    setFaceCaptureStatus('capturing');
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 } });
      const video = faceVideoRef.current;
      if (!video) throw new Error('Face capture video element not mounted.');
      video.srcObject = stream;
      await video.play();

      const landmarker = await getFaceLandmarker();
      let signature: number[] | null = null;
      // Try several frames over ~9 seconds — some webcams take a couple of
      // seconds to autofocus/adjust exposure before a face is detectable,
      // and this also tolerates a stray blink or momentary head turn.
      for (let attempt = 0; attempt < 18 && !signature; attempt++) {
        await new Promise(r => setTimeout(r, 500));
        if (video.readyState < 2) continue;
        const result = analyzeVideoFrame(landmarker, video, performance.now());
        if (result.faceCount === 1 && result.landmarks) {
          signature = computeFaceSignature(result.landmarks);
        }
      }
      setFaceCaptureStatus(signature ? 'captured' : 'failed');
      return signature;
    } catch (err) {
      console.error('Face signature capture failed:', err);
      setFaceCaptureStatus('failed');
      return null;
    } finally {
      if (stream) stream.getTracks().forEach(t => t.stop());
    }
  };

  // Lets the candidate retry the face snapshot on its own — e.g. after
  // enrollment already succeeded but the capture failed — without
  // re-recording their voice. Saves straight to the server since there's no
  // enclosing verify-voice call to piggyback the signature onto.
  const retryFaceCapture = async () => {
    const signature = await captureFaceSignature();
    if (!signature || !currentUser?.uid) {
      if (!signature) toast.error("Still couldn't detect a clear, single face. Check lighting and camera position, then try again.");
      return;
    }
    try {
      const res = await fetch('/api/auth/enroll-face', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: currentUser.uid, face_signature: JSON.stringify(signature) }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Facial identity snapshot saved.");
      } else {
        toast.error(data.message || "Failed to save face snapshot.");
      }
    } catch (err: any) {
      toast.error("Failed to save face snapshot: " + err.message);
    }
  };

  // Check Python ECAPA service status via server proxy (avoids no-cors always-true bug)
  useEffect(() => {
    async function checkMlService() {
      try {
        const res = await fetch('/api/auth/ml-status');
        const data = await res.json();
        setMlConnected(data.online === true);
      } catch {
        setMlConnected(false);
      }
    }
    checkMlService();
  }, []);

  useEffect(() => {
    if (candidateData?.voiceVerified && candidateData?.voiceSimilarity && candidateData.voiceSimilarity >= 50) {
      setSimilarity(candidateData.voiceSimilarity);
      setStatus('verified');
    }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setStatus('unsupported');
    }
  }, [candidateData]);

  const startAuth = async () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setStatus('unsupported');
      return;
    }

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
      mediaRecorder.start();
    } catch (err) {
      console.error("Microphone error:", err);
      toast.error("Microphone access denied.");
      return;
    }

    statusRef.current = 'analyzing';
    setStatus('analyzing');
    similarityRef.current = 0;
    setSimilarity(0);
    setTranscript("");
    setInterimTranscript("");
    setAudioUrl(null);
    setTestScore(null);
    setTestMatch(null);

    // Runs in parallel with speaking the phrase — same "look at the camera"
    // moment doubles as the facial-identity enrollment snapshot.
    faceCapturePromiseRef.current = captureFaceSignature();

    let accumulatedTranscript = '';

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      let finalStr = '';
      let interimStr = '';
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcriptSegment = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalStr += transcriptSegment;
        } else {
          interimStr += transcriptSegment;
        }
      }

      accumulatedTranscript = (accumulatedTranscript + ' ' + finalStr).trim();
      const fullTranscript = (accumulatedTranscript + ' ' + interimStr).trim();

      setInterimTranscript(interimStr);
      setTranscript(accumulatedTranscript);
      
      const score = computeSimilarity(fullTranscript, REFERENCE_PHRASE);
      similarityRef.current = score;
      setSimilarity(score);

      // Auto-stop only when the user has clearly spoken enough of the phrase (80%)
      if (score >= 80) {
        recognition.stop();
      }
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      if (event.error !== 'no-speech') {
        setStatus('failed');
        toast.error(`Error: ${event.error}`);
      }
    };

    recognition.onend = () => {
      if (statusRef.current === 'analyzing') {
        const currentScore = similarityRef.current;
        // Require at least 50% phrase coverage before sending to ECAPA
        if (currentScore >= 50) {
          processBiometrics(currentScore);
        } else {
          statusRef.current = 'failed';
          setStatus('failed');
          toast.error(`Phrase coverage too low (${currentScore}%). Please read the full phrase clearly and try again.`);
          if (mediaRecorderRef.current) mediaRecorderRef.current.stop();
        }
      }
    };

    recognition.start();
  };

  const processBiometrics = async (textScore: number) => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
    
    await new Promise(r => setTimeout(r, 400));

    const audioBlob = audioChunksRef.current.length > 0
      ? new Blob(audioChunksRef.current, { type: 'audio/webm' })
      : null;
    
    if (audioBlob) {
      setAudioUrl(URL.createObjectURL(audioBlob));
    }

    const finalScore = textScore;

    if (finalScore >= 50) {
      finishVerification(finalScore, audioBlob);
    } else {
      statusRef.current = 'failed';
      setStatus('failed');
      toast.error(`Text match too low (${finalScore}%). Read the entire phrase clearly and try again.`);
    }
  };

  const finishVerification = async (score: number, audioBlob?: Blob | null) => {
    statusRef.current = 'verified';
    setStatus('verified');
    setSimilarity(score);
    if (currentUser) {
      setSaving(true);
      try {
        if (!audioBlob) {
          // No audio recorded — cannot enroll without an audio file
          statusRef.current = 'failed';
          setStatus('failed');
          toast.error("No audio recorded. Please try again.");
          return;
        }

        const formData = new FormData();
        formData.append('voice_sample', audioBlob, 'enrollment.webm');
        formData.append('id', currentUser.uid);
        formData.append('score', score.toString());

        const faceSignature = faceCapturePromiseRef.current ? await faceCapturePromiseRef.current : null;
        if (faceSignature) {
          formData.append('face_signature', JSON.stringify(faceSignature));
        } else {
          toast.warning("Couldn't capture a clear face snapshot — identity verification during the interview will be skipped for this account.");
        }

        const res = await fetch('/api/auth/verify-voice', { method: 'POST', body: formData });
        const resData = await res.json();

        if (!res.ok || !resData.success) {
          // Enrollment failed on the server (e.g. ECAPA offline) — do NOT mark as verified
          statusRef.current = 'failed';
          setStatus('failed');
          toast.error(resData.message || 'Voice enrollment failed. Ensure the ECAPA ML service is running.');
          return;
        }

        // Only update Firestore after a confirmed successful server enrollment
        await updateCandidate(currentUser.uid, { voiceVerified: true, voiceSimilarity: score });
        await refreshCandidate();
        toast.success(`Voice enrollment complete — ECAPA 192-dim embedding saved! Score: ${score}%`);
      } catch (err: any) {
        statusRef.current = 'failed';
        setStatus('failed');
        toast.error("Failed to store voice enrollment: " + err.message);
      } finally {
        setSaving(false);
      }
    }
  };

  const testVoiceVerification = async () => {
    if (!currentUser?.uid) return;
    setVerifying(true);
    setTestScore(null);
    setTestMatch(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.start();
      
      toast.info("Recording 3-second test clip for ECAPA verification...");
      
      await new Promise(r => setTimeout(r, 3200));
      
      recorder.stop();
      stream.getTracks().forEach(t => t.stop());
      
      await new Promise(r => setTimeout(r, 300));
      const testBlob = new Blob(chunks, { type: 'audio/webm' });
      
      const formData = new FormData();
      formData.append('id', currentUser.uid);
      formData.append('voice_sample', testBlob, 'test_verify.webm');
      
      const res = await fetch('/api/auth/verify-voice-match', { method: 'POST', body: formData });
      const data = await res.json();
      
      if (data.success) {
        setTestScore(data.similarity_score);
        setTestMatch(data.match);
        if (data.match) {
          toast.success(`Speaker Verified! ECAPA Match Score: ${data.similarity_score}%`);
        } else {
          toast.warning(`Speaker Verification Low Match: ${data.similarity_score}%`);
        }
      } else {
        toast.error(data.message || "Verification test failed.");
      }
    } catch (err: any) {
      toast.error("Test error: " + err.message);
    } finally {
      setVerifying(false);
    }
  };

  const stopAuth = () => {
    if (recognitionRef.current) recognitionRef.current.stop();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  const pieData = [
    { name: 'Match', value: similarity },
    { name: 'Missing', value: Math.max(0, 100 - similarity) },
  ];

  const handleProceed = () => navigate('/candidate/interview');

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 p-6 md:p-12 relative overflow-hidden font-sans">
      {/* Background glow graphics */}
      <div className="absolute -z-10 top-[-200px] left-[-100px] w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[140px]" />
      <div className="absolute -z-10 bottom-[-200px] right-[-100px] w-[600px] h-[600px] bg-cyan-600/10 rounded-full blur-[140px]" />

      {/* Source frames for the facial-identity snapshot (see captureFaceSignature).
          Always mounted (so the ref is stable across capture attempts); made
          visible via CSS only while actively capturing, so the candidate can
          see themselves and position their face properly. */}
      <video
        ref={faceVideoRef}
        muted
        playsInline
        className={faceCaptureStatus === 'capturing'
          ? "fixed bottom-6 right-6 w-40 h-32 object-cover rounded-2xl border-2 border-cyan-400 shadow-2xl z-50 scale-x-[-1]"
          : "absolute w-px h-px opacity-0 pointer-events-none"}
      />

      <div className="max-w-6xl mx-auto space-y-8 relative z-10">
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-white/10 pb-6">
          <div className="space-y-2">
            <Link to="/candidate" className="flex items-center gap-2 text-slate-400 hover:text-cyan-400 text-xs font-bold uppercase tracking-widest transition-colors">
              <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
            </Link>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-blue-600/20 border border-blue-500/30">
                <Mic className="h-7 w-7 text-cyan-400" />
              </div>
              <div>
                <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-cyan-400 bg-clip-text text-transparent">
                  ECAPA-TDNN Neural Voice Enrollment
                </h1>
                <p className="text-xs uppercase font-mono tracking-widest text-slate-400 mt-0.5">
                  192-Dimensional Speaker Verification Protocol · SpeechBrain Engine
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Badge
              className={`text-xs font-mono font-bold px-3 py-1.5 flex items-center gap-2 ${
                mlConnected === null
                  ? 'bg-slate-600/10 text-slate-400 border-slate-500/20'
                  : mlConnected
                  ? 'bg-green-600/10 text-green-400 border-green-500/20'
                  : 'bg-red-600/10 text-red-400 border-red-500/20'
              }`}
            >
              <Cpu className="h-3.5 w-3.5" />
              {mlConnected === null ? 'Checking ECAPA...' : mlConnected ? 'ECAPA-TDNN Online' : 'ECAPA-TDNN Offline'}
            </Badge>
          </div>
        </header>

        {/* ML Offline Banner */}
        {mlConnected === false && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-3 p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300"
          >
            <AlertCircle className="h-5 w-5 mt-0.5 shrink-0 text-red-400" />
            <div className="space-y-0.5">
              <p className="text-sm font-bold">ECAPA ML Service is Offline</p>
              <p className="text-xs text-red-300/70">
                The Python ECAPA-TDNN service on port 8000 is not reachable.
                Voice enrollment will fail without it. Start it with{' '}
                <code className="font-mono bg-white/10 px-1 rounded">python app.py</code>{' '}
                inside the <code className="font-mono bg-white/10 px-1 rounded">python_ml_service/</code> folder.
              </p>
            </div>
          </motion.div>
        )}

        {/* Main Grid */}
        <div className="grid md:grid-cols-2 gap-8">
          {/* Left Panel - Enrollment & Phrase */}
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-2xl relative overflow-hidden group space-y-6">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-widest flex items-center gap-2">
                  <Radio className="h-4 w-4 animate-pulse text-cyan-400" /> Biometric Capture
                </span>
                <Badge variant="outline" className="bg-white/5 text-slate-400 border-white/10 text-[10px]">
                  Threshold: 50%
                </Badge>
              </div>

              {/* Facial identity snapshot status */}
              <div className="p-3 rounded-2xl bg-white/2 border border-white/5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-2">
                    <ScanFace className="h-4 w-4 text-cyan-400" /> Facial Identity Snapshot
                  </span>
                  <Badge className={
                    faceCaptureStatus === 'captured' ? "bg-green-500/10 text-green-400 border-green-500/20" :
                    faceCaptureStatus === 'capturing' ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/20 animate-pulse" :
                    faceCaptureStatus === 'failed' ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                    "bg-slate-500/10 text-slate-400 border-slate-500/20"
                  }>
                    {faceCaptureStatus === 'captured' ? 'Captured' :
                     faceCaptureStatus === 'capturing' ? 'Capturing...' :
                     faceCaptureStatus === 'failed' ? 'Not Captured' : 'Idle'}
                  </Badge>
                </div>
                {faceCaptureStatus === 'capturing' && (
                  <p className="text-[10px] text-cyan-400/70 italic">Look at your camera preview (bottom-right) — hold still for a few seconds.</p>
                )}
                {(faceCaptureStatus === 'failed' || faceCaptureStatus === 'captured') && (
                  <Button
                    onClick={retryFaceCapture}
                    variant="outline"
                    size="sm"
                    className="w-full bg-white/5 border-white/10 hover:bg-cyan-500/10 text-slate-300 text-[10px] font-bold uppercase tracking-wider gap-2 h-8"
                  >
                    <RefreshCw className="h-3 w-3" /> {faceCaptureStatus === 'failed' ? 'Retry Capture' : 'Recapture'}
                  </Button>
                )}
              </div>

              {/* Phrase Card */}
              <div className="bg-slate-950/70 rounded-2xl p-6 border border-white/10 space-y-3 shadow-inner">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Read Registration Phrase Aloud
                </p>
                <h2 className="text-lg font-bold text-white leading-relaxed">
                  "{REFERENCE_PHRASE}"
                </h2>
              </div>

              {/* Visualizer & Wave */}
              <div className="min-h-[70px] flex flex-col items-center justify-center space-y-2 bg-white/2 rounded-2xl p-4 border border-white/5">
                <AnimatePresence mode="wait">
                  {status === 'analyzing' ? (
                    <motion.div key="visualizer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full flex flex-col items-center gap-3">
                      <AudioVisualizer isListening={true} />
                      <div className="flex items-center gap-2 text-cyan-400">
                        <Activity className="h-4 w-4 animate-pulse" />
                        <span className="text-[10px] font-bold uppercase tracking-widest animate-pulse">Capturing Frequency Spectrum</span>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-slate-400 text-xs italic font-medium">
                      {status === 'idle' ? 'Microphone ready. Click button to begin recording.' : status === 'verified' ? '✓ Biometric Voiceprint Registered Successfully' : 'Analysis Incomplete. Retry recording.'}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Transcript Display */}
              <div className="bg-black/30 rounded-2xl p-4 border border-white/5 min-h-[64px]">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">Recognized Speech</p>
                <p className="text-xs font-mono">
                  <span className="text-slate-200">{transcript}</span>
                  <span className="text-cyan-400/70 ml-1">{interimTranscript}</span>
                  {!transcript && !interimTranscript && <span className="text-slate-600 italic">... Waiting for audio ...</span>}
                </p>
              </div>

              {/* Audio Playback if available */}
              {audioUrl && (
                <div className="p-3 bg-white/2 border border-white/5 rounded-2xl flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-2">
                    <Volume2 className="h-4 w-4 text-cyan-400" /> Recorded Sample
                  </span>
                  <audio controls src={audioUrl} className="h-8 max-w-[220px]" />
                </div>
              )}

              {/* Action Button */}
              <div className="flex justify-center pt-2">
                <button
                  onClick={status === 'analyzing' ? stopAuth : startAuth}
                  className={`group relative h-24 w-24 rounded-3xl flex items-center justify-center transition-all duration-300 shadow-2xl ${
                    status === 'analyzing' 
                      ? 'bg-red-600 shadow-red-600/30' 
                      : status === 'verified'
                      ? 'bg-green-600 shadow-green-600/30'
                      : 'bg-gradient-to-r from-blue-600 to-cyan-500 hover:scale-105 shadow-cyan-500/20'
                  }`}
                >
                  {status === 'analyzing' ? (
                    <div className="w-7 h-7 bg-white rounded-md animate-pulse" />
                  ) : status === 'verified' ? (
                    <CheckCircle2 className="h-10 w-10 text-white" />
                  ) : (
                    <Mic className="h-10 w-10 text-white" />
                  )}
                </button>
              </div>
            </div>
          </motion.div>

          {/* Right Panel - Similarity Gauge & Verification Test */}
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="space-y-6">
            <div className="bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-2xl flex flex-col justify-between h-full space-y-6">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-bold text-white">Enrollment Alignment</h3>
                  <Badge className={status === 'verified' ? "bg-green-500/10 text-green-400 border-green-500/20" : "bg-blue-500/10 text-cyan-400 border-blue-500/20"}>
                    {status === 'verified' ? 'Verified' : 'Pending'}
                  </Badge>
                </div>

                <div className="flex justify-between items-end">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Match Score</span>
                  <span className="text-3xl font-mono font-bold text-cyan-400">{similarity}%</span>
                </div>

                <div className="h-3 w-full bg-white/5 rounded-full overflow-hidden relative border border-white/5">
                  <motion.div 
                    className="h-full bg-gradient-to-r from-blue-600 via-cyan-400 to-green-400"
                    initial={{ width: 0 }}
                    animate={{ width: `${similarity}%` }}
                    transition={{ type: 'spring', damping: 20 }}
                  />
                  <div className="absolute top-0 left-[50%] w-px h-full bg-white/40 shadow-[0_0_10px_white]" />
                </div>
                
                <div className="flex justify-between text-[10px] font-mono text-slate-400">
                  <span>0%</span>
                  <span>Threshold (50%)</span>
                  <span>100%</span>
                </div>
              </div>

              {/* Pie Chart Representation */}
              <div className="relative w-64 h-64 mx-auto flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={75} outerRadius={95} paddingAngle={3} dataKey="value" startAngle={225} endAngle={-45}>
                      <Cell fill={status === 'verified' ? '#22c55e' : '#06b6d4'} fillOpacity={0.9} />
                      <Cell fill="rgba(255,255,255,0.05)" />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl text-center">
                    {status === 'verified' ? (
                      <div>
                        <CheckCircle2 className="h-8 w-8 text-green-400 mx-auto mb-1" />
                        <p className="text-[10px] font-bold text-green-400 uppercase tracking-wider">Voiceprint Enrolled</p>
                      </div>
                    ) : (
                      <div>
                        <Volume2 className={`h-8 w-8 ${status === 'analyzing' ? 'text-cyan-400 animate-pulse' : 'text-slate-400'} mx-auto mb-1`} />
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Speaker Matrix</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Test Voice Verification Block */}
              {status === 'verified' && (
                <div className="p-5 rounded-2xl bg-cyan-500/5 border border-cyan-500/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-cyan-300 flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4" /> Live Speaker Verification Tester
                    </span>
                    {testScore !== null && (
                      <Badge className={testMatch ? "bg-green-500/20 text-green-300" : "bg-amber-500/20 text-amber-300"}>
                        {testScore}% Match
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-slate-400">
                    Record a 3-second sample to verify against your stored ECAPA 192-dim embedding.
                  </p>
                  <Button
                    onClick={testVoiceVerification}
                    disabled={verifying}
                    variant="outline"
                    className="w-full bg-white/5 border-cyan-500/30 hover:bg-cyan-500/20 text-cyan-300 text-xs font-bold uppercase tracking-wider gap-2 h-10"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${verifying ? 'animate-spin' : ''}`} />
                    {verifying ? "Comparing ECAPA Vectors..." : "Test Verification Match"}
                  </Button>
                </div>
              )}

              {/* Proceed Button */}
              {status === 'verified' && (
                <Button
                  onClick={handleProceed}
                  disabled={saving}
                  className="w-full h-14 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white rounded-2xl font-bold uppercase tracking-widest text-xs transition-all shadow-xl shadow-blue-600/20 flex items-center justify-center gap-2"
                >
                  Proceed to AI Interview Protocol <ArrowRight className="h-4 w-4" />
                </Button>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
