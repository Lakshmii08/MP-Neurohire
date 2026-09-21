import express from 'express';
import db from '../db.js';

const router = express.Router();

router.get('/candidates', (req, res) => {
  const candidates = db.prepare(`
    SELECT c.id, c.user_id, u.name, c.role_applied as role, c.score, c.status, c.voice_score as voice, c.proctor_score as proctor
    FROM candidates c
    JOIN users u ON c.user_id = u.id
  `).all();
  res.json(candidates);
});

router.put('/candidates/:id/status', (req, res) => {
  const { status } = req.body;
  db.prepare('UPDATE candidates SET status = ? WHERE id = ?').run(status, req.params.id);
  res.json({ success: true });
});

// Real applicant counts (job_applications rows), not the fake static
// jobs.applicants seed value.
router.get('/jobs', (req, res) => {
  const jobs = db.prepare(`
    SELECT j.*, COUNT(ja.id) as applicants
    FROM jobs j
    LEFT JOIN job_applications ja ON ja.job_id = j.id
    GROUP BY j.id
    ORDER BY j.id DESC
  `).all();
  res.json(jobs);
});

router.post('/jobs', (req, res) => {
  const { title, company, location, type, salary, experience_level, required_skills, description, applicants, active, status } = req.body;
  try {
    const info = db.prepare(`INSERT INTO jobs 
      (title, company, location, type, salary, experience_level, required_skills, description, applicants, active, status) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      title, 
      company || 'NeuroHire Tech', 
      location || 'Remote', 
      type || 'Full-time', 
      salary || '$120k - $160k', 
      experience_level || 'Mid-Senior', 
      typeof required_skills === 'object' ? JSON.stringify(required_skills) : (required_skills || '[]'), 
      description || 'Join high-impact technical team building next-generation intelligent platforms.', 
      applicants || 0, 
      active !== undefined ? (active ? 1 : 0) : 1, 
      status || 'Open'
    );
    res.json({ success: true, id: info.lastInsertRowid });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Records a real application when a candidate starts the interview for a
// recommended job (see CandidateDashboard.tsx). Idempotent — clicking the
// same job again doesn't create duplicate application rows.
router.post('/jobs/:id/apply', (req, res) => {
  const { user_id } = req.body;
  if (!user_id) {
    return res.status(400).json({ success: false, message: 'user_id is required.' });
  }
  try {
    const candidate = db.prepare('SELECT id FROM candidates WHERE user_id = ?').get(user_id);
    if (!candidate) {
      return res.status(404).json({ success: false, message: 'Candidate profile not found.' });
    }
    db.prepare('INSERT OR IGNORE INTO job_applications (job_id, candidate_id) VALUES (?, ?)')
      .run(req.params.id, candidate.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// The real, per-job applicant list for the recruiter's "View Applicants"
// page — only candidates who actually applied to THIS job, not every
// candidate in the system.
router.get('/jobs/:id/applicants', (req, res) => {
  try {
    const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(req.params.id);
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found.' });
    }
    const applicants = db.prepare(`
      SELECT c.id, c.user_id, u.name, c.role_applied as role, c.score, c.status,
             c.voice_score as voice, c.proctor_score as proctor, ja.applied_at
      FROM job_applications ja
      JOIN candidates c ON c.id = ja.candidate_id
      JOIN users u ON u.id = c.user_id
      WHERE ja.job_id = ?
      ORDER BY ja.applied_at DESC
    `).all(req.params.id);
    // job.applicants still carries the legacy static seed value — replace it
    // with the real count so nothing reading this response gets misled.
    res.json({ success: true, job: { ...job, applicants: applicants.length }, applicants });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/jobs/:id/status', (req, res) => {
  const { status } = req.body;
  if (!status || !['Open', 'Closed'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Status must be "Open" or "Closed".' });
  }
  try {
    db.prepare('UPDATE jobs SET status = ?, active = ? WHERE id = ?').run(status, status === 'Open' ? 1 : 0, req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/logs', (req, res) => {
  // Try to join with candidates to get names for newer logs
  const logs = db.prepare(`
    SELECT pl.*, 
           COALESCE(u.name, pl.candidate_name) as candidate
    FROM proctor_logs pl
    LEFT JOIN users u ON pl.user_id = u.id
    ORDER BY pl.id DESC
  `).all();
  res.json(logs);
});

router.get('/recruiter/:uid', (req, res) => {
  try {
    const user = db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(req.params.uid);
    if (!user) {
      return res.json({ success: false, message: 'User not found' });
    }

    const recruiter = db.prepare(`
      SELECT r.*, u.email, u.name 
      FROM recruiters r 
      JOIN users u ON r.user_id = u.id 
      WHERE u.id = ?
    `).get(req.params.uid);
    
    if (recruiter) {
      res.json({ success: true, recruiter: {
        id: recruiter.id,
        userId: recruiter.user_id,
        companyName: recruiter.company_name || 'NeuroHire Talent Labs',
        companySize: recruiter.company_size || '100-500 Units',
        recruiterName: recruiter.recruiter_name || recruiter.name || 'Sarah Jenkins',
        website: recruiter.website || 'https://neurohire.com',
        designation: recruiter.designation || 'Director of Technical Talent',
        phone: recruiter.phone || '+1 (555) 019-2834',
        email: recruiter.email,
        status: recruiter.status || 'verified'
      }});
    } else if (user.role === 'admin' || user.role === 'recruiter') {
      res.json({ success: true, recruiter: {
        id: user.id,
        userId: user.id,
        companyName: 'NeuroHire Enterprise HQ',
        companySize: '500+ Units',
        recruiterName: user.name || 'System Administrator',
        website: 'https://neurohire.com',
        designation: 'Enterprise Recruitment Admin',
        phone: '+1 (555) 019-2834',
        email: user.email,
        status: 'verified'
      }});
    } else {
      res.json({ success: false });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
