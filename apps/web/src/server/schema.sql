-- Digital Burj Academy schema v1 (SQLite dev; Postgres-compatible types noted).
-- Conventions: UTC ISO timestamps, soft states (no hard deletes on academic records),
-- every mutating table that matters has an audit_logs entry written by the API layer.

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('student','teacher','admin','client')),
  language TEXT NOT NULL DEFAULT 'en',
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('PENDING','ACTIVE','SUSPENDED','DEACTIVATED')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS courses (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  level TEXT NOT NULL,
  outcome TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'PUBLISHED' CHECK (status IN ('DRAFT','BLUEPRINT','PUBLISHED','ARCHIVED'))
);

CREATE TABLE IF NOT EXISTS missions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_code TEXT NOT NULL REFERENCES courses(code),
  title TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('decision','build','break')),
  brief TEXT NOT NULL,
  payload TEXT NOT NULL DEFAULT '{}', -- JSON: options/consequence/scenario per kind
  difficulty INTEGER NOT NULL DEFAULT 2 CHECK (difficulty BETWEEN 1 AND 5),
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'PUBLISHED' CHECK (status IN ('DRAFT','PUBLISHED','ARCHIVED'))
);

CREATE TABLE IF NOT EXISTS enrollments (
  user_id INTEGER NOT NULL REFERENCES users(id),
  course_code TEXT NOT NULL REFERENCES courses(code),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('PENDING','ACTIVE','PAUSED','COMPLETED','WITHDRAWN')),
  enrolled_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, course_code)
);

-- Submission state machine:
-- DRAFT → SUBMITTED → UNDER_REVIEW → CHANGES_REQUESTED → RESUBMITTED → APPROVED (+EVIDENCE_CREATED)
CREATE TABLE IF NOT EXISTS submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  mission_id INTEGER NOT NULL REFERENCES missions(id),
  mission_version INTEGER NOT NULL DEFAULT 1, -- pinned content version at submit time
  revision INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'SUBMITTED' CHECK (status IN ('DRAFT','SUBMITTED','UNDER_REVIEW','CHANGES_REQUESTED','RESUBMITTED','APPROVED','EVIDENCE_CREATED','WITHDRAWN')),
  body TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  score INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sub_user ON submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_sub_status ON submissions(status);

CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  submission_id INTEGER NOT NULL REFERENCES submissions(id),
  reviewer_id INTEGER NOT NULL REFERENCES users(id),
  decision TEXT NOT NULL CHECK (decision IN ('APPROVE','REQUEST_CHANGES')),
  score INTEGER,
  feedback TEXT NOT NULL DEFAULT '',
  rubric_version TEXT NOT NULL DEFAULT 'rubric-v1',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS skills (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS student_skills (
  user_id INTEGER NOT NULL REFERENCES users(id),
  skill_code TEXT NOT NULL REFERENCES skills(code),
  level INTEGER NOT NULL DEFAULT 0 CHECK (level BETWEEN 0 AND 100),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, skill_code)
);

-- Evidence lifecycle: CANDIDATE → PENDING_REVIEW → VERIFIED / REJECTED (+REVOKED with reason)
-- Two origins: academy submissions, or external work students document themselves.
CREATE TABLE IF NOT EXISTS evidence (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  submission_id INTEGER REFERENCES submissions(id),
  skill_code TEXT NOT NULL REFERENCES skills(code),
  kind TEXT NOT NULL DEFAULT 'submission' CHECK (kind IN ('submission','external','video')),
  title TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL DEFAULT '',
  bytes INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'PENDING_REVIEW' CHECK (status IN ('CANDIDATE','PENDING_REVIEW','VERIFIED','REJECTED','REVOKED')),
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS certificates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'VALID' CHECK (status IN ('VALID','REVOKED','SUPERSEDED')),
  reason TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  kind TEXT NOT NULL,
  text TEXT NOT NULL,
  read_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id);

