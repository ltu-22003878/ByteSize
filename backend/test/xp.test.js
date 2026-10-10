const test = require("node:test");
const assert = require("node:assert/strict");
const { getLevelInfo, unlocksForLevel, isUnlocked } = require("../src/xp");

test("level boundaries match the prototype thresholds", () => {
  assert.equal(getLevelInfo(0).level, 1);
  assert.equal(getLevelInfo(299).level, 1);
  assert.equal(getLevelInfo(300).level, 2);
  assert.equal(getLevelInfo(699).level, 2);
  assert.equal(getLevelInfo(700).level, 3);
  assert.equal(getLevelInfo(999).level, 3);
  assert.equal(getLevelInfo(1000).level, 4);
  assert.equal(getLevelInfo(1250).level, 4);
  assert.equal(getLevelInfo(2000).level, 5);
  assert.equal(getLevelInfo(3500).level, 6);
});

test("progress and xpToNext are computed within the current level", () => {
  const info = getLevelInfo(500); // level 2: 300 to 700
  assert.equal(info.level, 2);
  assert.equal(info.xpToNext, 200);
  assert.equal(info.progress, 0.5);
});

test("top level has full progress and no next level", () => {
  const info = getLevelInfo(99999);
  assert.equal(info.level, 6);
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

test("unlocks grow with level", () => {
  assert.deepEqual(unlocksForLevel(1), ["avatar_basic"]);
  assert.ok(unlocksForLevel(5).includes("employer_challenges"));
  assert.equal(isUnlocked("avatar_cap", 1), false);
  assert.equal(isUnlocked("avatar_cap", 2), true);
  assert.equal(isUnlocked("nonsense", 6), false);
});
