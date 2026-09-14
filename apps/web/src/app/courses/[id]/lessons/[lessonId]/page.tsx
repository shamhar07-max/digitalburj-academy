import Link from "next/link";
import { DB00 } from "@/content/academy/db-00";
import { CheckWidget } from "@/components/CheckWidget";

export async function generateStaticParams() {
  return DB00.modules.flatMap((m) => m.lessons.map((l) => ({ id: DB00.id, lessonId: l.id })));
}

export default async function LessonView({ params }: { params: Promise<{ id: string; lessonId: string }> }) {
  const { id, lessonId } = await params;
  const lesson = DB00.modules.flatMap((m) => m.lessons).find((l) => l.id === lessonId);
  if (id !== "DB-00" || !lesson) return <div className="container-db py-20">Lesson not found.</div>;

  return (
    <div className="container-db max-w-3xl py-10">
      <Link href={`/courses/${id}`} className="font-mono-d text-xs uppercase tracking-[0.14em] text-ink-faint hover:text-cobalt">← DB-00</Link>
      <p className="font-mono-d mt-4 rounded-xl border-l-4 border-coral bg-panel px-5 py-4 text-[15px] font-semibold leading-relaxed" style={{ borderLeftColor: "#FF6BD6" }}>
        <span className="mb-1 block text-[11px] font-bold uppercase tracking-[0.16em] text-ink-faint">Cold open</span>
        {lesson.coldOpen}
      </p>
      <h1 className="font-display mt-5 text-3xl font-extrabold tracking-tight sm:text-4xl">{lesson.title}</h1>
      <p className="mt-3 border-l-4 border-cobalt bg-panel px-5 py-3 text-[15px] text-ink-soft" style={{ borderLeftColor: "#2EE6FF" }}>{lesson.why}</p>

      <h2 className="font-display mt-8 text-xl font-extrabold">The concept, short</h2>
      <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-ink-soft">
        {lesson.concept.map((p, i) => <p key={i}>{p}</p>)}
      </div>

      <h2 className="font-display mt-8 text-xl font-extrabold">See it happen</h2>
      <p className="mt-3 rounded-2xl border border-hair bg-panel p-5 text-[15px] leading-relaxed">{lesson.example}</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-hair bg-panel p-5">
          <p className="font-mono-d text-[11px] font-bold uppercase tracking-[0.14em] text-cobalt">Your exercise</p>
          <p className="mt-2 text-sm leading-relaxed">{lesson.exercise}</p>
        </div>
        <div className="rounded-2xl border border-hair bg-panel p-5">
          <p className="font-mono-d text-[11px] font-bold uppercase tracking-[0.14em] text-coral">What breaks</p>
          <p className="mt-2 text-sm leading-relaxed">{lesson.failure}</p>
        </div>
      </div>

      <h2 className="font-display mt-8 text-xl font-extrabold">Common mistakes</h2>
      <ul className="mt-3 space-y-2">
        {lesson.mistakes.map((m) => (
          <li key={m} className="flex gap-2 rounded-xl border border-hair bg-panel px-4 py-2.5 text-sm text-ink-soft"><span className="font-bold text-coral">✗</span>{m}</li>
        ))}
      </ul>

      <div className="mt-6">
        <CheckWidget question={lesson.check.question} options={lesson.check.options} answer={lesson.check.answer} why={lesson.check.why} />
      </div>

      <div className="mt-6 rounded-2xl border-2 border-ink bg-panel p-5" style={{ boxShadow: "4px 4px 0 #18B8D6" }}>
        <p className="font-mono-d text-[11px] font-bold uppercase tracking-[0.14em] text-tealx">Evidence for this lesson</p>
        <p className="mt-1.5 text-sm font-semibold">{lesson.evidence}</p>
        {lesson.recall && <p className="font-mono-d mt-2 text-xs text-ink-faint">Recall: {lesson.recall}</p>}
      </div>
    </div>
  );
}
