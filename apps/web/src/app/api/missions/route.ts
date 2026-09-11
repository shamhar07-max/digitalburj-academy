import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionUser } from "@/server/auth.js";
import { all } from "@/server/db.js";

export async function GET() {
  const jar = await cookies();
  getSessionUser(jar.get("db_academy")?.value); // public listing; identity unused
  const missions = all(
    "SELECT m.id, m.course_code, m.title, m.kind, m.brief, m.difficulty, m.version, c.name AS course_name FROM missions m JOIN courses c ON c.code=m.course_code WHERE m.status='PUBLISHED' ORDER BY m.id"
  );
  return NextResponse.json({ missions });
}
