import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionUser } from "@/server/auth.js";
import { row } from "@/server/db.js";
import { deny, limited } from "@/server/guard.js";

type Ctx = { params: Promise<{ id: string }> };

// Decision-lab verdict: browser submits OPTION_ID, server evaluates.
// Correctness/consequence/explain never leave the server before an answer.
export async function POST(req: Request, { params }: Ctx) {
  const jar = await cookies();
  const user = getSessionUser(jar.get("db_academy")?.value);
  if (!user) return deny("Login required", 401);
  if (limited(req, "answer", 60)) return NextResponse.json({ error: "Too many attempts, try again shortly" }, { status: 429 });
  const { id } = await params;
  const m = row<{ kind: string; payload: string }>("SELECT kind, payload FROM missions WHERE id=? AND status='PUBLISHED'", id);
  if (!m || m.kind !== "decision") return NextResponse.json({ error: "Not a decision mission" }, { status: 404 });
  const { option_id } = await req.json().catch(() => ({}));
  let payload: { options?: { id: string; text: string; consequence: string; correct: boolean }[]; explain?: string };
  try { payload = JSON.parse(m.payload || "{}"); } catch { return NextResponse.json({ error: "Bad mission data" }, { status: 500 }); }
  const opt = (payload.options || []).find((o) => o.id === option_id);
  if (!opt) return NextResponse.json({ error: "Unknown option" }, { status: 422 });
  return NextResponse.json({ correct: !!opt.correct, consequence: opt.consequence, explain: payload.explain || "" });
}
