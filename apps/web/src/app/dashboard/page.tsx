import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/server/auth.js";
import { all, row } from "@/server/db.js";
import Link from "next/link";

export default async function Dashboard() {
  const jar = await cookies();
  const user = getSessionUser(jar.get("db_academy")?.value);
  if (!user) redirect("/login");

  const nextMission = row<{ id: number; title: string; course_code: string }>(
    `SELECT m.id, m.title, m.course_code FROM missions m
     WHERE m.status='PUBLISHED' AND NOT EXISTS
     (SELECT 1 FROM submissions s WHERE s.user_id=? AND s.mission_id=m.id AND s.status IN ('SUBMITTED','UNDER_REVIEW','RESUBMITTED','APPROVED','EVIDENCE_CREATED'))
     ORDER BY m.id LIMIT 1`, user.id);
  const counts = row<{ sub: number; ev: number; notes: number }>(
    `SELECT (SELECT COUNT(*) FROM submissions WHERE user_id=?) AS sub,
            (SELECT COUNT(*) FROM evidence WHERE user_id=? AND status='VERIFIED') AS ev,
            (SELECT COUNT(*) FROM notifications WHERE user_id=? AND read_at IS NULL) AS notes`,
    user.id, user.id, user.id);
  const skills = all<{ code: string; name: string; level: number }>(
    `SELECT sk.code, sk.name, COALESCE(ss.level,0) AS level FROM skills sk
     LEFT JOIN student_skills ss ON ss.skill_code=sk.code AND ss.user_id=?`, user.id);
  const notes = all<{ id: number; text: string; created_at: string }>(
    "SELECT id, text, created_at FROM notifications WHERE user_id=? ORDER BY id DESC LIMIT 5", user.id);

  return (
    <div className="container-db py-10">
      <p className="font-mono-d text-xs font-semibold uppercase tracking-[0.22em] text-ink-faint">Today</p>
      <h1 className="font-display mt-2 text-3xl font-extrabold sm:text-4xl">Good to see you, {user.name.split(" ")[0]}.</h1>

      <div className="mt-8 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="card border-2 border-ink p-7" style={{ boxShadow: "6px 6px 0 #D9481C" }}>
          <p className="font-mono-d text-xs font-semibold uppercase tracking-[0.2em] text-coral">Current mission</p>
          {nextMission ? (
            <>
              <h2 className="font-display mt-2 text-2xl font-extrabold">{nextMission.title}</h2>
              <p className="font-mono-d mt-1 text-xs text-ink-faint">{nextMission.course_code}</p>
              <Link href={`/missions/${nextMission.id}`} className="mt-5 inline-block rounded-xl bg-cobalt px-6 py-3 font-bold text-white hover:opacity-90">
                Continue mission →
              </Link>
            </>
          ) : (
            <p className="mt-2 text-ink-soft">All missions attempted. Review feedback or ask for the next cohort.</p>
          )}
          <div className="mt-6 grid grid-cols-3 gap-3 border-t border-hair pt-5 font-mono-d text-center">
            {[["Submissions", counts?.sub ?? 0], ["Evidence", counts?.ev ?? 0], ["Alerts", counts?.notes ?? 0]].map(([k, v]) => (
              <div key={k as string} className="rounded-xl bg-lab px-2 py-3">
                <p className="text-xl font-bold">{v}</p>
                <p className="text-[10px] uppercase tracking-[0.14em] text-ink-faint">{k}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-5">
          <div className="card p-6">
            <h2 className="font-display text-lg font-extrabold">Your skills</h2>
            <div className="mt-4 space-y-3">
              {skills.map((s) => (
                <div key={s.code}>
                  <div className="flex justify-between text-xs font-semibold"><span>{s.name}</span><span className="font-mono-d text-ink-faint">{s.level}%</span></div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-lab">
                    <div className="h-full rounded-full bg-cobalt" style={{ width: `${s.level}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="card p-6">
            <h2 className="font-display text-lg font-extrabold">Notifications</h2>
            <ul className="mt-3 space-y-2 text-sm text-ink-soft">
              {notes.length === 0 && <li className="text-ink-faint">All quiet. Good time to start a mission.</li>}
              {notes.map((n) => <li key={n.id} className="rounded-lg bg-lab px-3 py-2">{n.text}</li>)}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
