# Academy architecture (slice v0.1 → production path)

## Engines (present)
Learning (missions/courses) · Assessment (submissions/reviews) · Evidence (verified records) · Capability (skills + record). Build engine = submission flow; sandbox execution, incident rooms and AI tutor attach later without touching these contracts.

## Request flow
Browser → Route Handler → `guard.js` (session + RBAC) → `db.js` (transaction where needed) → `audit()` → JSON. No trust in client role, URL ids, or posted progress.

## Data
`schema.sql` is the source of truth (SQLite dev). Tables: users, sessions, courses, missions, enrollments, submissions (idempotency_key UNIQUE), reviews, skills, student_skills, evidence, certificates (VALID/REVOKED/SUPERSEDED), notifications, audit_logs. Production: Postgres + RLS mirroring the same ownership rules already enforced in code.

## Background work (next)
Grading queue: `job_queue/job_runs` + worker pool + timeouts + dead-letter; notification fan-out; analytics rollups. API stays thin; workers own duration.

## Phases
1. Foundation ✅ (auth, dashboards, RBAC, courses, enrollment, progress, notifications)
2. Learning engine ✅ (Decision/Break labs, missions, rubrics-lite, feedback)
3. Builder (GitHub-linked projects, sandbox tests, automated grading)
4. Capability (portfolio, certificates verify URL, talent export)
5. Advanced (Incident Room, AI Judgment Lab, client sim, copilot with graded-work refusal)
6. Network (DB-22 challenge, Talent/Jobs integration)

## 10/10 gates for each phase
Authz tests (IDOR, escalation) · idempotency tests · concurrency (409, not silent overwrite) · audit coverage · tested restore · E2E journey test (this repo: `tests/journey.test.mjs`) · WCAG 2.2 AA UI pass · mobile pass.
