import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionUser, destroySession, clearCookieHeader } from "@/server/auth.js";
import { run } from "@/server/db.js";
import { audit, requestId } from "@/server/guard.js";

export async function POST() {
  const jar = await cookies();
  const token = jar.get("db_academy")?.value;
  if (token) destroySession(token);
  const res = NextResponse.json({ ok: true });
  res.headers.set("Set-Cookie", clearCookieHeader());
  return res;
}

// Revoke every session of the caller (e.g. after password change or a scare).
export async function DELETE() {
  const rid = requestId();
  const jar = await cookies();
  const user = getSessionUser(jar.get("db_academy")?.value);
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });
  run("DELETE FROM sessions WHERE user_id=?", user.id);
  audit(user.id, "sessions_revoked", "session", user.id, "", "REVOKED_ALL", rid);
  const res = NextResponse.json({ ok: true });
  res.headers.set("Set-Cookie", clearCookieHeader());
  return res;
}

export async function GET() {
  const jar = await cookies();
  const user = getSessionUser(jar.get("db_academy")?.value);
  if (!user) return NextResponse.json({ user: null }, { status: 401 });
  return NextResponse.json({ user });
}
