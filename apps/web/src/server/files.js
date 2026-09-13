// Controlled video storage for video evidence. Files live OUTSIDE any public
// directory and are served only through the authed playback route.
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { row } from "./db.js";

export function maxVideoBytes() {
  const v = Number(process.env.MAX_VIDEO_BYTES || 15 * 1024 * 1024);
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : 15 * 1024 * 1024;
}

export function userQuotaBytes() {
  return 100 * 1024 * 1024;
}

export function videoDir() {
  const dbPath = process.env.DB_PATH || join(process.cwd(), "data", "academy.db");
  const stem = basename(dbPath).replace(/\.[^.]+$/, "") || "academy";
  const dir = join(dirname(dbPath), `evidence-video-${stem}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** Sniff container from magic bytes — never trust client MIME. */
export function sniffVideo(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return "video/webm";
  if (buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70) return "video/mp4";
  return null;
}

export function userVideoBytes(userId) {
  const r = row("SELECT COALESCE(SUM(bytes),0) AS n FROM evidence WHERE user_id=? AND kind='video'", userId);
  return Number(r?.n || 0);
}

export function videoPath(evidenceId) {
  return join(videoDir(), `${evidenceId}.bin`);
}

export function saveVideo(evidenceId, buf) {
  writeFileSync(videoPath(evidenceId), buf);
}

export function readVideo(evidenceId) {
  const p = videoPath(evidenceId);
  if (!existsSync(p)) return null;
  return readFileSync(p);
}
