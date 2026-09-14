import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionUser } from "@/server/auth.js";
import { all, run, row, transaction } from "@/server/db.js";
import { deny, requestId, audit, notify, isOrgProjectCaller } from "@/server/guard.js";

type Ctx = { params: Promise<{ id: string }> };

const FIELDS = new Set(["title", "status", "health"]);
const PROJ_STATUS = ["LEAD", "DISCOVERY", "BUILD", "REVIEW", "LIVE", "OPERATING", "COMPLETED"];
const HEALTH = ["green", "amber", "red"];

// Staff propose scoped changes; the owning client (or org admin) approves.
export async function GET(_req: Request, { params }: Ctx) {
  const jar = await cookies();
  const user = getSessionUser(jar.get("db_academy")?.value);
  if (!user) return deny("Login required", 401);
  const { id } = await params;
  const proj = row<{ client_id: number; org_id: number | null }>("SELECT client_id, org_id FROM projects WHERE id=?", id);
  if (!proj) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const staff = user.role === "admin" || user.role === "teacher";
  const member = await isOrgProjectCaller({ id: Number(id), client_id: proj.client_id, org_id: proj.org_id }, user);
  const clientOwner = user.role === "client" && proj.client_id === user.id;
  if (!staff && !clientOwner && !member) return deny("Not your project", 403);
  const crs = all(
    `SELECT cr.*, u.name AS author FROM change_requests cr
     JOIN users u ON u.id=cr.created_by
     WHERE cr.project_id=? ORDER BY cr.id DESC`, id);
  return NextResponse.json({ requests: crs });
}

export async function POST(req: Request, { params }: Ctx) {
  const rid = requestId();
  const jar = await cookies();
  const user = getSessionUser(jar.get("db_academy")?.value);
  if (!user) return deny("Login required", 401);
  const { id } = await params;
  const proj = row<{ id: number; client_id: number; title: string; status: string; health: string }>(
    "SELECT id, client_id, title, status, health FROM projects WHERE id=?", id);
  if (!proj) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const staff = user.role === "admin" || user.role === "teacher";
  if (!staff) return deny("Staff only", 403);
  const { field, proposed_value, reason } = await req.json().catch(() => ({}));
  if (!FIELDS.has(field)) return NextResponse.json({ error: "Field must be title, status or health" }, { status: 422 });
  const value = String(proposed_value ?? "");
  if ((field === "status" && !PROJ_STATUS.includes(value)) ||
      (field === "health" && !HEALTH.includes(value)) ||
      (field === "title" && value.trim().length < 3)) {
    return NextResponse.json({ error: "Bad proposed value" }, { status: 422 });
  }
  if (!reason || String(reason).trim().length < 10) {
    return NextResponse.json({ error: "A reason (10+ chars) is required for change requests" }, { status: 422 });
  }
  const current = field === "title" ? proj.title : field === "status" ? proj.status : proj.health;
  const openQ = row("SELECT id FROM change_requests WHERE project_id=? AND field=? AND status IN ('PREVIEW','PREVIEW_SUBMITTED')", id, field);
  if (openQ) return NextResponse.json({ error: "A change request for this field is already open" }, { status: 409 });
  const r = run(
    `INSERT INTO change_requests (project_id, created_by, field, current_value, proposed_value, reason, status)
     VALUES (?,?,?,?,?,?, 'PREVIEW_SUBMITTED')`,
    id, user.id, field, current, value.trim().slice(0, 160), String(reason).trim().slice(0, 2000));
  audit(user.id, "change_request", "change_request", r.lastInsertRowid, current, value.trim(), rid);
  notify(proj.client_id, "project", `Change requested on "${proj.title}" (${field}): ${value.trim()}`);
  return NextResponse.json({ id: r.lastInsertRowid }, { status: 201 });
}

// Client (or org admin) approves/rejects. Approval applies the change atomically.
export async function PATCH(req: Request, { params }: Ctx) {
  const rid = requestId();
  const jar = await cookies();
  const user = getSessionUser(jar.get("db_academy")?.value);
  if (!user) return deny("Login required", 401);
  const { id } = await params;
  const proj = row<{ id: number; client_id: number; org_id: number | null }>("SELECT id, client_id, org_id FROM projects WHERE id=?", id);
  if (!proj) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { request_id, decision } = await req.json().catch(() => ({}));
  if (!["APPROVED", "REJECTED"].includes(decision)) return NextResponse.json({ error: "Bad decision" }, { status: 422 });
  const cr = row<{ id: number; project_id: number; field: string; proposed_value: string; status: string }>(
    "SELECT id, project_id, field, proposed_value, status FROM change_requests WHERE id=?", request_id);
  if (!cr || cr.project_id !== Number(id)) return NextResponse.json({ error: "Change request not found on this project" }, { status: 404 });
  const member = await isOrgProjectCaller(proj, user);
  const clientOwner = user.role === "client" && proj.client_id === user.id;
  const orgAdmin = user.role === "admin" || (member && proj.org_id !== null);
  if (!clientOwner && !orgAdmin) return deny("Only the owning client or org admin may decide", 403);
  if (cr.status !== "PREVIEW_SUBMITTED") return NextResponse.json({ error: "Already decided" }, { status: 409 });

  const applied = transaction(() => {
    // Field is whitelist-constrained (title/status/health) before it ever reaches SQL.
    const col = cr.field;
    if (decision === "APPROVED") {
      run(`UPDATE projects SET ${col}=? WHERE id=?`, cr.proposed_value, proj.id);
    }
    run("UPDATE change_requests SET status=?, updated_at=datetime('now') WHERE id=?", decision, cr.id);
  });
  void applied;
  audit(user.id, "change_request_decision", "change_request", cr.id, "PREVIEW_SUBMITTED", decision, rid);
  notify(user.id, "project", `Change request ${decision.toLowerCase()}: ${cr.field} → ${cr.proposed_value}`);
  return NextResponse.json({ ok: true });
}