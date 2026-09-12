import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionUser } from "@/server/auth.js";
import { row, all, run } from "@/server/db.js";
import { deny, audit, requestId } from "@/server/guard.js";

const TRADES = ["restaurant", "logistics", "real-estate", "school", "agency", "consultancy", "ecommerce", "healthcare", "startup", "general"];

export async function GET() {
  const jar = await cookies();
  const user = getSessionUser(jar.get("db_academy")?.value);
  if (!user) return deny("Login required", 401);
  return NextResponse.json({
    companies: all("SELECT * FROM companies WHERE user_id=? ORDER BY id", user.id),
  });
}

// Create (or adopt) the student's persistent company. One evolving business.
export async function POST(req: Request) {
  const rid = requestId();
  const jar = await cookies();
  const user = getSessionUser(jar.get("db_academy")?.value);
  if (!user) return deny("Login required", 401);
  const { name, trade } = await req.json().catch(() => ({}));
  if (!name || String(name).trim().length < 2 || String(name).length > 40) {
    return NextResponse.json({ error: "Company name 2–40 chars required" }, { status: 422 });
  }
  const t = TRADES.includes(trade) ? trade : "general";
  const existing = row<{ id: number }>("SELECT id FROM companies WHERE user_id=? AND name=?", user.id, name.trim());
  if (existing) return NextResponse.json({ company: existing, duplicate: true });
  const r = run("INSERT INTO companies (user_id, name, trade) VALUES (?,?,?)", user.id, name.trim(), t);
  const company = row("SELECT * FROM companies WHERE id=?", r.lastInsertRowid);
  audit(user.id, "company_create", "company", r.lastInsertRowid, "", t, rid);
  return NextResponse.json({ company }, { status: 201 });
}
