import Link from "next/link";

export default function Home() {
  return (
    <div className="container-db py-14">
      <p className="font-mono-d text-xs font-semibold uppercase tracking-[0.24em] text-coral">DB-Academy · Learn by building</p>
      <h1 className="font-display mt-5 max-w-3xl text-5xl font-extrabold leading-[1.02] tracking-tight sm:text-6xl">
        Real problems first. <span className="text-cobalt">Technology second.</span>
      </h1>
      <p className="mt-5 max-w-2xl text-lg leading-relaxed text-ink-soft">
        Most courses hand you chapters and hope. Here you get a client situation with missing
        pieces — a budget that doesn&apos;t fit, requirements that change mid-week, a system that
        breaks the night before review. You work through it the way working engineers do:
        investigate, try, build, break, fix, explain, defend, ship. A teacher reads every
        submission. Nothing counts until it&apos;s verified.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/register" className="rounded-xl bg-cobalt px-6 py-3 font-bold text-white hover:opacity-90">Start as student</Link>
        <Link href="/missions" className="rounded-xl border-2 border-ink px-6 py-3 font-bold hover:border-cobalt hover:text-cobalt">Browse missions</Link>
      </div>

      <div className="mt-12 grid gap-4 sm:grid-cols-3">
        {[["Brief", "A client situation, not a chapter title. Incomplete on purpose — reality doesn't ship with a answer key."],
          ["Build → Break → Fix", "Working systems, deliberate failures, real debugging. Your NOVA company grows with every course."],
          ["Defend → Evidence", "Explain every why to a human reviewer. Verified skill lands in your evidence wallet — not watch history."]].map(([t, d]) => (
          <div key={t} className="card p-6">
            <h2 className="font-display text-xl font-extrabold">{t}</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">{d}</p>
          </div>
        ))}
      </div>

      <div className="mt-12 rounded-2xl border-2 border-ink bg-panel p-8">
        <p className="font-mono-d text-[11px] tracking-[0.22em] text-ink-faint">WHERE THIS LEADS · ONE LOGIN</p>
        <h2 className="font-display mt-3 text-2xl font-extrabold">Learning is the entrance. Work is the destination.</h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-soft">
          Finish missions, collect verified evidence, and the same account carries you forward:
          your capability shows up in the talent directory employers actually read, and the jobs
          board posts real work — internships, apprenticeships, project contracts — where evidence
          decides shortlists. Clients track their own projects in the portal. Nobody promises you
          a job or a visa. We promise the work will be real, the review will be human, and the
          record will be honest.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/courses" className="rounded-xl border-2 border-ink px-5 py-2.5 text-sm font-bold hover:border-cobalt hover:text-cobalt">Courses</Link>
          <Link href="/talent" className="rounded-xl border-2 border-ink px-5 py-2.5 text-sm font-bold hover:border-cobalt hover:text-cobalt">Talent directory</Link>
          <Link href="/jobs" className="rounded-xl border-2 border-ink px-5 py-2.5 text-sm font-bold hover:border-cobalt hover:text-cobalt">Jobs board</Link>
          <Link href="/projects" className="rounded-xl border-2 border-ink px-5 py-2.5 text-sm font-bold hover:border-cobalt hover:text-cobalt">Client portal</Link>
        </div>
      </div>
    </div>
  );
}
