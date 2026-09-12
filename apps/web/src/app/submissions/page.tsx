import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/server/auth.js";
import { all } from "@/server/db.js";
import Link from "next/link";

const STATUS_STYLE: Record<string, string> = {
  SUBMITTED: "bg-cobalt/10 text-cobalt",
  UNDER_REVIEW: "bg-cobalt/10 text-cobalt",
  CHANGES_REQUESTED: "bg-coral/10 text-coral",
  RESUBMITTED: "bg-cobalt/10 text-cobalt",
  APPROVED: "bg-cobalt/10 text-cobalt",
  EVIDENCE_CREATED: "bg-tealx/10 text-tealx",
};

export default async function Submissions() {
  const jar = await cookies();
  const user = getSessionUser(jar.get("db_academy")?.value);
  if (!user) redirect("/login");
  const subs = all<{ id: number; mission_id: number; mission_title: string; status: string; score: number | null; updated_at: string; gstatus: string | null; gscore: number | null }>(
    `SELECT s.id, s.mission_id, s.status, s.score, s.updated_at, m.title AS mission_title,
            g.status AS gstatus, g.score AS gscore FROM submissions s
     JOIN missions m ON m.id=s.mission_id LEFT JOIN grading_runs g ON g.submission_id=s.id
     WHERE s.user_id=? ORDER BY s.id DESC`, user.id);
  const reviews = all<{ submission_id: number; decision: string; feedback: string; created_at: string }>(
    `SELECT r.submission_id, r.decision, r.feedback, r.created_at FROM reviews r
     JOIN submissions s ON s.id=r.submission_id WHERE s.user_id=? ORDER BY r.id DESC`, user.id);
  const fb = new Map(reviews.map((r) => [r.submission_id, r]));

  return (
    <div className="container-db max-w-3xl py-10">
      <p className="font-mono-d text-xs font-semibold uppercase tracking-[0.22em] text-ink-faint">My work</p>
      <h1 className="font-display mt-2 text-3xl font-extrabold">Submissions</h1>
      <div className="mt-6 space-y-3">
        {subs.length === 0 && <p className="card p-6 text-ink-soft">Nothing submitted yet. <Link href="/missions" className="font-bold text-cobalt underline">Pick a mission</Link>.</p>}
        {subs.map((s) => (
          <div key={s.id} className="card p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Link href={`/missions/${s.mission_id}`} className="font-bold hover:text-cobalt">#{s.id} · {s.mission_title}</Link>
              <span className="flex items-center gap-2">
                {s.gstatus && s.gstatus !== "QUEUED" && (
                  <span className="font-mono-d rounded-full bg-panel-deep px-2.5 py-1 text-[10px] font-bold text-ink-faint">AUTO {s.gstatus}{typeof s.gscore === "number" ? ` ${s.gscore}%` : ""}</span>
                )}
                <span className={`rounded-full px-2.5 py-1 font-mono-d text-[10px] font-bold ${STATUS_STYLE[s.status] ?? ""}`}>{s.status.replace(/_/g, " ")}</span>
              </span>
            </div>
            {fb.get(s.id) && (
              <p className="mt-2 rounded-lg bg-lab px-3 py-2 text-sm text-ink-soft">
                <span className="font-bold">Reviewer:</span> {fb.get(s.id)!.feedback || fb.get(s.id)!.decision}
                {typeof s.score === "number" && <span className="font-mono-d ml-2 text-xs">· {s.score}%</span>}
              </p>
            )}
            {s.status === "CHANGES_REQUESTED" && (
              <p className="mt-2 text-sm">Revise your reasoning, then <Link href={`/missions/${s.mission_id}`} className="font-bold text-cobalt underline">resubmit on the mission page</Link>.</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
