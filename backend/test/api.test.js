const test = require("node:test");
const assert = require("node:assert/strict");
const { startApp } = require("./helpers");

let ctx;
const ALL_THREES = ["brief", "craft", "communication", "scope", "reflection"].map((criterion) => ({ criterion, score: 3 }));
test.before(async () => { ctx = await startApp(); });
test.after(async () => { await ctx.close(); });

async function newStudent(email) {
  const r = await ctx.call("POST", "/api/auth/register", { body: { email, name: "Test Student", password: "password-123" } });
  assert.equal(r.status, 201);
  return r.body.token;
}

test("health check is public", async () => {
  assert.equal((await ctx.call("GET", "/api/health")).status, 200);
});

test("protected routes need a valid token", async () => {
  assert.equal((await ctx.call("GET", "/api/me")).status, 401);
  assert.equal((await ctx.call("GET", "/api/me", { token: "garbage" })).status, 401);
});

test("registration validates input and blocks duplicates", async () => {
  const bad = await ctx.call("POST", "/api/auth/register", { body: { email: "nope", name: "x", password: "short" } });
  assert.equal(bad.status, 400);
  await newStudent("dup@example.com");
  const dup = await ctx.call("POST", "/api/auth/register", { body: { email: "dup@example.com", name: "x", password: "password-123" } });
  assert.equal(dup.status, 409);
});

test("people cannot register themselves as educators", async () => {
  const r = await ctx.call("POST", "/api/auth/register", { body: { email: "sneaky@example.com", name: "Sneaky", password: "password-123", role: "educator" } });
  assert.equal(r.status, 201);
  const me = await ctx.call("GET", "/api/me", { token: r.body.token });
  assert.equal(me.body.user.role, "student");
  const edu = await ctx.call("GET", "/api/educator/claims", { token: r.body.token });
  assert.equal(edu.status, 403);
});

test("login gives the same error for unknown email and wrong password", async () => {
  const a = await ctx.call("POST", "/api/auth/login", { body: { email: "nobody@example.com", password: "whatever-123" } });
  const b = await ctx.call("POST", "/api/auth/login", { body: { email: "priya@example.com", password: "wrong-password" } });
  assert.equal(a.status, 401);
  assert.equal(b.status, 401);
  assert.equal(a.body.error, b.body.error);
});

test("claiming an activity awards XP once and refuses a second claim", async () => {
  const token = await newStudent("claimer@example.com");
  const acts = await ctx.call("GET", "/api/activities", { token });
  const checkin = acts.body.find((a) => a.title === "Daily Check-in");
  const first = await ctx.call("POST", `/api/activities/${checkin.id}/claim`, { token, body: {} });
  assert.equal(first.status, 201);
  assert.equal(first.body.xpAwarded, 20);
  assert.equal(first.body.xpTotal, 20);
  const second = await ctx.call("POST", `/api/activities/${checkin.id}/claim`, { token, body: {} });
  assert.equal(second.status, 409);
  const me = await ctx.call("GET", "/api/me", { token });
  assert.equal(me.body.xpTotal, 20);
});

test("client cannot choose its own XP amount", async () => {
  const token = await newStudent("cheat@example.com");
  const acts = await ctx.call("GET", "/api/activities", { token });
  const refer = acts.body.find((a) => a.title === "Refer a Friend");
  const r = await ctx.call("POST", `/api/activities/${refer.id}/claim`, { token, body: { xp: 99999, points: 99999 } });
  assert.equal(r.body.xpAwarded, 50);
});

