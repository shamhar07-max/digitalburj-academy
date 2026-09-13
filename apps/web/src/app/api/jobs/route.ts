import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionUser } from "@/server/auth.js";
import { all, run, row } from "@/server/db.js";
import { deny, audit, requestId, requireRole } from "@/server/guard.js";

// Jobs board: public OPEN list; admin posts; students apply once (409 replay).
export async function GET() {
  const jobs = all("SELECT j.id, j.title, j.kind, j.description, j.created_at, u.name AS posted_by FROM jobs j LEFT JOIN users u ON u.id=j.created_by WHERE j.status='OPEN' ORDER BY j.id DESC");
  return NextResponse.json({ jobs });
}

export async function POST(req: Request) {
  const rid = requestId();
  const jar = await cookies();
  const user = getSessionUser(jar.get("db_academy")?.value);
  if (!requireRole(user, "admin")) return deny("Admin only", 403);
  const { title, kind, description } = await req.json().catch(() => ({}));
  if (!title) return NextResponse.json({ error: "Title required" }, { status: 422 });
  if (kind && !["internship", "apprenticeship", "project", "role"].includes(kind)) return NextResponse.json({ error: "Bad kind" }, { status: 422 });
  const r = run("INSERT INTO jobs (title, kind, description, created_by) VALUES (?,?,?,?)",
    String(title).slice(0, 160), kind || "project", String(description || "").slice(0, 4000), user!.id);
  audit(user!.id, "job_post", "job", r.lastInsertRowid, "", "OPEN", rid);
  return NextResponse.json({ id: r.lastInsertRowid }, { status: 201 });
}

export async function PATCH(req: Request) {
  const rid = requestId();
  const jar = await cookies();
  const user = getSessionUser(jar.get("db_academy")?.value);
  if (!requireRole(user, "admin")) return deny("Admin only", 403);
  const { id, status } = await req.json().catch(() => ({}));
  if (!["OPEN", "CLOSED"].includes(status)) return NextResponse.json({ error: "Bad status" }, { status: 422 });
  const cur = row<{ status: string }>("SELECT status FROM jobs WHERE id=?", id);
  if (!cur) return NextResponse.json({ error: "Not found" }, { status: 404 });
  run("UPDATE jobs SET status=? WHERE id=?", status, id);
  audit(user!.id, "job_status", "job", id, cur.status, status, rid);
  return NextResponse.json({ ok: true });
}
