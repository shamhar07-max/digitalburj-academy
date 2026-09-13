import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/server/auth.js";
import { all } from "@/server/db.js";
import { ReviewActions } from "@/components/ReviewActions";

export default async function Teacher() {
  const jar = await cookies();
  const user = getSessionUser(jar.get("db_academy")?.value);
  if (!user || (user.role !== "teacher" && user.role !== "admin")) redirect("/login");
  const queue = all<{ id: number; body: string; status: string; created_at: string; mission_title: string; student_name: string; student_email: string }>(
    `SELECT s.id, s.body, s.status, s.created_at, m.title AS mission_title, u.name AS student_name, u.email AS student_email
     FROM submissions s JOIN missions m ON m.id=s.mission_id JOIN users u ON u.id=s.user_id
     WHERE s.status IN ('SUBMITTED','UNDER_REVIEW','RESUBMITTED') ORDER BY s.id`);

  return (
    <div className="container-db max-w-3xl py-10">
      <p className="font-mono-d text-xs font-semibold uppercase tracking-[0.22em] text-ink-faint">Teacher console</p>
      <h1 className="font-display mt-2 text-3xl font-extrabold">Review queue ({queue.length})</h1>
      <div className="mt-6 space-y-4">
        {queue.length === 0 && <p className="card p-6 text-ink-soft">Queue clear. Nothing awaiting review.</p>}
        {queue.map((s) => (
          <div key={s.id} className="card p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-bold">#{s.id} · {s.mission_title}</span>
              <span className="font-mono-d text-[11px] text-ink-faint">{s.student_name} · {s.status}</span>
            </div>
            <p className="mt-2 rounded-lg bg-lab px-3 py-2 text-sm leading-relaxed">{s.body}</p>
            <ReviewActions id={s.id} />
          </div>
        ))}
      </div>
    </div>
  );
}
