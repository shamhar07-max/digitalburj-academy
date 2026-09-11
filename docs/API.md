# Academy API v0.1

Base: same origin. Session cookie `db_academy` (httpOnly). Errors: `{ error }`.

| Method & path | Auth | Body / notes |
|---|---|---|
| POST `/api/auth/register` | — | `{email,name,password(8+)}` → 409 on duplicate |
| POST `/api/auth/login` | — | `{email,password}` → 401 on bad credentials |
| POST `/api/auth/session` | — | logout (clears cookie) |
| GET `/api/auth/session` | — | `{user}` or 401 |
| GET `/api/missions` | — | public list |
| GET `/api/missions/:id` | — | single mission; staff-only `answer` stripped for students |
| POST `/api/missions/:id/submit` | student | header `Idempotency-Key` required (428); body 20+ chars (422); replay returns `{duplicate:true}` |
| PUT `/api/missions/:id` | student | own submissions list (misused verb kept for compat; prefer GET `/api/evidence`) |
| GET `/api/reviews` | teacher,admin | review queue, else 403 |
| POST `/api/reviews` | teacher,admin | `{submission_id, decision: APPROVE\|REQUEST_CHANGES, score?, feedback?}`; APPROVE creates evidence + skill bump once; stale state → 409 |
| GET `/api/evidence` | student | own evidence + skills + notifications |

State machines: submissions `SUBMITTED → UNDER_REVIEW → CHANGES_REQUESTED → RESUBMITTED → APPROVED → EVIDENCE_CREATED`; evidence `PENDING_REVIEW → VERIFIED`.
