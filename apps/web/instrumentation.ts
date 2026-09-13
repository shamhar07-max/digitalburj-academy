// Boot recovery: a crash between RUNNING and completion must never strand work.
// Stale RUNNING rows (>10 min, i.e. older than any real grading pass) go back to
// QUEUED and are re-driven. Idempotent: gradeSubmission skips non-QUEUED rows.
export const runtime = "nodejs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { getDb } = (await import("./src/server/db.js")) as {
      getDb: () => {
        prepare: (sql: string) => {
          run: (...a: unknown[]) => { changes: unknown };
          all: (...a: unknown[]) => { submission_id: number }[];
        };
      };
    };
    const { gradeSubmission } = (await import("./src/server/grader.js")) as {
      gradeSubmission: (id: number) => unknown;
    };
    try {
      const db = getDb();
      const stale = db
        .prepare(
          "UPDATE grading_runs SET status='QUEUED', error='recovered after restart', updated_at=datetime('now') WHERE status='RUNNING' AND updated_at < datetime('now','-10 minutes')"
        )
        .run();
      if (Number(stale.changes) > 0) console.log(`[boot] requeued ${stale.changes} stale grading runs`);
      const queued = db
        .prepare("SELECT submission_id FROM grading_runs WHERE status='QUEUED' ORDER BY id LIMIT 50")
        .all() as { submission_id: number }[];
      for (const q of queued) {
        try {
          gradeSubmission(q.submission_id);
        } catch (e) {
          console.error("[boot] recovery grading failed:", e);
        }
      }
    } catch (e) {
      console.error("[boot] recovery failed:", e);
    }
  }
}
