import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/server/auth.js";
import { all } from "@/server/db.js";

// Failure Passport: every recovered failure, documented — recovery is the credential.
export default async function Passport() {
  const jar = await cookies();
  const user = getSessionUser(jar.get("db_academy")?.value);
  if (!user) redirect("/login");
  const rows = all<{
    sid: number; mission: string; feedback: string; decided: string; score: number | null; at: string;
  }>(`SELECT s.id AS sid, m.title AS mission, r.feedback, r.decision AS decided, r.score, r.created_at AS at
      FROM reviews r JOIN submissions s ON s.id=r.submission_id JOIN missions m ON m.id=s.mission_id
      WHERE s.user_id=? AND r.decision='REQUEST_CHANGES' ORDER BY r.id DESC`, user.id);
  const recovered = all<{ sid: number }>(
    `SELECT DISTINCT s.id AS sid FROM submissions s WHERE s.user_id=? AND s.status IN ('APPROVED','EVIDENCE_CREATED')
     AND EXISTS (SELECT 1 FROM reviews r WHERE r.submission_id=s.id AND r.decision='REQUEST_CHANGES')`, user.id);
  const recSet = new Set(recovered.map((r) => r.sid));

  return (
    <div className="container-db max-w-3xl py-10">
      <p className="font-mono-d text-xs font-semibold uppercase tracking-[0.22em] text-ink-faint">Failure passport</p>
      <h1 className="font-display mt-2 text-3xl font-extrabold">I know how to recover.</h1>
      <p className="mt-3 max-w-xl text-ink-soft">Every entry: what broke, why, what changed, what was learned. Verified recoveries, not hidden mistakes.</p>
      <div className="mt-6 space-y-3">
        {rows.length === 0 && <p className="card p-6 text-sm text-ink-soft">No recorded failures yet. They will come — that is the curriculum working.</p>}
        {rows.map((r, i) => (
          <div key={`${r.sid}-${i}`} className="card p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-bold">#{r.sid} · {r.mission}</span>
              <span className={`font-mono-d rounded-full px-2.5 py-1 text-[10px] font-bold ${recSet.has(r.sid) ? "bg-tealx/15 text-tealx" : "bg-amberx/15 text-amber-deep"}`}>
                {recSet.has(r.sid) ? "● RECOVERED" : "● OPEN"}
              </span>
            </div>
            <p className="mt-2 text-sm text-ink-soft"><span className="font-semibold text-ink">Reviewer note:</span> {r.feedback || "See submission thread."}</p>
            <p className="font-mono-d mt-1.5 text-[11px] text-ink-faint">{r.at.slice(0, 10)}{typeof r.score === "number" ? ` · scored ${r.score}%` : ""}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
