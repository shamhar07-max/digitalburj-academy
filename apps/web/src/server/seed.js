// Seed: demo accounts + starter missions. Idempotent.
import { getDb, row, run } from "./db.js";
import { hashPassword } from "./auth.js";

getDb();

function ensureUser(email, name, role) {
  const e = row("SELECT id FROM users WHERE email=?", email);
  if (e) return e.id;
  const r = run("INSERT INTO users (email, name, password_hash, role) VALUES (?,?,?,?)",
    email, name, hashPassword("demo1234"), role);
  return r.lastInsertRowid;
}

const student = ensureUser("student@digitalburj.com", "Ahmed Khan", "student");
ensureUser("teacher@digitalburj.com", "Reviewer One", "teacher");
ensureUser("admin@digitalburj.com", "Platform Owner", "admin");

const courses = [
  ["DB-00", "Digital Foundations", "Start here", "Reads any digital product without feeling lost."],
  ["DB-01", "Problem Solving & Product Thinking", "Start here", "Turns vague asks into requirements and scope."],
  ["DB-03", "Backend, APIs & Databases", "Builder", "Builds complete business applications."],
  ["DB-12", "AI Agents & Automation", "Flagship", "Ships an AI employee for one business function."],
];
for (const [code, name, level, outcome] of courses) {
  run("INSERT OR IGNORE INTO courses (code, name, level, outcome) VALUES (?,?,?,?)", code, name, level, outcome);
}

const missions = [
["DB-00", "Make two systems talk", "decision", "A client's website receives enquiries, but sales copies every enquiry into a spreadsheet by hand. Budget: none yet. The client is non-technical and wants your recommendation first.",
 JSON.stringify({ options: [
   { id: "A", text: "Build a brand-new website", consequence: "The copying continues — the website was never the bottleneck.", correct: false },
   { id: "B", text: "Hire another employee to copy faster", consequence: "Cost scales with volume; errors scale with it.", correct: false },
   { id: "C", text: "Connect the systems so data flows automatically", consequence: "Correct. The bottleneck is the manual handoff, not headcount or pixels.", correct: true },
   { id: "D", text: "Redesign the logo", consequence: "Pretty. The spreadsheet remains.", correct: false }],
   explain: "APIs let systems exchange data through a defined interface. Learn the interface only after the problem demands it." }), 2],
["DB-03", "The invoice you should not see", "break", "A customer reports seeing another customer's invoice at /invoices/4721. The button was hidden for non-owners, yet the data leaked. Diagnose: is hiding the button enough, and what must the server check?",
 JSON.stringify({ scenario: "GET /invoices/4721 returns 200 with another customer's data for a logged-in non-owner. Frontend hides the link. Question: what is the root cause and the fix?",
   answer: "Authorization missing server-side. Fix: verify ownership on every read; hidden UI is not a control." }), 3],
["DB-03", "Two buyers, one item", "build", "Two users click Buy on the last item at the same second. Design the safeguard: unique constraint, transaction, idempotency key. Submit your approach plus the SQL you would add.",
 JSON.stringify({}), 3],
["DB-12", "The 4-hour morning", "decision", "An operations manager spends four hours every morning answering the same ten questions. An AI agent is proposed with CRM access. Decide scope: what may it answer, what must escalate, what must it never touch?",
 JSON.stringify({ options: [
   { id: "A", text: "Full CRM access, auto-reply everything", consequence: "Fast — until it refunds the wrong customer at 3am.", correct: false },
   { id: "B", text: "FAQs + order status, escalate money and anger", consequence: "Correct. Boundaries first, personality second.", correct: true },
   { id: "C", text: "No AI; hire two support agents", consequence: "Safe, but the 4-hour mornings continue forever.", correct: false }],
   explain: "Agents need explicit boundaries: answer, escalate, never-touch. High-risk actions stay human-approved." }), 2],
];
for (const [course, title, kind, brief, payload, diff] of missions) {
  const e = row("SELECT id FROM missions WHERE course_code=? AND title=?", course, title);
  if (!e) run("INSERT INTO missions (course_code, title, kind, brief, payload, difficulty) VALUES (?,?,?,?,?,?)",
    course, title, kind, brief, payload, diff);
}

const skills = [["web","Web Development"],["backend","Backend & APIs"],["ai","AI Engineering"],["security","Security Fundamentals"],["testing","Testing"],["product","Product Thinking"]];
for (const [code, name] of skills) {
  run("INSERT OR IGNORE INTO skills (code, name) VALUES (?,?)", code, name);
  run("INSERT OR IGNORE INTO student_skills (user_id, skill_code, level) VALUES (?,?,?)",
    student, code, code === "web" ? 62 : code === "backend" ? 41 : 18);
}

for (const code of ["DB-00", "DB-01", "DB-03"]) {
  run("INSERT OR IGNORE INTO enrollments (user_id, course_code) VALUES (?,?)", student, code);
}

console.log("seed ok");
