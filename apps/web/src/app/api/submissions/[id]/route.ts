import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionUser } from "@/server/auth.js";
import { row, run } from "@/server/db.js";
import { deny, audit, requestId, requireRole } from "@/server/guard.js";

type Ctx = { params: Promise<{ id: string }> };

// Withdraw: owner (or admin) closes an in-flight submission. Terminal states are
// immutable; history rows are never deleted or overwritten.
export async function PATCH(req: Request, { params }: Ctx) {
  const rid = requestId();
  const jar = await cookies();
  const user = getSessionUser(jar.get("db_academy")?.value);
  if (!user) return deny("Login required", 401);
  const { id } = await params;
  const { action } = await req.json().catch(() => ({}));
  if (action !== "withdraw") return NextResponse.json({ error: "Unknown action" }, { status: 422 });
  const sub = row<{ id: number; user_id: number; status: string }>("SELECT id, user_id, status FROM submissions WHERE id=?", id);
  if (!sub) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (sub.user_id !== user.id && !requireRole(user, "admin")) return deny("Not yours", 403);
  if (!["DRAFT", "SUBMITTED", "UNDER_REVIEW", "CHANGES_REQUESTED", "RESUBMITTED"].includes(sub.status)) {
    return NextResponse.json({ error: `Cannot withdraw a ${sub.status} submission` }, { status: 409 });
  }
  run("UPDATE submissions SET status='WITHDRAWN', updated_at=datetime('now') WHERE id=?", id);
  audit(user.id, "withdraw", "submission", id, sub.status, "WITHDRAWN", rid);
  return NextResponse.json({ ok: true });
}
