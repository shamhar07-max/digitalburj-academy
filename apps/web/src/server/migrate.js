// migrate: schema auto-applies on connect; idempotent ALTERs for existing DBs.
import "./db.js";
import { getDb } from "./db.js";

const db = getDb();
const cols = db.prepare("PRAGMA table_info(users)").all().map((c) => c.name);
if (!cols.includes("language")) {
  db.exec("ALTER TABLE users ADD COLUMN language TEXT NOT NULL DEFAULT 'en'");
  console.log("migrated: users.language");
}
// Content versioning: submissions pin the mission version they answered.
const subCols = db.prepare("PRAGMA table_info(submissions)").all().map((c) => c.name);
if (!subCols.includes("mission_version")) {
  db.exec("ALTER TABLE submissions ADD COLUMN mission_version INTEGER NOT NULL DEFAULT 1");
  console.log("migrated: submissions.mission_version");
}
// Client role (R7): rebuild users CHECK to admit 'client'. 12-step, FK-safe.
const userSql = db.prepare("SELECT sql FROM sqlite_master WHERE name='users'").get()?.sql || "";
if (!userSql.includes("'client'")) {
  db.exec("PRAGMA foreign_keys=OFF");
  db.exec("BEGIN");
  db.exec(`CREATE TABLE users_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('student','teacher','admin','client')),
    language TEXT NOT NULL DEFAULT 'en',
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('PENDING','ACTIVE','SUSPENDED','DEACTIVATED')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);
  db.exec("INSERT INTO users_new SELECT * FROM users");
  db.exec("DROP TABLE users");
  db.exec("ALTER TABLE users_new RENAME TO users");
  db.exec("COMMIT");
  db.exec("PRAGMA foreign_keys=ON");
  console.log("migrated: users.role admits client");
}
// Audit actor IP (nullable history stays valid).
const auditCols = db.prepare("PRAGMA table_info(audit_logs)").all().map((c) => c.name);
if (!auditCols.includes("ip")) {
  db.exec("ALTER TABLE audit_logs ADD COLUMN ip TEXT NOT NULL DEFAULT ''");
  console.log("migrated: audit_logs.ip");
}
// Submissions: WITHDRAWN state (rebuild CHECK, FK-safe).
const subSql = db.prepare("SELECT sql FROM sqlite_master WHERE name='submissions'").get()?.sql || "";
if (!subSql.includes("'WITHDRAWN'")) {
  db.exec("PRAGMA foreign_keys=OFF");
  db.exec("BEGIN");
  db.exec(`CREATE TABLE submissions_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    mission_id INTEGER NOT NULL REFERENCES missions(id),
    mission_version INTEGER NOT NULL DEFAULT 1,
    revision INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'SUBMITTED' CHECK (status IN ('DRAFT','SUBMITTED','UNDER_REVIEW','CHANGES_REQUESTED','RESUBMITTED','APPROVED','EVIDENCE_CREATED','WITHDRAWN')),
    body TEXT NOT NULL,
    idempotency_key TEXT NOT NULL UNIQUE,
    score INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);
  db.exec("INSERT INTO submissions_new SELECT * FROM submissions");
  db.exec("DROP TABLE submissions");
  db.exec("ALTER TABLE submissions_new RENAME TO submissions");
  db.exec("CREATE INDEX IF NOT EXISTS idx_sub_user ON submissions(user_id)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_sub_status ON submissions(status)");
  db.exec("COMMIT");
  db.exec("PRAGMA foreign_keys=ON");
  console.log("migrated: submissions.status admits WITHDRAWN");
}
// Machine-graded rows awaiting teachers move to the teacher stage explicitly.
const moved = db.prepare(`UPDATE submissions SET status='UNDER_REVIEW', updated_at=datetime('now')
  WHERE status='SUBMITTED' AND EXISTS (SELECT 1 FROM grading_runs g WHERE g.submission_id=submissions.id AND g.status IN ('PASSED','FAILED'))`).run();
