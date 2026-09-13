import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionUser } from "@/server/auth.js";
import { all, run } from "@/server/db.js";
import { deny, audit, requestId, requireRole } from "@/server/guard.js";

// AI Gateway: scoped agents, audited, least privilege. No key = honest 503, never silent.
const AGENTS = ["tutor", "reviewer", "researcher", "pm"] as const;

export async function POST(req: Request) {
  const rid = requestId();
  const jar = await cookies();
  const user = getSessionUser(jar.get("db_academy")?.value);
  if (!requireRole(user, "teacher", "admin")) return deny("Staff only", 403);
  const { agent, prompt, purpose } = await req.json().catch(() => ({}));
  if (!AGENTS.includes(agent)) return NextResponse.json({ error: `agent must be one of ${AGENTS.join(", ")}` }, { status: 422 });
  if (!prompt || String(prompt).trim().length < 10) return NextResponse.json({ error: "Prompt needs substance (10+ chars)" }, { status: 422 });
  const key = process.env.AI_API_KEY;
  if (!key) {
    run("INSERT INTO ai_requests (user_id, agent, purpose, status, detail) VALUES (?,?,?,?,?)",
      user!.id, agent, String(purpose || "").slice(0, 200), "DENIED", "AI_API_KEY not configured");
    audit(user!.id, "ai_denied", "ai_request", "", agent, "NO_KEY", rid);
    return NextResponse.json({ error: "AI is not configured yet (AI_API_KEY missing). Request logged." }, { status: 503 });
  }
  try {
    const res = await fetch(process.env.AI_API_BASE || "https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: process.env.AI_MODEL || "gpt-4o-mini",
        messages: [
          { role: "system", content: `You are the DigitalBurj ${agent} agent. Be concrete, honest, and never invent credentials, metrics, or guarantees.` },
          { role: "user", content: String(prompt).slice(0, 4000) },
        ],
        max_tokens: 800,
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) throw new Error(`provider ${res.status}`);
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || "";
    const r = run("INSERT INTO ai_requests (user_id, agent, purpose, status, detail) VALUES (?,?,?,?,?)",
      user!.id, agent, String(purpose || "").slice(0, 200), "COMPLETED", `rid=${rid}`);
    audit(user!.id, "ai_complete", "ai_request", r.lastInsertRowid, agent, "COMPLETED", rid);
    return NextResponse.json({ text });
  } catch (e: unknown) {
    const err = e as Error;
    run("INSERT INTO ai_requests (user_id, agent, purpose, status, detail) VALUES (?,?,?,?,?)",
      user!.id, agent, String(purpose || "").slice(0, 200), "ERROR", err.message.slice(0, 300));
    audit(user!.id, "ai_error", "ai_request", "", agent, "ERROR", rid);
    return NextResponse.json({ error: "AI provider failed; logged, nothing charged silently" }, { status: 502 });
  }
}

export async function GET() {
  const jar = await cookies();
  const user = getSessionUser(jar.get("db_academy")?.value);
  if (!requireRole(user, "admin")) return deny("Admin only", 403);
  return NextResponse.json({ requests: all("SELECT * FROM ai_requests ORDER BY id DESC LIMIT 100") });
}
