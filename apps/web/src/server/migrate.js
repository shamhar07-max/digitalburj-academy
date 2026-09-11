// migrate: ensure schema applied (db.js auto-applies on connect).
import "./db.js";
import { getDb } from "./db.js";
getDb();
console.log("migrate ok");
