import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionUser } from "@/server/auth.js";
import { all, run, row } from "@/server/db.js";
import { deny, audit, requestId, requireRole } from "@/server/guard.js";

const SCOPES = new Set(["platform", "role", "org", "user"]);
// Falsy-role-target normalization: a target must be a role, org id or user id.
function normalizeTarget(scope: string, target: string) {
  if (scope === "platform") return "";
  if (scope === "role") {
    if (!["student", "teacher", "admin", "client"].includes(target)) return null;
    return target;
  }
  const n = Number(target);
  if (!Number.isInteger(n) || n <= 0) return null;
  return String(n);
}

export async function GET() {
  const jar = await cookies();
  const user = getSessionUser(jar.get("db_academy")?.value);
  if (!user) return deny("Login required", 401);
  // Admin reads the full catalog (they manage flags); everyone else gets only
  // their effective flags (the public read path for gated pages).
  if (user.role === "admin") {
    const catalog = all("SELECT key, enabled, scope, target, reason FROM feature_flags ORDER BY key");
    return NextResponse.json({ flags: catalog.map((f) => ({ ...f, enabled: !!f.enabled })) });
  }
  // Effective flags for this caller.
  const flags = all("SELECT key, enabled, scope, target, reason FROM feature_flags ORDER BY key");
  const org = row<{ org_id: number | null }>("SELECT org_id FROM memberships WHERE user_id=? AND status='ACTIVE' ORDER BY org_id LIMIT 1", user.id);
  const orgId = org?.org_id ? String(org.org_id) : "";
  const mine = flags.filter((f) =>
    f.scope === "platform" ||
    (f.scope === "role" && f.target === user.role) ||
    (f.scope === "org" && orgId && f.target === orgId) ||
    (f.scope === "user" && f.target === String(user.id)));
  return NextResponse.json({ flags: mine.map((f) => ({ key: f.key, enabled: !!f.enabled, reason: f.reason })) });
}

export async function POST(req: Request) {
  const rid = requestId();
  const jar = await cookies();
  const user = getSessionUser(jar.get("db_academy")?.value);
  if (!requireRole(user, "admin")) return deny("Admin only", 403);
  const { key, enabled, scope, target, reason } = await req.json().catch(() => ({}));
  if (!key || !/^[a-z0-9_.:-]+$/.test(String(key))) {
    return NextResponse.json({ error: "Flag key must be lowercase alnum, dot, underscore, colon or dash" }, { status: 422 });
  }
  const sc = scope || "platform";
  if (!SCOPES.has(sc)) return NextResponse.json({ error: "Scope must be platform, role, org or user" }, { status: 422 });
  const normalized = normalizeTarget(sc, String(target || ""));
  if (normalized === null) return NextResponse.json({ error: "Bad target for scope" }, { status: 422 });
  const before = row<{ enabled: number }>("SELECT enabled FROM feature_flags WHERE key=?", key);
  run(`INSERT INTO feature_flags (key, enabled, scope, target, reason, updated_at) VALUES (?,?,?,?,?,datetime('now'))
       ON CONFLICT(key) DO UPDATE SET enabled=excluded.enabled, scope=excluded.scope, target=excluded.target, reason=excluded.reason, updated_at=datetime('now')`,
    key, enabled ? 1 : 0, sc, normalized, String(reason || "").slice(0, 500));
  audit(user!.id, "feature_flag", "feature_flag", key, before?.enabled ? "1" : "0", enabled ? "1" : "0", rid);
  return NextResponse.json({ ok: true });
}