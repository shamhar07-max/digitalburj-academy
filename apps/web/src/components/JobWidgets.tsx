"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

async function post(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { ok: res.ok, status: res.status, data: await res.json().catch(() => ({})) };
}

export function ApplyWidget({ jobId }: { jobId: number }) {
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");
  const router = useRouter();
  async function apply(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    const r = await post(`/platform/api/jobs/${jobId}/apply`, { note });
    setMsg(r.ok ? "Applied — the team reviews every application." : (r.data.error || "Failed"));
    if (r.ok) router.refresh();
  }
  return (
    <form onSubmit={apply} className="mt-4 flex gap-2">
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="One line: why you? (login as student)"
        className="min-w-0 flex-1 rounded-lg border border-hair bg-lab px-3 py-2 text-sm" />
      <button className="rounded-lg bg-ink px-4 py-2 text-sm font-bold text-paper">Apply</button>
      {msg && <span className="sr-only" role="status">{msg}</span>}
      {msg && <span aria-hidden className="self-center text-xs text-ink-soft">{msg}</span>}
    </form>
  );
}

export function JobForm() {
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState("project");
  const [description, setDescription] = useState("");
  const [msg, setMsg] = useState("");
  const router = useRouter();
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    const r = await post("/platform/api/jobs", { title, kind, description });
    setMsg(r.ok ? `Posted (#${r.data.id}).` : (r.data.error || "Failed"));
    if (r.ok) { setTitle(""); setDescription(""); router.refresh(); }
  }
  return (
    <form onSubmit={submit} className="card mt-3 grid gap-2 p-4">
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Job title" required className="rounded-lg border border-hair bg-lab px-3 py-2 text-sm" />
      <div className="flex gap-2">
        <select value={kind} onChange={(e) => setKind(e.target.value)} className="rounded-lg border border-hair bg-lab px-3 py-2 text-sm">
          <option value="project">project</option><option value="internship">internship</option>
          <option value="apprenticeship">apprenticeship</option><option value="role">role</option>
        </select>
        <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short description" className="min-w-0 flex-1 rounded-lg border border-hair bg-lab px-3 py-2 text-sm" />
        <button className="rounded-lg bg-ink px-4 py-2 text-sm font-bold text-paper">Post</button>
      </div>
      {msg && <p role="status" className="text-xs text-ink-soft">{msg}</p>}
    </form>
  );
}

export function CloseJob({ id, closed }: { id: number; closed: boolean }) {
  const router = useRouter();
  async function toggle() {
    const res = await fetch("/platform/api/jobs", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status: closed ? "OPEN" : "CLOSED" }) });
    if (res.ok) router.refresh();
  }
  return <button onClick={toggle} className="rounded-lg border border-hair px-3 py-1.5 text-xs font-bold">{closed ? "Reopen" : "Close"}</button>;
}
