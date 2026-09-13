"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ReviewActions({ id }: { id: number }) {
  const [feedback, setFeedback] = useState("");
  const [score, setScore] = useState("85");
  const [msg, setMsg] = useState("");
  const router = useRouter();

  async function act(decision: "APPROVE" | "REQUEST_CHANGES") {
    setMsg("");
    const res = await fetch("/platform/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ submission_id: id, decision, score: Number(score) || null, feedback }),
    });
    const data = await res.json();
    if (!res.ok) { setMsg(data.error || "Failed"); return; }
    setMsg(decision === "APPROVE" ? `Approved — evidence #${data.evidence_id} created.` : "Changes requested — student notified.");
    router.refresh();
  }

  return (
    <div className="mt-3 border-t border-hair pt-3">
      <textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={2}
        placeholder="Feedback (required for changes)…" className="w-full rounded-lg border border-hair bg-lab px-3 py-2 text-sm" />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <label className="font-mono-d text-xs text-ink-faint">Score
          <input value={score} onChange={(e) => setScore(e.target.value)} className="ml-2 w-16 rounded-lg border border-hair bg-lab px-2 py-1" inputMode="numeric" />
        </label>
        <button onClick={() => act("APPROVE")} className="rounded-lg bg-cobalt px-4 py-2 text-xs font-bold text-white">Approve + evidence</button>
        <button onClick={() => act("REQUEST_CHANGES")} className="rounded-lg border border-hair px-4 py-2 text-xs font-bold hover:border-coral hover:text-coral">Request changes</button>
        {msg && <span className="text-xs font-semibold text-cobalt">{msg}</span>}
      </div>
    </div>
  );
}
