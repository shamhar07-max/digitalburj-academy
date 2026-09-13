import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionUser } from "@/server/auth.js";
import { all, run } from "@/server/db.js";
import { deny, audit, requestId, requireRole } from "@/server/guard.js";

// Organizations (Platform Core slice): admin-managed teams; membership roles OWNER/ADMIN/MEMBER.
export async function GET() {
  const jar = await cookies();
  const user = getSessionUser(jar.get("db_academy")?.value);
  if (!requireRole(user, "admin")) return deny("Admin only", 403);
  const orgs = all("SELECT * FROM organizations ORDER BY id");
  return NextResponse.json({ orgs });
}

export async function POST(req: Request) {
  const rid = requestId();
  const jar = await cookies();
  const user = getSessionUser(jar.get("db_academy")?.value);
  if (!requireRole(user, "admin")) return deny("Admin only", 403);
  const { name, slug } = await req.json().catch(() => ({}));
  if (!name || !slug || !/^[a-z0-9-]{2,40}$/.test(String(slug))) {
    return NextResponse.json({ error: "name + slug (a-z0-9-, 2-40) required" }, { status: 422 });
  }
  try {
    const r = run("INSERT INTO organizations (name, slug) VALUES (?,?)", String(name).slice(0, 120), slug);
    run("INSERT INTO memberships (org_id, user_id, role) VALUES (?,?, 'OWNER')", r.lastInsertRowid, user!.id);
    audit(user!.id, "org_create", "organization", r.lastInsertRowid, "", slug, rid);
    return NextResponse.json({ id: r.lastInsertRowid }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Slug taken" }, { status: 409 });
  }
}
