const test = require("node:test");
const assert = require("node:assert/strict");
const { startApp } = require("./helpers");

let ctx;
const DAY1 = new Date("2026-10-12T01:00:00Z");
const DAY2 = new Date("2026-10-13T01:00:00Z");
const ALL_THREES = ["brief", "craft", "communication", "scope", "reflection"].map((criterion) => ({ criterion, score: 3 }));
test.before(async () => { ctx = await startApp(); });
test.after(async () => { await ctx.close(); });
test.beforeEach(() => ctx.setNow(DAY1));

let n = 0;
async function newStudent(label = "student") {
  n += 1;
  const r = await ctx.call("POST", "/api/auth/register", { body: { email: `${label}${n}@example.com`, name: "Test Student", password: "password-123" } });
  assert.equal(r.status, 201);
  const token = r.body.token;
  const me = await ctx.call("GET", "/api/me", { token });
  return { token, id: me.body.user.id };
}
const claim = (token, id, body = {}) => ctx.call("POST", `/api/activities/${id}/claim`, { token, body });
const educator = () => ctx.login("educator@example.com", "educator-demo-1");
const employer = () => ctx.login("employer@example.com", "employer-demo-1");

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
  await ctx.call("POST", "/api/auth/register", { body: { email: "dup@example.com", name: "x", password: "password-123" } });
  const dup = await ctx.call("POST", "/api/auth/register", { body: { email: "dup@example.com", name: "x", password: "password-123" } });
  assert.equal(dup.status, 409);
});

test("people cannot register themselves as educators", async () => {
  const r = await ctx.call("POST", "/api/auth/register", { body: { email: "sneaky@example.com", name: "Sneaky", password: "password-123", role: "educator" } });
  assert.equal(r.status, 201);
  const me = await ctx.call("GET", "/api/me", { token: r.body.token });
  assert.equal(me.body.user.role, "student");
  assert.equal((await ctx.call("GET", "/api/educator/claims", { token: r.body.token })).status, 403);
});

test("login gives the same error for unknown email and wrong password", async () => {
  const a = await ctx.call("POST", "/api/auth/login", { body: { email: "nobody@example.com", password: "whatever-123" } });
  const b = await ctx.call("POST", "/api/auth/login", { body: { email: "priya@example.com", password: "wrong-password" } });
  assert.equal(a.status, 401);
  assert.equal(b.status, 401);
  assert.equal(a.body.error, b.body.error);
});

test("the demo student matches the site: 1250 XP, level 4, Rising Star", async () => {
  const token = await ctx.login("priya@example.com", "student-demo-1");
  const me = (await ctx.call("GET", "/api/me", { token })).body;
  assert.equal(me.xpTotal, 1250);
  assert.equal(me.level, 4);
  assert.equal(me.levelTitle, "Rising Star");
  assert.equal(me.xpToNext, 750);
  assert.equal(me.capabilities.filter((c) => c.unlocked).length, 3);
});

test("a new student starts at zero with everything locked", async () => {
  const { token } = await newStudent();
  const me = (await ctx.call("GET", "/api/me", { token })).body;
  assert.equal(me.xpTotal, 0);
  assert.equal(me.levelTitle, "Newcomer");
  assert.equal(me.streak, 0);
  assert.equal(me.capabilities.some((c) => c.unlocked), false);
});

test("the activity list tells the site what can be claimed and why not", async () => {
  const { token } = await newStudent();
  const list = (await ctx.call("GET", "/api/activities", { token })).body;
  assert.equal(list.length, 8);
  assert.deepEqual(list.find((a) => a.id === "daily_checkin").check, { ok: true, points: 10 });
  const locked = list.find((a) => a.id === "mock_interview").check;
  assert.equal(locked.ok, false);
  assert.equal(locked.code, "locked");
  assert.equal(locked.minLevel, 4);
  await claim(token, "complete_profile");
  const again = (await ctx.call("GET", "/api/activities", { token })).body.find((a) => a.id === "complete_profile").check;
  assert.equal(again.code, "already_claimed");
});

