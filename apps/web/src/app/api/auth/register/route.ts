import { NextResponse } from "next/server";
import { createUser, createSession, cookieHeader } from "@/server/auth.js";
import { run } from "@/server/db.js";
import { audit, requestId, limited, fail } from "@/server/guard.js";

export async function POST(req: Request) {
  const rid = requestId();
  // 30/min/IP: a classroom behind one NAT must be able to register together.
  // Mass-creation abuse is bounded by email uniqueness + admin visibility, not by this number.
  if (limited(req, "register", 30)) return NextResponse.json({ error: "Too many attempts, try again shortly" }, { status: 429 });
  try {
    const { email, name, password } = await req.json();
    if (!email || !name || !password || String(password).length < 8) {
      return NextResponse.json({ error: "Name, valid email and 8+ char password required" }, { status: 400 });
    }
    const user = createUser(email, name, password, "student");
    // Nobody lands in an empty product: every new student starts DB-00.
    run("INSERT OR IGNORE INTO enrollments (user_id, course_code) VALUES (?, 'DB-00')", user.id);
    const { token, expiresAt } = createSession(user.id);
    audit(user.id, "register", "user", user.id, "", "ACTIVE", rid);
    const res = NextResponse.json({ user });
    res.headers.set("Set-Cookie", cookieHeader(token, expiresAt));
    return res;
  } catch (e: unknown) {
    return fail(rid, e, "register");
  }
}
