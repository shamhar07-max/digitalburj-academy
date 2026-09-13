import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionUser } from "@/server/auth.js";
import { all, row, run } from "@/server/db.js";
import { deny, audit, requestId, requireRole, fail } from "@/server/guard.js";
import { maxVideoBytes, userQuotaBytes, sniffVideo, userVideoBytes, saveVideo } from "@/server/files.js";

export async function GET() {
  const jar = await cookies();
  const user = getSessionUser(jar.get("db_academy")?.value);
  if (!user) return deny("Login required", 401);
  const evidence = all(
    `SELECT e.*, m.title AS mission_title, s.name AS skill_name FROM evidence e
     JOIN submissions sub ON sub.id=e.submission_id JOIN missions m ON m.id=sub.mission_id
     JOIN skills s ON s.code=e.skill_code WHERE e.user_id=? ORDER BY e.id DESC`, user.id);
  const skills = all("SELECT sk.code, sk.name, ss.level FROM skills sk LEFT JOIN student_skills ss ON ss.skill_code=sk.code AND ss.user_id=?", user.id);
  const notes = all("SELECT * FROM notifications WHERE user_id=? ORDER BY id DESC LIMIT 10", user.id);
  return NextResponse.json({ evidence, skills, notifications: notes });
}

// Claim: a student attaches approved work as CANDIDATE evidence for a skill.
// Create: a student documents EXTERNAL work (project, repo, demo) as CANDIDATE.
// Both never self-verify — assurance reviews every one.
export async function POST(req: Request) {
  const rid = requestId();
  const jar = await cookies();
  const user = getSessionUser(jar.get("db_academy")?.value);
  if (!requireRole(user, "student")) return deny("Students only", 403);
  // Path 0 — recorded video upload (multipart). 60s cap enforced recorder-side;
  // server enforces container magic + size + quota. Never trusts client MIME.
  const ctype = req.headers.get("content-type") || "";
  if (ctype.includes("multipart/form-data")) {
    try {
      const form = await req.formData();
      const fSkill = String(form.get("skill_code") || "");
      const fTitle = String(form.get("title") || "").trim().slice(0, 160);
      const fNote = String(form.get("note") || "").trim();
      const file = form.get("video");
      const sk = row("SELECT code FROM skills WHERE code=?", fSkill);
      if (!sk) return NextResponse.json({ error: "Unknown skill" }, { status: 422 });
      if (fTitle.length < 5) return NextResponse.json({ error: "Title the video (5+ chars)" }, { status: 422 });
      if (fNote.length < 10) return NextResponse.json({ error: "Say what it demonstrates (10+ chars)" }, { status: 422 });
      if (!file || typeof file === "string") return NextResponse.json({ error: "No video attached" }, { status: 422 });
      const buf = Buffer.from(await (file as Blob).arrayBuffer());
      if (buf.length > maxVideoBytes()) {
        return NextResponse.json({ error: `Video too large (${Math.round(buf.length / 1048576)}MB, max ${Math.round(maxVideoBytes() / 1048576)}MB)` }, { status: 413 });
      }
      const sniffed = sniffVideo(buf);
      if (!sniffed) return NextResponse.json({ error: "Not a real video file (webm/mp4 only, checked by content)" }, { status: 422 });
      if (userVideoBytes(user!.id) + buf.length > userQuotaBytes()) {
        return NextResponse.json({ error: "Personal video quota reached (100MB)" }, { status: 413 });
      }
      const r = run("INSERT INTO evidence (user_id, submission_id, skill_code, kind, title, url, bytes, status, note) VALUES (?,NULL,?,'video',?,'',?, 'CANDIDATE',?)",
        user!.id, fSkill, fTitle, buf.length, fNote.slice(0, 1000));
      try {
        saveVideo(r.lastInsertRowid, buf);
      } catch (e: unknown) {
        run("DELETE FROM evidence WHERE id=?", r.lastInsertRowid);
        throw e;
      }
      audit(user!.id, "evidence_video", "evidence", r.lastInsertRowid, "", "CANDIDATE", rid);
      return NextResponse.json({ id: r.lastInsertRowid }, { status: 201 });
    } catch (e: unknown) {
      return fail(rid, e, "video upload");
    }
  }
  const { submission_id, skill_code, note, title, url } = await req.json().catch(() => ({}));
  const skill = row<{ code: string }>("SELECT code FROM skills WHERE code=?", skill_code);
  if (!skill) return NextResponse.json({ error: "Unknown skill" }, { status: 422 });
  // Path 1 — claim on own approved submission.
  if (submission_id) {    const sub = row<{ id: number; user_id: number; status: string }>(
      "SELECT id, user_id, status FROM submissions WHERE id=?", submission_id);
    if (!sub || sub.user_id !== user!.id) return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    if (!["APPROVED", "EVIDENCE_CREATED"].includes(sub.status)) {
      return NextResponse.json({ error: `Only approved work can back evidence (this is ${sub.status})` }, { status: 409 });
    }
    const dup = row<{ id: number }>("SELECT id FROM evidence WHERE submission_id=? AND skill_code=?", submission_id, skill_code);
    if (dup) return NextResponse.json({ error: "Already claimed", evidence_id: dup.id }, { status: 409 });
    const r = run("INSERT INTO evidence (user_id, submission_id, skill_code, status, note) VALUES (?,?,?,'CANDIDATE',?)",
      user!.id, submission_id, skill_code, String(note || "").slice(0, 1000));
    audit(user!.id, "evidence_claim", "evidence", r.lastInsertRowid, "", "CANDIDATE", rid);
    return NextResponse.json({ id: r.lastInsertRowid }, { status: 201 });
  }
  // Path 2 — external work documented by the student. Requires something checkable.
  const cleanTitle = String(title || "").trim().slice(0, 160);
  const cleanUrl = String(url || "").trim().slice(0, 500);
  const cleanNote = String(note || "").trim();
  if (cleanTitle.length < 5) return NextResponse.json({ error: "Title the work (5+ chars)" }, { status: 422 });
  if (!/^https?:\/\/\S+\.\S+/.test(cleanUrl)) return NextResponse.json({ error: "A checkable http(s) link is required — reviewers verify, not trust" }, { status: 422 });
  if (cleanNote.length < 30) return NextResponse.json({ error: "Explain what it proves and your role in it (30+ chars)" }, { status: 422 });
  const dup = row<{ id: number }>("SELECT id FROM evidence WHERE user_id=? AND url=? AND skill_code=? AND status NOT IN ('REJECTED','REVOKED')",
    user!.id, cleanUrl, skill_code);
  if (dup) return NextResponse.json({ error: "Already documented", evidence_id: dup.id }, { status: 409 });
  const r = run("INSERT INTO evidence (user_id, submission_id, skill_code, kind, title, url, status, note) VALUES (?,NULL,?,'external',?,?,'CANDIDATE',?)",
    user!.id, skill_code, cleanTitle, cleanUrl, cleanNote.slice(0, 1000));
  audit(user!.id, "evidence_create", "evidence", r.lastInsertRowid, "", "CANDIDATE", rid);
  return NextResponse.json({ id: r.lastInsertRowid }, { status: 201 });
}