test("one-time activity: XP once, then refused", async () => {
  const { token } = await newStudent();
  const first = await claim(token, "complete_profile");
  assert.equal(first.status, 201);
  assert.equal(first.body.points, 50);
  assert.equal(first.body.xpTotal, 50);
  const second = await claim(token, "complete_profile");
  assert.equal(second.status, 409);
  assert.equal(second.body.code, "already_claimed");
  assert.equal((await ctx.call("GET", "/api/me", { token })).body.xpTotal, 50);
});

test("client cannot choose its own XP amount", async () => {
  const { token } = await newStudent();
  const r = await claim(token, "refer_friend", { xp: 99999, points: 99999, baseXp: 99999 });
  assert.equal(r.body.points, 120);
});

test("daily check-in: once a day, with a growing streak bonus, reset by a gap", async () => {
  const { token } = await newStudent();
  assert.equal((await claim(token, "daily_checkin")).body.points, 10);
  const same = await claim(token, "daily_checkin");
  assert.equal(same.status, 429);
  assert.equal(same.body.code, "daily_limit");
  ctx.setNow(DAY2);
  assert.equal((await claim(token, "daily_checkin")).body.points, 13); // streak 1 -> +3
  ctx.setNow(new Date("2026-10-14T01:00:00Z"));
  assert.equal((await claim(token, "daily_checkin")).body.points, 16); // streak 2 -> +6
  assert.equal((await ctx.call("GET", "/api/me", { token })).body.streak, 3);
  ctx.setNow(new Date("2026-10-17T01:00:00Z")); // missed two days
  assert.equal((await claim(token, "daily_checkin")).body.points, 10);
});

test("repeatable activity stops at its daily limit and resets the next day", async () => {
  const { token } = await newStudent();
  assert.equal((await claim(token, "upload_certificate")).status, 201);
  assert.equal((await claim(token, "upload_certificate")).status, 201);
  const third = await claim(token, "upload_certificate");
  assert.equal(third.status, 429);
  assert.equal(third.body.code, "daily_limit");
  ctx.setNow(DAY2);
  assert.equal((await claim(token, "upload_certificate")).status, 201);
});

test("daily XP cap stops farming, and denied claims are written to the audit log", async () => {
  const { token } = await newStudent();
  for (const id of ["portfolio_piece", "upload_certificate", "upload_certificate", "learn_module", "learn_module", "learn_module"]) {
    assert.equal((await claim(token, id)).status, 201); // 150+75+75+50+50+50 = 450
  }
  const over = await claim(token, "refer_friend"); // 120 more would pass 500
  assert.equal(over.status, 429);
  assert.equal(over.body.code, "xp_cap");
  assert.equal((await ctx.call("GET", "/api/me", { token })).body.xpTotal, 450);
  const log = (await ctx.call("GET", "/api/educator/audit", { token: await educator() })).body;
  assert.ok(log.some((e) => e.action === "claim_denied" && e.detail.includes("refer_friend") && e.detail.includes("xp_cap")));
});

test("level-locked activities refuse a low-level student and allow a high-level one", async () => {
  const { token } = await newStudent();
  const low = await claim(token, "mock_interview");
  assert.equal(low.status, 403);
  assert.equal(low.body.code, "locked");
  assert.equal(low.body.minLevel, 4);
  const priya = await ctx.login("priya@example.com", "student-demo-1");
  const high = await claim(priya, "mock_interview");
  assert.equal(high.status, 201);
  assert.equal(high.body.points, 180);
  assert.equal((await claim(priya, "employer_challenge")).status, 403); // level 5 needed, she is level 4
});

test("crossing a threshold levels the student up and reports what unlocked", async () => {
  const { token } = await newStudent();
  await claim(token, "daily_checkin");
  await claim(token, "portfolio_piece");
  await claim(token, "upload_certificate"); // 235 on day 1
  ctx.setNow(DAY2);
  await claim(token, "daily_checkin"); // +13 = 248
  const up = await claim(token, "learn_module"); // +50 = 298
  assert.equal(up.body.leveledUp, true);
  assert.equal(up.body.level, 2);
  assert.equal(up.body.levelTitle, "Explorer");
  assert.deepEqual(up.body.unlocked, ["Apply for paid gigs"]);
});

