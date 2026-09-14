"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

export function UpdateForm({ projectId }: { projectId: number }) {
  const [body, setBody] = useState("");
  const [needs, setNeeds] = useState(false);
  const [msg, setMsg] = useState("");
  const router = useRouter();
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    const res = await fetch(`/platform/api/projects/${projectId}/updates`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body, needs_approval: needs }),
    });
    const data = await res.json().catch(() => ({}));
    setMsg(res.ok ? "Update posted." : (data.error || "Failed"));
    if (res.ok) { setBody(""); setNeeds(false); router.refresh(); }
  }
  return (
    <form onSubmit={submit} className="card mt-4 grid gap-2 p-4">
      <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} required
        placeholder="What changed, what it means, what happens next…" className="rounded-lg border border-hair bg-lab px-3 py-2 text-sm" />
      <label className="flex items-center gap-2 text-xs font-semibold text-ink-soft">
        <input type="checkbox" checked={needs} onChange={(e) => setNeeds(e.target.checked)} /> Needs client approval
      </label>
      <button className="w-fit rounded-lg bg-ink px-4 py-2 text-sm font-bold text-paper">Post update</button>
      {msg && <p role="status" className="text-xs text-ink-soft">{msg}</p>}
    </form>
  );
}

export function ApproveButtons({ projectId, updateId }: { projectId: number; updateId: number }) {
  const [msg, setMsg] = useState("");
  const router = useRouter();
  async function decide(decision: string) {
    const res = await fetch(`/platform/api/projects/${projectId}/updates`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ update_id: updateId, decision }),
    });
    const data = await res.json().catch(() => ({}));
    setMsg(res.ok ? `Recorded: ${decision.toLowerCase().replace("_", " ")}.` : (data.error || "Failed"));
    if (res.ok) router.refresh();
  }
  return (
    <span className="flex items-center gap-2">
      <button onClick={() => decide("APPROVED")} className="rounded-lg bg-emerald px-3 py-1.5 text-xs font-bold text-white">Approve</button>
      <button onClick={() => decide("CHANGES_REQUESTED")} className="rounded-lg border border-hair px-3 py-1.5 text-xs font-bold">Request changes</button>
      {msg && <span role="status" className="text-xs text-ink-soft">{msg}</span>}
    </span>
  );
}

export function ProvisionForm() {
  const [f, setF] = useState({ email: "", name: "", password: "", role: "client", company: "" });
  const [msg, setMsg] = useState("");
  const router = useRouter();
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    const res = await fetch("/platform/api/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
    const data = await res.json().catch(() => ({}));
    setMsg(res.ok ? `Provisioned ${data.user.email} as ${data.user.role}.` : (data.error || "Failed"));
    if (res.ok) router.refresh();
  }
  const inp = "rounded-lg border border-hair bg-lab px-3 py-2 text-sm";
  return (
    <form onSubmit={submit} className="card mt-3 grid gap-2 p-4 sm:grid-cols-2">
      <input value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="email" required type="email" className={inp} />
      <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="full name" required className={inp} />
      <input value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} placeholder="password (8+)" required type="password" className={inp} />
      <select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })} className={inp}>
        <option value="client">client</option><option value="student">student</option>
        <option value="teacher">teacher</option><option value="admin">admin</option>
      </select>
      <input value={f.company} onChange={(e) => setF({ ...f, company: e.target.value })} placeholder="company (for clients)" className={inp} />
      <button className="rounded-lg bg-ink px-4 py-2 text-sm font-bold text-paper sm:col-span-2">Provision user</button>
      {msg && <p role="status" className="text-xs text-ink-soft sm:col-span-2">{msg}</p>}
    </form>
  );
}

export function InquiryActions({ id, current }: { id: number; current: string }) {
  const router = useRouter();
  async function set(status: string) {
    const res = await fetch("/platform/api/studio/inquiries", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }) });
    if (res.ok) router.refresh();
  }
  return (
    <span className="flex gap-1">
      {["REVIEWING", "ACCEPTED", "DECLINED"].filter((s) => s !== current).map((s) => (
        <button key={s} onClick={() => set(s)} className="rounded-lg border border-hair px-2 py-1 text-[11px] font-bold">{s}</button>
      ))}
    </span>
  );
}

