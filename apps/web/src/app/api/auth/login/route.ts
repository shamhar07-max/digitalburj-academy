import { NextResponse } from "next/server";
import { authenticate, createSession, cookieHeader } from "@/server/auth.js";
import { audit, requestId } from "@/server/guard.js";

export async function POST(req: Request) {
  const rid = requestId();
  try {
    const { email, password } = await req.json();
    const user = authenticate(email, password);
    const { token, expiresAt } = createSession(user.id);
    audit(user.id, "login", "session", user.id, "", "ACTIVE", rid);
    const res = NextResponse.json({ user });
    res.headers.set("Set-Cookie", cookieHeader(token, expiresAt));
    return res;
  } catch (e: unknown) {
    const err = e as Error & { status?: number };
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}
