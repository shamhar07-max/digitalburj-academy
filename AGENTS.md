# AGENTS.md — digitalburj-academy

## What this repo is
Digital Burj Academy: a learning + building + assessment platform. Student loop:
BRIEF → LEARN → INVESTIGATE → TRY → BUILD → BREAK → FIX → TEST → EXPLAIN →
DEFEND → SHIP → EVIDENCE. Output is verified capability, not certificates.

## Architecture (do not reinvent)
- `apps/web` — Next.js 16 App Router + Tailwind. Pages in `src/app/`.
- `apps/web/src/server/*.js` — plain-JS framework-agnostic layer (runs in Next
  AND in plain node scripts): `db.js` (node:sqlite, schema auto-applies),
  `auth.js` (scrypt, opaque sessions), `guard.js` (RBAC/audit).
- `apps/web/src/server/*.d.ts` — TypeScript declarations for the JS layer.
  If you change a `.js` signature, update the `.d.ts` or the build breaks.
- `apps/web/src/content/academy/*.ts` — curriculum as structured data (NOT hardcoded JSX).
  UI renders content; never duplicate curriculum rules into components.
- `tests/journey.test.mjs` — integration suite (temp DB + real server).
  Run `npm test` from repo root after any API/DB change.

## Iron rules
1. **RBAC server-side, always.** Frontend role is presentation only. New route?
   Add the role check + a negative test (403) in `tests/journey.test.mjs`.
2. **Answer keys never reach student browsers.** Staff-only fields must be
   stripped in both page components AND API responses.
3. **Idempotency on mutations** that students can double-trigger (submit,
   enroll). UNIQUE key + replay returns existing. Test the replay.
4. **No silent overwrites.** Concurrent state changes → 409 with refresh message.
5. **Audit everything sensitive** via `audit()` in guard.js.
6. **Course content lives in `apps/web/src/content/academy/`** following
   `.opencode/skills/digital-burj-course-author/SKILL.md`. Validate with
   `npm run curriculum:validate` before marking content complete.
7. **Never claim completion without running**: `npm run curriculum:validate`,
   `npm --prefix apps/web run build`, `npm test`.

## Commands
- `npm run db:migrate && npm run db:seed` — local DB + demo data
- `npm run dev` — academy web (use PORT env; default script has no -p flag)
- `npm test` — integration suite (spawns own server + temp DB)
- `npm run curriculum:validate` — curriculum schema/ref/prereq audit
- Demo logins: `student@` / `teacher@` / `admin@digitalburj.com` / `demo1234`