export function OrgForm() {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [msg, setMsg] = useState("");
  const router = useRouter();
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    const res = await fetch("/platform/api/orgs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, slug }) });
    const data = await res.json().catch(() => ({}));
    setMsg(res.ok ? `Organization #${data.id} created; you are OWNER.` : (data.error || "Failed"));
    if (res.ok) { setName(""); setSlug(""); router.refresh(); }
  }
  return (
    <form onSubmit={submit} className="card mt-3 flex flex-wrap gap-2 p-4">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Organization name" required className="min-w-0 flex-1 rounded-lg border border-hair bg-lab px-3 py-2 text-sm" />
      <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="slug" required pattern="[a-z0-9-]{2,40}" className="rounded-lg border border-hair bg-lab px-3 py-2 text-sm" />
      <button className="rounded-lg bg-ink px-4 py-2 text-sm font-bold text-paper">Create</button>
      {msg && <p role="status" className="w-full text-xs text-ink-soft">{msg}</p>}
    </form>
  );
}

export function AiConsole() {  const [agent, setAgent] = useState("tutor");
  const [prompt, setPrompt] = useState("");
  const [out, setOut] = useState("");
  const [msg, setMsg] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("Working…"); setOut("");
    const res = await fetch("/platform/api/ai/gateway", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ agent, prompt, purpose: "admin console" }) });
    const data = await res.json().catch(() => ({}));
    if (res.ok) { setOut(data.text); setMsg(""); }
    else setMsg(data.error || "Failed");
  }
  return (
    <form onSubmit={submit} className="card mt-3 grid gap-2 p-4">
      <div className="flex gap-2">
        <select value={agent} onChange={(e) => setAgent(e.target.value)} className="rounded-lg border border-hair bg-lab px-3 py-2 text-sm">
          <option value="tutor">tutor</option><option value="reviewer">reviewer</option>
          <option value="researcher">researcher</option><option value="pm">pm</option>
        </select>
        <input value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Ask the scoped agent…" required className="min-w-0 flex-1 rounded-lg border border-hair bg-lab px-3 py-2 text-sm" />
        <button className="rounded-lg bg-ink px-4 py-2 text-sm font-bold text-paper">Run</button>
      </div>
      {msg && <p role="status" className="text-xs text-ink-soft">{msg}</p>}
      {out && <pre className="whitespace-pre-wrap rounded-lg bg-lab p-3 text-xs">{out}</pre>}
    </form>
  );
}

export function AssuranceActions({ evidenceId }: { evidenceId: number }) {
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState("");
  const router = useRouter();
  async function decide(decision: string) {
    setMsg("");
    const res = await fetch("/platform/api/assurance", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ evidence_id: evidenceId, decision, reason }),
    });
    const data = await res.json().catch(() => ({}));
    setMsg(res.ok ? `Recorded: ${decision}.` : (data.error || "Failed"));
    if (res.ok) router.refresh();
  }
  return (
    <span className="mt-2 block">
      <span className="flex gap-2">
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Verification reason (10+ chars, required)"
          className="min-w-0 flex-1 rounded-lg border border-hair bg-lab px-3 py-1.5 text-xs" />
        <button onClick={() => decide("VERIFIED")} className="rounded-lg bg-emerald px-3 py-1.5 text-xs font-bold text-white">Verify</button>
        <button onClick={() => decide("REJECTED")} className="rounded-lg border border-hair px-3 py-1.5 text-xs font-bold">Reject</button>
      </span>
      {msg && <span role="status" className="mt-1 block text-xs text-ink-soft">{msg}</span>}
    </span>
  );
}

