// DB layer: node:sqlite (dev). Postgres-compatible SQL; swap driver for production.
import { DatabaseSync } from "node:sqlite";
import { readFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || join(here, "..", "..", "data", "academy.db");

let db = null;

/** @returns {import("node:sqlite").DatabaseSync} */
export function getDb() {
  if (!db) {
    mkdirSync(dirname(DB_PATH), { recursive: true });
    db = new DatabaseSync(DB_PATH);
    db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
    db.exec(readFileSync(join(here, "schema.sql"), "utf8"));
  }
  return db;
}

export function row(sql, ...params) {
  const r = getDb().prepare(sql).get(...params);
  // node:sqlite returns null-prototype objects, which Next.js refuses to
  // serialize into Client Components. Normalize at the boundary, once.
  return r ? { ...r } : r;
}

export function all(sql, ...params) {
  return getDb().prepare(sql).all(...params).map((r) => ({ ...r }));
}

export function run(sql, ...params) {
  const r = getDb().prepare(sql).run(...params);
  return { changes: Number(r.changes), lastInsertRowid: Number(r.lastInsertRowid) };
}

export function dbPath() {
  return DB_PATH;
}

/** Atomic multi-record writes. A crash mid-flow rolls back — never half-approve. */
export function transaction(fn) {
  const conn = getDb();
  conn.exec("BEGIN IMMEDIATE");
  try {
    const out = fn();
    conn.exec("COMMIT");
    return out;
  } catch (e) {
    try { conn.exec("ROLLBACK"); } catch { /* already rolled back */ }
    throw e;
  }
}
