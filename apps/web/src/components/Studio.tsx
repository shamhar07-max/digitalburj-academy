"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const TRADES = ["restaurant", "logistics", "real-estate", "school", "agency", "consultancy", "ecommerce", "healthcare", "startup", "general"];
const LANGS = ["en", "hinglish", "urdish", "malayalish", "tamglish", "bengalish", "kanglish"];

export function CompanyWidget({ initial }: { initial: { id: number; name: string; trade: string; stage: string }[] }) {
  const [name, setName] = useState("");
  const [trade, setTrade] = useState("general");
  const [msg, setMsg] = useState("");
  const router = useRouter();

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    const res = await fetch("/platform/api/companies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, trade }),
    });
    const data = await res.json();
    if (!res.ok) { setMsg(data.error || "Failed"); return; }
    setName("");
    router.refresh();
  }

  return (
    <div className="card p-6">
      <h2 className="font-display text-lg font-extrabold">My digital company</h2>
      <p className="mt-1 text-sm text-ink-soft">One business you grow course by course — website → database → CRM → automation → AI.</p>
      {initial.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {initial.map((c) => (
            <li key={c.id} className="flex items-center justify-between rounded-xl bg-lab px-3 py-2 text-sm">
              <span className="font-bold">{c.name} <span className="font-mono-d ml-1 text-[11px] font-normal text-ink-faint">{c.trade} · {c.stage}</span></span>
              <span className="font-mono-d text-[11px] text-tealx">● ACTIVE</span>
            </li>
          ))}
        </ul>
      ) : (
        <form onSubmit={create} className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name it — e.g. NOVA" maxLength={40}
            className="flex-1 rounded-xl border border-hair bg-lab px-3 py-2 text-sm" />
          <select value={trade} onChange={(e) => setTrade(e.target.value)} className="rounded-xl border border-hair bg-lab px-3 py-2 text-sm font-semibold">
            {TRADES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <button className="rounded-xl bg-cobalt px-4 py-2 text-sm font-bold text-white">Found it</button>
        </form>
      )}
      {msg && <p className="mt-2 text-sm font-semibold text-coral">{msg}</p>}
    </div>
  );
}

export function LanguageWidget({ current }: { current: string }) {
  const [lang, setLang] = useState(current || "en");
  const [msg, setMsg] = useState("");
  const router = useRouter();

  async function save() {
    const res = await fetch("/platform/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language: lang }),
    });
    const data = await res.json();
    setMsg(res.ok ? "Saved. Concepts stay in English; explanations follow your lead." : data.error || "Failed");
    if (res.ok) router.refresh();
  }

  return (
    <div className="card p-6">
      <h2 className="font-display text-lg font-extrabold">Explanation language</h2>
      <p className="mt-1 text-sm text-ink-soft">Understand in your language. Execute in English — terms, docs and clients stay English.</p>
      <div className="mt-3 flex gap-2">
        <select value={lang} onChange={(e) => setLang(e.target.value)} className="flex-1 rounded-xl border border-hair bg-lab px-3 py-2 text-sm font-semibold">
          {LANGS.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        <button onClick={save} className="rounded-xl bg-navy px-4 py-2 text-sm font-bold text-white">Save</button>
      </div>
      {msg && <p className="mt-2 text-sm font-semibold text-cobalt">{msg}</p>}
    </div>
  );
}
