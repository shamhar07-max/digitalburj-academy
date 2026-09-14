import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionUser } from "@/server/auth.js";
import { all, run, row } from "@/server/db.js";
import { deny, audit, requestId, requireRole, limited, fail } from "@/server/guard.js";

// Production lead capture. Public POST (rate-limited, validated); admin pipeline.
export async function POST(req: Request) {
  const rid = requestId();
  if (limited(req, "lead", 10)) return NextResponse.json({ error: "Too many requests, try again shortly" }, { status: 429 });
  try {
    const { name, email, company, interest, budget, message } = await req.json().catch(() => ({}));
    if (!name || !email || !message) return NextResponse.json({ error: "Name, email and message are required" }, { status: 422 });
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(email))) return NextResponse.json({ error: "Valid email required" }, { status: 422 });
    if (String(message).trim().length < 20) return NextResponse.json({ error: "Tell us a little more (20+ chars)" }, { status: 422 });
    const r = run("INSERT INTO leads (name, email, company, interest, budget, message) VALUES (?,?,?,?,?,?)",
      String(name).slice(0, 120), String(email).slice(0, 160), String(company || "").slice(0, 160),
      String(interest || "").slice(0, 80), String(budget || "").slice(0, 60), String(message).slice(0, 4000));
    audit(null, "lead_received", "lead", r.lastInsertRowid, "", "NEW", rid);
    return NextResponse.json({ id: r.lastInsertRowid }, { status: 201 });
  } catch (e: unknown) {
    return fail(rid, e, "lead");
  }
}

export async function GET() {
  const jar = await cookies();
  const user = getSessionUser(jar.get("db_academy")?.value);
  if (!requireRole(user, "admin")) return deny("Admin only", 403);
  return NextResponse.json({ leads: all("SELECT * FROM leads ORDER BY id DESC LIMIT 100") });
}

export async function PATCH(req: Request) {
  const rid = requestId();
  const jar = await cookies();
  const user = getSessionUser(jar.get("db_academy")?.value);
  if (!requireRole(user, "admin")) return deny("Admin only", 403);
  const { id, status } = await req.json().catch(() => ({}));
  if (!["NEW", "CONTACTED", "WON", "LOST"].includes(status)) return NextResponse.json({ error: "Bad status" }, { status: 422 });
  const cur = row<{ status: string }>("SELECT status FROM leads WHERE id=?", id);
  if (!cur) return NextResponse.json({ error: "Not found" }, { status: 404 });
  run("UPDATE leads SET status=? WHERE id=?", status, id);
  audit(user!.id, "lead_status", "lead", id, cur.status, status, rid);
  return NextResponse.json({ ok: true });
}
