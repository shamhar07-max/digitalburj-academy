import { all } from "@/server/db.js";
import { ApplyWidget } from "@/components/JobWidgets";

export const metadata = { title: "Jobs" };

export default async function Jobs() {
  const jobs = all<{ id: number; title: string; kind: string; description: string; created_at: string; posted_by: string | null }>(
    "SELECT j.id, j.title, j.kind, j.description, j.created_at, u.name AS posted_by FROM jobs j LEFT JOIN users u ON u.id=j.created_by WHERE j.status='OPEN' ORDER BY j.id DESC");
  return (
    <div className="container-db py-10">
      <p className="font-mono-d text-xs font-semibold uppercase tracking-[0.22em] text-ink-faint">Jobs board</p>
      <h1 className="font-display mt-2 text-3xl font-extrabold sm:text-4xl">Real work for verified capability.</h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-soft">
        Every posting here is reviewed before it appears — no commission traps, no pay-to-apply,
        no ghost listings. Employers don&apos;t see your grades; they see your verified evidence:
        what you built, what broke, how you recovered, who reviewed it. One application per job:
        if you already applied, the system tells you instead of silently duplicating. Closed roles
        disappear the moment they&apos;re filled.
      </p>
      <div className="mt-8 grid gap-4">
        {jobs.map((j) => (
          <div key={j.id} className="card p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-xl font-extrabold">{j.title}</h2>
              <span className="font-mono-d rounded-full bg-emerald/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-emerald">{j.kind}</span>
            </div>
            {j.description && <p className="mt-2 text-sm text-ink-soft">{j.description}</p>}
            <p className="font-mono-d mt-2 text-[11px] text-ink-faint">#{j.id} · {j.created_at.slice(0, 10)}{j.posted_by ? ` · ${j.posted_by}` : ""}</p>
            <ApplyWidget jobId={j.id} />
          </div>
        ))}
        {jobs.length === 0 && <p className="card p-6 text-sm text-ink-soft">No open roles right now. Build evidence in missions — the board fills as partners post.</p>}
      </div>
    </div>
  );
}