export function EvidenceWallet({ evidence, claimable, skills }: {
  evidence: { id: number; skill: string; mission: string | null; title: string; status: string; at: string }[];
  claimable: { id: number; title: string }[];
  skills: { code: string; name: string }[];
}) {
  const [sub, setSub] = useState("");
  const [skill, setSkill] = useState(skills[0]?.code || "");
  const [note, setNote] = useState("");
  const [ext, setExt] = useState({ title: "", url: "", skill: skills[0]?.code || "", note: "" });
  const [msg, setMsg] = useState("");
  const [msg2, setMsg2] = useState("");
  const router = useRouter();
  const chip: Record<string, string> = {
    CANDIDATE: "bg-amberx/15 text-amber-deep",
    PENDING_REVIEW: "bg-cobalt/10 text-cobalt",
    VERIFIED: "bg-emerald/10 text-emerald",
    REJECTED: "bg-coral/10 text-coral",
    REVOKED: "bg-coral/10 text-coral",
  };
  async function claim(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    const res = await fetch("/platform/api/evidence", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ submission_id: Number(sub), skill_code: skill, note }),
    });
    const data = await res.json().catch(() => ({}));
    setMsg(res.ok ? `Claimed as candidate #${data.id} — independent review next.` : (data.error || "Failed"));
    if (res.ok) router.refresh();
  }
  return (
    <div className="card p-6">
      <h2 className="font-display text-lg font-extrabold">Evidence wallet</h2>
      <div className="mt-3 space-y-2">
        {evidence.map((e) => (
          <div key={e.id} className="flex items-center justify-between gap-2 text-sm">
            <span>#{e.id} {e.skill} — {e.mission || e.title}</span>
            <span className={`font-mono-d rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] ${chip[e.status] || chip.CANDIDATE}`}>{e.status.replace("_", " ")}</span>
          </div>
        ))}
        {evidence.length === 0 && <p className="text-sm text-ink-soft">No evidence yet — approved work lands here for verification.</p>}
      </div>
      {claimable.length > 0 && (
        <form onSubmit={claim} className="mt-4 grid gap-2 border-t border-hair pt-4">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-ink-faint">Claim evidence from approved work</p>
          <select value={sub} onChange={(e) => setSub(e.target.value)} required className="rounded-lg border border-hair bg-lab px-3 py-2 text-sm">
            <option value="">Choose approved submission…</option>
            {claimable.map((c) => <option key={c.id} value={c.id}>#{c.id} {c.title}</option>)}
          </select>
          <div className="flex gap-2">
            <select value={skill} onChange={(e) => setSkill(e.target.value)} className="min-w-0 flex-1 rounded-lg border border-hair bg-lab px-3 py-2 text-sm">
              {skills.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
            </select>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="What does it prove?" className="min-w-0 flex-1 rounded-lg border border-hair bg-lab px-3 py-2 text-sm" />
          </div>
          <button className="w-fit rounded-lg bg-ink px-4 py-2 text-sm font-bold text-paper">Submit claim</button>
          {msg && <p role="status" className="text-xs text-ink-soft">{msg}</p>}
        </form>
      )}
      <form onSubmit={async (e) => {
        e.preventDefault();
        setMsg2("");
        const res = await fetch("/platform/api/evidence", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(ext),
        });
        const data = await res.json().catch(() => ({}));
        setMsg2(res.ok ? `Documented as candidate #${data.id} — independent review next.` : (data.error || "Failed"));
        if (res.ok) router.refresh();
      }} className="mt-4 grid gap-2 border-t border-hair pt-4">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-ink-faint">Or document outside work</p>
        <input value={ext.title} onChange={(e) => setExt({ ...ext, title: e.target.value })} placeholder="What did you build? (e.g. Inventory tracker for a shop)" required
          className="rounded-lg border border-hair bg-lab px-3 py-2 text-sm" />
        <div className="flex gap-2">
          <select value={ext.skill} onChange={(e) => setExt({ ...ext, skill: e.target.value })} className="rounded-lg border border-hair bg-lab px-3 py-2 text-sm">
            {skills.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
          </select>
          <input value={ext.url} onChange={(e) => setExt({ ...ext, url: e.target.value })} placeholder="Checkable link (repo, demo, post)" required type="url"
            className="min-w-0 flex-1 rounded-lg border border-hair bg-lab px-3 py-2 text-sm" />
        </div>
        <input value={ext.note} onChange={(e) => setExt({ ...ext, note: e.target.value })} placeholder="What does it prove, and what was YOUR role? (30+ chars)" required
          className="rounded-lg border border-hair bg-lab px-3 py-2 text-sm" />
        <button className="w-fit rounded-lg bg-ink px-4 py-2 text-sm font-bold text-paper">Document work</button>
        {msg2 && <p role="status" className="text-xs text-ink-soft">{msg2}</p>}
      </form>
    </div>
  );
}

const SIXTY = 60;

export function VideoRecorder({ skills }: { skills: { code: string; name: string }[] }) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [rec, setRec] = useState<MediaRecorder | null>(null);
  const [secs, setSecs] = useState(SIXTY);
  const [blobUrl, setBlobUrl] = useState("");
  const [blob, setBlob] = useState<Blob | null>(null);
  const [skill, setSkill] = useState(skills[0]?.code || "");
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const liveRef = useRef<HTMLVideoElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const router = useRouter();

  async function startCamera() {
    setErr("");
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { width: 640 }, audio: true });
      setStream(s);
      if (liveRef.current) { liveRef.current.srcObject = s; liveRef.current.play().catch(() => {}); }
    } catch {
      setErr("Camera unavailable — grant permission, or document the work with a link instead.");
    }
  }

  function stopTracks() {
    stream?.getTracks().forEach((t) => t.stop());
    setStream(null);
  }

  function startRecording() {
    if (!stream) return;
    const mime = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"]
      .find((m) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) || "";
    const chunks: BlobPart[] = [];
    const mr = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    mr.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
    mr.onstop = () => {
      const b = new Blob(chunks, { type: mr.mimeType || "video/webm" });
      setBlob(b);
      setBlobUrl(URL.createObjectURL(b));
      stopTracks();
      if (timerRef.current) clearInterval(timerRef.current);
    };
    mr.start(500);
    setRec(mr);
    setSecs(SIXTY);
    timerRef.current = setInterval(() => {
      setSecs((s) => {
        if (s <= 1) { mr.stop(); setRec(null); return 0; }
        return s - 1;
      });
    }, 1000);
  }

  function retake() {
    setBlob(null);
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    setBlobUrl("");
    setSecs(SIXTY);
    startCamera();
  }

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    if (!blob) return;
    setBusy(true);
    setMsg("");
    try {
      const fd = new FormData();
      fd.set("skill_code", skill);
      fd.set("title", title);
      fd.set("note", note);
      fd.set("video", blob, "evidence.webm");
      const res = await fetch("/platform/api/evidence", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      setMsg(res.ok ? `Recorded as candidate #${data.id} — independent review next.` : (data.error || "Upload failed"));
      if (res.ok) router.refresh();
    } catch {
      setMsg("Upload failed — check connection and retry.");
    }
    setBusy(false);
  }

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    stream?.getTracks().forEach((t) => t.stop());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="card mt-4 border-t border-hair p-6 pt-4">
      <h3 className="font-display text-base font-extrabold">Record 60-second video evidence</h3>
      <p className="mt-1 text-xs text-ink-soft">Explain what you built, show it working, say what broke. Sixty seconds, one take-ish. A reviewer watches every second.</p>
      {!stream && !blobUrl && (
        <button onClick={startCamera} className="mt-3 rounded-lg bg-ink px-4 py-2 text-sm font-bold text-paper">Start camera</button>
      )}
      {err && <p role="alert" className="mt-2 text-xs font-semibold text-coral">{err}</p>}
      {stream && !blobUrl && (
        <div className="mt-3">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video ref={liveRef} muted playsInline className="w-full max-w-sm rounded-xl border border-hair bg-black" />
          <div className="mt-2 flex items-center gap-3">
            {!rec
              ? <button onClick={startRecording} className="rounded-lg bg-coral px-4 py-2 text-sm font-bold text-white">● Record (60s max)</button>
              : <button onClick={() => { rec.stop(); setRec(null); }} className="rounded-lg bg-ink px-4 py-2 text-sm font-bold text-paper">■ Stop ({secs}s left)</button>}
            {rec && <span className="font-mono-d text-xs font-bold text-coral">● REC {secs}s</span>}
          </div>
        </div>
      )}
      {blobUrl && (
        <form onSubmit={upload} className="mt-3 grid gap-2">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video src={blobUrl} controls playsInline className="w-full max-w-sm rounded-xl border border-hair bg-black" />
          <input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="What does this video prove? (5+ chars)"
            className="rounded-lg border border-hair bg-lab px-3 py-2 text-sm" />
          <div className="flex gap-2">
            <select value={skill} onChange={(e) => setSkill(e.target.value)} className="rounded-lg border border-hair bg-lab px-3 py-2 text-sm">
              {skills.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
            </select>
            <input value={note} onChange={(e) => setNote(e.target.value)} required placeholder="Your role + what to watch for (10+ chars)"
              className="min-w-0 flex-1 rounded-lg border border-hair bg-lab px-3 py-2 text-sm" />
          </div>
          <div className="flex gap-2">
            <button disabled={busy} className="rounded-lg bg-ink px-4 py-2 text-sm font-bold text-paper disabled:opacity-50">
              {busy ? "Uploading…" : "Submit video evidence"}
            </button>
            <button type="button" onClick={retake} className="rounded-lg border border-hair px-4 py-2 text-sm font-bold">Retake</button>
          </div>
          {msg && <p role="status" className="text-xs text-ink-soft">{msg}</p>}
        </form>
      )}
    </div>
  );
}

