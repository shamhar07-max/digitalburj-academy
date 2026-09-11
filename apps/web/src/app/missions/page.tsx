import { all } from "@/server/db.js";
import Link from "next/link";

const KIND_COLOR: Record<string, string> = {
  decision: "bg-cobalt/10 text-cobalt",
  build: "bg-amberx/15 text-amber-deep",
  break: "bg-coral/10 text-coral",
};

export default async function Missions() {
  const missions = all<{ id: number; course_code: string; course_name: string; title: string; kind: string; brief: string; difficulty: number }>(
    "SELECT m.id, m.course_code, m.title, m.kind, m.brief, m.difficulty, c.name AS course_name FROM missions m JOIN courses c ON c.code=m.course_code WHERE m.status='PUBLISHED' ORDER BY m.id");
  return (
    <div className="container-db py-10">
      <p className="font-mono-d text-xs font-semibold uppercase tracking-[0.22em] text-ink-faint">Mission board</p>
      <h1 className="font-display mt-2 text-3xl font-extrabold sm:text-4xl">Problems first. Lessons second.</h1>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {missions.map((m) => (
          <Link key={m.id} href={`/missions/${m.id}`} className="card group block p-6 transition-transform hover:-translate-y-0.5">
            <div className="flex items-center justify-between">
              <span className={`rounded-full px-2.5 py-1 font-mono-d text-[10px] font-bold uppercase tracking-[0.12em] ${KIND_COLOR[m.kind]}`}>{m.kind} · L{m.difficulty}</span>
              <span className="font-mono-d text-[11px] text-ink-faint">{m.course_code}</span>
            </div>
            <h2 className="font-display mt-3 text-xl font-extrabold group-hover:text-cobalt">{m.title}</h2>
            <p className="mt-2 line-clamp-2 text-sm text-ink-soft">{m.brief}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
