import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionUser } from "@/server/auth.js";
import { row, all, run } from "@/server/db.js";
import { deny, audit, notify, requestId } from "@/server/guard.js";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  const { id } = await params;
  const jar = await cookies();
  const viewer = getSessionUser(jar.get("db_academy")?.value);
  const staff = viewer?.role === "teacher" || viewer?.role === "admin";
  const m = row<Record<string, unknown>>("SELECT m.*, c.name AS course_name FROM missions m JOIN courses c ON c.code=m.course_code WHERE m.id=?", id);
  if (!m) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!staff && typeof m.payload === "string") {
    try {
      const p = JSON.parse(m.payload) as Record<string, unknown>;
      delete p.answer; // answer keys never reach student browsers
      m.payload = JSON.stringify(p);
    } catch { /* keep as-is */ }
  }
  return NextResponse.json({ mission: m });
}

// GET my submissions (owner only)
export async function PUT(req: Request) {
  const jar = await cookies();
  const user = getSessionUser(jar.get("db_academy")?.value);
  if (!user) return deny("Login required", 401);
  const mine = all("SELECT s.*, m.title AS mission_title FROM submissions s JOIN missions m ON m.id=s.mission_id WHERE s.user_id=? ORDER BY s.id DESC", user.id);
  return NextResponse.json({ submissions: mine });
}
