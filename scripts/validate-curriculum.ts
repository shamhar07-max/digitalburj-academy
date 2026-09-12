// Curriculum validator: schema, references, prereq graph, duplicates, skill refs.
// Writes docs/curriculum/COURSE_CATALOG.md. Exit non-zero on error.
import { writeFileSync } from "node:fs";
import { CATALOG } from "../apps/web/src/content/academy/catalog.js";
import { DB00 } from "../apps/web/src/content/academy/db-00.js";
import { SKILL_IDS } from "../apps/web/src/content/academy/skills.js";
import { SKILL_EDGES } from "../apps/web/src/content/academy/graph.js";
import type { Course } from "../apps/web/src/content/academy/types.js";

const errors: string[] = [];
const warns: string[] = [];
const err = (m: string) => errors.push(m);
const warn = (m: string) => warns.push(m);

const full: Record<string, Course> = { "DB-00": DB00 };
const courses: Course[] = CATALOG.map((c) => (full[c.id] ? { ...c, modules: full[c.id].modules } : c));

// 1. unique course IDs
const ids = courses.map((c) => c.id);
for (const id of new Set(ids)) {
  if (ids.filter((x) => x === id).length > 1) err(`duplicate course id ${id}`);
}
// 2. prereqs exist + acyclic
const idSet = new Set(ids);
for (const c of courses) {
  for (const p of c.prerequisites) {
    if (!idSet.has(p)) err(`${c.id}: unknown prerequisite ${p}`);
  }
}
const visit = (id: string, stack: string[]): boolean => {
  if (stack.includes(id)) { err(`prereq cycle: ${[...stack, id].join(" → ")}`); return true; }
  const c = courses.find((x) => x.id === id);
  let bad = false;
  for (const p of c?.prerequisites ?? []) bad = visit(p, [...stack, id]) || bad;
  return bad;
};
ids.forEach((id) => visit(id, []));
// 3. unique outcomes
const outs = courses.flatMap((c) => c.outcomes.map((o) => `${c.id}::${o}`));
const outVals = outs.map((o) => o.split("::")[1]);
for (const o of new Set(outVals)) {
  const who = outs.filter((x) => x.endsWith(`::${o}`)).map((x) => x.split("::")[0]);
  if (who.length > 1) warn(`duplicate outcome "${o.slice(0, 50)}…" in ${who.join(",")}`);
}
// 4. skills valid + required course fields
const skillSet = new Set(SKILL_IDS);
for (const c of courses) {
  for (const s of c.skills) if (!skillSet.has(s)) err(`${c.id}: unknown skill ${s}`);
  if (!c.assessment || !c.finalProject) err(`${c.id}: missing assessment/finalProject`);
  if (!c.evidence.length) err(`${c.id}: no evidence defined`);
  if (!c.modules.length) err(`${c.id}: no modules`);
  for (const n of c.next) if (!idSet.has(n)) err(`${c.id}: unknown next course ${n}`);
  for (const m of c.modules) {
    if (!m.objective) err(`${c.id}/${m.id}: missing objective`);
    for (const l of m.lessons ?? []) {
      for (const f of ["coldOpen", "why", "concept", "example", "exercise", "evidence"] as const) {
        const v = (l as Record<string, unknown>)[f];
        if (!v || (Array.isArray(v) && !v.length)) err(`${c.id}/${l.id}: empty ${f}`);
      }
      if (!l.check || l.check.options.length !== 4) err(`${c.id}/${l.id}: check needs 4 options`);
      if (l.check && (l.check.answer < 0 || l.check.answer > 3)) err(`${c.id}/${l.id}: answer out of range`);
      if (!l.mistakes.length) err(`${c.id}/${l.id}: no mistakes listed`);
    }
  }
}
// 5. DB-00 completeness (batch-1 bar)
const db00lessons = DB00.modules.flatMap((m) => m.lessons);
if (db00lessons.length < 12) err(`DB-00 has only ${db00lessons.length} full lessons (min 12)`);

// lesson id uniqueness
const lids = courses.flatMap((c) => c.modules.flatMap((m) => (m.lessons ?? []).map((l) => l.id)));
for (const id of new Set(lids)) {
  if (lids.filter((x) => x === id).length > 1) err(`duplicate lesson id ${id}`);
}
// 6. skill graph integrity
const skillSet2 = new Set(SKILL_IDS);
for (const [a, b] of SKILL_EDGES) {
  if (!skillSet2.has(a)) err(`graph: unknown skill ${a}`);
  if (!skillSet2.has(b)) err(`graph: unknown skill ${b}`);
  if (a === b) err(`graph: self-loop ${a}`);
}
const gids = new Set(SKILL_EDGES.flat());
const untaught = [...skillSet2].filter((s) => !gids.has(s) && !courses.some((c) => c.skills.includes(s)));
if (untaught.length) warn(`skills outside graph+courses: ${untaught.join(",")}`);

// write generated catalog
const totalLessons = lids.length;
const totalModules = courses.reduce((n, c) => n + c.modules.length, 0);
const catalog = `# COURSE CATALOG (generated — do not hand-edit)\n\n- Courses: ${courses.length} (${Object.keys(full).length} with full lesson content)\n- Modules: ${totalModules}\n- Full lessons: ${totalLessons}\n- Generated: ${new Date().toISOString().slice(0, 10)}\n\n${courses.map((c) => `## ${c.id} — ${c.title}\n${c.audience} · ${c.difficulty} · ${c.durationWeeks}w · prereq: ${c.prerequisites.join(", ") || "none"} · v${c.version}\nOutcomes: ${c.outcomes.join(" | ")}\nNext: ${c.next.join(", ") || "—"}\n`).join("\n")}`;
writeFileSync(new URL("../docs/curriculum/COURSE_CATALOG.md", import.meta.url), catalog);

console.log(`courses=${courses.length} modules=${totalModules} lessons=${totalLessons} warnings=${warns.length}`);
for (const w of warns) console.log("WARN " + w);
if (errors.length) {
  for (const e of errors) console.log("ERROR " + e);
  process.exit(1);
}
console.log("curriculum: VALID");