test("marked activities give no XP until an educator approves", async () => {
  const token = await newStudent("marked@example.com");
  const eduToken = await ctx.login("educator@example.com", "educator-demo-1");
  const acts = await ctx.call("GET", "/api/activities", { token });
  const cert = acts.body.find((a) => a.title === "Upload a Certificate");

  const noEvidence = await ctx.call("POST", `/api/activities/${cert.id}/claim`, { token, body: {} });
  assert.equal(noEvidence.status, 400);

  const claim = await ctx.call("POST", `/api/activities/${cert.id}/claim`, { token, body: { evidence: "link to my certificate" } });
  assert.equal(claim.body.status, "pending");
  assert.equal(claim.body.xpAwarded, 0);
  assert.equal((await ctx.call("GET", "/api/me", { token })).body.xpTotal, 0);

  const pending = await ctx.call("GET", "/api/educator/claims?status=pending", { token: eduToken });
  const row = pending.body.find((c) => c.studentName === "Test Student" && c.activityTitle === "Upload a Certificate");
  assert.ok(row);

  const badScore = await ctx.call("POST", `/api/educator/claims/${row.id}/mark`, { token: eduToken, body: { decision: "approve", marks: [{ criterion: "craft", score: 9 }] } });
  assert.equal(badScore.status, 400);

  const marked = await ctx.call("POST", `/api/educator/claims/${row.id}/mark`, { token: eduToken, body: { decision: "approve", marks: ALL_THREES } });
  assert.equal(marked.status, 200);
  assert.equal(marked.body.weightedScore, 75);
  assert.equal(marked.body.xpAwarded, 75);
  assert.equal((await ctx.call("GET", "/api/me", { token })).body.xpTotal, 75);

  const again = await ctx.call("POST", `/api/educator/claims/${row.id}/mark`, { token: eduToken, body: { decision: "approve", marks: ALL_THREES } });
  assert.equal(again.status, 409);
});

test("students cannot use educator routes, and educators cannot claim", async () => {
  const token = await newStudent("limits@example.com");
  assert.equal((await ctx.call("POST", "/api/educator/activities", { token, body: { title: "Free XP", xp: 500 } })).status, 403);
  const eduToken = await ctx.login("educator@example.com", "educator-demo-1");
  assert.equal((await ctx.call("GET", "/api/activities", { token: eduToken })).status, 403);
});

test("educator can create and edit activities, with limits on XP", async () => {
  const eduToken = await ctx.login("educator@example.com", "educator-demo-1");
  const tooBig = await ctx.call("POST", "/api/educator/activities", { token: eduToken, body: { title: "Huge", xp: 5000 } });
  assert.equal(tooBig.status, 400);
  const made = await ctx.call("POST", "/api/educator/activities", { token: eduToken, body: { title: "Attend a workshop", xp: 80 } });
  assert.equal(made.status, 201);
  const edit = await ctx.call("PUT", `/api/educator/activities/${made.body.id}`, { token: eduToken, body: { xp: 90 } });
  assert.equal(edit.status, 200);
  const token = await newStudent("sees-new@example.com");
  const list = await ctx.call("GET", "/api/activities", { token });
  assert.equal(list.body.find((a) => a.title === "Attend a workshop").xp, 90);
});

test("one gig at a time", async () => {
  const token = await newStudent("gigger@example.com");
  const gigs = (await ctx.call("GET", "/api/gigs", { token })).body;
  const a = await ctx.call("POST", `/api/gigs/${gigs[0].id}/apply`, { token });
  assert.equal(a.status, 201);
  const b = await ctx.call("POST", `/api/gigs/${gigs[1].id}/apply`, { token });
  assert.equal(b.status, 409);
  const same = await ctx.call("POST", `/api/gigs/${gigs[0].id}/apply`, { token });
  assert.equal(same.status, 409);
  assert.equal((await ctx.call("POST", `/api/gigs/${gigs[0].id}/withdraw`, { token })).status, 200);
  assert.equal((await ctx.call("POST", `/api/gigs/${gigs[1].id}/apply`, { token })).status, 201);
});

test("avatar items are locked until the right level", async () => {
  const token = await newStudent("avatar@example.com");
  const base = { skin: "tan", hairColor: "purple", hairStyle: "short", face: "happy", outfit: "purple", accessory: "none" };
  assert.equal((await ctx.call("PUT", "/api/me/avatar", { token, body: base })).status, 200);
  const locked = await ctx.call("PUT", "/api/me/avatar", { token, body: { ...base, accessory: "cap" } });
  assert.equal(locked.status, 403);
  const invalid = await ctx.call("PUT", "/api/me/avatar", { token, body: { ...base, skin: "neon" } });
  assert.equal(invalid.status, 400);
});

