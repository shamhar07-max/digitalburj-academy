import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUser } from "@/server/auth.js";
import { all } from "@/server/db.js";

export const metadata = { title: "Projects" };

export default async function Projects() {
  const jar = await cookies();
  const user = getSessionUser(jar.get("db_academy")?.value);
  if (!user) redirect("/login");
  const staff = user.role === "admin" || user.role === "teacher";
  const projects = staff
    ? all<{ id: number; title: string; status: string; health: string; company: string | null }>(
      "SELECT p.id, p.title, p.status, p.health, c.company FROM projects p LEFT JOIN clients c ON c.user_id=p.client_id ORDER BY p.id DESC")
    : all<{ id: number; title: string; status: string; health: string }>(
      "SELECT id, title, status, health FROM projects WHERE client_id=? ORDER BY id DESC", user.id);
  const dot = { green: "bg-emerald", amber: "bg-amberx", red: "bg-coral" } as Record<string, string>;
  return (
    <div className="container-db py-10">
      <p className="font-mono-d text-xs font-semibold uppercase tracking-[0.22em] text-ink-faint">Client portal</p>
      <h1 className="font-display mt-2 text-3xl font-extrabold sm:text-4xl">Every project, visible.</h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-soft">
        Clients never have to ask “what&apos;s happening with my project?”. Every update the team
        posts lands here with its status attached — and anything that needs your decision arrives
        flagged for approval, so nothing expensive happens on assumption. Approvals and change
        requests are recorded with who decided what and when. That record is the relationship.
      </p>
      <div className="mt-8 grid gap-4">
        {projects.map((p) => (
          <Link key={p.id} href={`/projects/${p.id}`} className="card group block p-6">
            <div className="flex items-center gap-2">
              <span className={`inline-block h-2.5 w-2.5 rounded-full ${dot[p.health] || dot.green}`} aria-hidden />
              <h2 className="font-display text-xl font-extrabold group-hover:text-cobalt">{p.title}</h2>
            </div>
            <p className="font-mono-d mt-2 text-[11px] uppercase tracking-[0.12em] text-ink-faint">{p.status}{"company" in p && p.company ? ` · ${p.company}` : ""}</p>
          </Link>
        ))}
        {projects.length === 0 && <p className="card p-6 text-sm text-ink-soft">No projects yet. Admins open projects for provisioned clients.</p>}
      </div>
    </div>
  );
}
