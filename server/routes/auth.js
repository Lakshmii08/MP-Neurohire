import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import db from '../db.js';

const router = express.Router();

// Setup Multer for profile images and logos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let dir = 'uploads/profiles';
    if (file.fieldname === 'voice_sample') dir = 'uploads/voices';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

router.post('/login', (req, res) => {
  const { email, password, ip_address, device_info } = req.body;
  const user = db.prepare('SELECT id, name, email, role, voice_verified FROM users WHERE email = ? AND password = ?').get(email, password);
  
  if (user) {
    db.prepare('INSERT INTO login_history (user_id, ip_address, device_info) VALUES (?, ?, ?)')
      .run(user.id, ip_address || req.ip, device_info || req.get('User-Agent'));

    let recruiter = null;
    if (user.role === 'recruiter' || user.role === 'admin') {
      recruiter = db.prepare('SELECT * FROM recruiters WHERE user_id = ?').get(user.id);
    }

    res.json({ 
      success: true, 
      user: {
        ...user,
        recruiter: recruiter ? {
          companyName: recruiter.company_name,
          companySize: recruiter.company_size || '100-500 Units',
          recruiterName: recruiter.recruiter_name,
          website: recruiter.website,
          designation: recruiter.designation,
          phone: recruiter.phone,
          status: recruiter.status || 'verified'
        } : null
      } 
    });
  } else {
    res.status(401).json({ success: false, message: 'Invalid credentials' });
  }
});