test("diary: private by default, educators see only shared entries", async () => {
  const token = await newStudent("diary@example.com");
  const me = await ctx.call("GET", "/api/me", { token });
  const eduToken = await ctx.login("educator@example.com", "educator-demo-1");
  await ctx.call("POST", "/api/diary", { token, body: { body: "private thoughts" } });
  await ctx.call("POST", "/api/diary", { token, body: { body: "for my assessor", shared: true } });
  const seen = await ctx.call("GET", `/api/educator/students/${me.body.user.id}/diary`, { token: eduToken });
  assert.equal(seen.body.length, 1);
  assert.equal(seen.body[0].body, "for my assessor");
  const own = await ctx.call("GET", "/api/diary", { token });
  assert.equal(own.body.length, 2);
});

test("a student cannot read or change another student's data", async () => {
  const a = await newStudent("a@example.com");
  const b = await newStudent("b@example.com");
  await ctx.call("POST", "/api/diary", { token: a, body: { body: "mine" } });
  const bDiary = await ctx.call("GET", "/api/diary", { token: b });
  assert.equal(bDiary.body.length, 0);
  const aEntry = (await ctx.call("GET", "/api/diary", { token: a })).body[0];
  const hijack = await ctx.call("PUT", `/api/diary/${aEntry.id}/share`, { token: b, body: { shared: true } });
  assert.equal(hijack.status, 404);
});

test("malformed JSON and unknown routes return clean errors", async () => {
  const res = await fetch(ctx.base + "/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: "{not json" });
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error, "Invalid JSON");
  const token = await newStudent("lost@example.com");
  assert.equal((await ctx.call("GET", "/api/nothing-here", { token })).status, 404);
});

test("rubric is labelled as a placeholder and its weights add up to 100", async () => {
  const eduToken = await ctx.login("educator@example.com", "educator-demo-1");
  const r = await ctx.call("GET", "/api/educator/rubric", { token: eduToken });
  assert.equal(r.body.placeholder, true);
  assert.equal(r.body.criteria.reduce((sum, c) => sum + c.weight, 0), 100);
  for (const c of r.body.criteria) assert.equal(c.descriptors.length, 5);
});

test("marking must score every criterion, once, from the rubric", async () => {
  const token = await newStudent("rubric-check@example.com");
  const eduToken = await ctx.login("educator@example.com", "educator-demo-1");
  const acts = await ctx.call("GET", "/api/activities", { token });
  const portfolio = acts.body.find((a) => a.title === "Add a Portfolio Piece");
  await ctx.call("POST", `/api/activities/${portfolio.id}/claim`, { token, body: { evidence: "my piece" } });
  const pending = (await ctx.call("GET", "/api/educator/claims?status=pending", { token: eduToken })).body;
  const claim = pending.find((c) => c.activityTitle === "Add a Portfolio Piece" && c.studentName === "Test Student");
  const partial = await ctx.call("POST", `/api/educator/claims/${claim.id}/mark`, { token: eduToken, body: { decision: "approve", marks: [{ criterion: "brief", score: 4 }] } });
  assert.equal(partial.status, 400);
  assert.ok(partial.body.missing.includes("craft"));
  const unknown = await ctx.call("POST", `/api/educator/claims/${claim.id}/mark`, { token: eduToken, body: { decision: "approve", marks: [{ criterion: "vibes", score: 4 }] } });
  assert.equal(unknown.status, 400);
  const top = ALL_THREES.map((m) => ({ ...m, score: 4 }));
  const full = await ctx.call("POST", `/api/educator/claims/${claim.id}/mark`, { token: eduToken, body: { decision: "approve", marks: top } });
  assert.equal(full.body.weightedScore, 100);
});
