import Link from "next/link";

export default function Home() {
  return (
    <section className="container-db py-14">
      <p className="font-mono-d text-xs font-semibold uppercase tracking-[0.24em] text-coral">DB-Academy · Learn by building</p>
      <h1 className="font-display mt-5 max-w-3xl text-5xl font-extrabold leading-[1.02] tracking-tight sm:text-6xl">
        Real problems first. <span className="text-cobalt">Technology second.</span>
      </h1>
      <p className="mt-5 max-w-xl text-lg text-ink-soft">
        Missions, break labs, submissions, teacher review and a verifiable evidence wallet —
        not video → quiz → certificate.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/register" className="rounded-xl bg-cobalt px-6 py-3 font-bold text-white hover:opacity-90">Start as student</Link>
        <Link href="/missions" className="rounded-xl border-2 border-ink px-6 py-3 font-bold hover:border-cobalt hover:text-cobalt">Browse missions</Link>
      </div>
      <div className="mt-12 grid gap-4 sm:grid-cols-3">
        {[["Brief", "A client situation, not a chapter title."], ["Build → Break → Fix", "Working systems, deliberate failures, real debugging."], ["Defend → Evidence", "Explain every why. Verified skill, not watch history."]].map(([t, d]) => (
          <div key={t} className="card p-6">
            <h2 className="font-display text-xl font-extrabold">{t}</h2>
            <p className="mt-2 text-sm text-ink-soft">{d}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
