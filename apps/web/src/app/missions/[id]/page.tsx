import { row } from "@/server/db.js";
import { cookies } from "next/headers";
import { getSessionUser } from "@/server/auth.js";
import { DecisionLab, SubmitBox } from "@/components/MissionWidgets";
import Link from "next/link";

export default async function MissionDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const jar = await cookies();
  const viewer = getSessionUser(jar.get("db_academy")?.value);
  const staff = viewer?.role === "teacher" || viewer?.role === "admin";
  const m = row<{ id: number; course_code: string; course_name: string; title: string; kind: string; brief: string; payload: string; difficulty: number }>(
    "SELECT m.*, c.name AS course_name FROM missions m JOIN courses c ON c.code=m.course_code WHERE m.id=?", id);
  if (!m) return <div className="container-db py-20">Mission not found. <Link href="/missions" className="underline">Back</Link></div>;
  const payload = JSON.parse(m.payload || "{}");
  // Answer-key containment: strip correctness + consequences server-side.
  // The browser receives option ids + text only; verdicts come from /answer.
  const safeOptions = Array.isArray(payload.options)
    ? payload.options.map((o: { id: string; text: string }) => ({ id: o.id, text: o.text }))
    : null;

  return (
    <div className="container-db max-w-3xl py-10">
      <Link href="/missions" className="font-mono-d text-xs uppercase tracking-[0.14em] text-ink-faint hover:text-cobalt">← Mission board</Link>
      <p className="font-mono-d mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-cobalt">{m.course_code} · {m.kind} · Level {m.difficulty}</p>
      <h1 className="font-display mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">{m.title}</h1>
      <div className="mt-5 rounded-2xl border-l-4 border-cobalt bg-panel px-5 py-4 text-[15px] leading-relaxed text-ink-soft">
        <span className="font-mono-d mb-1 block text-[11px] font-bold uppercase tracking-[0.16em] text-ink-faint">Client brief</span>
        {m.brief}
      </div>

      {m.kind === "decision" && safeOptions && (
        <div className="mt-6"><DecisionLab missionId={m.id} options={safeOptions} /></div>
      )}
      {m.kind === "break" && payload.scenario && (
        <div className="mt-6 rounded-2xl border-2 border-ink bg-panel p-6" style={{ boxShadow: "5px 5px 0 #FF6BD6" }}>
          <p className="font-mono-d text-xs font-bold uppercase tracking-[0.18em] text-coral">Break lab — incident</p>
          <p className="mt-3 text-[15px] leading-relaxed">{payload.scenario}</p>
          {staff && <p className="mt-3 rounded-xl bg-lab px-4 py-3 text-sm text-ink-soft">Staff reference: {payload.answer}</p>}
        </div>
      )}

      <div className="mt-6"><SubmitBox missionId={m.id} /></div>
      <p className="font-mono-d mt-4 text-xs text-ink-faint">Flow: SUBMITTED → UNDER_REVIEW → APPROVED → EVIDENCE. Double-click safe (idempotent).</p>
    </div>
  );
}
