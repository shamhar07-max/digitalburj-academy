import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/server/auth.js";
import { all, row } from "@/server/db.js";
import { ProvisionForm, InquiryActions, OrgForm, AiConsole, AssuranceActions } from "@/components/PortalWidgets";
import { JobForm, CloseJob } from "@/components/JobWidgets";

export default async function Admin() {
  const jar = await cookies();
  const user = getSessionUser(jar.get("db_academy")?.value);
  if (!user || user.role !== "admin") redirect("/login");
  const counts = row<{ users: number; subs: number; ev: number; audits: number }>(
    "SELECT (SELECT COUNT(*) FROM users) AS users, (SELECT COUNT(*) FROM submissions) AS subs, (SELECT COUNT(*) FROM evidence) AS ev, (SELECT COUNT(*) FROM audit_logs) AS audits");
  const audits = all<{ id: number; actor_id: number | null; action: string; entity: string; entity_id: string; created_at: string }>(
    "SELECT id, actor_id, action, entity, entity_id, created_at FROM audit_logs ORDER BY id DESC LIMIT 25");
  const inquiries = all<{ id: number; name: string; email: string; idea: string; stage: string; status: string; created_at: string }>(
    "SELECT * FROM studio_inquiries ORDER BY id DESC LIMIT 20");
  const users = all<{ id: number; email: string; name: string; role: string; status: string }>(
    "SELECT id, email, name, role, status FROM users ORDER BY id DESC LIMIT 30");
  const jobs = all<{ id: number; title: string; kind: string; status: string }>(
    "SELECT id, title, kind, status FROM jobs ORDER BY id DESC LIMIT 20");
  const apps = all<{ id: number; job_id: number; user_id: number; status: string; created_at: string }>(
    "SELECT * FROM job_applications ORDER BY id DESC LIMIT 20");
  const orgs = all<{ id: number; name: string; slug: string; status: string }>(
    "SELECT * FROM organizations ORDER BY id DESC LIMIT 20");
  const ai = all<{ id: number; user_id: number; agent: string; status: string; created_at: string }>(
    "SELECT id, user_id, agent, status, created_at FROM ai_requests ORDER BY id DESC LIMIT 15");
  const assurance = all<{ id: number; skill_code: string; status: string; note: string; student: string; mission: string | null; kind: string; title: string; url: string }>(
    `SELECT e.id, e.skill_code, e.status, e.note, e.kind, e.title, e.url, u.name AS student, m.title AS mission FROM evidence e
     JOIN users u ON u.id=e.user_id LEFT JOIN submissions sub ON sub.id=e.submission_id
     LEFT JOIN missions m ON m.id=sub.mission_id
     WHERE e.status IN ('CANDIDATE','PENDING_REVIEW') ORDER BY e.id DESC LIMIT 20`);

  return (
    <div className="container-db max-w-4xl py-10">
      <p className="font-mono-d text-xs font-semibold uppercase tracking-[0.22em] text-ink-faint">Admin control center</p>
      <h1 className="font-display mt-2 text-3xl font-extrabold">System health</h1>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[["Users", counts?.users ?? 0], ["Submissions", counts?.subs ?? 0], ["Evidence", counts?.ev ?? 0], ["Audit rows", counts?.audits ?? 0]].map(([k, v]) => (
          <div key={k as string} className="card p-4 text-center">
            <p className="font-display text-2xl font-extrabold">{v}</p>
            <p className="font-mono-d text-[10px] uppercase tracking-[0.14em] text-ink-faint">{k}</p>
          </div>
        ))}
      </div>
      <h2 className="font-display mt-8 text-xl font-extrabold">Audit trail (latest 25)</h2>
      <div className="card mt-3 overflow-x-auto p-2">
        <table className="w-full font-mono-d text-xs">
          <thead><tr className="text-left text-ink-faint"><th className="px-3 py-2">#</th><th className="px-3 py-2">Actor</th><th className="px-3 py-2">Action</th><th className="px-3 py-2">Entity</th><th className="px-3 py-2">At</th></tr></thead>
          <tbody>
            {audits.map((a) => (
              <tr key={a.id} className="border-t border-hair">
                <td className="px-3 py-2">{a.id}</td><td className="px-3 py-2">{a.actor_id ?? "—"}</td>
                <td className="px-3 py-2 font-bold">{a.action}</td><td className="px-3 py-2">{a.entity} {a.entity_id}</td>
                <td className="px-3 py-2">{a.created_at}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="font-display mt-10 text-xl font-extrabold">Studio inquiries</h2>
      <div className="card mt-3 space-y-3 p-4">
        {inquiries.map((q) => (
          <div key={q.id} className="border-b border-hair pb-3 last:border-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-bold">#{q.id} {q.name} · {q.email} · {q.stage} · <span className="text-cobalt">{q.status}</span></p>
              <InquiryActions id={q.id} current={q.status} />
            </div>
            <p className="mt-1 line-clamp-2 text-xs text-ink-soft">{q.idea}</p>
          </div>
        ))}
        {inquiries.length === 0 && <p className="text-sm text-ink-soft">No inquiries yet — the site studio form posts here.</p>}
      </div>

      <h2 className="font-display mt-10 text-xl font-extrabold">Provision users</h2>
      <ProvisionForm />
      <div className="card mt-3 overflow-x-auto p-2">
        <table className="w-full font-mono-d text-xs">
          <thead><tr className="text-left text-ink-faint"><th className="px-3 py-2">#</th><th className="px-3 py-2">Email</th><th className="px-3 py-2">Name</th><th className="px-3 py-2">Role</th><th className="px-3 py-2">Status</th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-hair">
                <td className="px-3 py-2">{u.id}</td><td className="px-3 py-2">{u.email}</td>
                <td className="px-3 py-2">{u.name}</td><td className="px-3 py-2 font-bold">{u.role}</td>
                <td className="px-3 py-2">{u.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="font-display mt-10 text-xl font-extrabold">Jobs board</h2>
      <JobForm />
      <div className="card mt-3 space-y-2 p-4">
        {jobs.map((j) => (
          <div key={j.id} className="flex items-center justify-between gap-2 border-b border-hair pb-2 text-sm last:border-0">
            <span><b>#{j.id}</b> {j.title} · {j.kind} · <span className="text-cobalt">{j.status}</span></span>
            <CloseJob id={j.id} closed={j.status === "CLOSED"} />
          </div>
        ))}
        {jobs.length === 0 && <p className="text-sm text-ink-soft">No jobs posted yet.</p>}
      </div>
      {apps.length > 0 && (
        <div className="card mt-3 overflow-x-auto p-2">
          <table className="w-full font-mono-d text-xs">
            <thead><tr className="text-left text-ink-faint"><th className="px-3 py-2">App</th><th className="px-3 py-2">Job</th><th className="px-3 py-2">User</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">At</th></tr></thead>
            <tbody>
              {apps.map((a) => (
                <tr key={a.id} className="border-t border-hair">
                  <td className="px-3 py-2">{a.id}</td><td className="px-3 py-2">{a.job_id}</td>
                  <td className="px-3 py-2">{a.user_id}</td><td className="px-3 py-2 font-bold">{a.status}</td>
                  <td className="px-3 py-2">{a.created_at}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="font-display mt-10 text-xl font-extrabold">Organizations</h2>
      <OrgForm />
      <div className="card mt-3 space-y-2 p-4">
        {orgs.map((o) => (
          <p key={o.id} className="text-sm"><b>#{o.id}</b> {o.name} · <span className="font-mono-d text-xs">{o.slug}</span> · {o.status}</p>
        ))}
        {orgs.length === 0 && <p className="text-sm text-ink-soft">No organizations yet.</p>}
      </div>

      <h2 className="font-display mt-10 text-xl font-extrabold">Assurance queue — independent verification</h2>
      <p className="mt-1 text-xs text-ink-soft">Approval ≠ verification. A second reviewer (never the approver) verifies here; the approver is blocked by code.</p>
      <div className="card mt-3 space-y-3 p-4">
        {assurance.map((e) => (
          <div key={e.id} className="border-b border-hair pb-3 last:border-0">
            <p className="text-sm"><b>Evidence #{e.id}</b> · {e.student} · {e.skill_code} · <span className="text-cobalt">{e.status}</span> · {e.mission || e.title}</p>
            {e.kind === "external" && <a href={e.url} target="_blank" rel="noreferrer" className="text-xs text-cobalt underline">{e.url}</a>}
            {e.kind === "video" && (
              <video src={`/platform/api/evidence/${e.id}/video`} controls preload="metadata" playsInline className="mt-2 w-full max-w-md rounded-xl border border-hair bg-black" />
            )}
            <p className="mt-1 text-xs text-ink-soft">{e.note}</p>
            <AssuranceActions evidenceId={e.id} />
          </div>
        ))}
        {assurance.length === 0 && <p className="text-sm text-ink-soft">Queue empty — nothing awaiting independent review.</p>}
      </div>

      <h2 className="font-display mt-10 text-xl font-extrabold">AI gateway</h2>
      <AiConsole />
      {ai.length > 0 && (
        <div className="card mt-3 overflow-x-auto p-2">
          <table className="w-full font-mono-d text-xs">
            <thead><tr className="text-left text-ink-faint"><th className="px-3 py-2">#</th><th className="px-3 py-2">User</th><th className="px-3 py-2">Agent</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">At</th></tr></thead>
            <tbody>
              {ai.map((r) => (
                <tr key={r.id} className="border-t border-hair">
                  <td className="px-3 py-2">{r.id}</td><td className="px-3 py-2">{r.user_id}</td>
                  <td className="px-3 py-2">{r.agent}</td><td className="px-3 py-2 font-bold">{r.status}</td>
                  <td className="px-3 py-2">{r.created_at}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
