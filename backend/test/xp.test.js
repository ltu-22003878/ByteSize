const test = require("node:test");
const assert = require("node:assert/strict");
const { getLevelInfo, capabilitiesFor, calcPoints, currentStreak, dayKey, evaluateClaim } = require("../src/xp");

const act = (over = {}) => ({ id: "x", type: "repeatable", base_xp: 100, daily_limit: 2, cooldown_minutes: 0, requires_capability: null, ...over });

test("level boundaries match the site's thresholds", () => {
  assert.equal(getLevelInfo(0).level, 1);
  assert.equal(getLevelInfo(249).level, 1);
  assert.equal(getLevelInfo(250).level, 2);
  assert.equal(getLevelInfo(599).level, 2);
  assert.equal(getLevelInfo(600).level, 3);
  assert.equal(getLevelInfo(999).level, 3);
  assert.equal(getLevelInfo(1000).level, 4);
  assert.equal(getLevelInfo(1250).level, 4);
  assert.equal(getLevelInfo(2000).level, 5);
});

test("the site's seed (1250 XP) is level 4 with 750 to go and 25% progress", () => {
  const info = getLevelInfo(1250);
  assert.equal(info.levelTitle, "Rising Star");
  assert.equal(info.xpToNext, 750);
  assert.equal(info.progress, 0.25);
});

test("top level has full progress and no next level", () => {
  const info = getLevelInfo(99999);
  assert.equal(info.level, 5);
  assert.equal(info.nextLevel, null);
  assert.equal(info.progress, 1);
});

test("bad input is treated as zero, never negative or NaN", () => {
  for (const bad of [-50, "abc", undefined, null, NaN]) {
    const info = getLevelInfo(bad);
    assert.equal(info.xpTotal, 0);
    assert.equal(info.level, 1);
  }
});

test("capabilities unlock at their level", () => {
  const at = (level) => capabilitiesFor(level).filter((c) => c.unlocked).map((c) => c.id);
  assert.deepEqual(at(1), []);
  assert.deepEqual(at(2), ["cap_paid_gigs"]);
  assert.equal(at(5).length, 4);
});

test("streak bonus is 3 per day, capped at 5 days, daily activities only", () => {
  const daily = act({ type: "daily", base_xp: 10 });
  assert.equal(calcPoints(daily, { streak: 0 }), 10);
  assert.equal(calcPoints(daily, { streak: 2 }), 16);
  assert.equal(calcPoints(daily, { streak: 30 }), 25);
  assert.equal(calcPoints(act(), { streak: 30 }), 100);
});

test("assignment bonus is added on top", () => {
  assert.equal(calcPoints(act({ base_xp: 150 }), { assignment: { bonus_xp: 25 } }), 175);
});

test("streak counts consecutive days and resets after a gap", () => {
  const days = new Set(["2026-10-08", "2026-10-09", "2026-10-10"]);
  assert.equal(currentStreak(days, "2026-10-11"), 3); // not done today yet: counts back from yesterday
  assert.equal(currentStreak(days, "2026-10-10"), 3); // done today
  assert.equal(currentStreak(days, "2026-10-12"), 0); // missed yesterday: reset
  assert.equal(currentStreak(new Set(), "2026-10-12"), 0);
});

test("a day is the Melbourne day, not the UTC day", () => {
  // 23:30 UTC on the 11th is 10:30 on the 12th in Melbourne (daylight saving).
  assert.equal(dayKey(new Date("2026-10-11T23:30:00Z"), "Australia/Melbourne"), "2026-10-12");
  assert.equal(dayKey(new Date("2026-10-11T23:30:00Z"), "UTC"), "2026-10-11");
});

test("claim rules: locked, one-time, daily, limit, cooldown, assignment, XP cap", () => {
  const now = new Date("2026-10-12T01:00:00Z");
  assert.equal(evaluateClaim({ activity: act({ requires_capability: "cap_mock_interview" }), level: 3, now }).code, "locked");
  assert.equal(evaluateClaim({ activity: act({ requires_capability: "cap_mock_interview" }), level: 4, now }).ok, true);
  assert.equal(evaluateClaim({ activity: act({ type: "one_time" }), level: 1, everCount: 1, now }).code, "already_claimed");
  assert.equal(evaluateClaim({ activity: act({ type: "daily" }), level: 1, todayCount: 1, now }).code, "daily_limit");
  assert.equal(evaluateClaim({ activity: act(), level: 1, todayCount: 2, now }).code, "daily_limit");
  assert.equal(evaluateClaim({ activity: act({ cooldown_minutes: 30 }), level: 1, lastClaimAt: now.getTime() - 10 * 60000, now }).code, "cooldown");
  assert.equal(evaluateClaim({ activity: act({ cooldown_minutes: 30 }), level: 1, lastClaimAt: now.getTime() - 40 * 60000, now }).ok, true);
  assert.equal(evaluateClaim({ activity: act(), level: 1, assignmentRequested: true, assignment: null, now }).code, "bad_assignment");
  assert.equal(evaluateClaim({ activity: act(), level: 1, dailyXp: 450, now }).code, "xp_cap");
  assert.equal(evaluateClaim({ activity: act(), level: 1, dailyXp: 400, now }).ok, true); // exactly 500 is allowed
});
