import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionUser } from "@/server/auth.js";
import { all } from "@/server/db.js";
import { deny } from "@/server/guard.js";

export async function GET() {
  const jar = await cookies();
  const user = getSessionUser(jar.get("db_academy")?.value);
  if (!user) return deny("Login required", 401);
  const evidence = all(
    `SELECT e.*, m.title AS mission_title, s.name AS skill_name FROM evidence e
     JOIN submissions sub ON sub.id=e.submission_id JOIN missions m ON m.id=sub.mission_id
     JOIN skills s ON s.code=e.skill_code WHERE e.user_id=? ORDER BY e.id DESC`, user.id);
  const skills = all("SELECT sk.code, sk.name, ss.level FROM skills sk LEFT JOIN student_skills ss ON ss.skill_code=sk.code AND ss.user_id=?", user.id);
  const notes = all("SELECT * FROM notifications WHERE user_id=? ORDER BY id DESC LIMIT 10", user.id);
  return NextResponse.json({ evidence, skills, notifications: notes });
}
