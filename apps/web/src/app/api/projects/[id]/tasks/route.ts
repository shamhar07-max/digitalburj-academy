import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionUser } from "@/server/auth.js";
import { all, run, row } from "@/server/db.js";
import { deny, audit, requestId, requireRole, notify, isOrgProjectCaller } from "@/server/guard.js";

type Ctx = { params: Promise<{ id: string }> };

async function requireMember(projectId: number, user: { id: number; role: string }) {
  const p = row<{ id: number; client_id: number; org_id: number | null; title: string }>(
    "SELECT id, client_id, org_id, title FROM projects WHERE id=?", projectId);
  if (!p) return { project: null, err: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  if (user.role === "admin" || user.role === "teacher") return { project: p, err: null };
  const ok = await isOrgProjectCaller(p, user);
  return ok ? { project: p, err: null } : { project: null, err: deny("Not your project", 403) };
}

export async function GET(_req: Request, { params }: Ctx) {
  const jar = await cookies();
  const user = getSessionUser(jar.get("db_academy")?.value);
  if (!user) return deny("Login required", 401);
  const { id } = await params;
  const { project, err } = await requireMember(Number(id), user);
  if (err) return err;
  const tasks = all(
    `SELECT t.*, u.name AS assignee_name FROM project_tasks t
     LEFT JOIN users u ON u.id=t.assignee_id
     WHERE t.project_id=? ORDER BY t.status='DONE', t.updated_at DESC`, project!.id);
  return NextResponse.json({ tasks });
}

export async function POST(req: Request, { params }: Ctx) {
  const rid = requestId();
  const jar = await cookies();
  const user = getSessionUser(jar.get("db_academy")?.value);
  if (!user) return deny("Login required", 401);
  const { id } = await params;
  const { project, err } = await requireMember(Number(id), user);
  if (err) return err;
  if (user.role !== "admin" && user.role !== "teacher") return deny("Staff only", 403);
  const { title, assignee_id } = await req.json().catch(() => ({}));
  if (!title || String(title).trim().length < 3) return NextResponse.json({ error: "Task needs a title (3+ chars)" }, { status: 422 });
  if (assignee_id) {
    const a = row("SELECT id FROM users WHERE id=?", assignee_id);
    if (!a) return NextResponse.json({ error: "Unknown assignee" }, { status: 404 });
  }
  const r = run("INSERT INTO project_tasks (project_id, title, assignee_id, created_by) VALUES (?,?,?,?)",
    project!.id, String(title).trim().slice(0, 160), assignee_id || null, user.id);
  audit(user.id, "task_create", "project_task", r.lastInsertRowid, "", "TODO", rid);
  if (assignee_id) notify(Number(assignee_id), "task", `Task assigned: ${title}`);
  return NextResponse.json({ id: r.lastInsertRowid }, { status: 201 });
}

// Staff and org admins move tasks; assignees can move their own.
export async function PATCH(req: Request, { params }: Ctx) {
  const rid = requestId();
  const jar = await cookies();
  const user = getSessionUser(jar.get("db_academy")?.value);
  if (!user) return deny("Login required", 401);
  const { id } = await params;
  const { project, err } = await requireMember(Number(id), user);
  if (err) return err;
  const { task_id, status } = await req.json().catch(() => ({}));
  if (!["TODO", "IN_PROGRESS", "BLOCKED", "DONE"].includes(status)) {
    return NextResponse.json({ error: "Bad status" }, { status: 422 });
  }
  const task = row<{ id: number; assignee_id: number | null; status: string }>(
    "SELECT id, assignee_id, status FROM project_tasks WHERE id=? AND project_id=?", task_id, project!.id);
  if (!task) return NextResponse.json({ error: "Task not found on this project" }, { status: 404 });
  const staff = user.role === "admin" || user.role === "teacher";
  const orgAdmin = await isOrgProjectCaller(project!, user);
  if (!staff && !(orgAdmin && task.assignee_id === user.id)) return deny("Not your task", 403);
  run("UPDATE project_tasks SET status=?, updated_at=datetime('now') WHERE id=?", status, task.id);
  audit(user.id, "task_status", "project_task", task.id, task.status, status, rid);
  return NextResponse.json({ ok: true });
}