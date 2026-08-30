import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new Database(dbPath, { verbose: console.log });

db.pragma('journal_mode = WAL');

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('user', 'admin', 'recruiter')),
    profile_image TEXT,
    voice_verified BOOLEAN DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS candidates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    first_name TEXT,
    last_name TEXT,
    resume_path TEXT,
    resume_text TEXT,
    role_applied TEXT,
    score INTEGER DEFAULT 0,
    status TEXT DEFAULT 'New',
    voice_score INTEGER DEFAULT 0,
    proctor_score INTEGER DEFAULT 0,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS recruiters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    company_name TEXT,
    company_size TEXT,
    recruiter_name TEXT,
    website TEXT,
    logo_path TEXT,
    designation TEXT,
    phone TEXT,
    status TEXT DEFAULT 'verified',
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS resume_analysis (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    candidate_id INTEGER,
    ai_score INTEGER,
    ats_score INTEGER,
    technical_skills TEXT, -- JSON
    soft_skills TEXT, -- JSON
    missing_skills TEXT, -- JSON
    strengths TEXT, -- JSON
    weaknesses TEXT, -- JSON
    recommendations TEXT, -- JSON
    ai_summary TEXT,
    qualifications TEXT, -- JSON
    experience TEXT, -- JSON
    projects TEXT, -- JSON
    certifications TEXT, -- JSON
    contact_info TEXT, -- JSON
    radar_data TEXT, -- JSON
    global_percentile TEXT,
    reliability_score TEXT,
    FOREIGN KEY(candidate_id) REFERENCES candidates(id)
  );

  CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    company TEXT DEFAULT 'NeuroHire Tech',
    location TEXT DEFAULT 'Remote',
    type TEXT DEFAULT 'Full-time',
    salary TEXT DEFAULT '$120k - $160k',
    experience_level TEXT DEFAULT 'Mid-Senior',
    required_skills TEXT, -- JSON array of strings e.g. ["React", "TypeScript", "Node.js"]
    description TEXT,
    applicants INTEGER DEFAULT 0,
    active INTEGER DEFAULT 1,
    status TEXT DEFAULT 'Open'
  );

  CREATE TABLE IF NOT EXISTS interviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    session_id TEXT,
    questions TEXT, -- JSON
    difficulty TEXT,
    categories TEXT, -- JSON
    answers TEXT, -- JSON
    transcripts TEXT, -- JSON
    speech_score INTEGER,
    confidence_score INTEGER,
    fluency_score INTEGER,
    clarity_score INTEGER,
    emotion_detected TEXT,
    filler_word_count INTEGER,
    response_time INTEGER,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS speech_analysis (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    interview_id INTEGER,
    pronunciation_score INTEGER,
    grammar_score INTEGER,
    vocabulary_score INTEGER,
    sentiment TEXT,
    ai_feedback TEXT,
    FOREIGN KEY(interview_id) REFERENCES interviews(id)
  );

  CREATE TABLE IF NOT EXISTS voice_auth (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    voice_sample_path TEXT,
    voice_embedding TEXT,          -- JSON array: 192-dim L2-normalised ECAPA embedding
    similarity_score REAL DEFAULT 0,
    verification_status TEXT,
    enrolled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS proctor_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    session_id TEXT,
    candidate_name TEXT,
    event TEXT,
    time TEXT,
    type TEXT,
    severity TEXT,
    tab_switching INTEGER DEFAULT 0,
    multiple_face INTEGER DEFAULT 0,
    no_face INTEGER DEFAULT 0,
    suspicious_activity INTEGER DEFAULT 0,
    camera_mic_status TEXT,
    screenshots TEXT, -- JSON array of paths
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    final_recommendation TEXT,
    hiring_probability INTEGER,
    ai_summary TEXT,
    strengths TEXT, -- JSON
    weaknesses TEXT, -- JSON
    final_feedback TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    title TEXT,
    message TEXT,
    read_status BOOLEAN DEFAULT 0,
    type TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS login_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    ip_address TEXT,
    device_info TEXT,
    login_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`);

// Migration guards: add missing columns if DB was created before this version
const migrateColumns = [
  { table: 'voice_auth', col: 'voice_embedding', type: 'TEXT' },
  { table: 'resume_analysis', col: 'qualifications', type: 'TEXT' },
  { table: 'resume_analysis', col: 'experience', type: 'TEXT' },
  { table: 'resume_analysis', col: 'projects', type: 'TEXT' },
  { table: 'resume_analysis', col: 'certifications', type: 'TEXT' },
  { table: 'resume_analysis', col: 'contact_info', type: 'TEXT' },
  { table: 'resume_analysis', col: 'radar_data', type: 'TEXT' },
  { table: 'resume_analysis', col: 'global_percentile', type: 'TEXT' },
  { table: 'resume_analysis', col: 'reliability_score', type: 'TEXT' },
  { table: 'jobs', col: 'company', type: "TEXT DEFAULT 'NeuroHire Tech'" },
  { table: 'jobs', col: 'location', type: "TEXT DEFAULT 'Remote'" },
  { table: 'jobs', col: 'type', type: "TEXT DEFAULT 'Full-time'" },
  { table: 'jobs', col: 'salary', type: "TEXT DEFAULT '$120k - $160k'" },
  { table: 'jobs', col: 'experience_level', type: "TEXT DEFAULT 'Mid-Senior'" },
  { table: 'jobs', col: 'required_skills', type: 'TEXT' },
  { table: 'jobs', col: 'description', type: 'TEXT' },
  { table: 'recruiters', col: 'company_size', type: "TEXT DEFAULT '100-500 Units'" },
  { table: 'recruiters', col: 'status', type: "TEXT DEFAULT 'verified'" },
];

for (const { table, col, type } of migrateColumns) {
  try {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`);
    console.log(`[DB] Migrated: added ${col} column to ${table}`);
  } catch (e) {
    // Column already exists
  }
}

