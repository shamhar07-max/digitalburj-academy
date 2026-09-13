"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch(`/platform/api/auth/${mode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name, password }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error || "Something went wrong"); return; }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="card mx-auto mt-10 max-w-md space-y-4 p-7">
      <h1 className="font-display text-2xl font-extrabold">{mode === "login" ? "Welcome back" : "Join the Academy"}</h1>
      {mode === "register" && (
        <label className="block text-sm font-semibold">Name
          <input value={name} onChange={(e) => setName(e.target.value)} required className="mt-1 w-full rounded-lg border border-hair bg-lab px-3 py-2.5" />
        </label>
      )}
      <label className="block text-sm font-semibold">Email
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="mt-1 w-full rounded-lg border border-hair bg-lab px-3 py-2.5" />
      </label>
      <label className="block text-sm font-semibold">Password (8+ chars)
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} className="mt-1 w-full rounded-lg border border-hair bg-lab px-3 py-2.5" />
      </label>
      {error && <p className="rounded-lg bg-coral/10 px-3 py-2 text-sm font-semibold text-coral">{error}</p>}
      <button className="w-full rounded-xl bg-cobalt py-3 font-bold text-white hover:opacity-90">
        {mode === "login" ? "Log in" : "Create account"}
      </button>
      {process.env.NEXT_PUBLIC_DEMO_CREDENTIALS === "1" && (
        <p className="font-mono-d text-center text-xs text-ink-faint">demo: student@digitalburj.com · demo1234</p>
      )}
    </form>
  );
}
