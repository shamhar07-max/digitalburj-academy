import { NextResponse } from "next/server";
import { createUser, createSession, cookieHeader } from "@/server/auth.js";
import { audit, requestId } from "@/server/guard.js";

export async function POST(req: Request) {
  const rid = requestId();
  try {
    const { email, name, password } = await req.json();
    if (!email || !name || !password || String(password).length < 8) {
      return NextResponse.json({ error: "Name, valid email and 8+ char password required" }, { status: 400 });
    }
    const user = createUser(email, name, password, "student");
    const { token, expiresAt } = createSession(user.id);
    audit(user.id, "register", "user", user.id, "", "ACTIVE", rid);
    const res = NextResponse.json({ user });
    res.headers.set("Set-Cookie", cookieHeader(token, expiresAt));
    return res;
  } catch (e: unknown) {
    const err = e as Error & { status?: number };
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}
