import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionUser } from "@/server/auth.js";
import { row } from "@/server/db.js";
import { deny, audit, requestId, requireRole } from "@/server/guard.js";
import { readVideo, sniffVideo } from "@/server/files.js";

type Ctx = { params: Promise<{ id: string }> };

// Gated playback: owner, teacher, admin only. Cookies authenticate the <video> tag
// (same-origin), so no URL is ever shareable to outsiders.
export async function GET(_req: Request, { params }: Ctx) {
  const rid = requestId();
  const jar = await cookies();
  const user = getSessionUser(jar.get("db_academy")?.value);
  if (!user) return deny("Login required", 401);
  const { id } = await params;
  const ev = row<{ id: number; user_id: number; kind: string; status: string }>(
    "SELECT id, user_id, kind, status FROM evidence WHERE id=?", id);
  if (!ev || ev.kind !== "video") return NextResponse.json({ error: "Not found" }, { status: 404 });
  const staff = user.role === "teacher" || user.role === "admin";
  if (ev.user_id !== user.id && !staff) return deny("Not yours", 403);
  const buf = readVideo(ev.id);
  if (!buf) return NextResponse.json({ error: "File missing — report to support" }, { status: 410 });
  audit(user.id, "evidence_view", "evidence", ev.id, "", ev.status, rid);
  const mime = sniffVideo(buf) || "video/webm";
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": mime,
      "Content-Length": String(buf.length),
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