if (Number(moved.changes) > 0) console.log(`migrated: ${moved.changes} submissions → UNDER_REVIEW`);
// Courses: BLUEPRINT honesty (blueprint catalog rows must not claim PUBLISHED).
const courseSql = db.prepare("SELECT sql FROM sqlite_master WHERE name='courses'").get()?.sql || "";
if (!courseSql.includes("'BLUEPRINT'")) {
  db.exec("PRAGMA foreign_keys=OFF");
  db.exec("BEGIN");
  db.exec(`CREATE TABLE courses_new (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    level TEXT NOT NULL,
    outcome TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'PUBLISHED' CHECK (status IN ('DRAFT','BLUEPRINT','PUBLISHED','ARCHIVED'))
  )`);
  db.exec("INSERT INTO courses_new SELECT * FROM courses");
  db.exec("DROP TABLE courses");
  db.exec("ALTER TABLE courses_new RENAME TO courses");
  db.exec("COMMIT");
  db.exec("PRAGMA foreign_keys=ON");
  console.log("migrated: courses.status admits BLUEPRINT");
}
// Evidence: external-work origin (nullable submission + title/kind/url).
const evSql = db.prepare("SELECT sql FROM sqlite_master WHERE name='evidence'").get()?.sql || "";
if (!evSql.includes("submission_id INTEGER REFERENCES")) {
  db.exec("PRAGMA foreign_keys=OFF");
  db.exec("BEGIN");
  db.exec(`CREATE TABLE evidence_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    submission_id INTEGER REFERENCES submissions(id),
    skill_code TEXT NOT NULL REFERENCES skills(code),
    kind TEXT NOT NULL DEFAULT 'submission' CHECK (kind IN ('submission','external')),
    title TEXT NOT NULL DEFAULT '',
    url TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'PENDING_REVIEW' CHECK (status IN ('CANDIDATE','PENDING_REVIEW','VERIFIED','REJECTED','REVOKED')),
    note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);
  db.exec("INSERT INTO evidence_new (id, user_id, submission_id, skill_code, status, note, created_at) SELECT id, user_id, submission_id, skill_code, status, note, created_at FROM evidence");
  db.exec("DROP TABLE evidence");
  db.exec("ALTER TABLE evidence_new RENAME TO evidence");
  db.exec("COMMIT");
  db.exec("PRAGMA foreign_keys=ON");
  console.log("migrated: evidence external-work origin");
}
// Evidence: video origin (kind=video + bytes). Rebuild guarded by CHECK content.
const evSql2 = db.prepare("SELECT sql FROM sqlite_master WHERE name='evidence'").get()?.sql || "";
if (!evSql2.includes("'video'")) {
  db.exec("PRAGMA foreign_keys=OFF");
  db.exec("BEGIN");
  db.exec(`CREATE TABLE evidence_new (
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
  )`);
  db.exec("INSERT INTO evidence_new (id, user_id, submission_id, skill_code, kind, title, url, status, note, created_at) SELECT id, user_id, submission_id, skill_code, kind, title, url, status, note, created_at FROM evidence");
  db.exec("DROP TABLE evidence");
  db.exec("ALTER TABLE evidence_new RENAME TO evidence");
  db.exec("COMMIT");
  db.exec("PRAGMA foreign_keys=ON");
  console.log("migrated: evidence kind=video");
}
// Blueprint honesty backfill: only the four authored courses stay PUBLISHED.
const bp = db.prepare(`UPDATE courses SET status='BLUEPRINT' WHERE status='PUBLISHED'
  AND code NOT IN ('DB-00','DB-01','DB-03','DB-12')`).run();
if (Number(bp.changes) > 0) console.log(`migrated: ${bp.changes} courses → BLUEPRINT`);

// GATE 2 — org-scoped projects (nullable org_id; membership enforced in API layer).
const projCols = db.prepare("PRAGMA table_info(projects)").all().map((c) => c.name);
if (!projCols.includes("org_id")) {
  db.exec("ALTER TABLE projects ADD COLUMN org_id INTEGER REFERENCES organizations(id)");
  console.log("migrated: projects.org_id");
}

// GATE 2 — project tasks (scoped, assignable work items).
db.exec(`CREATE TABLE IF NOT EXISTS project_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id),
  title TEXT NOT NULL,
  assignee_id INTEGER REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'TODO' CHECK (status IN ('TODO','IN_PROGRESS','BLOCKED','DONE')),
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`);
db.exec("CREATE INDEX IF NOT EXISTS idx_tasks_project ON project_tasks(project_id)");

// GATE 2 — change requests (scoped project edits awaiting client approval).
db.exec(`CREATE TABLE IF NOT EXISTS change_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id),
  created_by INTEGER NOT NULL REFERENCES users(id),
  field TEXT NOT NULL CHECK (field IN ('title','status','health') OR field LIKE 'custom:%'),
  current_value TEXT NOT NULL DEFAULT '',
  proposed_value TEXT NOT NULL DEFAULT '',
  reason TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'PREVIEW_SUBMITTED' CHECK (status IN ('PREVIEW','PREVIEW_SUBMITTED','APPROVED','REJECTED')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`);
db.exec("CREATE INDEX IF NOT EXISTS idx_cr_project ON change_requests(project_id)");

// GATE 2 — feature flags (platform + role-scoped toggles).
db.exec(`CREATE TABLE IF NOT EXISTS feature_flags (
  key TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 0,
  scope TEXT NOT NULL DEFAULT 'platform' CHECK (scope IN ('platform','role','org','user')),
  target TEXT NOT NULL DEFAULT '',
  default_state INTEGER NOT NULL DEFAULT 0,
  reason TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`);
db.exec("CREATE INDEX IF NOT EXISTS idx_flags_scope ON feature_flags(scope, target)");

// GATE 2 — AI cost/token tracking columns.
const aiCols = db.prepare("PRAGMA table_info(ai_requests)").all().map((c) => c.name);
if (!aiCols.includes("tokens_in")) {
  db.exec("ALTER TABLE ai_requests ADD COLUMN tokens_in INTEGER NOT NULL DEFAULT 0");
  db.exec("ALTER TABLE ai_requests ADD COLUMN tokens_out INTEGER NOT NULL DEFAULT 0");
  db.exec("ALTER TABLE ai_requests ADD COLUMN cost_cents INTEGER NOT NULL DEFAULT 0");
  console.log("migrated: ai_requests token/cost tracking");
}

console.log("migrate ok");