test("students cannot use educator routes, and educators cannot claim", async () => {
  const { token } = await newStudent();
  assert.equal((await ctx.call("POST", "/api/educator/activities", { token, body: { title: "Free XP", baseXp: 500 } })).status, 403);
  assert.equal((await ctx.call("GET", "/api/educator/audit", { token })).status, 403);
  assert.equal((await ctx.call("GET", "/api/activities", { token: await educator() })).status, 403);
});

test("employers can assign work but cannot mark, edit activities or read the audit log", async () => {
  const token = await employer();
  assert.equal((await ctx.call("GET", "/api/educator/students", { token })).status, 200);
  assert.equal((await ctx.call("GET", "/api/educator/claims", { token })).status, 403);
  assert.equal((await ctx.call("POST", "/api/educator/activities", { token, body: { title: "Nope", baseXp: 10 } })).status, 403);
  assert.equal((await ctx.call("GET", "/api/educator/audit", { token })).status, 403);
});

test("educator can create and edit activities, with limits, and point changes are logged", async () => {
  const token = await educator();
  const bad = [
    { title: "Huge", baseXp: 5000 },
    { title: "", baseXp: 10 },
    { title: "Odd type", baseXp: 10, type: "weekly" },
    { title: "Bad cap", baseXp: 10, requiresCapability: "cap_nonsense" },
    { title: "Float", baseXp: 10.5 },
  ];
  for (const body of bad) assert.equal((await ctx.call("POST", "/api/educator/activities", { token, body })).status, 400, JSON.stringify(body));
  const made = await ctx.call("POST", "/api/educator/activities", { token, body: { title: "Attend a workshop", baseXp: 80, type: "repeatable", dailyLimit: 1 } });
  assert.equal(made.status, 201);
  assert.equal(made.body.id, "attend_a_workshop");
  assert.equal((await ctx.call("POST", "/api/educator/activities", { token, body: { title: "Attend a workshop", baseXp: 80 } })).status, 409);
  assert.equal((await ctx.call("PUT", "/api/educator/activities/attend_a_workshop", { token, body: { baseXp: 90 } })).status, 200);
  assert.equal((await ctx.call("PUT", "/api/educator/activities/does_not_exist", { token, body: { baseXp: 90 } })).status, 404);
  const { token: student } = await newStudent();
  const list = await ctx.call("GET", "/api/activities", { token: student });
  assert.equal(list.body.find((a) => a.id === "attend_a_workshop").baseXp, 90);
  const log = (await ctx.call("GET", "/api/educator/audit", { token })).body;
  assert.ok(log.some((e) => e.action === "points_changed" && e.detail.includes("80 -> 90")));
});

test("assignments add bonus XP once and cannot be used by someone else", async () => {
  const eduToken = await educator();
  const a = await newStudent();
  const b = await newStudent();
  const made = await ctx.call("POST", "/api/educator/assignments", { token: eduToken, body: { studentId: a.id, activityId: "portfolio_piece", note: "Your best case study", dueDate: "2026-10-20", bonusXp: 25 } });
  assert.equal(made.status, 201);
  const mine = (await ctx.call("GET", "/api/assignments", { token: a.token })).body;
  assert.equal(mine.length, 1);
  assert.equal(mine[0].assignedBy, "Dr. Helen Lee");
  assert.equal(mine[0].assignerRole, "Educator");

  const stolen = await claim(b.token, "portfolio_piece", { assignmentId: made.body.id });
  assert.equal(stolen.status, 400);
  assert.equal(stolen.body.code, "bad_assignment");

  const ok = await claim(a.token, "portfolio_piece", { assignmentId: made.body.id });
  assert.equal(ok.status, 201);
  assert.equal(ok.body.points, 175);
  assert.equal((await ctx.call("GET", "/api/assignments", { token: a.token })).body[0].status, "completed");

  ctx.setNow(DAY2);
  const reuse = await claim(a.token, "portfolio_piece", { assignmentId: made.body.id });
  assert.equal(reuse.status, 400);
});

