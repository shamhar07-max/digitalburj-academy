import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { getSessionUser } from "@/server/auth.js";
import { all, row } from "@/server/db.js";
import { UpdateForm, ApproveButtons } from "@/components/PortalWidgets";

export const metadata = { title: "Project" };

export default async function ProjectDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const jar = await cookies();
  const user = getSessionUser(jar.get("db_academy")?.value);
  if (!user) redirect("/login");
  const proj = row<{ id: number; title: string; status: string; health: string; client_id: number; company: string | null }>(
    "SELECT p.*, c.company FROM projects p LEFT JOIN clients c ON c.user_id=p.client_id WHERE p.id=?", id);
  if (!proj) notFound();
  const staff = user.role === "admin" || user.role === "teacher";
  if (!staff && proj.client_id !== user.id) redirect("/projects");
  const updates = all<{ id: number; body: string; needs_approval: number; status: string; created_at: string; author: string }>(
    "SELECT u.*, us.name AS author FROM project_updates u JOIN users us ON us.id=u.author_id WHERE u.project_id=? ORDER BY u.id DESC", id);
  return (
    <div className="container-db max-w-3xl py-10">
      <p className="font-mono-d text-xs font-semibold uppercase tracking-[0.22em] text-ink-faint">Project #{proj.id} · {proj.status}</p>
      <h1 className="font-display mt-2 text-3xl font-extrabold">{proj.title}</h1>
      {proj.company && <p className="mt-1 text-sm text-ink-soft">{proj.company}</p>}
      {staff && <UpdateForm projectId={proj.id} />}
      <div className="mt-6 space-y-3">
        {updates.map((u) => (
          <div key={u.id} className="card p-5">
            <p className="text-sm leading-relaxed">{u.body}</p>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <p className="font-mono-d text-[11px] text-ink-faint">{u.author} · {u.created_at.slice(0, 16)} · {u.status}{u.needs_approval ? " · needs approval" : ""}</p>
              {(user.role === "client" || user.role === "admin") && u.needs_approval === 1 && u.status === "POSTED" && (
                <ApproveButtons projectId={proj.id} updateId={u.id} />
              )}
            </div>
          </div>
        ))}
        {updates.length === 0 && <p className="card p-5 text-sm text-ink-soft">No updates yet.</p>}
      </div>
    </div>
  );
}
