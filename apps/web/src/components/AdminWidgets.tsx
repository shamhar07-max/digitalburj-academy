"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function LeadRow({ lead }: { lead: { id: number; name: string; email: string; company: string; interest: string; status: string; created_at: string } }) {
  const router = useRouter();
  async function set(status: string) {
    const res = await fetch("/platform/api/leads", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: lead.id, status }),
    });
    if (res.ok) router.refresh();
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hair pb-2 text-sm last:border-0">
      <span><b>#{lead.id}</b> {lead.name} · {lead.email}{lead.company ? ` · ${lead.company}` : ""} · {lead.interest} · <span className="text-cobalt">{lead.status}</span></span>
      <span className="flex gap-1">
        {["CONTACTED", "WON", "LOST"].filter((s) => s !== lead.status).map((s) => (
          <button key={s} onClick={() => set(s)} className="rounded-lg border border-hair px-2 py-1 text-[11px] font-bold">{s}</button>
        ))}
      </span>
    </div>
  );
}
