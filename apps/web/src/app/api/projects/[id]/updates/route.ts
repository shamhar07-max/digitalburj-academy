import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionUser } from "@/server/auth.js";
import { all, run, row } from "@/server/db.js";
import { deny, audit, requestId, requireRole, notify, isOrgProjectCaller } from "@/server/guard.js";

type Ctx = { params: Promise<{ id: string }> };

async function visibleTo(projectId: number, user: { id: number; role: string }) {
  if (user.role === "admin" || user.role === "teacher") return true;
  const p = row<{ client_id: number; org_id: number | null }>("SELECT client_id, org_id FROM projects WHERE id=?", projectId);
  if (!p) return false;
  if (p.client_id === user.id) return true;
  return isOrgProjectCaller({ id: projectId, client_id: p.client_id, org_id: p.org_id }, user);
}

export async function GET(_req: Request, { params }: Ctx) {
  const jar = await cookies();
  const user = getSessionUser(jar.get("db_academy")?.value);
  if (!user) return deny("Login required", 401);
  const { id } = await params;
  if (!(await visibleTo(Number(id), user))) return deny("Not your project", 403);
  const updates = all("SELECT u.*, us.name AS author FROM project_updates u JOIN users us ON us.id=u.author_id WHERE u.project_id=? ORDER BY u.id DESC", id);
  return NextResponse.json({ updates });
}

export async function POST(req: Request, { params }: Ctx) {
  const rid = requestId();
  const jar = await cookies();
  const user = getSessionUser(jar.get("db_academy")?.value);
  if (!requireRole(user, "admin", "teacher")) return deny("Staff only", 403);
  const { id } = await params;
  const proj = row<{ id: number; client_id: number; title: string }>("SELECT id, client_id, title FROM projects WHERE id=?", id);
  if (!proj) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { body, needs_approval } = await req.json().catch(() => ({}));
  if (!body || String(body).trim().length < 10) return NextResponse.json({ error: "Update needs substance (10+ chars)" }, { status: 422 });
  const r = run("INSERT INTO project_updates (project_id, author_id, body, needs_approval) VALUES (?,?,?,?)",
    id, user!.id, String(body).slice(0, 4000), needs_approval ? 1 : 0);
  audit(user!.id, "project_update", "project_update", r.lastInsertRowid, "", needs_approval ? "NEEDS_APPROVAL" : "POSTED", rid);
  notify(proj.client_id, "project", `Update on “${proj.title}”${needs_approval ? " — your approval needed" : ""}.`);
  return NextResponse.json({ id: r.lastInsertRowid }, { status: 201 });
}

// Client approves (or requests changes on) an update awaiting approval.
export async function PATCH(req: Request, { params }: Ctx) {
  const rid = requestId();
  const jar = await cookies();
  const user = getSessionUser(jar.get("db_academy")?.value);
  if (!user) return deny("Login required", 401);
  const { id } = await params;
  const proj = row<{ client_id: number; org_id: number | null }>("SELECT client_id, org_id FROM projects WHERE id=?", id);
  const member = (user.role === "client" && proj && proj.client_id === user.id) ||
    (proj && await isOrgProjectCaller({ id: Number(id), client_id: proj.client_id, org_id: proj.org_id }, user));
  if (!proj || (user.role === "client" && !member)) return deny("Not your project", 403);
  if (user.role !== "client" && user.role !== "admin") return deny("Client approval only", 403);
  const { update_id, decision } = await req.json().catch(() => ({}));
  if (!["APPROVED", "CHANGES_REQUESTED"].includes(decision)) return NextResponse.json({ error: "Bad decision" }, { status: 422 });
  const cur = row<{ status: string; project_id: number }>("SELECT status, project_id FROM project_updates WHERE id=?", update_id);
  if (!cur || cur.project_id !== Number(id)) return NextResponse.json({ error: "Update not found on this project" }, { status: 404 });
  run("UPDATE project_updates SET status=? WHERE id=?", decision, update_id);
  audit(user.id, "project_approval", "project_update", update_id, cur.status, decision, rid);
  return NextResponse.json({ ok: true });
}
