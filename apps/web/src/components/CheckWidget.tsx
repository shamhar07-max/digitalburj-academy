"use client";

import { useState } from "react";

export function CheckWidget({ question, options, answer, why }: { question: string; options: string[]; answer: number; why: string }) {
  const [picked, setPicked] = useState<number | null>(null);
  return (
    <div className="rounded-2xl border-2 border-ink bg-panel p-5" style={{ boxShadow: "4px 4px 0 #18B8D6" }}>
      <p className="font-mono-d text-xs font-bold uppercase tracking-[0.16em] text-cobalt">Knowledge check</p>
      <p className="mt-2 font-bold">{question}</p>
      <div className="mt-3 grid gap-2">
        {options.map((o, i) => (
          <button
            key={o}
            onClick={() => setPicked(i)}
            className={`rounded-xl border px-4 py-2.5 text-left text-sm font-semibold transition-colors ${
              picked === null ? "border-hair bg-lab hover:border-cobalt"
              : i === answer ? "border-cobalt bg-cobalt/10"
              : i === picked ? "border-coral bg-coral/10" : "border-hair bg-lab opacity-60"
            }`}
          >
            <span className="font-mono-d mr-2 text-xs text-ink-faint">{String.fromCharCode(65 + i)}.</span> {o}
          </button>
        ))}
      </div>
      {picked !== null && (
        <p className="mt-3 rounded-xl bg-lab px-4 py-3 text-sm">
          <span className="font-bold">{picked === answer ? "✓ Correct." : "✗ Not quite."}</span>{" "}
          <span className="text-ink-soft">{why}</span>
        </p>
      )}
    </div>
  );
}
