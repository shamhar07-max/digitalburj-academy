import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionUser } from "@/server/auth.js";
import { all, row, run, transaction } from "@/server/db.js";
import { deny, audit, requestId, requireRole, notify } from "@/server/guard.js";

// Independent assurance: a SECOND reviewer (never the approver) verifies evidence.
// Separation of duties is enforced in code, not policy docs.
export async function GET() {
  const jar = await cookies();
  const user = getSessionUser(jar.get("db_academy")?.value);
  if (!requireRole(user, "teacher", "admin")) return deny("Staff only", 403);
  const queue = all(
    `SELECT e.*, m.title AS mission_title, u.name AS student_name FROM evidence e
     LEFT JOIN submissions sub ON sub.id=e.submission_id LEFT JOIN missions m ON m.id=sub.mission_id
     JOIN users u ON u.id=e.user_id
     WHERE e.status IN ('CANDIDATE','PENDING_REVIEW') ORDER BY e.id`);
  return NextResponse.json({ queue });
}

export async function POST(req: Request) {
  const rid = requestId();
  const jar = await cookies();
  const user = getSessionUser(jar.get("db_academy")?.value);
  if (!requireRole(user, "teacher", "admin")) return deny("Staff only", 403);
  const { evidence_id, decision, reason } = await req.json().catch(() => ({}));
  if (!["VERIFIED", "REJECTED", "REVOKED"].includes(decision)) {
    return NextResponse.json({ error: "decision must be VERIFIED, REJECTED or REVOKED" }, { status: 422 });
  }
  const ev = row<{ id: number; user_id: number; submission_id: number; skill_code: string; status: string }>(
    "SELECT * FROM evidence WHERE id=?", evidence_id);
  if (!ev) return NextResponse.json({ error: "Evidence not found" }, { status: 404 });
  if (decision === "VERIFIED" && !["CANDIDATE", "PENDING_REVIEW"].includes(ev.status)) {
    return NextResponse.json({ error: `Evidence is ${ev.status}` }, { status: 409 });
  }
  if (decision === "REJECTED" && !["CANDIDATE", "PENDING_REVIEW"].includes(ev.status)) {
    return NextResponse.json({ error: `Evidence is ${ev.status}` }, { status: 409 });
  }
  if (decision === "REVOKED" && ev.status !== "VERIFIED") {
    return NextResponse.json({ error: "Only VERIFIED evidence can be revoked" }, { status: 409 });
  }
  // The approver cannot verify their own approval.
  const approval = row<{ reviewer_id: number }>(
    "SELECT reviewer_id FROM reviews WHERE submission_id=? AND decision='APPROVE' ORDER BY id LIMIT 1", ev.submission_id);
  if ((decision === "VERIFIED" || decision === "REJECTED") && approval && approval.reviewer_id === user!.id) {
    return NextResponse.json({ error: "Separation of duties: the approver cannot assure their own approval" }, { status: 403 });
  }
  if (!reason || String(reason).trim().length < 10) {
    return NextResponse.json({ error: "A verification reason is required (10+ chars) — traceability is the point" }, { status: 422 });
  }
  // Atomic: status flip + decision record + (on verify) submission close + skill bump.
  transaction(() => {
    run("UPDATE evidence SET status=?, note=? WHERE id=?", decision, String(reason).slice(0, 1000), evidence_id);
    run("INSERT INTO assurance_decisions (evidence_id, reviewer_id, decision, reason) VALUES (?,?,?,?)",
      evidence_id, user!.id, decision, String(reason).slice(0, 1000));
    if (decision === "VERIFIED") {
      run("UPDATE submissions SET status='EVIDENCE_CREATED', updated_at=datetime('now') WHERE id=?", ev.submission_id);
      run("INSERT OR IGNORE INTO student_skills (user_id, skill_code, level) VALUES (?,?,0)", ev.user_id, ev.skill_code);
      const cur = row<{ level: number }>("SELECT level FROM student_skills WHERE user_id=? AND skill_code=?", ev.user_id, ev.skill_code);
      run("UPDATE student_skills SET level=MIN(100, COALESCE(?,0)+8), updated_at=datetime('now') WHERE user_id=? AND skill_code=?",
        cur?.level ?? 0, ev.user_id, ev.skill_code);
    }
  });
  audit(user!.id, "assure", "evidence", evidence_id, ev.status, decision, rid);
  notify(ev.user_id, "assurance", `Evidence #${evidence_id} ${decision.toLowerCase()} by independent review.`);
  return NextResponse.json({ ok: true });
}
