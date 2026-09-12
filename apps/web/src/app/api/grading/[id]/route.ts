import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionUser } from "@/server/auth.js";
import { row } from "@/server/db.js";
import { deny } from "@/server/guard.js";

// Owner, assigned teacher/admin only. Students can never read others' runs.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const jar = await cookies();
  const user = getSessionUser(jar.get("db_academy")?.value);
  if (!user) return deny("Login required", 401);
  const { id } = await params;
  const sub = row<{ id: number; user_id: number }>("SELECT id, user_id FROM submissions WHERE id=?", id);
  if (!sub) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (sub.user_id !== user.id && user.role === "student") return deny();
  const run = row("SELECT * FROM grading_runs WHERE submission_id=?", id);
  return NextResponse.json({ grading: run ?? { status: "QUEUED" } });
}
