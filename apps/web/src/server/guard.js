// RBAC + audit + notify. Frontend role is presentation only — routes re-verify here.
import { NextResponse } from "next/server";
import { run } from "./db.js";
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

export function audit(actorId, action, entity, entityId = "", before = "", after = "", rid = "") {
  run("INSERT INTO audit_logs (actor_id, action, entity, entity_id, before_state, after_state, request_id) VALUES (?,?,?,?,?,?,?)",
    actorId, action, entity, String(entityId), before, after, rid);
}

export function notify(userId, kind, text) {
  run("INSERT INTO notifications (user_id, kind, text) VALUES (?,?,?)", userId, kind, text);
}

/** Read session user from request cookies (route handlers). */
export async function sessionFromRequest(req, getSessionUser) {
  const token = req.cookies.get("db_academy")?.value;
  return getSessionUser(token);
}
