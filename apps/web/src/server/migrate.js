// migrate: schema auto-applies on connect; idempotent ALTERs for existing DBs.
import "./db.js";
import { getDb } from "./db.js";

const db = getDb();
const cols = db.prepare("PRAGMA table_info(users)").all().map((c) => c.name);
if (!cols.includes("language")) {
  db.exec("ALTER TABLE users ADD COLUMN language TEXT NOT NULL DEFAULT 'en'");
  console.log("migrated: users.language");
}
console.log("migrate ok");