// Ensure Default Recruiter exists in DB
const recruiterUser = db.prepare('SELECT id FROM users WHERE email = ?').get('recruiter@neurohire.com');
if (!recruiterUser) {
  const rRes = db.prepare('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)').run(
    'Sarah Jenkins', 'recruiter@neurohire.com', 'recruiter123', 'recruiter'
  );
  db.prepare(`INSERT INTO recruiters (user_id, company_name, recruiter_name, website, designation, phone) 
    VALUES (?, ?, ?, ?, ?, ?)`).run(
    rRes.lastInsertRowid, 
    'NeuroHire Talent Labs', 
    'Sarah Jenkins', 
    'https://neurohire.com', 
    'Director of Technical Talent', 
    '+1 (555) 019-2834'
  );
  console.log('[DB] Seeded default recruiter: recruiter@neurohire.com / recruiter123');
} else {
  // Ensure recruiters table record exists for this user
  const recruiterRec = db.prepare('SELECT id FROM recruiters WHERE user_id = ?').get(recruiterUser.id);
  if (!recruiterRec) {
    db.prepare(`INSERT INTO recruiters (user_id, company_name, recruiter_name, website, designation, phone) 
      VALUES (?, ?, ?, ?, ?, ?)`).run(
      recruiterUser.id, 
      'NeuroHire Talent Labs', 
      'Sarah Jenkins', 
      'https://neurohire.com', 
      'Director of Technical Talent', 
      '+1 (555) 019-2834'
    );
  }
}