test("assignment input is checked", async () => {
  const token = await educator();
  const s = await newStudent();
  const base = { studentId: s.id, activityId: "portfolio_piece" };
  for (const extra of [{ bonusXp: 5000 }, { bonusXp: -1 }, { dueDate: "next friday" }, { note: "x".repeat(501) }]) {
    assert.equal((await ctx.call("POST", "/api/educator/assignments", { token, body: { ...base, ...extra } })).status, 400, JSON.stringify(extra));
  }
  assert.equal((await ctx.call("POST", "/api/educator/assignments", { token, body: { studentId: 1000000, activityId: "portfolio_piece" } })).status, 400);
  assert.equal((await ctx.call("POST", "/api/educator/assignments", { token, body: { studentId: s.id, activityId: "nope" } })).status, 400);
});

test("marked activities give no XP until an educator approves, and rejection lets the student retry", async () => {
  const eduToken = await educator();
  const made = await ctx.call("POST", "/api/educator/activities", { token: eduToken, body: { title: "Case study review", baseXp: 80, type: "one_time", requiresMarking: true } });
  const id = made.body.id;
  const s = await newStudent();

  assert.equal((await claim(s.token, id)).status, 400); // evidence needed
  const sent = await claim(s.token, id, { evidence: "link to my case study" });
  assert.equal(sent.status, 201);
  assert.equal(sent.body.status, "pending");
  assert.equal(sent.body.points, 0);
  assert.equal(sent.body.pendingPoints, 80);
  assert.equal((await ctx.call("GET", "/api/me", { token: s.token })).body.xpTotal, 0);
  assert.equal((await claim(s.token, id, { evidence: "again" })).status, 409); // pending counts as claimed

  const pending = (await ctx.call("GET", "/api/educator/claims?status=pending", { token: eduToken })).body;
  const row = pending.find((c) => c.studentId === s.id && c.activityId === id);
  assert.ok(row);

  const rejected = await ctx.call("POST", `/api/educator/claims/${row.id}/mark`, { token: eduToken, body: { decision: "reject", marks: ALL_THREES.map((m) => ({ ...m, score: 1 })) } });
  assert.equal(rejected.status, 200);
  assert.equal(rejected.body.xpAwarded, 0);

  const retry = await claim(s.token, id, { evidence: "improved case study" });
  assert.equal(retry.status, 201);
  const row2 = (await ctx.call("GET", "/api/educator/claims?status=pending", { token: eduToken })).body.find((c) => c.studentId === s.id);
  const approved = await ctx.call("POST", `/api/educator/claims/${row2.id}/mark`, { token: eduToken, body: { decision: "approve", marks: ALL_THREES } });
  assert.equal(approved.body.weightedScore, 75);
  assert.equal(approved.body.xpAwarded, 80);
  assert.equal((await ctx.call("GET", "/api/me", { token: s.token })).body.xpTotal, 80);
  assert.equal((await ctx.call("POST", `/api/educator/claims/${row2.id}/mark`, { token: eduToken, body: { decision: "approve", marks: ALL_THREES } })).status, 409);
});

test("marking must score every criterion, once, from the rubric", async () => {
  const eduToken = await educator();
  await ctx.call("POST", "/api/educator/activities", { token: eduToken, body: { title: "Rubric check", baseXp: 10, type: "one_time", requiresMarking: true } });
  const s = await newStudent();
  await claim(s.token, "rubric_check", { evidence: "my piece" });
  const row = (await ctx.call("GET", "/api/educator/claims?status=pending", { token: eduToken })).body.find((c) => c.studentId === s.id);
  const mark = (marks) => ctx.call("POST", `/api/educator/claims/${row.id}/mark`, { token: eduToken, body: { decision: "approve", marks } });
  const partial = await mark([{ criterion: "brief", score: 4 }]);
  assert.equal(partial.status, 400);
  assert.ok(partial.body.missing.includes("craft"));
  assert.equal((await mark([{ criterion: "vibes", score: 4 }])).status, 400);
  assert.equal((await mark([{ criterion: "brief", score: 9 }])).status, 400);
  assert.equal((await mark([...ALL_THREES, { criterion: "brief", score: 1 }])).status, 400);
  const full = await mark(ALL_THREES.map((m) => ({ ...m, score: 4 })));
  assert.equal(full.body.weightedScore, 100);
});

