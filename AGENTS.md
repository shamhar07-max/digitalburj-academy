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
8. **Answer keys never leave the server.** Option correctness/consequences/explanations
   are evaluated in API routes; pages pass `{id, text}` only. Any new practice UI needs
   a leak test (page HTML + API JSON must not contain correctness data).
9. **Approval ≠ verification.** Evidence goes PENDING_REVIEW on approve; only
   `/api/assurance` by a DIFFERENT reviewer verifies (enforced 403, tested).
10. **Submissions are immutable rows.** New revision = new row, revision = max+1;
    one open submission per student+mission (409); withdrawal is a state, never a delete.
11. **Demo seed is gated.** `ALLOW_DEMO_SEED=1` for local/tests only; production DBs must
    never contain demo accounts. Tests set the flag in the seed spawn env.
12. **500s never leak internals.** Use `fail(rid, e)` — known statuses pass, everything
    else logs server-side with request id and returns a generic message.
13. **Migrations are 12-step + backfill.** CHECK changes need table rebuilds (FK off/on);
    always backfill legacy rows (e.g. SUBMITTED→UNDER_REVIEW) and keep fresh-install
    `schema.sql` identical in effect to migrated DBs.
14. **Single origin.** Academy serves under `basePath: "/platform"` behind the site rewrite.
    Client fetches use `/platform/api/*`; tests assert the proxied paths.
15. **DB rows are normalized in `db.js`.** node:sqlite returns null-prototype objects that
    crash Client Components — `row()`/`all()` spread to plain objects at the boundary.
    Never pass raw driver rows to client components from anywhere else.
16. **Video evidence is gated content.** Magic-byte sniff (never MIME), size cap
    (`MAX_VIDEO_BYTES`), per-user quota, storage outside public dirs keyed per-database,
    playback only through the authed route (owner/staff). Tests assert 422/413/401/403.

## Commands
- `ALLOW_DEMO_SEED=1 npm run db:migrate && ALLOW_DEMO_SEED=1 npm run db:seed` — local DB + demo data
- `npm run dev` — academy web (use PORT env; default script has no -p flag)
- `npm test` — integration suite (spawns own server + temp DB)
- `npm run curriculum:validate` — curriculum schema/ref/prereq audit
- Demo logins (local/test only): `student@` / `teacher@` / `admin@digitalburj.com` / `demo1234`
