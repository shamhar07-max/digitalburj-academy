import Link from "next/link";
import { CATALOG } from "@/content/academy/catalog";

export default function Courses() {
  return (
    <div className="container-db py-10">
      <p className="font-mono-d text-xs font-semibold uppercase tracking-[0.22em] text-ink-faint">Catalog · 23 courses</p>
      <h1 className="font-display mt-2 text-3xl font-extrabold sm:text-4xl">Capability pathways, not playlists.</h1>
      <p className="mt-3 max-w-2xl text-ink-soft">Every course: problem-first missions, build/break labs, assessment and evidence. Green badges mark courses with full lesson content; the rest show complete blueprints.</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {CATALOG.map((c) => (
          <Link key={c.id} href={`/courses/${c.id}`} className="card group block p-6 transition-transform hover:-translate-y-0.5">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono-d rounded-md bg-cobalt/10 px-2.5 py-1 text-xs font-bold text-cobalt">{c.id}</span>
              <span className="font-mono-d text-[11px] uppercase tracking-[0.1em] text-ink-faint">{c.difficulty} · {c.durationWeeks}w</span>
            </div>
            <h2 className="font-display mt-3 text-xl font-extrabold group-hover:text-cobalt">{c.title}</h2>
            <p className="mt-1.5 line-clamp-2 text-sm text-ink-soft">{c.outcomes[0]}</p>
            <p className="font-mono-d mt-3 text-[11px] text-ink-faint">{c.modules.length} modules · prereq: {c.prerequisites.join(", ") || "none"}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
