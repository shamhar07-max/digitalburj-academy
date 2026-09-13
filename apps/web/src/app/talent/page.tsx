import { all } from "@/server/db.js";

export const metadata = { title: "Talent" };

export default async function Talent() {
  const people = all<{ id: number; name: string }>(
    `SELECT DISTINCT u.id, u.name FROM users u JOIN evidence e ON e.user_id=u.id AND e.status='VERIFIED'
     WHERE u.role='student' AND u.status='ACTIVE' ORDER BY u.name`);
  const directory = people.map((p) => ({
    ...p,
    skills: all<{ code: string; name: string; level: number }>(
      `SELECT sk.code, sk.name, ss.level FROM student_skills ss JOIN skills sk ON sk.code=ss.skill_code
       WHERE ss.user_id=? AND ss.level > 0 ORDER BY ss.level DESC`, p.id),
    evidence: all<{ skill: string; mission: string | null; title: string }>(
      `SELECT s.name AS skill, m.title AS mission, e.title FROM evidence e JOIN skills s ON s.code=e.skill_code
       LEFT JOIN submissions sub ON sub.id=e.submission_id LEFT JOIN missions m ON m.id=sub.mission_id
       WHERE e.user_id=? AND e.status='VERIFIED' ORDER BY e.id DESC`, p.id),
  }));
  return (
    <div className="container-db py-10">
      <p className="font-mono-d text-xs font-semibold uppercase tracking-[0.22em] text-ink-faint">Talent directory</p>
      <h1 className="font-display mt-2 text-3xl font-extrabold sm:text-4xl">Evidence, not CVs.</h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-soft">
        A CV says “I know backend”. This directory says “here are three reviewed builds, two
        recovered failures, and the teacher who verified them”. Everyone listed earned their place
        the same way: missions submitted, human-reviewed, evidence verified. Skill bars reflect
        demonstrated work, not self-ratings — and nobody appears here without at least one
        verified evidence record. Contact details stay private until both sides agree to talk.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {directory.map((p) => (
          <div key={p.id} className="card p-6">
            <h2 className="font-display text-xl font-extrabold">{p.name}</h2>
            <p className="font-mono-d mt-1 text-[11px] uppercase tracking-[0.12em] text-emerald">{p.evidence.length} verified evidence</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {p.skills.map((s) => (
                <span key={s.code} className="font-mono-d rounded-full bg-cobalt/10 px-2.5 py-1 text-[10px] font-bold text-cobalt">{s.name} · {s.level}</span>
              ))}
            </div>
            <ul className="mt-3 space-y-1 text-xs text-ink-soft">
              {p.evidence.slice(0, 4).map((e, i) => <li key={i}>✓ {e.skill} — {e.mission || e.title}</li>)}
            </ul>
          </div>
        ))}
        {directory.length === 0 && <p className="card p-6 text-sm text-ink-soft">No verified talent yet. Evidence appears here after teacher review.</p>}
      </div>
    </div>
  );
}
