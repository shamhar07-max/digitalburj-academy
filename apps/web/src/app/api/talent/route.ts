import { NextResponse } from "next/server";
import { all } from "@/server/db.js";
import { capabilityBand } from "@/server/guard.js";

// Public talent directory: verified capability only. No emails, no unverified claims.
export async function GET() {
  const people = all<{ id: number; name: string }>(
    `SELECT DISTINCT u.id, u.name FROM users u
     JOIN evidence e ON e.user_id=u.id AND e.status='VERIFIED'
     WHERE u.role='student' AND u.status='ACTIVE' ORDER BY u.name`);
  const directory = people.map((p) => {
    const skills = all<{ code: string; name: string; level: number }>(
      `SELECT sk.code, sk.name, ss.level FROM student_skills ss JOIN skills sk ON sk.code=ss.skill_code
       WHERE ss.user_id=? AND ss.level > 0 ORDER BY ss.level DESC`, p.id);
    const banded = skills.map((s) => ({ ...s, band: capabilityBand(s.level) }));
    const evidence = all<{ skill: string; mission: string; at: string }>(
      `SELECT s.name AS skill, m.title AS mission, e.created_at AS at FROM evidence e
       JOIN skills s ON s.code=e.skill_code
       JOIN submissions sub ON sub.id=e.submission_id JOIN missions m ON m.id=sub.mission_id
       WHERE e.user_id=? AND e.status='VERIFIED' ORDER BY e.id DESC`, p.id);
    return { id: p.id, name: p.name, skills: banded, evidence, verified_count: evidence.length };
  });
  return NextResponse.json({ version: "talent-directory-v1", people: directory });
}