export function TaskForm({ projectId, people }: { projectId: number; people: { id: number; name: string }[] }) {
  const [title, setTitle] = useState("");
  const [assignee, setAssignee] = useState("");
  const [msg, setMsg] = useState("");
  const router = useRouter();
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    const res = await fetch(`/platform/api/projects/${projectId}/tasks`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, assignee_id: assignee ? Number(assignee) : null }),
    });
    const data = await res.json().catch(() => ({}));
    setMsg(res.ok ? `Task #${data.id} created.` : (data.error || "Failed"));
    if (res.ok) { setTitle(""); setAssignee(""); router.refresh(); }
  }
  return (
    <form onSubmit={submit} className="mt-2 flex flex-wrap items-center gap-2">
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Task title (3+ chars)" required
        className="min-w-0 flex-1 rounded-lg border border-hair bg-lab px-3 py-1.5 text-sm" />
      <select value={assignee} onChange={(e) => setAssignee(e.target.value)} className="rounded-lg border border-hair bg-lab px-3 py-1.5 text-sm">
        <option value="">Unassigned</option>
        {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      <button className="rounded-lg bg-ink px-3 py-1.5 text-xs font-bold text-paper">Add task</button>
      {msg && <span role="status" className="text-xs text-ink-soft">{msg}</span>}
    </form>
  );
}

