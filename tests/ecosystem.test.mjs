// Ecosystem tests: health/headers, versioning, studio intake, jobs, client portal,
// AI gateway denial, orgs — plus 403 walls. Temp DB + real server, own file.
import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const WEB = fileURLToPath(new URL("../apps/web", import.meta.url));

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

async function waitFor(base, ms = 30000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      const r = await fetch(`${base}/platform/api/health`);
      if (r.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("server never became healthy");
}

function client(base) {
  let cookie = "";
  async function call(method, p, body, headers = {}) {
    const res = await fetch(`${base}${p}`, {
      method,
      headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const set = res.headers.get("set-cookie");
    if (set) cookie = set.split(";")[0];
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}
    return { status: res.status, json, headers: res.headers };
  }
  return {
    post: (p, b, h) => call("POST", p, b, h),
    patch: (p, b, h) => call("PATCH", p, b, h),
    del: (p) => call("DELETE", p),
    get: (p) => call("GET", p),
    jar: () => cookie,
  };
}

describe("ecosystem slice", () => {
  let child, base, dbPath;
  const tag = Date.now();

  before(async () => {
    const port = await freePort();
    base = `http://127.0.0.1:${port}`;
    dbPath = path.join(os.tmpdir(), `db-eco-test-${port}.db`);
    const seed = spawn(process.execPath, ["src/server/seed.js"], {
      cwd: WEB, env: { ...process.env, DB_PATH: dbPath, ALLOW_DEMO_SEED: "1" }, stdio: "ignore",
    });
    await new Promise((res) => seed.on("exit", res));
    child = spawn("npm", ["run", "start"], {
      cwd: WEB, env: { ...process.env, DB_PATH: dbPath, PORT: String(port), MAX_VIDEO_BYTES: "4096" }, stdio: "ignore",
    });
    await waitFor(base);
  });

  after(() => { try { child.kill("SIGKILL"); } catch {} });

  it("health + security headers", async () => {
    const anon = client(base);
    const h = await anon.get("/platform/api/health");
    assert.equal(h.status, 200);
    assert.equal(h.json.ok, true);
    assert.equal(h.headers.get("x-frame-options"), "DENY");
    assert.ok((h.headers.get("content-security-policy") || "").includes("frame-ancestors"));
  });

  it("submissions pin mission version", async () => {
    const s = client(base);
    const email = `v${tag}@test.dev`;
    await s.post("/platform/api/auth/register", { email, name: "V", password: "password123" });
    const before = await (await fetch(`${base}/platform/api/missions`)).json();
    const m = before.missions[0];
    const r = await s.post(`/platform/api/missions/${m.id}/submit`, { body: "word ".repeat(100) }, { "Idempotency-Key": `v-${tag}` });
    assert.equal(r.status, 201);
    assert.equal(r.json.submission.mission_version, m.version);
  });

  it("studio inquiry: public submit, admin review, student wall", async () => {
    const anon = client(base);
    const bad = await anon.post("/platform/api/studio/inquiries", { name: "F", email: "nope", idea: "short" });
    assert.equal(bad.status, 422);
    const good = await anon.post("/platform/api/studio/inquiries", {
      name: "Founder", email: "f@test.dev",
      idea: "A marketplace for spare industrial parts with escrow settlement and dispute windows.",
      stage: "idea", budget: "<10k",
    });
    assert.equal(good.status, 201);
    const wall = await anon.get("/platform/api/studio/inquiries");
    assert.equal(wall.status, 403);
    const admin = client(base);
    await admin.post("/platform/api/auth/login", { email: "admin@digitalburj.com", password: "demo1234" });
    const list = await admin.get("/platform/api/studio/inquiries");
    assert.equal(list.status, 200);
    assert.ok(list.json.inquiries.some((q) => q.id === good.json.id));
    const upd = await admin.patch("/platform/api/studio/inquiries", { id: good.json.id, status: "REVIEWING" });
    assert.equal(upd.status, 200);
  });

  it("jobs: post, list, apply once, close", async () => {
    const admin = client(base);
    await admin.post("/platform/api/auth/login", { email: "admin@digitalburj.com", password: "demo1234" });
    const posted = await admin.post("/platform/api/jobs", { title: `Test gig ${tag}`, kind: "project", description: "d" });
    assert.equal(posted.status, 201);
    const anon = client(base);
    const list = await anon.get("/platform/api/jobs");
    assert.ok(list.json.jobs.some((j) => j.id === posted.json.id));
    const nope = await anon.post(`/platform/api/jobs/${posted.json.id}/apply`, { note: "x" });
    assert.equal(nope.status, 403);
    const s = client(base);
    await s.post("/platform/api/auth/register", { email: `j${tag}@test.dev`, name: "J", password: "password123" });
    const a1 = await s.post(`/platform/api/jobs/${posted.json.id}/apply`, { note: "I built similar." });
    assert.equal(a1.status, 201);
    const a2 = await s.post(`/platform/api/jobs/${posted.json.id}/apply`, { note: "again" });
    assert.equal(a2.status, 409);
    const closed = await admin.patch("/platform/api/jobs", { id: posted.json.id, status: "CLOSED" });
    assert.equal(closed.status, 200);
    const gone = await anon.get("/platform/api/jobs");
    assert.ok(!gone.json.jobs.some((j) => j.id === posted.json.id));
  });

  it("talent directory shows verified evidence only, no emails", async () => {
    const anon = client(base);
    const t = await anon.get("/platform/api/talent");
    assert.equal(t.status, 200);
    assert.equal(t.json.version, "talent-directory-v1");
    assert.ok(!JSON.stringify(t.json).includes("@"));
  });

  it("client portal: provision, project, update, approve + walls", async () => {
    const admin = client(base);
    await admin.post("/platform/api/auth/login", { email: "admin@digitalburj.com", password: "demo1234" });
    const email = `c${tag}@test.dev`;
    const prov = await admin.post("/platform/api/admin/users", { email, name: "Client", password: "password123", role: "client", company: "Test LLC" });
    assert.equal(prov.status, 201);
    const proj = await admin.post("/platform/api/projects", { client_id: prov.json.user.id, title: `Portal test ${tag}` });
    assert.equal(proj.status, 201);
    const upd = await admin.post(`/platform/api/projects/${proj.json.id}/updates`, { body: "Milestone one is live on staging for your review.", needs_approval: true });
    assert.equal(upd.status, 201);
    const c = client(base);
    await c.post("/platform/api/auth/login", { email, password: "password123" });
    const mine = await c.get("/platform/api/projects");
    assert.ok(mine.json.projects.some((p) => p.id === proj.json.id));
    const s = client(base);
    await s.post("/platform/api/auth/register", { email: `x${tag}@test.dev`, name: "X", password: "password123" });
    const wall = await s.get("/platform/api/projects");
    assert.ok(!wall.json.projects.some((p) => p.id === proj.json.id));
    const appr = await c.patch(`/platform/api/projects/${proj.json.id}/updates`, { update_id: upd.json.id, decision: "APPROVED" });
    assert.equal(appr.status, 200);
    const wall2 = await s.patch(`/platform/api/projects/${proj.json.id}/updates`, { update_id: upd.json.id, decision: "APPROVED" });
    assert.equal(wall2.status, 403);
  });

  it("AI gateway denies honestly without key; orgs work", async () => {
    const t = client(base);
    await t.post("/platform/api/auth/login", { email: "teacher@digitalburj.com", password: "demo1234" });
    const ai = await t.post("/platform/api/ai/gateway", { agent: "tutor", prompt: "Explain idempotency simply." });
    assert.equal(ai.status, 503);
    const s = client(base);
    await s.post("/platform/api/auth/register", { email: `a${tag}@test.dev`, name: "A", password: "password123" });
    const wall = await s.post("/platform/api/ai/gateway", { agent: "tutor", prompt: "Explain idempotency simply." });
    assert.equal(wall.status, 403);
    const admin = client(base);
    await admin.post("/platform/api/auth/login", { email: "admin@digitalburj.com", password: "demo1234" });
    const org = await admin.post("/platform/api/orgs", { name: `Test Org ${tag}`, slug: `test-${tag}`.slice(0, 30) });
    assert.equal(org.status, 201);
    const dup = await admin.post("/platform/api/orgs", { name: "dup", slug: `test-${tag}`.slice(0, 30) });
    assert.equal(dup.status, 409);
  });

  it("answer keys never reach the browser, verdicts are server-side", async () => {
    const s = client(base);
    await s.post("/platform/api/auth/register", { email: `z${tag}@test.dev`, name: "Z", password: "password123" });
    const list = await (await fetch(`${base}/platform/api/missions`)).json();
    const dec = list.missions.find((m) => m.kind === "decision");
    assert.ok(dec, "a decision mission exists");
    // anonymous verdict → 401
    const anon = client(base);
    let r = await anon.post(`/platform/api/missions/${dec.id}/answer`, { option_id: "A" });
    assert.equal(r.status, 401);
    // unknown option → 422 (no oracle)
    r = await s.post(`/platform/api/missions/${dec.id}/answer`, { option_id: "NOPE" });
    assert.equal(r.status, 422);
    // rendered mission page carries no correctness data
    const html = await (await fetch(`${base}/platform/missions/${dec.id}`)).text();
    assert.ok(!html.includes('"correct"'), "no correctness flags in page");
    assert.ok(!html.includes("That breaks in production"), "no pre-answer verdicts in page");
  });

  it("revisions chain, open submissions block, withdrawal works", async () => {
    const s = client(base);
    await s.post("/platform/api/auth/register", { email: `r${tag}@test.dev`, name: "R", password: "password123" });
    const list = await (await fetch(`${base}/platform/api/missions`)).json();
    const m = list.missions.find((x) => x.kind === "build") || list.missions[0];
    const good = "word ".repeat(100);
    let r = await s.post(`/platform/api/missions/${m.id}/submit`, { body: good }, { "Idempotency-Key": `r1-${tag}` });
    assert.equal(r.status, 201);
    assert.equal(r.json.submission.revision, 1);
    // second open submission blocked, not overwritten
    r = await s.post(`/platform/api/missions/${m.id}/submit`, { body: good }, { "Idempotency-Key": `r2-${tag}` });
    assert.equal(r.status, 409);
    // withdraw → resubmit chains revision 2, history preserved
    r = await s.patch(`/platform/api/submissions/${r.json.submission_id}`, { action: "withdraw" });
    assert.equal(r.status, 200);
    r = await s.post(`/platform/api/missions/${m.id}/submit`, { body: good }, { "Idempotency-Key": `r3-${tag}` });
    assert.equal(r.status, 201);
    assert.equal(r.json.submission.revision, 2);
    const secondId = r.json.submission.id;
    // withdraw the open one, then withdrawing again is a terminal-state 409
    r = await s.patch(`/platform/api/submissions/${secondId}`, { action: "withdraw" });
    assert.equal(r.status, 200);
    r = await s.patch(`/platform/api/submissions/${secondId}`, { action: "withdraw" });
    assert.equal(r.status, 409);
  });

  it("brute force locks the account, sessions revoke cleanly", async () => {
    const email = `l${tag}@test.dev`;
    const s = client(base);
    await s.post("/platform/api/auth/register", { email, name: "L", password: "password123" });
    const anon = client(base);
    for (let i = 0; i < 5; i++) {
      const r = await anon.post("/platform/api/auth/login", { email, password: "wrongpassword" });
      assert.equal(r.status, 401);
    }
    const locked = await anon.post("/platform/api/auth/login", { email, password: "wrongpassword" });
    assert.equal(locked.status, 423);
    // revoke-all kills the live session too (fresh account — the locked one stays locked)
    const email2 = `l2${tag}@test.dev`;
    const me = client(base);
    await me.post("/platform/api/auth/register", { email: email2, name: "L2", password: "password123" });
    let alive = await me.get("/platform/api/evidence");
    assert.equal(alive.status, 200);
    const gone = await me.del("/platform/api/auth/session");
    assert.equal(gone.status, 200);
    alive = await me.get("/platform/api/evidence");
    assert.equal(alive.status, 401);
  });

  it("dashboard renders for users WITH companies (null-prototype regression)", async () => {
    // node:sqlite rows are null-prototype; passing them to client components
    // crashed dashboard for any user owning a company. Must stay 200.
    const s = client(base);
    await s.post("/platform/api/auth/register", { email: `d${tag}@test.dev`, name: "Dash", password: "password123" });
    await s.post("/platform/api/companies", { name: "DASHCO", trade: "logistics" });
    const res = await fetch(`${base}/platform/dashboard`, { headers: { Cookie: s.jar() } });
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes("DASHCO"), "company renders on dashboard");
  });

  it("students claim CANDIDATE evidence; assurance verifies", async () => {
    const s = client(base);
    await s.post("/platform/api/auth/register", { email: `e${tag}@test.dev`, name: "E", password: "password123" });
    const list = await (await fetch(`${base}/platform/api/missions`)).json();
    const m = list.missions.find((x) => x.kind === "build") || list.missions[0];
    // claim on unapproved work → 409
    let r = await s.post(`/platform/api/missions/${m.id}/submit`, { body: "word ".repeat(100) }, { "Idempotency-Key": `e1-${tag}` });
    assert.equal(r.status, 201);
    const subId = r.json.submission.id;
    r = await s.post("/platform/api/evidence", { submission_id: subId, skill_code: "testing", note: "My tests caught it." });
    assert.equal(r.status, 409);
    // teacher approves → claim a second skill → CANDIDATE
    const tea = client(base);
    await tea.post("/platform/api/auth/login", { email: "teacher@digitalburj.com", password: "demo1234" });
    // wait for automated stage so review accepts
    for (let i = 0; i < 20; i++) {
      const q = await tea.get("/platform/api/reviews");
      if ((q.json.queue || []).some((x) => x.id === subId)) break;
      await new Promise((res) => setTimeout(res, 250));
    }
    r = await tea.post("/platform/api/reviews", { submission_id: subId, decision: "APPROVE", score: 80, feedback: "Good." });
    assert.equal(r.status, 200);
    r = await s.post("/platform/api/evidence", { submission_id: subId, skill_code: "testing", note: "My tests caught the edge case." });
    assert.equal(r.status, 201);
    const claimId = r.json.id;
    r = await s.post("/platform/api/evidence", { submission_id: subId, skill_code: "testing", note: "dup" });
    assert.equal(r.status, 409);
    // candidate visible in assurance queue; different reviewer verifies
    const adm = client(base);
    await adm.post("/platform/api/auth/login", { email: "admin@digitalburj.com", password: "demo1234" });
    const q = await adm.get("/platform/api/assurance");
    assert.ok((q.json.queue || []).some((x) => x.id === claimId));
    r = await adm.post("/platform/api/assurance", { evidence_id: claimId, decision: "VERIFIED", reason: "Tests documented in the submission thread." });
    assert.equal(r.status, 200);
  });

  it("students record video evidence; container and size enforced", async () => {
    const s = client(base);
    await s.post("/platform/api/auth/register", { email: `vid${tag}@test.dev`, name: "V", password: "password123" });
    const webm = Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(2000, 7)]);
    const fake = Buffer.from("this is not a video file at all, just text...........");
    async function upload(buf, fields, cookie) {
      const fd = new FormData();
      for (const [k, v] of Object.entries(fields)) fd.set(k, v);
      fd.set("video", new Blob([buf], { type: "video/webm" }), "evidence.webm");
      const res = await fetch(`${base}/platform/api/evidence`, { method: "POST", headers: cookie ? { Cookie: cookie } : {}, body: fd });
      return { status: res.status, json: await res.json().catch(() => ({})) };
    }
    // anonymous → 403
    let r = await upload(webm, { skill_code: "web", title: "t", note: "n".repeat(20) }, null);
    assert.equal(r.status, 403);
    // fake container → 422 even with honest MIME label
    r = await upload(fake, { skill_code: "web", title: "Fake demo", note: "n".repeat(20) }, s.jar());
    assert.equal(r.status, 422);
    // oversize (4KB cap in tests) → 413
    r = await upload(Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(5000, 7)]),
      { skill_code: "web", title: "Big demo", note: "n".repeat(20) }, s.jar());
    assert.equal(r.status, 413);
    // valid → 201 CANDIDATE; playback gated
    r = await upload(webm, { skill_code: "web", title: "Kiosk walkthrough", note: "Sixty seconds showing the ordering flow end to end." }, s.jar());
    assert.equal(r.status, 201);
    const vid = r.json.id;
    const anonPlay = await fetch(`${base}/platform/api/evidence/${vid}/video`);
    assert.equal(anonPlay.status, 401);
    const play = await fetch(`${base}/platform/api/evidence/${vid}/video`, { headers: { Cookie: s.jar() } });
    assert.equal(play.status, 200);
    assert.ok((play.headers.get("content-type") || "").startsWith("video/"));
    // another student cannot watch it
    const o = client(base);
    await o.post("/platform/api/auth/register", { email: `vo${tag}@test.dev`, name: "O", password: "password123" });
    const blocked = await fetch(`${base}/platform/api/evidence/${vid}/video`, { headers: { Cookie: o.jar() } });
    assert.equal(blocked.status, 403);
    // admin verifies; talent export carries it
    const adm = client(base);
    await adm.post("/platform/api/auth/login", { email: "admin@digitalburj.com", password: "demo1234" });
    r = await adm.post("/platform/api/assurance", { evidence_id: vid, decision: "VERIFIED", reason: "Watched fully; flow works as narrated." });
    assert.equal(r.status, 200);
  });

  it("students document external work; checks are enforced", async () => {
    const s = client(base);
    await s.post("/platform/api/auth/register", { email: `w${tag}@test.dev`, name: "W", password: "password123" });
    // missing link → 422; junk link → 422; short note → 422
    let r = await s.post("/platform/api/evidence", { skill_code: "web", title: "Shop site", note: "word ".repeat(20) });
    assert.equal(r.status, 422);
    r = await s.post("/platform/api/evidence", { skill_code: "web", title: "Shop site", url: "not-a-url", note: "word ".repeat(20) });
    assert.equal(r.status, 422);
    r = await s.post("/platform/api/evidence", { skill_code: "web", title: "Shop site", url: "https://example.com/shop", note: "short" });
    assert.equal(r.status, 422);
    // valid external work → CANDIDATE, visible in assurance queue, verifiable
    r = await s.post("/platform/api/evidence", { skill_code: "web", title: "Shop inventory tracker",
      url: "https://example.com/shop-tracker", note: "I built stock tracking for a shop; it cut stockouts." });
    assert.equal(r.status, 201);
    const extId = r.json.id;
    r = await s.post("/platform/api/evidence", { skill_code: "web", title: "Shop inventory tracker",
      url: "https://example.com/shop-tracker", note: "word ".repeat(20) });
    assert.equal(r.status, 409);
    const adm = client(base);
    await adm.post("/platform/api/auth/login", { email: "admin@digitalburj.com", password: "demo1234" });
    const q = await adm.get("/platform/api/assurance");
    assert.ok((q.json.queue || []).some((x) => x.id === extId));
    r = await adm.post("/platform/api/assurance", { evidence_id: extId, decision: "VERIFIED", reason: "Opened the link; functionality matches the claim." });
    assert.equal(r.status, 200);
    const t = await s.get("/platform/api/talent/export");
    assert.ok(t.json.evidence.some((e) => e.title === "Shop inventory tracker"));
  });

    it("demo seed is off by default", async () => {    const { spawn: sp } = await import("node:child_process");
    const pdb = (await import("node:path")).join((await import("node:os")).tmpdir(), `db-nodemo-${tag}.db`);
    const seed = sp(process.execPath, ["src/server/seed.js"], {
      cwd: WEB, env: { ...process.env, DB_PATH: pdb }, stdio: "ignore",
    });
    await new Promise((res) => seed.on("exit", res));
    const { DatabaseSync } = await import("node:sqlite");
    const db = new DatabaseSync(pdb);
    const n = db.prepare("SELECT COUNT(*) AS n FROM users").get();
    assert.equal(n.n, 0, "no demo users without the flag");
    const m = db.prepare("SELECT COUNT(*) AS n FROM missions").get();
    assert.ok(m.n >= 4, "content still seeds");
    db.close();
  });
});
