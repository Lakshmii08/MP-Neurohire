const Database = require('better-sqlite3');
const db = new Database('./server/database.sqlite');

const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`).all();
for (const table of tables) {
  console.log('Dropping table:', table.name);
  db.prepare(`DROP TABLE IF EXISTS ${table.name}`).run();
}

console.log('Tables dropped. Running schema...');

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
    recruiter_name TEXT,
    website TEXT,
    logo_path TEXT,
    designation TEXT,
    phone TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS resume_analysis (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    candidate_id INTEGER,
    ai_score INTEGER,
    ats_score INTEGER,
    technical_skills TEXT,
    soft_skills TEXT,
    missing_skills TEXT,
    strengths TEXT,
    weaknesses TEXT,
    recommendations TEXT,
    ai_summary TEXT,
    FOREIGN KEY(candidate_id) REFERENCES candidates(id)
  );

  CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    applicants INTEGER,
    active INTEGER,
    status TEXT
  );

  CREATE TABLE IF NOT EXISTS interviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    session_id TEXT,
    questions TEXT,
    difficulty TEXT,
    categories TEXT,
    answers TEXT,
    transcripts TEXT,
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
    similarity_score INTEGER,
    verification_status TEXT,
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
    screenshots TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    final_recommendation TEXT,
    hiring_probability INTEGER,
    ai_summary TEXT,
    strengths TEXT,
    weaknesses TEXT,
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

console.log('Successfully recreated all tables with the correct full schema!');
