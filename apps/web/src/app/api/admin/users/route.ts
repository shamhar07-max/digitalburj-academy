import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionUser, createUser } from "@/server/auth.js";
import { run } from "@/server/db.js";
import { deny, audit, requestId, requireRole } from "@/server/guard.js";

// Admin provisions any role incl. clients. Passwords hashed; everything audited.
export async function POST(req: Request) {
  const rid = requestId();
  const jar = await cookies();
  const user = getSessionUser(jar.get("db_academy")?.value);
  if (!requireRole(user, "admin")) return deny("Admin only", 403);
  const { email, name, password, role, company } = await req.json().catch(() => ({}));
  if (!email || !name || !password) return NextResponse.json({ error: "email, name, password required" }, { status: 422 });
  if (!["student", "teacher", "admin", "client"].includes(role)) return NextResponse.json({ error: "Bad role" }, { status: 422 });
  if (String(password).length < 8) return NextResponse.json({ error: "Password must be 8+ chars" }, { status: 422 });
  try {
    const created = createUser(email, name, password, role);
    if (role === "client") {
      run("INSERT INTO clients (user_id, company, contact) VALUES (?,?,?)",
        created.id, String(company || name).slice(0, 160), String(name).slice(0, 160));
    }
    audit(user!.id, "user_provision", "user", created.id, "", role, rid);
    return NextResponse.json({ user: created }, { status: 201 });
  } catch (e: unknown) {
    const err = e as Error & { status?: number };
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}
