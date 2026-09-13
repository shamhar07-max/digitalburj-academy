import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionUser } from "@/server/auth.js";
import { all } from "@/server/db.js";
import { deny, capabilityBand } from "@/server/guard.js";

// Talent export contract: the shape jobs/talent will consume. Own record only.
export async function GET() {
  const jar = await cookies();
  const user = getSessionUser(jar.get("db_academy")?.value);
  if (!user) return deny("Login required", 401);
  const skills = all<{ code: string; name: string; level: number }>(
    `SELECT sk.code, sk.name, COALESCE(ss.level,0) AS level FROM skills sk
     LEFT JOIN student_skills ss ON ss.skill_code=sk.code AND ss.user_id=?`, user.id);
  const evidence = all<{ id: number; skill: string; mission: string | null; title: string; at: string }>(
    `SELECT e.id, s.name AS skill, m.title AS mission, e.title, e.created_at AS at FROM evidence e
     JOIN skills s ON s.code=e.skill_code
     LEFT JOIN submissions sub ON sub.id=e.submission_id LEFT JOIN missions m ON m.id=sub.mission_id
     WHERE e.user_id=? AND e.status='VERIFIED' ORDER BY e.id`, user.id);
  const recovered = all<{ id: number }>(
    `SELECT DISTINCT s.id FROM submissions s WHERE s.user_id=? AND s.status IN ('APPROVED','EVIDENCE_CREATED')
     AND EXISTS (SELECT 1 FROM reviews r WHERE r.submission_id=s.id AND r.decision='REQUEST_CHANGES')`, user.id);
  const companies = all<{ name: string; trade: string; stage: string }>(
    "SELECT name, trade, stage FROM companies WHERE user_id=? ORDER BY id", user.id);
  return NextResponse.json({
    version: "talent-export-v1",
    user: { id: user.id, name: user.name, language: user.language },
    skills: skills.filter((s) => s.level > 0).map((s) => ({ ...s, band: capabilityBand(s.level) })),
    evidence,
    recoveries: recovered.length,
    companies,
    verify: `talent.digitalburj.com/DB-${String(user.id).padStart(6, "0")}`,
  });
}
