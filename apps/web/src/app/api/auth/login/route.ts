import { NextResponse } from "next/server";
import { authenticate, createSession, cookieHeader } from "@/server/auth.js";
import { audit, requestId, limited, fail, recordFail, checkLocked, clearFails, clientIp } from "@/server/guard.js";

export async function POST(req: Request) {
  const rid = requestId();
  if (limited(req, "login", 20)) return NextResponse.json({ error: "Too many attempts, try again shortly" }, { status: 429 });
  try {
    const { email, password } = await req.json();
    if (checkLocked(email)) {
      audit(null, "login_locked", "session", String(email || ""), "", "LOCKED", rid, clientIp(req));
      return NextResponse.json({ error: "Account temporarily locked after repeated failures — try again in 15 minutes" }, { status: 423 });
    }
    try {
      const user = authenticate(email, password);
      clearFails(email);
      const { token, expiresAt } = createSession(user.id);
      audit(user.id, "login", "session", user.id, "", "ACTIVE", rid, clientIp(req));
      const res = NextResponse.json({ user });
      res.headers.set("Set-Cookie", cookieHeader(token, expiresAt));
      return res;
    } catch (inner: unknown) {
      recordFail(email);
      const err = inner as Error & { status?: number };
      audit(null, "login_failed", "session", String(email || ""), "", err.message, rid, clientIp(req));
      throw inner;
    }
  } catch (e: unknown) {
    return fail(rid, e, "login");
  }
}
