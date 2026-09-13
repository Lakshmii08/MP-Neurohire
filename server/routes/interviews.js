import express from 'express';
import db from '../db.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = 'uploads/interview_voices';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage });


router.post('/result', (req, res) => {
  const { 
    user_id, 
    session_id,
    question, 
    answer, 
    score, 
    feedback,
    speech_metrics,
    proctor_logs,
    report,
    voice_score,
    proctor_score
  } = req.body;

  try {
    // Save to interviews table
    const stmt = db.prepare(`INSERT INTO interviews 
      (user_id, session_id, questions, answers, speech_score, confidence_score, fluency_score, clarity_score)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
      
    const info = stmt.run(
      user_id, 
      session_id || 'session_' + Date.now(),
      JSON.stringify([question]),
      JSON.stringify([answer]),
      score || 0,
      speech_metrics?.confidence || 0,
      speech_metrics?.fluency || 0,
      speech_metrics?.clarity || 0
    );

    const interview_id = info.lastInsertRowid;

    // Update candidate dynamic evaluation scores in candidates table
    db.prepare(`UPDATE candidates 
      SET score = ?, status = 'Interviewed', voice_score = ?, proctor_score = ? 
      WHERE user_id = ?`)
      .run(score || 0, voice_score || 0, proctor_score || 0, user_id);

    // Save Speech Analysis
    db.prepare(`INSERT INTO speech_analysis (interview_id, pronunciation_score, grammar_score, vocabulary_score, sentiment, ai_feedback)
      VALUES (?, ?, ?, ?, ?, ?)`).run(
        interview_id,
        speech_metrics?.pronunciation || 0,
        speech_metrics?.grammar || 0,
        speech_metrics?.vocabulary || 0,
        speech_metrics?.sentiment || 'Neutral',
        feedback
      );

    // Save Proctor Logs if any
    if (proctor_logs && proctor_logs.length > 0) {
      const plStmt = db.prepare(`INSERT INTO proctor_logs 
        (user_id, session_id, event, time, type, severity, tab_switching, multiple_face, no_face, suspicious_activity)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
        
      for (const log of proctor_logs) {
        plStmt.run(user_id, session_id, log.event, log.time, log.type, log.severity, log.tab_switching ? 1 : 0, log.multiple_face ? 1 : 0, log.no_face ? 1 : 0, log.suspicious_activity ? 1 : 0);
      }
    }

    // Save Report
    if (report) {
      db.prepare(`INSERT INTO reports (user_id, final_recommendation, hiring_probability, ai_summary, strengths, weaknesses, final_feedback)
        VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
          user_id, 
          report.final_recommendation || 'Pending',
          report.hiring_probability || 0,
          report.ai_summary || '',
          JSON.stringify(report.strengths || []),
          JSON.stringify(report.weaknesses || []),
          report.final_feedback || ''
        );
    }

    res.json({ success: true, interview_id });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Persists a single proctoring event (e.g. a tab switch) to the database the
// moment it happens, rather than waiting for the interview to finish. Without
// this, an interview that's abandoned mid-way (tab-switched away and never
// returned, browser closed) leaves zero record of the violations that
// happened — they only reached the DB bundled into the final /result call.
router.post('/proctor-event', (req, res) => {
  const {
    user_id, session_id, event, type, severity,
    tab_switching, multiple_face, no_face, suspicious_activity,
  } = req.body;

  if (!user_id || !session_id) {
    return res.status(400).json({ success: false, message: 'user_id and session_id are required.' });
  }

  try {
    db.prepare(`INSERT INTO proctor_logs
      (user_id, session_id, event, time, type, severity, tab_switching, multiple_face, no_face, suspicious_activity)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      user_id,
      session_id,
      event || 'Tab Switch Detected',
      new Date().toLocaleTimeString(),
      type || 'Proctor',
      severity || 'warning',
      tab_switching ? 1 : 0,
      multiple_face ? 1 : 0,
      no_face ? 1 : 0,
      suspicious_activity ? 1 : 0
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/verify-interview-voice', upload.single('audio_chunk'), async (req, res) => {
  const { user_id, session_id } = req.body;
  const audio_chunk_path = req.file ? req.file.path : null;

  if (!audio_chunk_path) {
    return res.status(400).json({ success: false, message: 'No audio chunk provided' });
  }

  try {
    const voiceAuth = db.prepare('SELECT voice_embedding FROM voice_auth WHERE user_id = ?').get(user_id);
    
    if (!voiceAuth || !voiceAuth.voice_embedding) {
      return res.status(404).json({ success: false, message: 'User not voice verified yet or missing embedding.' });
    }

    const formData = new FormData();
    formData.append('enrolled_embedding', voiceAuth.voice_embedding);
    
    const testBlob = new Blob([fs.readFileSync(audio_chunk_path)]);
    formData.append('file', testBlob, 'test.webm');

    const response = await fetch('http://127.0.0.1:8000/verify-with-embedding', {
      method: 'POST',
      body: formData
    });

    const result = await response.json();
    
    if (result.success) {
      // If mismatch, log it
      if (!result.match) {
        db.prepare(`INSERT INTO proctor_logs 
          (user_id, session_id, event, time, type, severity, suspicious_activity)
          VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
            user_id, 
            session_id || 'session_' + Date.now(), 
            `Voiceprint Mismatch (${Math.round(result.similarity_score * 100)}% similarity)`,
            new Date().toLocaleTimeString(), 
            'Auth', 
            'high', 
            1
          );
      }
      return res.json({ success: true, match: result.match, similarity: result.similarity_score });
    } else {
      return res.status(500).json({ success: false, message: 'ML service error' });
    }
  } catch (error) {
    console.error('Voice verification error:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    // Optionally clean up the temp interview chunk
    if (fs.existsSync(audio_chunk_path)) {
      try { fs.unlinkSync(audio_chunk_path); } catch(e) {}
    }
  }
});

// ── Real speech analysis (fluency / clarity / confidence) ──────────────────
// Proxies to the Python ECAPA-TDNN ML service's /analyze-speech endpoint,
// which combines a confidence classifier (trained on synthetic_dataset) with
// genuine acoustic + transcript features. Never fabricates scores: on ML
// service failure this returns an error rather than static numbers, so the
// caller can fall back to its own transcript-only heuristic.
router.post('/analyze-speech', upload.single('answer_audio'), async (req, res) => {
  const { transcript, question } = req.body;
  const audio_path = req.file ? req.file.path : null;

  if (!audio_path) {
    return res.status(400).json({ success: false, message: 'No answer audio provided.' });
  }

  try {
    const formData = new FormData();
    const audioBuffer = fs.readFileSync(audio_path);
    formData.append('file', new Blob([audioBuffer]), 'answer.webm');
    formData.append('transcript', transcript || '');
    formData.append('question', question || '');

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20000);
    const mlRes = await fetch('http://127.0.0.1:8000/analyze-speech', {
      method: 'POST',
      body: formData,
      signal: ctrl.signal
    });
    clearTimeout(timer);

    const data = await mlRes.json();
    if (!mlRes.ok || !data.success) {
      return res.status(503).json({ success: false, message: data.detail || 'Speech analysis service error.' });
    }
    res.json(data);
  } catch (error) {
    console.error('analyze-speech error:', error.message || error);
    res.status(503).json({
      success: false,
      message: 'Speech analysis ML service is offline or failed to process the audio.'
    });
  } finally {
    if (audio_path && fs.existsSync(audio_path)) {
      try { fs.unlinkSync(audio_path); } catch (e) { /* ignore */ }
    }
  }
});

export default router;