router.post('/register', upload.fields([{ name: 'profile_image', maxCount: 1 }, { name: 'logo', maxCount: 1 }]), (req, res) => {
  const { email, password, role, ...otherData } = req.body;
  const profile_image = req.files && req.files['profile_image'] ? req.files['profile_image'][0].path : null;
  const logo_path = req.files && req.files['logo'] ? req.files['logo'][0].path : null;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password are required.' });
  }

  const cleanEmail = String(email).trim().toLowerCase();

  try {
    // Check if user already exists
    const existing = db.prepare('SELECT id, name, email, role FROM users WHERE LOWER(email) = ?').get(cleanEmail);
    if (existing) {
      return res.status(400).json({ 
        success: false, 
        message: `An account with "${cleanEmail}" already exists. Please log in instead.` 
      });
    }

    const stmt = db.prepare('INSERT INTO users (name, email, password, role, profile_image) VALUES (?, ?, ?, ?, ?)');
    let name = '';
    if (role === 'user') {
      name = `${otherData.first_name || ''} ${otherData.last_name || ''}`.trim();
    } else if (role === 'recruiter' || role === 'admin') {
      name = otherData.recruiter_name || otherData.company_name || 'Recruiter Admin';
    }
    if (!name) name = cleanEmail.split('@')[0];

    const info = stmt.run(name, cleanEmail, password, role || 'user', profile_image || null);
    
    if (role === 'user' || !role) {
      db.prepare('INSERT INTO candidates (user_id, first_name, last_name, role_applied) VALUES (?, ?, ?, ?)')
        .run(
          info.lastInsertRowid, 
          otherData.first_name || null, 
          otherData.last_name || null, 
          otherData.role_applied || 'Software Engineer'
        );
    } else if (role === 'recruiter' || role === 'admin') {
      db.prepare(`INSERT INTO recruiters 
        (user_id, company_name, company_size, recruiter_name, website, logo_path, designation, phone, status) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
          info.lastInsertRowid, 
          otherData.company_name || 'Organization', 
          otherData.company_size || otherData.scale_factor || '100-500 Units',
          otherData.recruiter_name || name, 
          otherData.website || 'https://neurohire.com', 
          logo_path || null, 
          otherData.designation || 'Talent Acquisition Lead', 
          otherData.phone || null,
          'verified'
        );
    }
    
    res.json({ 
      success: true, 
      user: { 
        id: info.lastInsertRowid, 
        name, 
        email: cleanEmail, 
        role: role || 'user', 
        voice_verified: 0,
        recruiter: (role === 'recruiter' || role === 'admin') ? {
          companyName: otherData.company_name || 'Organization',
          companySize: otherData.company_size || otherData.scale_factor || '100-500 Units',
          recruiterName: otherData.recruiter_name || name,
          website: otherData.website || 'https://neurohire.com',
          status: 'verified'
        } : null
      } 
    });
  } catch (error) {
    console.error("Signup Error:", error);
    res.status(400).json({ success: false, message: 'Registration failed. ' + error.message, error: error.message });
  }
});

// ── ML Health Proxy ───────────────────────────────────────────────────────────
// Frontend calls this instead of hitting the Python service directly (avoids
// no-cors mode which swallows all errors and always appears successful).
router.get('/ml-status', async (req, res) => {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 3000);
    const r = await fetch('http://127.0.0.1:8000/docs', { signal: ctrl.signal });
    clearTimeout(timer);
    res.json({ online: r.ok || r.status < 500 });
  } catch {
    res.json({ online: false });
  }
});

router.post('/verify-voice', upload.single('voice_sample'), async (req, res) => {
  const { id, score } = req.body;
  const voice_sample_path = req.file ? req.file.path : null;

  // Reject requests with no valid score — removes the || 85 bypass
  const finalScore = parseInt(score);
  if (!finalScore || finalScore < 1 || finalScore > 100) {
    if (voice_sample_path && fs.existsSync(voice_sample_path)) fs.unlinkSync(voice_sample_path);
    return res.status(400).json({ success: false, message: 'A valid score (1-100) is required.' });
  }

  // Require an audio file for enrollment
  if (!voice_sample_path || !fs.existsSync(voice_sample_path)) {
    return res.status(400).json({ success: false, message: 'Audio voice sample is required for enrollment.' });
  }

  try {
    // ── Step 1: Extract ECAPA embedding — REQUIRED, not optional ────────────
    let embeddingStr = null;
    try {
      const formData = new FormData();
      const audioBuffer = fs.readFileSync(voice_sample_path);
      const audioBlob = new Blob([audioBuffer], { type: 'audio/webm' });
      formData.append('file', audioBlob, 'enrollment.webm');

      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 15000);
      const mlRes = await fetch('http://127.0.0.1:8000/extract-embedding', {
        method: 'POST',
        body: formData,
        signal: ctrl.signal
      });
      clearTimeout(timer);
      const mlData = await mlRes.json();
      if (mlData.success && mlData.embedding) {
        embeddingStr = JSON.stringify(mlData.embedding);
        console.log(`[ECAPA] Extracted 192-dim embedding for user ${id}`);
      } else {
        throw new Error(mlData.detail || 'ML service returned no embedding.');
      }
    } catch (err) {
      // Enrollment MUST fail if the ML service is unreachable or returns no embedding
      if (voice_sample_path && fs.existsSync(voice_sample_path)) fs.unlinkSync(voice_sample_path);
      console.error('[ECAPA] Enrollment failed — ML service error:', err.message || err);
      return res.status(503).json({
        success: false,
        message: 'ECAPA voice service is offline or failed to process audio. Please ensure the Python ML service is running on port 8000 and try again.',
        ecapa_error: err.message
      });
    }

    // ── Step 2: Persist embedding and mark user verified ────────────────────
    db.prepare('UPDATE users SET voice_verified = 1 WHERE id = ?').run(id);

    const existing = db.prepare('SELECT id FROM voice_auth WHERE user_id = ?').get(id);
    if (existing) {
      db.prepare('UPDATE voice_auth SET voice_sample_path = ?, voice_embedding = ?, similarity_score = ?, verification_status = ? WHERE user_id = ?')
        .run(voice_sample_path, embeddingStr, finalScore, 'Verified', id);
    } else {
      db.prepare('INSERT INTO voice_auth (user_id, voice_sample_path, voice_embedding, similarity_score, verification_status) VALUES (?, ?, ?, ?, ?)')
        .run(id, voice_sample_path, embeddingStr, finalScore, 'Verified');
    }

    res.json({ success: true, score: finalScore, hasEmbedding: true });
  } catch (error) {
    console.error('verify-voice error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/verify-voice-match', upload.single('voice_sample'), async (req, res) => {
  const { id } = req.body;
  const voice_sample_path = req.file ? req.file.path : null;

  if (!id) {
    return res.status(400).json({ success: false, message: 'User ID is required.' });
  }

  try {
    const record = db.prepare('SELECT voice_embedding FROM voice_auth WHERE user_id = ?').get(id);

    if (!record || !record.voice_embedding) {
      return res.status(404).json({ success: false, message: 'No enrolled voiceprint embedding found for candidate.' });
    }

    if (!voice_sample_path || !fs.existsSync(voice_sample_path)) {
      return res.status(400).json({ success: false, message: 'Audio sample file is required.' });
    }

    const formData = new FormData();
    formData.append('enrolled_embedding', record.voice_embedding);
    const audioBuffer = fs.readFileSync(voice_sample_path);
    const audioBlob = new Blob([audioBuffer], { type: 'audio/webm' });
    formData.append('file', audioBlob, 'verify.webm');

    const mlRes = await fetch('http://127.0.0.1:8000/verify-with-embedding', {
      method: 'POST',
      body: formData
    });

    const mlData = await mlRes.json();
    if (mlData.success) {
      const simScorePercent = Math.round((mlData.similarity_score || 0) * 100);
      res.json({
        success: true,
        similarity_score: simScorePercent,
        raw_cosine: mlData.raw_cosine,
        match: mlData.match,
        threshold: mlData.threshold
      });
    } else {
      res.status(500).json({ success: false, message: mlData.detail || 'Speaker verification failed.' });
    }
  } catch (error) {
    console.error('verify-voice-match error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