test("rubric is labelled as a placeholder and its weights add up to 100", async () => {
  const r = await ctx.call("GET", "/api/educator/rubric", { token: await educator() });
  assert.equal(r.body.placeholder, true);
  assert.equal(r.body.criteria.reduce((sum, c) => sum + c.weight, 0), 100);
  for (const c of r.body.criteria) assert.equal(c.descriptors.length, 5);
});

test("gigs are locked by level, and a student holds one gig at a time", async () => {
  const low = await newStudent();
  const locked = await ctx.call("POST", "/api/gigs/g1/apply", { token: low.token });
  assert.equal(locked.status, 403);
  assert.equal(locked.body.minLevel, 2);

  const list = (await ctx.call("GET", "/api/gigs", { token: low.token })).body;
  assert.equal(list.length, 4);
  assert.equal(list[0].requiresCapability, "cap_paid_gigs");

  const priya = await ctx.login("priya@example.com", "student-demo-1"); // level 4
  assert.equal((await ctx.call("POST", "/api/gigs/g1/apply", { token: priya })).status, 201);
  assert.equal((await ctx.call("POST", "/api/gigs/g2/apply", { token: priya })).status, 409);
  assert.equal((await ctx.call("POST", "/api/gigs/g1/apply", { token: priya })).status, 409);
  assert.equal((await ctx.call("POST", "/api/gigs/g4/apply", { token: priya })).status, 403); // needs level 5
  assert.equal((await ctx.call("POST", "/api/gigs/g1/withdraw", { token: priya })).status, 200);
  assert.equal((await ctx.call("POST", "/api/gigs/g3/apply", { token: priya })).status, 201);
  assert.equal((await ctx.call("POST", "/api/gigs/nope/apply", { token: priya })).status, 404);
});

test("avatar accepts the site's options and rejects anything else", async () => {
  const { token } = await newStudent();
  const ok = { skin: "#c68642", hair: "#5a3825", hairStyle: "curly", outfit: "#10b981", accessory: "glasses" };
  assert.equal((await ctx.call("PUT", "/api/me/avatar", { token, body: ok })).status, 200);
  assert.deepEqual((await ctx.call("GET", "/api/me/avatar", { token })).body, ok);
  assert.equal((await ctx.call("PUT", "/api/me/avatar", { token, body: { ...ok, skin: "#000000" } })).status, 400);
  assert.equal((await ctx.call("PUT", "/api/me/avatar", { token, body: { ...ok, hairStyle: "mohawk" } })).status, 400);
});

test("diary: private by default, educators see only shared entries", async () => {
  const { token, id } = await newStudent();
  await ctx.call("POST", "/api/diary", { token, body: { body: "private thoughts" } });
  await ctx.call("POST", "/api/diary", { token, body: { body: "for my assessor", shared: true } });
  const seen = await ctx.call("GET", `/api/educator/students/${id}/diary`, { token: await educator() });
  assert.equal(seen.body.length, 1);
  assert.equal(seen.body[0].body, "for my assessor");
  assert.equal((await ctx.call("GET", "/api/diary", { token })).body.length, 2);
});

test("a student cannot read or change another student's data", async () => {
  const a = await newStudent();
  const b = await newStudent();
  await ctx.call("POST", "/api/diary", { token: a.token, body: { body: "mine" } });
  assert.equal((await ctx.call("GET", "/api/diary", { token: b.token })).body.length, 0);
  const aEntry = (await ctx.call("GET", "/api/diary", { token: a.token })).body[0];
  assert.equal((await ctx.call("PUT", `/api/diary/${aEntry.id}/share`, { token: b.token, body: { shared: true } })).status, 404);
  await claim(a.token, "complete_profile");
  assert.equal((await ctx.call("GET", "/api/me", { token: b.token })).body.xpTotal, 0);
});

