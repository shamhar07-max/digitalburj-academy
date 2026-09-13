// RBAC + audit + notify. Frontend role is presentation only — routes re-verify here.
import { NextResponse } from "next/server";
import { run, row } from "./db.js";
import { randomUUID } from "node:crypto";

export function requestId() {
  return randomUUID().slice(0, 8);
}

export function deny(message = "Forbidden", status = 403) {
  return NextResponse.json({ error: message }, { status });
}

export function requireRole(user, ...roles) {
  return !!user && roles.includes(user.role);
}

export function audit(actorId, action, entity, entityId = "", before = "", after = "", rid = "", ip = "") {
  run("INSERT INTO audit_logs (actor_id, action, entity, entity_id, before_state, after_state, request_id, ip) VALUES (?,?,?,?,?,?,?,?)",
    actorId, action, entity, String(entityId), before, after, rid, String(ip || "").slice(0, 64));
}

export function notify(userId, kind, text) {
  // Dedupe: same event within the hour notifies once (retries must not double-notify).
  const dup = row("SELECT id FROM notifications WHERE user_id=? AND kind=? AND text=? AND created_at > datetime('now','-1 hour')",
    userId, kind, text);
  if (dup) return;
  run("INSERT INTO notifications (user_id, kind, text) VALUES (?,?,?)", userId, kind, text);
}

// Error hygiene: known statuses pass through; 500s log server-side and return a
// generic message + request id. DB internals never reach clients.
export function fail(rid, e, context = "request") {
  const status = e && typeof e.status === "number" ? e.status : 500;
  if (status !== 500) return NextResponse.json({ error: e.message }, { status });
  console.error(`[${rid}] ${context}:`, e);
  return NextResponse.json({ error: "Something went wrong — the failure was logged", request_id: rid }, { status: 500 });
}

// Per-account lockout (in-memory, single-node; move to Redis with Postgres).
const fails = new Map();
const LOCK_WINDOW = 15 * 60 * 1000;
const LOCK_AFTER = 5;
export function recordFail(email) {
  const k = String(email || "").toLowerCase();
  const f = fails.get(k) || { count: 0, first: Date.now() };
  if (Date.now() - f.first > LOCK_WINDOW) { fails.set(k, { count: 1, first: Date.now() }); return; }
  f.count += 1;
  fails.set(k, f);
}
export function checkLocked(email) {
  const f = fails.get(String(email || "").toLowerCase());
  if (!f) return false;
  if (Date.now() - f.first > LOCK_WINDOW) { fails.delete(String(email || "").toLowerCase()); return false; }
  return f.count >= LOCK_AFTER;
}
export function clearFails(email) {
  fails.delete(String(email || "").toLowerCase());
}

// Capability bands: system-computed from verified-work levels. Bands describe,
// reviewers verify — a band is never proof by itself.
export function capabilityBand(level) {
  const l = Number(level) || 0;
  if (l <= 0) return "UNRATED";
  if (l < 25) return "FOUNDATIONAL";
  if (l < 50) return "WORKING";
  if (l < 75) return "INDEPENDENT";
  if (l < 90) return "ADVANCED";
  return "EXPERT";
}

/** Read session user from request cookies (route handlers). */
export async function sessionFromRequest(req, getSessionUser) {
  const token = req.cookies.get("db_academy")?.value;
  return getSessionUser(token);
}

/** Best-effort client IP (single-node; honors proxy header when deployed behind one). */
export function clientIp(req) {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim().slice(0, 64);
  return "local";
}

// In-memory sliding-window limiter (single-node stage; move to Redis with Postgres).
const buckets = new Map();
export function rateLimit(key, limit, windowMs) {
  const now = Date.now();
  const seen = (buckets.get(key) || []).filter((t) => now - t < windowMs);
  if (seen.length >= limit) {
    buckets.set(key, seen);
    return false;
  }
  seen.push(now);
  buckets.set(key, seen);
  return true;
}
export function limited(req, scope, limit, windowMs = 60000) {
  return !rateLimit(`${scope}:${clientIp(req)}`, limit, windowMs);
}
