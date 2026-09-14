import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionUser } from "@/server/auth.js";
import { all, run, row, transaction } from "@/server/db.js";
import { deny, audit, requestId, requireRole, notify } from "@/server/guard.js";

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

// Membership management: { org_id, user_id, role } to add/update, or { org_id, user_id, remove: true }.
export async function PATCH(req: Request) {
  const rid = requestId();
  const jar = await cookies();
  const user = getSessionUser(jar.get("db_academy")?.value);
  if (!requireRole(user, "admin")) return deny("Admin only", 403);
  const { org_id, user_id, role, remove } = await req.json().catch(() => ({}));
  if (!org_id || !user_id) return NextResponse.json({ error: "org_id and user_id required" }, { status: 422 });
  const org = row("SELECT id FROM organizations WHERE id=?", org_id);
  if (!org) return NextResponse.json({ error: "Unknown organization" }, { status: 404 });
  const target = row("SELECT id, name FROM users WHERE id=?", user_id);
  if (!target) return NextResponse.json({ error: "Unknown user" }, { status: 404 });
  const roles = new Set(["OWNER", "ADMIN", "MEMBER"]);
  if (remove) {
    transaction(() => {
      run("UPDATE memberships SET status='REMOVED' WHERE org_id=? AND user_id=?", org_id, user_id);
    });
    audit(user!.id, "org_remove_member", "membership", `${org_id}:${user_id}`, "ACTIVE", "REMOVED", rid);
    return NextResponse.json({ ok: true });
  }
  if (!roles.has(role)) return NextResponse.json({ error: "role must be OWNER, ADMIN or MEMBER" }, { status: 422 });
  const before = row<{ status: string }>("SELECT status FROM memberships WHERE org_id=? AND user_id=?", org_id, user_id);
  transaction(() => {
    run(`INSERT INTO memberships (org_id, user_id, role, status) VALUES (?,?,?, 'ACTIVE')
         ON CONFLICT(org_id, user_id) DO UPDATE SET role=excluded.role, status='ACTIVE'`, org_id, user_id, role);
  });
  audit(user!.id, "org_member", "membership", `${org_id}:${user_id}`, before?.status || "", role, rid);
  notify(Number(user_id), "org", `You were added to an organization as ${role}.`);
  return NextResponse.json({ ok: true });
}