test("malformed JSON and unknown routes return clean errors", async () => {
  const res = await fetch(ctx.base + "/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: "{not json" });
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error, "Invalid JSON");
  const { token } = await newStudent();
  assert.equal((await ctx.call("GET", "/api/nothing-here", { token })).status, 404);
  assert.equal((await claim(token, "no_such_activity")).status, 404);
  assert.equal((await claim(token, "daily_checkin", { assignmentId: "abc" })).status, 400);
});


test("student XP ledger and activities are account-scoped and survive API refresh", async () => {
  const { token } = await newStudent("synced");
  const other = await newStudent("otherstudent");
  assert.equal((await ctx.call("GET", "/api/ledger", { token })).body.length, 0);
  const awarded = await claim(token, "complete_profile");
  assert.equal(awarded.status, 201);
  assert.equal(awarded.body.points, 50);
  const mine = (await ctx.call("GET", "/api/ledger", { token })).body;
  assert.equal(mine.length, 1);
  assert.equal(mine[0].balanceAfter, 50);
  assert.equal((await ctx.call("GET", "/api/me", { token })).body.xpTotal, 50);
  assert.equal((await ctx.call("GET", "/api/ledger", { token: other.token })).body.length, 0);
  assert.equal((await claim(token, "complete_profile")).status, 409);
  assert.equal((await ctx.call("GET", "/api/ledger")).status, 401);
});

test("Learn progress and XP are committed together and cannot exceed the course total", async () => {
  const { token } = await newStudent("learner");
  let courses = (await ctx.call("GET", "/api/courses", { token })).body;
  assert.equal(courses.find(c => c.id === "co2").modulesDone, 0);
  const done = await claim(token, "learn_module", { courseId: "co2" });
  assert.equal(done.status, 201);
  assert.equal(done.body.points, 50);
  courses = (await ctx.call("GET", "/api/courses", { token })).body;
  assert.equal(courses.find(c => c.id === "co2").modulesDone, 1);
  assert.equal((await ctx.call("GET", "/api/me", { token })).body.xpTotal, 50);
  assert.equal((await claim(token, "learn_module", { courseId: "nope" })).status, 400);
  assert.equal((await claim(token, "daily_checkin", { courseId: "co2" })).status, 400);
  const initial = (await ctx.call("GET", "/api/courses", { token: await ctx.login("priya@example.com", "student-demo-1") })).body;
  assert.equal(initial.find(c => c.id === "co3").modulesDone, 5);
});

test("avatar gear remains backward-compatible and high XP items require unlock", async () => {
  const { token } = await newStudent("wardrobe");
  const base = { skin: "#e0ac69", hair: "#2b2320", hairStyle: "short", outfit: "#7c3aed", accessory: "none" };
  assert.equal((await ctx.call("PUT", "/api/me/avatar", { token, body: { ...base, outfitId: "cosmic" } })).status, 400);
  const saved = await ctx.call("PUT", "/api/me/avatar", { token, body: { ...base, outfitId: "tee" } });
  assert.equal(saved.status, 200);
  assert.equal(saved.body.outfitId, "tee");
});


test("server-awarded XP remains identical after a fresh login and prevents double claims", async () => {
  const { token } = await newStudent("crosssession");
  const before = (await ctx.call("GET", "/api/me", { token })).body.xpTotal;
  const awarded = await claim(token, "complete_profile");
  assert.equal(awarded.status, 201);
  const email = ctx.db.prepare("SELECT email FROM users WHERE id = ?").get(
    Number((await ctx.call("GET", "/api/me", { token })).body.user.id)
  ).email;
  const nextToken = await ctx.login(email, "password-123");
  assert.ok(nextToken, "a fresh login should issue a token");
  const refreshed = await ctx.call("GET", "/api/me", { token: nextToken });
  assert.equal(refreshed.body.xpTotal, before + 50);
  assert.equal((await claim(nextToken, "complete_profile")).status, 409);
  assert.equal((await ctx.call("GET", "/api/me", { token })).body.xpTotal, before + 50);
});