// Seed default rich tech jobs if needed
const sampleJobs = [
  {
    title: 'Senior Full Stack Engineer',
    company: 'NeuroScale AI',
    location: 'Remote / San Francisco, CA',
    type: 'Full-time',
    salary: '$140k - $180k',
    experience_level: '3-5 Years',
    required_skills: JSON.stringify(['React', 'TypeScript', 'Node.js', 'Express', 'PostgreSQL', 'REST API', 'Docker', 'Git']),
    description: 'Architect and build high-performance web applications, resilient backend microservices, and modern user interfaces.',
    applicants: 42,
    active: 1,
    status: 'Open'
  },
  {
    title: 'AI / Machine Learning Engineer',
    company: 'Cortex Intelligence Labs',
    location: 'Remote / New York, NY',
    type: 'Full-time',
    salary: '$150k - $200k',
    experience_level: '2-4 Years',
    required_skills: JSON.stringify(['Python', 'PyTorch', 'TensorFlow', 'NLP', 'Machine Learning', 'FastAPI', 'Docker', 'Pandas', 'Scikit-Learn']),
    description: 'Develop and deploy state-of-the-art transformer and voice biometric models into low-latency production pipelines.',
    applicants: 38,
    active: 1,
    status: 'Open'
  },
  {
    title: 'Frontend Developer (React / Next.js)',
    company: 'Vanguard Digital',
    location: 'Hybrid / Seattle, WA',
    type: 'Full-time',
    salary: '$115k - $145k',
    experience_level: '1-3 Years',
    required_skills: JSON.stringify(['React', 'Next.js', 'TypeScript', 'JavaScript', 'Tailwind', 'HTML5', 'CSS3', 'Redux', 'Git']),
    description: 'Craft pixel-perfect, responsive, and high-performance interactive user experiences with cutting-edge React paradigms.',
    applicants: 89,
    active: 1,
    status: 'Open'
  },
  {
    title: 'Backend Systems Architect',
    company: 'Quantum Infrastructure',
    location: 'Remote / Austin, TX',
    type: 'Full-time',
    salary: '$160k - $210k',
    experience_level: '4-7 Years',
    required_skills: JSON.stringify(['Node.js', 'Python', 'Java', 'PostgreSQL', 'Redis', 'Microservices', 'System Design', 'Docker', 'Kubernetes', 'AWS']),
    description: 'Design distributed transaction engines, real-time event streaming systems, and fault-tolerant cloud APIs.',
    applicants: 29,
    active: 1,
    status: 'Open'
  },
  {
    title: 'DevOps & Cloud Reliability Engineer',
    company: 'CloudSphere Networks',
    location: 'Remote',
    type: 'Full-time',
    salary: '$135k - $175k',
    experience_level: '2-5 Years',
    required_skills: JSON.stringify(['Docker', 'Kubernetes', 'AWS', 'CI/CD', 'Linux', 'Bash', 'Git', 'Python', 'PostgreSQL']),
    description: 'Automate continuous integration, container orchestration, zero-downtime deployments, and infrastructure as code.',
    applicants: 24,
    active: 1,
    status: 'Open'
  },
  {
    title: 'Data Scientist & Analytics Specialist',
    company: 'Synthetix Data Systems',
    location: 'Hybrid / Boston, MA',
    type: 'Full-time',
    salary: '$130k - $170k',
    experience_level: '2-4 Years',
    required_skills: JSON.stringify(['Python', 'SQL', 'Pandas', 'NumPy', 'Data Analysis', 'Scikit-Learn', 'Matplotlib', 'Jupyter', 'Machine Learning']),
    description: 'Extract deep business intelligence, formulate statistical inference models, and build predictive dashboards.',
    applicants: 51,
    active: 1,
    status: 'Open'
  },
  {
    title: 'Mobile Application Engineer',
    company: 'Apex Mobile Labs',
    location: 'Remote / Los Angeles, CA',
    type: 'Full-time',
    salary: '$125k - $160k',
    experience_level: '2-4 Years',
    required_skills: JSON.stringify(['React Native', 'React', 'TypeScript', 'JavaScript', 'REST API', 'Firebase', 'Git']),
    description: 'Build and maintain native-performance cross-platform mobile apps with fluid animations and offline sync.',
    applicants: 31,
    active: 1,
    status: 'Open'
  },
  {
    title: 'Cybersecurity & Identity Engineer',
    company: 'CipherGuard Security',
    location: 'Hybrid / Chicago, IL',
    type: 'Full-time',
    salary: '$140k - $185k',
    experience_level: '3-5 Years',
    required_skills: JSON.stringify(['Python', 'Linux', 'Security', 'REST API', 'Docker', 'System Design', 'AWS', 'Git']),
    description: 'Implement biometric authentication, zero-trust access protocols, and proactive threat detection.',
    applicants: 19,
    active: 1,
    status: 'Open'
  }
];