export function TaskActions({ projectId, taskId, current }: { projectId: number; taskId: number; current: string }) {
  const router = useRouter();
  async function set(status: string) {
    const res = await fetch(`/platform/api/projects/${projectId}/tasks`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task_id: taskId, status }),
    });
    if (res.ok) router.refresh();
  }
  const next = current === "TODO" ? "IN_PROGRESS" : current === "IN_PROGRESS" ? "DONE" : current === "BLOCKED" ? "IN_PROGRESS" : "";
  return (
    <span className="flex gap-1">
      {next && <button onClick={() => set(next)} className="rounded-lg bg-emerald px-2 py-1 text-[11px] font-bold text-white">→ {next.replace("_", " ")}</button>}
    </span>
  );
}

export function ChangeForm({ projectId }: { projectId: number }) {
  const [field, setField] = useState("title");
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState("");
  const router = useRouter();
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    const res = await fetch(`/platform/api/projects/${projectId}/changes`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ field, proposed_value: value, reason }),
    });
    const data = await res.json().catch(() => ({}));
    setMsg(res.ok ? `Change request #${data.id} — waiting on the client.` : (data.error || "Failed"));
    if (res.ok) { setValue(""); setReason(""); router.refresh(); }
  }
  return (
    <form onSubmit={submit} className="mt-2 grid gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <select value={field} onChange={(e) => setField(e.target.value)} className="rounded-lg border border-hair bg-lab px-3 py-1.5 text-sm">
          <option value="title">title</option><option value="status">status</option><option value="health">health</option>
        </select>
        <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="Proposed value" required
          className="min-w-0 flex-1 rounded-lg border border-hair bg-lab px-3 py-1.5 text-sm" />
      </div>
      <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why? (10+ chars — required)" required
        className="rounded-lg border border-hair bg-lab px-3 py-1.5 text-sm" />
      <div className="flex items-center gap-2">
        <button className="rounded-lg bg-ink px-3 py-1.5 text-xs font-bold text-paper">Submit change request</button>
        {msg && <span role="status" className="text-xs text-ink-soft">{msg}</span>}
      </div>
    </form>
  );
}

