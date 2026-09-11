import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/server/auth.js";
import { all, row } from "@/server/db.js";

export default async function Admin() {
  const jar = await cookies();
  const user = getSessionUser(jar.get("db_academy")?.value);
  if (!user || user.role !== "admin") redirect("/login");
  const counts = row<{ users: number; subs: number; ev: number; audits: number }>(
    "SELECT (SELECT COUNT(*) FROM users) AS users, (SELECT COUNT(*) FROM submissions) AS subs, (SELECT COUNT(*) FROM evidence) AS ev, (SELECT COUNT(*) FROM audit_logs) AS audits");
  const audits = all<{ id: number; actor_id: number | null; action: string; entity: string; entity_id: string; created_at: string }>(
    "SELECT id, actor_id, action, entity, entity_id, created_at FROM audit_logs ORDER BY id DESC LIMIT 25");

  return (
    <div className="container-db max-w-4xl py-10">
      <p className="font-mono-d text-xs font-semibold uppercase tracking-[0.22em] text-ink-faint">Admin control center</p>
      <h1 className="font-display mt-2 text-3xl font-extrabold">System health</h1>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[["Users", counts?.users ?? 0], ["Submissions", counts?.subs ?? 0], ["Evidence", counts?.ev ?? 0], ["Audit rows", counts?.audits ?? 0]].map(([k, v]) => (
          <div key={k as string} className="card p-4 text-center">
            <p className="font-display text-2xl font-extrabold">{v}</p>
            <p className="font-mono-d text-[10px] uppercase tracking-[0.14em] text-ink-faint">{k}</p>
          </div>
        ))}
      </div>
      <h2 className="font-display mt-8 text-xl font-extrabold">Audit trail (latest 25)</h2>
      <div className="card mt-3 overflow-x-auto p-2">
        <table className="w-full font-mono-d text-xs">
          <thead><tr className="text-left text-ink-faint"><th className="px-3 py-2">#</th><th className="px-3 py-2">Actor</th><th className="px-3 py-2">Action</th><th className="px-3 py-2">Entity</th><th className="px-3 py-2">At</th></tr></thead>
          <tbody>
            {audits.map((a) => (
              <tr key={a.id} className="border-t border-hair">
                <td className="px-3 py-2">{a.id}</td><td className="px-3 py-2">{a.actor_id ?? "—"}</td>
                <td className="px-3 py-2 font-bold">{a.action}</td><td className="px-3 py-2">{a.entity} {a.entity_id}</td>
                <td className="px-3 py-2">{a.created_at}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
