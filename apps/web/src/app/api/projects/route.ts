import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionUser } from "@/server/auth.js";
import { all, run, row } from "@/server/db.js";
import { deny, audit, requestId, requireRole, notify } from "@/server/guard.js";

// Client portal: staff see all, clients see own. Admin provisions client users.
export async function GET() {
  const jar = await cookies();
  const user = getSessionUser(jar.get("db_academy")?.value);
  if (!user) return deny("Login required", 401);
  const staff = user.role === "admin" || user.role === "teacher";
  const projects = staff
    ? all("SELECT p.*, c.company FROM projects p LEFT JOIN clients c ON c.user_id=p.client_id ORDER BY p.id DESC")
    : all("SELECT p.*, c.company FROM projects p LEFT JOIN clients c ON c.user_id=p.client_id WHERE p.client_id=? ORDER BY p.id DESC", user.id);
  return NextResponse.json({ projects });
}

export async function POST(req: Request) {
  const rid = requestId();
  const jar = await cookies();
  const user = getSessionUser(jar.get("db_academy")?.value);
  if (!requireRole(user, "admin")) return deny("Admin only", 403);
  const { client_id, title } = await req.json().catch(() => ({}));
  if (!client_id || !title) return NextResponse.json({ error: "client_id and title required" }, { status: 422 });
  const client = row("SELECT user_id FROM clients WHERE user_id=?", client_id);
  if (!client) return NextResponse.json({ error: "Unknown client" }, { status: 404 });
  const r = run("INSERT INTO projects (client_id, title) VALUES (?,?)", client_id, String(title).slice(0, 160));
  audit(user!.id, "project_create", "project", r.lastInsertRowid, "", "DISCOVERY", rid);
  notify(Number(client_id), "project", `New project opened: ${title}`);
  return NextResponse.json({ id: r.lastInsertRowid }, { status: 201 });
}