const existingJobCount = db.prepare('SELECT count(*) as count FROM jobs WHERE required_skills IS NOT NULL').get();
if (existingJobCount.count === 0) {
  // Clear any old jobs with missing schema
  db.prepare('DELETE FROM jobs').run();
  
  const insertJob = db.prepare(`INSERT INTO jobs 
    (title, company, location, type, salary, experience_level, required_skills, description, applicants, active, status) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

  for (const job of sampleJobs) {
    insertJob.run(
      job.title,
      job.company,
      job.location,
      job.type,
      job.salary,
      job.experience_level,
      job.required_skills,
      job.description,
      job.applicants,
      job.active,
      job.status
    );
  }
  console.log(`[DB] Seeded ${sampleJobs.length} rich job profiles with skill requirements.`);
}

// Seed default users if empty
const userCount = db.prepare('SELECT count(*) as count FROM users').get();
if (userCount.count <= 1) { // Only admin or empty
  // Default Admin
  const adminCheck = db.prepare('SELECT id FROM users WHERE email = ?').get('admin@neurohire.com');
  if (!adminCheck) {
    db.prepare('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)').run(
      'System Admin', 'admin@neurohire.com', 'admin123', 'admin'
    );
  }
  
  // Default Candidates
  const stmt = db.prepare('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)');
  const res1 = stmt.run('Gaurang Agrawal', 'gaurang@test.com', 'password', 'user');
  const res2 = stmt.run('Sarah Wilson', 'sarah@test.com', 'password', 'user');
  const res3 = stmt.run('Michael Chen', 'michael@test.com', 'password', 'user');
  const res4 = stmt.run('Emily Blunt', 'emily@test.com', 'password', 'user');

  // Seed Candidate details
  const cStmt = db.prepare('INSERT INTO candidates (user_id, first_name, last_name, role_applied, score, status, voice_score, proctor_score) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  cStmt.run(res1.lastInsertRowid, 'Gaurang', 'Agrawal', 'Full Stack Engineer', 89, 'Interviewed', 94, 100);
  cStmt.run(res2.lastInsertRowid, 'Sarah', 'Wilson', 'Product Manager', 92, 'Shortlisted', 98, 98);
  cStmt.run(res3.lastInsertRowid, 'Michael', 'Chen', 'Data Scientist', 72, 'Evaluating', 62, 85);
  cStmt.run(res4.lastInsertRowid, 'Emily', 'Blunt', 'Frontend Developer', 85, 'Interviewed', 91, 100);

  // Seed Logs
  const lStmt = db.prepare('INSERT INTO proctor_logs (candidate_name, event, time, type, severity) VALUES (?, ?, ?, ?, ?)');
  lStmt.run('Michael Chen', 'Voiceprint Mismatch (42% similarity)', '14:22:10', 'Auth', 'high');
  lStmt.run('Sarah Wilson', 'Browser Tab Focus Lost', '13:05:44', 'Proctor', 'medium');
  lStmt.run('Unknown', 'Multiple Faces Detected (Candidate + 1)', '11:40:02', 'Security', 'high');
  lStmt.run('Gaurang Agrawal', 'Noise Level Peak (>85dB)', '09:15:30', 'Env', 'low');
}

export default db;
