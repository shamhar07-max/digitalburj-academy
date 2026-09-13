import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionUser } from "@/server/auth.js";
import { row, run } from "@/server/db.js";
import { deny, audit, notify, requestId, limited } from "@/server/guard.js";
import { enqueueGrading } from "@/server/grader.js";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  const rid = requestId();
  const jar = await cookies();
  const user = getSessionUser(jar.get("db_academy")?.value);
  if (!user) return deny("Login required", 401);
  if (limited(req, "submit", 30)) return NextResponse.json({ error: "Too many attempts, try again shortly" }, { status: 429 });
  const { id } = await params;
  const mission = row<{ id: number; version: number; course_code: string }>("SELECT id, version, course_code FROM missions WHERE id=? AND status='PUBLISHED'", id);
  if (!mission) return NextResponse.json({ error: "Mission not found" }, { status: 404 });
  const key = req.headers.get("Idempotency-Key") || req.headers.get("idempotency-key");
  if (!key) return NextResponse.json({ error: "Idempotency-Key header required" }, { status: 428 });
  const { body } = await req.json().catch(() => ({ body: "" }));
  if (!body || String(body).trim().length < 20) {
    return NextResponse.json({ error: "Submission needs at least a paragraph of reasoning (20+ chars)" }, { status: 422 });
  }
  const dup = row<{ id: number; status: string }>("SELECT id, status FROM submissions WHERE idempotency_key=?", key);
  if (dup) return NextResponse.json({ submission: dup, duplicate: true });
  // State-machine guard: one open submission per student per mission. History is
  // immutable rows — resubmission creates a new revision, never an overwrite.
  const open = row<{ id: number; status: string }>(
    "SELECT id, status FROM submissions WHERE user_id=? AND mission_id=? AND status IN ('SUBMITTED','UNDER_REVIEW','RESUBMITTED') ORDER BY id DESC",
    user.id, mission.id);
  if (open) return NextResponse.json({ error: `Submission #${open.id} is already ${open.status} — withdraw it or wait for review`, submission_id: open.id }, { status: 409 });
  const prev = row<{ n: number }>("SELECT COUNT(*) AS n FROM submissions WHERE user_id=? AND mission_id=?", user.id, mission.id);
  const revision = (prev?.n ?? 0) + 1;
  // Submitting enrolls (nobody submits into a vacuum).
  run("INSERT OR IGNORE INTO enrollments (user_id, course_code) VALUES (?,?)", user.id, mission.course_code);
  const r = run(
    "INSERT INTO submissions (user_id, mission_id, mission_version, revision, body, idempotency_key, status) VALUES (?,?,?,?,?,?, 'SUBMITTED')",
    user.id, mission.id, mission.version, revision, String(body), key
  );
  const sub = row("SELECT * FROM submissions WHERE id=?", r.lastInsertRowid);
  audit(user.id, "submit", "submission", r.lastInsertRowid, "", "SUBMITTED", rid);
  notify(user.id, "submission", `Submission #${r.lastInsertRowid} received — automated checks running, then teacher review.`);
  enqueueGrading(Number(r.lastInsertRowid));
  return NextResponse.json({ submission: sub }, { status: 201 });
}

