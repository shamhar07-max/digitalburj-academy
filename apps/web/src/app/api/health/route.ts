import { NextResponse } from "next/server";
import { row } from "@/server/db.js";

export async function GET() {
  try {
    const t = row<{ now: string }>("SELECT datetime('now') AS now");
    return NextResponse.json({ ok: true, db: "up", time: t?.now ?? "" });
  } catch {
    return NextResponse.json({ ok: false, db: "down" }, { status: 503 });
  }
}
