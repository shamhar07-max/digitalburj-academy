"use client";

import { useState } from "react";

type SafeOption = { id: string; text: string };
type Verdict = { correct: boolean; consequence: string; explain: string };

// Decision Lab: choose → server verdict. Correctness never ships to the browser in advance.
export function DecisionLab({ missionId, options }: { missionId: number; options: SafeOption[] }) {
  const [picked, setPicked] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [busy, setBusy] = useState(false);
  async function pick(id: string) {
    setPicked(id);
    setVerdict(null);
    setBusy(true);
    try {
      const res = await fetch(`/platform/api/missions/${missionId}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ option_id: id }),
      });
      const data = await res.json();
      if (res.ok) setVerdict(data);
    } catch { /* verdict stays empty on network failure */ }
    setBusy(false);
  }
  return (
    <div className="rounded-2xl border-2 border-ink bg-panel p-6" style={{ boxShadow: "5px 5px 0 #18B8D6" }}>
      <p className="font-mono-d text-xs font-bold uppercase tracking-[0.18em] text-cobalt">Decision lab — choose, then live with it</p>
      <div className="mt-4 grid gap-2.5">
        {options.map((o) => (
          <button
            key={o.id}
            onClick={() => pick(o.id)}
            disabled={busy}
            className={`rounded-xl border px-4 py-3 text-left text-sm font-semibold transition-colors ${
              picked === o.id && verdict
                ? verdict.correct
                  ? "border-cobalt bg-cobalt/10 text-ink"
                  : "border-coral bg-coral/10 text-ink"
                : "border-hair bg-lab text-ink-soft hover:border-cobalt hover:text-ink"
            }`}
          >
            <span className="font-mono-d mr-2 text-xs text-ink-faint">{o.id}.</span> {o.text}
          </button>
        ))}
      </div>
      {picked && verdict && (
        <div className="mt-4 rounded-xl bg-lab px-4 py-3 text-sm leading-relaxed">
          <p className="font-bold">{verdict.correct ? "✓ That holds up." : "✗ That breaks in production."} <span className="font-normal text-ink-soft">{verdict.consequence}</span></p>
          <p className="mt-2 text-ink-soft">{verdict.explain}</p>
        </div>
      )}
      {picked && !verdict && (
        <p className="mt-4 text-sm text-ink-soft">{busy ? "Checking…" : "Log in to check your judgment."}</p>
      )}
    </div>
  );
}

// Submit box with idempotency key (double-click safe by design).
export function SubmitBox({ missionId }: { missionId: number }) {
  const [body, setBody] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setMsg("");
    const key = (globalThis.crypto?.randomUUID?.() ?? String(Date.now())) as string;
    const res = await fetch(`/platform/api/missions/${missionId}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": key },
      body: JSON.stringify({ body }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) { setMsg(data.error || "Submission failed"); return; }
    setMsg(data.duplicate ? `Already received as submission #${data.submission.id}.` : `Submitted as #${data.submission.id} — queued for review.`);
    setBody("");
  }

  return (
    <div className="rounded-2xl border border-hair bg-panel p-6">
      <p className="font-mono-d text-xs font-bold uppercase tracking-[0.18em] text-ink-faint">Deliver — reasoning + artifact</p>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={5}
        placeholder="Explain your approach, decisions, and what you verified… (min 20 chars)"
        className="mt-3 w-full rounded-xl border border-hair bg-lab px-3 py-2.5 text-sm"
      />
      {msg && <p className="mt-2 text-sm font-semibold text-cobalt">{msg}</p>}
      <button onClick={submit} disabled={busy} className="mt-3 rounded-xl bg-cobalt px-6 py-2.5 text-sm font-bold text-white disabled:opacity-50">
        {busy ? "Submitting…" : "Submit for review"}
      </button>
    </div>
  );
}
