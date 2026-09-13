// Grading worker: safe static checks over submission text (no code execution).
// Runs async after submit; idempotent per submission; infra failure is a
// distinct status and never reported as student failure.
import { row, run } from "./db.js";
import { notify } from "./guard.js";

function checksFor(body) {
  const text = String(body || "");
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const lower = text.toLowerCase();
  const hasSecret = /(sk-[a-z0-9]{8,}|password\s*[:=]\s*\S+|api[_-]?key\s*[:=]\s*\S+)/i.test(text);
  const hasReasoning = /(because|therefore|trade-?off|verify|test|risk|alternative)/i.test(text);
  const hasStructure = text.includes("\n") || text.length > 300;
  return [
    { id: "substance", label: "Substantive reasoning (80+ words)", pass: words >= 80 },
    { id: "judgment", label: "Shows trade-offs or verification thinking", pass: hasReasoning },
    { id: "structure", label: "Organized beyond one paragraph", pass: hasStructure },
    { id: "hygiene", label: "No secrets pasted into submission", pass: !hasSecret },
  ];
}

export function gradeSubmission(submissionId) {
  const existing = row("SELECT id, status FROM grading_runs WHERE submission_id=?", submissionId);
  if (existing && existing.status !== "QUEUED") return existing;
  try {
    if (!existing) {
      run("INSERT INTO grading_runs (submission_id, status) VALUES (?, 'QUEUED')", submissionId);
    }
    run("UPDATE grading_runs SET status='RUNNING', updated_at=datetime('now') WHERE submission_id=?", submissionId);
    const sub = row("SELECT user_id, body FROM submissions WHERE id=?", submissionId);
    if (!sub) throw new Error("submission vanished mid-grade");
    const checks = checksFor(sub.body);
    const passed = checks.filter((c) => c.pass).length;
    const score = Math.round((passed / checks.length) * 100);
    const status = passed === checks.length ? "PASSED" : "FAILED";
    run("UPDATE grading_runs SET status=?, score=?, checks=?, updated_at=datetime('now') WHERE submission_id=?",
      status, score, JSON.stringify(checks), submissionId);
    // Machine stage done → teacher stage. Compare-and-swap: only advance untouched rows.
    run("UPDATE submissions SET status='UNDER_REVIEW', updated_at=datetime('now') WHERE id=? AND status='SUBMITTED'", submissionId);
    notify(sub.user_id, "grading", `Automated checks ${status.toLowerCase()} (${score}%) for submission #${submissionId} — teacher review next.`);
    return row("SELECT * FROM grading_runs WHERE submission_id=?", submissionId);
  } catch (e) {
    run("UPDATE grading_runs SET status='INFRASTRUCTURE_ERROR', error=?, updated_at=datetime('now') WHERE submission_id=?",
      String((e && e.message) || e), submissionId);
    const sub = row("SELECT user_id FROM submissions WHERE id=?", submissionId);
    if (sub) notify(sub.user_id, "grading", `Automated checks hit a platform problem on submission #${submissionId} — your work is preserved, nothing recorded against you.`);
    return row("SELECT * FROM grading_runs WHERE submission_id=?", submissionId);
  }
}

export function enqueueGrading(submissionId) {
  // In-process queue for the single-node stage; swap for a real queue later.
  // setImmediate keeps the HTTP response fast and the grading async.
  setImmediate(() => {
    try { gradeSubmission(submissionId); } catch { /* recorded inside */ }
  });
}