-- Automated grading runs: one per submission. INFRASTRUCTURE_ERROR is never
-- reported as student failure; status distinguishes the two explicitly.
CREATE TABLE IF NOT EXISTS grading_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  submission_id INTEGER NOT NULL UNIQUE REFERENCES submissions(id),
  status TEXT NOT NULL DEFAULT 'QUEUED' CHECK (status IN ('QUEUED','RUNNING','PASSED','FAILED','INFRASTRUCTURE_ERROR','TIMED_OUT')),
  score INTEGER,
  checks TEXT NOT NULL DEFAULT '[]',
  error TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Persistent student company (NOVA concept): one evolving business per student.
CREATE TABLE IF NOT EXISTS companies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  trade TEXT NOT NULL DEFAULT 'general',
  stage TEXT NOT NULL DEFAULT 'website',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_comp_user ON companies(user_id);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id INTEGER,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT NOT NULL DEFAULT '',
  before_state TEXT NOT NULL DEFAULT '',
  after_state TEXT NOT NULL DEFAULT '',
  request_id TEXT NOT NULL DEFAULT '',
  ip TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity, entity_id);

-- Studio intake: founder inquiries from the public site. Public POST, admin review.
CREATE TABLE IF NOT EXISTS studio_inquiries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  idea TEXT NOT NULL,
  stage TEXT NOT NULL DEFAULT 'idea' CHECK (stage IN ('idea','validated','mvp','revenue')),
  budget TEXT NOT NULL DEFAULT 'unknown',
  status TEXT NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW','REVIEWING','ACCEPTED','DECLINED')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Jobs board: admin posts, public reads, students apply.
CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'project' CHECK (kind IN ('internship','apprenticeship','project','role')),
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','CLOSED')),
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS job_applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id INTEGER NOT NULL REFERENCES jobs(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  note TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'APPLIED' CHECK (status IN ('APPLIED','SHORTLISTED','REJECTED','HIRED')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (job_id, user_id)
);

-- Client portal (R7 slice): company profile per client user, projects, updates, approvals.
CREATE TABLE IF NOT EXISTS clients (
  user_id INTEGER PRIMARY KEY REFERENCES users(id),
  company TEXT NOT NULL,
  contact TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'DISCOVERY' CHECK (status IN ('LEAD','DISCOVERY','BUILD','REVIEW','LIVE','OPERATING','COMPLETED')),
  health TEXT NOT NULL DEFAULT 'green' CHECK (health IN ('green','amber','red')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS project_updates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id),
  author_id INTEGER NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  needs_approval INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'POSTED' CHECK (status IN ('POSTED','APPROVED','CHANGES_REQUESTED')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Platform Core slice (R9): organizations + memberships. Source of truth for teams.
CREATE TABLE IF NOT EXISTS organizations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('PROPOSED','ACTIVE','SUSPENDED','CLOSED')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS memberships (
  org_id INTEGER NOT NULL REFERENCES organizations(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  role TEXT NOT NULL DEFAULT 'MEMBER' CHECK (role IN ('OWNER','ADMIN','MEMBER')),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('INVITED','ACTIVE','SUSPENDED','REMOVED')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (org_id, user_id)
);

-- Independent assurance: approval NEVER verifies. A second reviewer (≠ approver)
-- moves evidence PENDING_REVIEW → VERIFIED / REJECTED, or VERIFIED → REVOKED.
CREATE TABLE IF NOT EXISTS assurance_decisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  evidence_id INTEGER NOT NULL REFERENCES evidence(id),
  reviewer_id INTEGER NOT NULL REFERENCES users(id),
  decision TEXT NOT NULL CHECK (decision IN ('VERIFIED','REJECTED','REVOKED')),
  reason TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- AI gateway audit: every assisted call logged; no key = 503, never silent failure.
CREATE TABLE IF NOT EXISTS ai_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  agent TEXT NOT NULL,
  purpose TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'DENIED' CHECK (status IN ('COMPLETED','DENIED','ERROR')),
  detail TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
