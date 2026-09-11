import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionUser, destroySession, clearCookieHeader } from "@/server/auth.js";

export async function POST() {
  const jar = await cookies();
  const token = jar.get("db_academy")?.value;
  if (token) destroySession(token);
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