export function ChangeActions({ projectId, requestId, current }: { projectId: number; requestId: number; current: string }) {
  const [msg, setMsg] = useState("");
  const router = useRouter();
  async function decide(decision: string) {
    setMsg("");
    const res = await fetch(`/platform/api/projects/${projectId}/changes`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ request_id: requestId, decision }),
    });
    const data = await res.json().catch(() => ({}));
    setMsg(res.ok ? "" : (data.error || "Failed"));
    if (res.ok) router.refresh();
  }
  if (current !== "PREVIEW_SUBMITTED") return (
    <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-ink-faint">{current.replace("_", " ")}</span>
  );
  return (
    <span className="flex items-center gap-2">
      <button onClick={() => decide("APPROVED")} className="rounded-lg bg-emerald px-3 py-1 text-xs font-bold text-white">Approve</button>
      <button onClick={() => decide("REJECTED")} className="rounded-lg border border-hair px-3 py-1 text-xs font-bold">Reject</button>
      {msg && <span role="status" className="text-xs text-coral">{msg}</span>}
    </span>
  );
}

export function FlagForm() {
  const [f, setF] = useState({ key: "", enabled: true, scope: "platform", target: "", reason: "" });
  const [msg, setMsg] = useState("");
  const router = useRouter();
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    const res = await fetch("/platform/api/flags", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
    const data = await res.json().catch(() => ({}));
    setMsg(res.ok ? `Flag ${f.key} saved.` : (data.error || "Failed"));
    if (res.ok) { setF({ ...f, key: "", reason: "" }); router.refresh(); }
  }
  return (
    <form onSubmit={submit} className="mt-3 grid gap-2 sm:grid-cols-4">
      <input value={f.key} onChange={(e) => setF({ ...f, key: e.target.value })} placeholder="feature.gate_1" required pattern="[a-z0-9_.:-]{2,60}"
        className="rounded-lg border border-hair bg-lab px-3 py-2 text-sm" />
      <select value={f.scope} onChange={(e) => setF({ ...f, scope: e.target.value })} className="rounded-lg border border-hair bg-lab px-3 py-2 text-sm">
        <option value="platform">platform</option><option value="role">role</option><option value="org">org</option><option value="user">user</option>
      </select>
      <input value={f.target} onChange={(e) => setF({ ...f, target: e.target.value })} placeholder="target (role/org id/user id)" className="rounded-lg border border-hair bg-lab px-3 py-2 text-sm" />
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1 text-xs font-semibold text-ink-soft">
          <input type="checkbox" checked={f.enabled} onChange={(e) => setF({ ...f, enabled: e.target.checked })} /> On
        </label>
        <button className="rounded-lg bg-ink px-4 py-2 text-sm font-bold text-paper">Save</button>
      </div>
      <input value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} placeholder="why this flag exists" className="rounded-lg border border-hair bg-lab px-3 py-2 text-sm sm:col-span-4" />
      {msg && <p role="status" className="text-xs text-ink-soft sm:col-span-4">{msg}</p>}
    </form>
  );
}
