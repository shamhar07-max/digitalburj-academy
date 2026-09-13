import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionUser } from "@/server/auth.js";
import { row, run } from "@/server/db.js";
import { deny, audit, requestId, requireRole } from "@/server/guard.js";

type Ctx = { params: Promise<{ id: string }> };

// One application per student per job. Replay returns existing (409, not silent overwrite).
export async function POST(req: Request, { params }: Ctx) {
  const rid = requestId();
  const jar = await cookies();
  const user = getSessionUser(jar.get("db_academy")?.value);
  if (!requireRole(user, "student")) return deny("Students only", 403);
  const { id } = await params;
  const job = row<{ status: string }>("SELECT status FROM jobs WHERE id=?", id);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  if (job.status !== "OPEN") return NextResponse.json({ error: "Job is closed" }, { status: 410 });
  const { note } = await req.json().catch(() => ({}));
  const dup = row<{ id: number }>("SELECT id FROM job_applications WHERE job_id=? AND user_id=?", id, user!.id);
  if (dup) return NextResponse.json({ error: "Already applied", application_id: dup.id }, { status: 409 });
  const r = run("INSERT INTO job_applications (job_id, user_id, note) VALUES (?,?,?)",
    id, user!.id, String(note || "").slice(0, 2000));
  audit(user!.id, "job_apply", "job_application", r.lastInsertRowid, "", "APPLIED", rid);
  return NextResponse.json({ id: r.lastInsertRowid }, { status: 201 });
}
