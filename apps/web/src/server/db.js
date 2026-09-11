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
  return getDb().prepare(sql).get(...params);
}

export function all(sql, ...params) {
  return getDb().prepare(sql).all(...params);
}

export function run(sql, ...params) {
  const r = getDb().prepare(sql).run(...params);
  return { changes: Number(r.changes), lastInsertRowid: Number(r.lastInsertRowid) };
}

export function dbPath() {
  return DB_PATH;
}
