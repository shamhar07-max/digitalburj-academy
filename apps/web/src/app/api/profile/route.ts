import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionUser } from "@/server/auth.js";
import { run } from "@/server/db.js";
import { deny, audit, requestId } from "@/server/guard.js";

const LANGS = ["en", "hinglish", "urdish", "malayalish", "tamglish", "bengalish", "kanglish"];

// Preferred explanation language. Technical terminology stays English.
export async function PATCH(req: Request) {
  const rid = requestId();
  const jar = await cookies();
  const user = getSessionUser(jar.get("db_academy")?.value);
  if (!user) return deny("Login required", 401);
  const { language } = await req.json().catch(() => ({}));
  if (!LANGS.includes(language)) {
    return NextResponse.json({ error: `language must be one of ${LANGS.join(", ")}` }, { status: 422 });
  }
  run("UPDATE users SET language=? WHERE id=?", language, user.id);
  audit(user.id, "language_set", "user", user.id, user.language, language, rid);
  return NextResponse.json({ ok: true, language });
}
