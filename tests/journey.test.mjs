// Academy integration tests: real server, temp DB per file, cookie-jar clients.
// Covers: full student journey, double-submit idempotency, authz walls, answer-key guard.
import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";
import fs from "node:fs";
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

async function waitFor(base, ms = 25000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      const r = await fetch(`${base}/api/missions`);
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
    return { status: res.status, json };
  }
  return {
    post: (p, b, h) => call("POST", p, b, h),
    patch: (p, b, h) => call("PATCH", p, b, h),
    get: (p) => call("GET", p),
    register: (email, name, pw = "password123") => call("POST", "/api/auth/register", { email, name, password: pw }),
  };
}

describe("academy vertical slice", () => {
  let child, base, dbPath;
  const email = `s${Date.now()}@test.dev`;

  before(async () => {
    const port = await freePort();
    base = `http://127.0.0.1:${port}`;
    dbPath = path.join(os.tmpdir(), `db-academy-test-${port}.db`);
    // seed demo data into the temp DB first
    const seed = spawn(process.execPath, ["src/server/seed.js"], {
      cwd: WEB,
      env: { ...process.env, DB_PATH: dbPath },
      stdio: "ignore",
    });
    await new Promise((res) => seed.on("exit", res));
    child = spawn("npm", ["run", "start"], {
      cwd: WEB,
      env: { ...process.env, DB_PATH: dbPath, PORT: String(port) },
      stdio: "ignore",
    });
    await waitFor(base);
  });

  after(() => {
    child?.kill("SIGTERM");
    for (const s of ["", "-wal", "-shm", "-journal"]) {
      try { fs.rmSync(dbPath + s, { force: true }); } catch {}
    }
  });

  it("student journey: register → mission → submit → approve → evidence", async () => {
    const stu = client(base);
    const tea = client(base);
    // register + login as student
    let r = await stu.register(email, "Test Student");
    assert.equal(r.status, 200, JSON.stringify(r.json));
    // duplicate registration rejected
    r = await stu.register(email, "Test Student");
    assert.equal(r.status, 409);
    // teacher login (seeded)
    r = await tea.post("/api/auth/login", { email: "teacher@digitalburj.com", password: "demo1234" });
    assert.equal(r.status, 200);
    // missions visible
    r = await stu.get("/api/missions");
    assert.ok(r.json.missions.length >= 4, "seeded missions present");
    const mission = r.json.missions[0];
    // submit requires idempotency key
    r = await stu.post(`/api/missions/${mission.id}/submit`, { body: "short" }, {});
    // missing key → 428 (body also short, but key checked first)
    assert.equal(r.status, 428);
    const key = `k-${Date.now()}`;
    r = await stu.post(`/api/missions/${mission.id}/submit`, { body: "x" }, { "Idempotency-Key": key });
    assert.equal(r.status, 422, "short body rejected");
    r = await stu.post(`/api/missions/${mission.id}/submit`,
      { body: "My approach: connect the systems with an API, verify ownership server-side, and log everything." },
      { "Idempotency-Key": key });
    assert.equal(r.status, 201);
    const subId = r.json.submission.id;
    // double submit, same key → same submission, no duplicate
    r = await stu.post(`/api/missions/${mission.id}/submit`,
      { body: "A completely different body that must be ignored." },
      { "Idempotency-Key": key });
    assert.equal(r.status, 200);
    assert.equal(r.json.duplicate, true);
    assert.equal(r.json.submission.id, subId);
    // teacher approves → evidence created
    r = await tea.post("/api/reviews", { submission_id: subId, decision: "APPROVE", score: 88, feedback: "Solid reasoning." });
    assert.equal(r.status, 200);
    assert.ok(r.json.evidence_id, "evidence created");
    // evidence visible to student
    r = await stu.get("/api/evidence");
    assert.ok(r.json.evidence.some((e) => e.id === r.json.evidence_id || e.submission_id === subId) || r.json.evidence.length >= 1);
    assert.ok(r.json.skills.some((s) => s.level > 0), "skill bumped");
  });

  it("authz: student cannot touch teacher queue or other students", async () => {
    const a = client(base);
    const b = client(base);
    const ea = `a${Date.now()}@t.dev`, eb = `b${Date.now()}@t.dev`;
    await a.register(ea, "A");
    await b.register(eb, "B");
    // student hits teacher queue → 403
    let r = await a.get("/api/reviews");
    assert.equal(r.status, 403);
    // student reviews someone else's submission → 403
    r = await a.post("/api/reviews", { submission_id: 1, decision: "APPROVE" });
    assert.equal(r.status, 403);
    // unauthenticated submit → 401
    const anon = client(base);
    r = await anon.post("/api/missions/1/submit", { body: "hello world this is long enough" }, { "Idempotency-Key": "anon-1" });
    assert.equal(r.status, 401);
    // wrong password → 401, unknown user data stays hidden
    r = await anon.post("/api/auth/login", { email: ea, password: "wrongpassword" });
    assert.equal(r.status, 401);
  });

  it("studio layer: company, language, passport", async () => {
    const s = client(base);
    await s.register(`w${Date.now()}@t.dev`, "W");
    // company create + duplicate guard
    let r = await s.post("/api/companies", { name: "NOVA", trade: "logistics" });
    assert.equal(r.status, 201);
    r = await s.post("/api/companies", { name: "NOVA", trade: "logistics" });
    assert.equal(r.json.duplicate, true);
    r = await s.post("/api/companies", { name: "X", trade: "logistics" });
    assert.equal(r.status, 422, "name too short rejected");
    // language allowlist
    r = await s.patch("/api/profile", { language: "hinglish" });
    assert.equal(r.status, 200);
    assert.equal(r.json.language, "hinglish");
    r = await s.patch("/api/profile", { language: "klingon" });
    assert.equal(r.status, 422);
    // passport renders (empty state, no crash)
    r = await s.get("/api/evidence");
    assert.equal(r.status, 200);
    assert.ok(Array.isArray(r.json.evidence));
  });

  it("answer keys never leak to students", async () => {
    const s = client(base);
    await s.register(`k${Date.now()}@t.dev`, "K");
    const r = await s.get("/api/missions/2"); // break mission has staff answer
    assert.equal(r.status, 200);
    assert.ok(!JSON.stringify(r.json).includes("verify ownership on every read"), "staff answer hidden");
  });
});
