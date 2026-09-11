import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionUser } from "@/server/auth.js";
import { row, all, run } from "@/server/db.js";
import { deny, requireRole, audit, notify, requestId } from "@/server/guard.js";

// Teacher/admin review queue
export async function GET() {
  const jar = await cookies();
  const user = getSessionUser(jar.get("db_academy")?.value);
  if (!requireRole(user, "teacher", "admin")) return deny();
  const queue = all(
    `SELECT s.*, m.title AS mission_title, u.name AS student_name, u.email AS student_email
     FROM submissions s JOIN missions m ON m.id=s.mission_id JOIN users u ON u.id=s.user_id
     WHERE s.status IN ('SUBMITTED','RESUBMITTED') ORDER BY s.id`
  );
  return NextResponse.json({ queue });
}

// Review a submission: APPROVE (creates evidence + skill bump) or REQUEST_CHANGES.
export async function POST(req: Request) {
  const rid = requestId();
  const jar = await cookies();
  const user = getSessionUser(jar.get("db_academy")?.value);
  if (!requireRole(user, "teacher", "admin")) return deny();
  const { submission_id, decision, score, feedback } = await req.json();
  const sub = row<{ id: number; user_id: number; mission_id: number; status: string }>(
    "SELECT * FROM submissions WHERE id=?", submission_id);
  if (!sub) return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  if (!["SUBMITTED", "RESUBMITTED"].includes(sub.status)) {
    return NextResponse.json({ error: `Already ${sub.status} — refresh before continuing` }, { status: 409 });
  }
  if (!["APPROVE", "REQUEST_CHANGES"].includes(decision)) {
    return NextResponse.json({ error: "Decision must be APPROVE or REQUEST_CHANGES" }, { status: 422 });
  }
  const before = sub.status;
  if (decision === "APPROVE") {
    run("UPDATE submissions SET status='APPROVED', score=?, updated_at=datetime('now') WHERE id=? AND status IN ('SUBMITTED','RESUBMITTED')",
      score ?? null, sub.id);
    const chk = row<{ status: string }>("SELECT status FROM submissions WHERE id=?", sub.id);
    if (chk?.status !== "APPROVED") return NextResponse.json({ error: "State changed concurrently — refresh" }, { status: 409 });
    run("INSERT INTO reviews (submission_id, reviewer_id, decision, score, feedback) VALUES (?,?,?,?,?)",
      sub.id, user.id, decision, score ?? null, feedback ?? "");
    // Evidence: one verified record per approved submission (idempotent by submission).
    const ev = row<{ id: number }>("SELECT id FROM evidence WHERE submission_id=?", sub.id);
    let evidenceId = ev?.id;
    if (!evidenceId) {
      const mission = row<{ course_code: string }>("SELECT course_code FROM missions WHERE id=?", sub.mission_id);
      const skillMap: Record<string, string> = { "DB-00": "product", "DB-01": "product", "DB-03": "backend", "DB-12": "ai" };
      const skill = skillMap[mission?.course_code ?? ""] ?? "product";
      const r = run("INSERT INTO evidence (user_id, submission_id, skill_code, status, note) VALUES (?,?,?,'VERIFIED',?)",
        sub.user_id, sub.id, skill, `Approved by ${user.name} (rubric-v1)`);
      evidenceId = r.lastInsertRowid;
      run("UPDATE submissions SET status='EVIDENCE_CREATED', updated_at=datetime('now') WHERE id=?", sub.id);
      run("INSERT OR IGNORE INTO student_skills (user_id, skill_code, level) VALUES (?,?,0)", sub.user_id, skill);
      const cur = row<{ level: number }>("SELECT level FROM student_skills WHERE user_id=? AND skill_code=?", sub.user_id, skill);
      run("UPDATE student_skills SET level=MIN(100, COALESCE(?,0)+8), updated_at=datetime('now') WHERE user_id=? AND skill_code=?",
        cur?.level ?? 0, sub.user_id, skill);
    }
    audit(user.id, "approve", "submission", sub.id, before, "EVIDENCE_CREATED", rid);
    notify(sub.user_id, "review", `Submission #${sub.id} approved — evidence #${evidenceId} created.`);
    return NextResponse.json({ ok: true, evidence_id: evidenceId });
  }
  run("UPDATE submissions SET status='CHANGES_REQUESTED', updated_at=datetime('now') WHERE id=? AND status IN ('SUBMITTED','RESUBMITTED')", sub.id);
  run("INSERT INTO reviews (submission_id, reviewer_id, decision, score, feedback) VALUES (?,?,?,?,?)",
    sub.id, user.id, decision, score ?? null, feedback ?? "");
  audit(user.id, "request_changes", "submission", sub.id, before, "CHANGES_REQUESTED", rid);
  notify(sub.user_id, "review", `Submission #${sub.id}: changes requested — check feedback and resubmit.`);
  return NextResponse.json({ ok: true });
}
