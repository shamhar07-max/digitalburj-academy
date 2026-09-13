import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionUser } from "@/server/auth.js";
import { row, all, run } from "@/server/db.js";
import { deny, audit, requestId, requireRole, limited } from "@/server/guard.js";

// Studio intake: public POST (rate-limited), admin review queue.
export async function POST(req: Request) {
  if (limited(req, "inquiry", 10)) return NextResponse.json({ error: "Too many requests, try again shortly" }, { status: 429 });
  const rid = requestId();
  const { name, email, idea, stage, budget } = await req.json().catch(() => ({}));
  if (!name || !email || !idea) return NextResponse.json({ error: "Name, email and idea are required" }, { status: 422 });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(email))) return NextResponse.json({ error: "Valid email required" }, { status: 422 });
  if (String(idea).trim().length < 30) return NextResponse.json({ error: "Describe the idea in at least a few sentences (30+ chars)" }, { status: 422 });
  const okStages = ["idea", "validated", "mvp", "revenue"];
  const r = run("INSERT INTO studio_inquiries (name, email, idea, stage, budget) VALUES (?,?,?,?,?)",
    String(name).slice(0, 120), String(email).slice(0, 160), String(idea).slice(0, 4000),
    okStages.includes(stage) ? stage : "idea", String(budget || "unknown").slice(0, 60));
  audit(null, "inquiry_received", "studio_inquiry", r.lastInsertRowid, "", "NEW", rid);
  return NextResponse.json({ id: r.lastInsertRowid }, { status: 201 });
}

export async function GET(req: Request) {
  const jar = await cookies();
  const user = getSessionUser(jar.get("db_academy")?.value);
  if (!requireRole(user, "admin")) return deny("Admin only", 403);
  const status = new URL(req.url).searchParams.get("status");
  const list = status
    ? all("SELECT * FROM studio_inquiries WHERE status=? ORDER BY id DESC", status)
    : all("SELECT * FROM studio_inquiries ORDER BY id DESC");
  return NextResponse.json({ inquiries: list });
}

export async function PATCH(req: Request) {
  const rid = requestId();
  const jar = await cookies();
  const user = getSessionUser(jar.get("db_academy")?.value);
  if (!requireRole(user, "admin")) return deny("Admin only", 403);
  const { id, status } = await req.json().catch(() => ({}));
  if (!["NEW", "REVIEWING", "ACCEPTED", "DECLINED"].includes(status)) return NextResponse.json({ error: "Bad status" }, { status: 422 });
  const cur = row<{ status: string }>("SELECT status FROM studio_inquiries WHERE id=?", id);
  if (!cur) return NextResponse.json({ error: "Not found" }, { status: 404 });
  run("UPDATE studio_inquiries SET status=? WHERE id=?", status, id);
  audit(user!.id, "inquiry_status", "studio_inquiry", id, cur.status, status, rid);
  return NextResponse.json({ ok: true });
}
