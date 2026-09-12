// Auth: scrypt password hashing (stdlib), opaque session tokens, httpOnly cookies.
import { scryptSync, randomBytes, timingSafeEqual } from "node:crypto";
import { row, run } from "./db.js";

const SESSION_DAYS = 7;

export function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  return `scrypt:${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

export function verifyPassword(password, stored) {
  const parts = String(stored).split(":");
  if (parts[0] !== "scrypt" || !parts[1] || !parts[2]) return false;
  const calc = scryptSync(password, parts[1], 64);
  const b = Buffer.from(parts[2], "hex");
  return calc.length === b.length && timingSafeEqual(calc, b);
}

export function createUser(email, name, password, role = "student") {
  if (row("SELECT id FROM users WHERE email=?", email.toLowerCase())) {
    throw Object.assign(new Error("Email already registered"), { status: 409 });
  }
  const r = run("INSERT INTO users (email, name, password_hash, role) VALUES (?,?,?,?)",
    email.toLowerCase(), name, hashPassword(password), role);
  const u = row("SELECT id, email, name, role, status, language FROM users WHERE id=?", r.lastInsertRowid);
  if (!u) throw new Error("User creation failed");
  return u;
}

export function authenticate(email, password) {
  const u = row("SELECT id, email, name, role, status, language, password_hash FROM users WHERE email=?", email.toLowerCase());
  if (!u || !verifyPassword(password, u.password_hash)) {
    throw Object.assign(new Error("Invalid email or password"), { status: 401 });
  }
  if (u.status !== "ACTIVE") throw Object.assign(new Error("Account is not active"), { status: 403 });
  const { password_hash, ...safe } = u;
  return safe;
}

export function createSession(userId) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400 * 1000).toISOString();
  run("INSERT INTO sessions (token, user_id, expires_at) VALUES (?,?,?)", token, userId, expiresAt);
  return { token, expiresAt };
}

export function getSessionUser(token) {
  if (!token) return null;
  const s = row("SELECT user_id, expires_at FROM sessions WHERE token=?", token);
  if (!s) return null;
  if (new Date(s.expires_at).getTime() < Date.now()) {
    run("DELETE FROM sessions WHERE token=?", token);
    return null;
  }
  return row("SELECT id, email, name, role, status, language FROM users WHERE id=? AND status='ACTIVE'", s.user_id) ?? null;
}

export function destroySession(token) {
  run("DELETE FROM sessions WHERE token=?", token);
}

export const COOKIE = "db_academy";
export function cookieHeader(token, expiresAt) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Expires=${new Date(expiresAt).toUTCString()}${secure}`;
}
export function clearCookieHeader() {
  return `${COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}
