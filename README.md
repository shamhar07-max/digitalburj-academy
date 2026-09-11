# Digital Burj Academy — vertical slice v0.1.0

Learning + building + assessment platform. First slice: auth (RBAC) → missions
(Decision/Build/Break labs) → idempotent submissions → teacher review →
evidence wallet → capability record. All green: `npm test` (3/3).

## Run it

```bash
npm --prefix apps/web install   # once
npm run db:migrate && npm run db:seed
npm run dev                     # :3100, or npm start after npm run build
npm test                        # integration suite (temp DB, real server)
```

Demo logins (password `demo1234`): `student@` / `teacher@` / `admin@digitalburj.com`.

## Layout

```
digitalburj-academy/
  apps/web/
    src/app/            # pages (dashboard, missions, evidence, teacher, admin)
    src/app/api/        # route handlers (auth, missions, submissions, reviews, evidence)
    src/server/         # db.js (node:sqlite), auth.js (scrypt), guard.js (RBAC/audit), schema.sql, seed.js
    src/components/     # AuthForm, MissionWidgets (DecisionLab, SubmitBox), ReviewActions
  tests/journey.test.mjs
  docs/
```

## Non-negotiables enforced

- RBAC server-side on every route; answer keys stripped for students (tested).
- Idempotent submissions (`Idempotency-Key`); double-click safe (tested).
- No silent overwrites: review conflicts return 409.
- Audit log on register/login/submit/review/approve.
- Academic records soft-state only; evidence created once per submission.
- SQLite dev now; schema is Postgres-compatible — swap driver + `DATABASE_URL` later.
