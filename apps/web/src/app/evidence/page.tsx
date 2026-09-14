import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/server/auth.js";
import { all, row } from "@/server/db.js";

export default async function Evidence() {
  const jar = await cookies();
  const user = getSessionUser(jar.get("db_academy")?.value);
  if (!user) redirect("/login");
  const items = all<{ id: number; mission_title: string; skill_name: string; status: string; note: string; created_at: string }>(
    `SELECT e.id, e.status, e.note, e.created_at, m.title AS mission_title, s.name AS skill_name FROM evidence e
     JOIN submissions sub ON sub.id=e.submission_id JOIN missions m ON m.id=sub.mission_id
     JOIN skills s ON s.code=e.skill_code WHERE e.user_id=? ORDER BY e.id DESC`, user.id);
  const skills = all<{ name: string; level: number }>(
    `SELECT sk.name, COALESCE(ss.level,0) AS level FROM skills sk LEFT JOIN student_skills ss ON ss.skill_code=sk.code AND ss.user_id=?`, user.id);
  const certs = all<{ code: string; title: string; status: string }>("SELECT code, title, status FROM certificates WHERE user_id=?", user.id);
  const maxed = skills.filter((s) => s.level > 0).length;

  return (
    <div className="container-db max-w-3xl py-10">
      <p className="font-mono-d text-xs font-semibold uppercase tracking-[0.22em] text-ink-faint">Evidence wallet</p>
      <h1 className="font-display mt-2 text-3xl font-extrabold">Proof, not promises.</h1>

      <div className="card mt-6 border-2 border-ink p-6" style={{ boxShadow: "5px 5px 0 #18B8D6" }}>
        <p className="font-mono-d text-xs font-bold uppercase tracking-[0.18em] text-cobalt">Capability record · DB-{String(user.id).padStart(6, "0")}</p>
        <h2 className="font-display mt-1 text-xl font-extrabold">{user.name}</h2>
        <div className="mt-4 space-y-2.5">
          {skills.map((s) => (
            <div key={s.name}>
              <div className="flex justify-between text-xs font-semibold"><span>{s.name}</span><span className="font-mono-d text-ink-faint">{s.level}%</span></div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-lab">
                <div className="h-full rounded-full bg-cobalt" style={{ width: `${s.level}%` }} />
              </div>
            </div>
          ))}
        </div>
        <p className="font-mono-d mt-4 text-xs text-ink-faint">{items.length} evidence · {maxed} active skills · {certs.length} certificates</p>
      </div>

      <h2 className="font-display mt-8 text-xl font-extrabold">Evidence log</h2>
      <div className="mt-4 space-y-3">
        {items.length === 0 && <p className="card p-5 text-sm text-ink-soft">No verified evidence yet. Approved submissions land here automatically.</p>}
        {items.map((e) => (
          <div key={e.id} className="card p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-bold">EVIDENCE #{e.id} · {e.skill_name}</span>
              <span className="font-mono-d rounded-full bg-tealx/10 px-2.5 py-1 text-[10px] font-bold text-tealx">{e.status}</span>
            </div>
            <p className="mt-1.5 text-sm text-ink-soft">{e.mission_title} — {e.note}</p>
            <p className="font-mono-d mt-1.5 text-[11px] text-ink-faint">verify: talent.digitalburj.com/DB-{String(user.id).padStart(6, "0")} · {e.created_at.slice(0, 10)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
