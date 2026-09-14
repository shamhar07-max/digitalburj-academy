import Link from "next/link";
import { CATALOG } from "@/content/academy/catalog";
import { DB00 } from "@/content/academy/db-00";

export async function generateStaticParams() {
  return CATALOG.map((c) => ({ id: c.id }));
}

export default async function CourseDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const course = CATALOG.find((c) => c.id === id);
  if (!course) return <div className="container-db py-20">Course not found.</div>;
  const full = id === "DB-00" ? DB00 : null;

  return (
    <div className="container-db max-w-3xl py-10">
      <Link href="/courses" className="font-mono-d text-xs uppercase tracking-[0.14em] text-ink-faint hover:text-cobalt">← Catalog</Link>
      <p className="font-mono-d mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-cobalt">{course.id} · {course.category} · v{course.version}</p>
      <h1 className="font-display mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">{course.title}</h1>
      <p className="mt-3 text-ink-soft">For: {course.audience} · {course.durationWeeks} weeks · {course.difficulty}</p>

      <h2 className="font-display mt-8 text-xl font-extrabold">You will be able to</h2>
      <ul className="mt-3 space-y-2">
        {course.outcomes.map((o) => (
          <li key={o} className="flex gap-2 rounded-xl border border-hair bg-panel px-4 py-3 text-sm"><span className="font-bold text-tealx">✓</span>{o}</li>
        ))}
      </ul>

      <h2 className="font-display mt-8 text-xl font-extrabold">Modules</h2>
      <div className="mt-3 space-y-3">
        {course.modules.map((m, i) => (
          <div key={m.id} className="card p-5">
            <p className="font-mono-d text-[11px] font-bold uppercase tracking-[0.14em] text-ink-faint">Module {i + 1}</p>
            <h3 className="mt-1 font-bold">{m.objective}</h3>
            <p className="mt-1.5 rounded-lg bg-lab px-3 py-2 text-sm italic text-ink-soft">Scenario: {m.scenario}</p>
            {full && (
              <div className="mt-3 border-t border-hair pt-3">
                {full.modules.find((fm) => fm.id === m.id)?.lessons.map((l) => (
                  <Link key={l.id} href={`/courses/${course.id}/lessons/${l.id}`} className="flex items-center justify-between border-b border-hair/60 py-2 text-sm last:border-b-0 hover:text-cobalt">
                    <span className="font-semibold">{l.title}</span>
                    <span className="font-mono-d text-[11px] text-ink-faint">open →</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="card mt-6 border-2 border-ink p-6" style={{ boxShadow: "5px 5px 0 #18B8D6" }}>
        <p className="font-mono-d text-xs font-bold uppercase tracking-[0.16em] text-coral">Final project</p>
        <p className="mt-2 font-bold">{course.finalProject}</p>
        <p className="font-mono-d mt-3 text-xs text-ink-faint">Evidence: {course.evidence.join(" · ")}</p>
        <p className="font-mono-d mt-1 text-xs text-ink-faint">Next: {course.next.join(", ") || "—"}</p>
      </div>
    </div>
  );
}
