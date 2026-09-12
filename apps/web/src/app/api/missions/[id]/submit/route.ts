import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionUser } from "@/server/auth.js";
import { row, run } from "@/server/db.js";
import { deny, audit, notify, requestId } from "@/server/guard.js";
import { enqueueGrading } from "@/server/grader.js";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  const rid = requestId();
  const jar = await cookies();
  const user = getSessionUser(jar.get("db_academy")?.value);
  if (!user) return deny("Login required", 401);
  const { id } = await params;
  const mission = row<{ id: number }>("SELECT id FROM missions WHERE id=? AND status='PUBLISHED'", id);
  if (!mission) return NextResponse.json({ error: "Mission not found" }, { status: 404 });
  const key = req.headers.get("Idempotency-Key") || req.headers.get("idempotency-key");
  if (!key) return NextResponse.json({ error: "Idempotency-Key header required" }, { status: 428 });
  const { body } = await req.json().catch(() => ({ body: "" }));
  if (!body || String(body).trim().length < 20) {
    return NextResponse.json({ error: "Submission needs at least a paragraph of reasoning (20+ chars)" }, { status: 422 });
  }
  const dup = row<{ id: number; status: string }>("SELECT id, status FROM submissions WHERE idempotency_key=?", key);
  if (dup) return NextResponse.json({ submission: dup, duplicate: true });
  const r = run(
    "INSERT INTO submissions (user_id, mission_id, body, idempotency_key, status) VALUES (?,?,?,?, 'SUBMITTED')",
    user.id, mission.id, String(body), key
  );
  const sub = row("SELECT * FROM submissions WHERE id=?", r.lastInsertRowid);
  audit(user.id, "submit", "submission", r.lastInsertRowid, "", "SUBMITTED", rid);
  notify(user.id, "submission", `Submission #${r.lastInsertRowid} received — automated checks running, then teacher review.`);
  enqueueGrading(Number(r.lastInsertRowid));
  return NextResponse.json({ submission: sub }, { status: 201 });
}

