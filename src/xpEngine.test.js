import { describe, it, expect } from "vitest";
import { createSeedDb } from "./db";
import {
  getBalance, getLevelInfo, calcPoints, checkClaim, claimActivity,
  updateActivityPoints, getCapabilities, advanceCourse,
} from "./xpEngine";

const NOW = new Date("2026-09-28T10:00:00");
const U = "u1";

describe("balance & levels", () => {
  it("seed ledger totals 1250 XP at Level 4", () => {
    const db = createSeedDb();
    expect(getBalance(db, U)).toBe(1250);
    const info = getLevelInfo(db, 1250);
    expect(info.level).toBe(4);
    expect(info.toNext).toBe(750);
    expect(info.pct).toBe(25);
  });
});

describe("calcPoints", () => {
  const db = createSeedDb();
  const act = (id) => db.activities.find((a) => a.id === id);
  it("adds a capped streak bonus to daily activities only", () => {
    expect(calcPoints(db, act("daily_checkin"), { streak: 2 })).toBe(16);
    expect(calcPoints(db, act("daily_checkin"), { streak: 30 })).toBe(25);
    expect(calcPoints(db, act("portfolio_piece"), { streak: 30 })).toBe(150);
  });
  it("adds assignment bonus XP", () => {
    expect(calcPoints(db, act("portfolio_piece"), { assignment: { bonusXp: 25 } })).toBe(175);
  });
});

describe("claiming activities", () => {
  it("awards XP, writes a ledger row and updates the streak", () => {
    const { db, result } = claimActivity(createSeedDb(), U, "daily_checkin", { now: NOW });
    expect(result.ok).toBe(true);
    expect(result.points).toBe(25);
    const last = db.xpTransactions.at(-1);
    expect(last.balanceAfter).toBe(1275);
    expect(db.users[0].streak).toBe(8);
  });

  it("blocks a one-time activity that was already claimed", () => {
    const check = checkClaim(createSeedDb(), U, "complete_profile", { now: NOW });
    expect(check.code).toBe("already_claimed");
  });

  it("enforces the per-day limit on repeatable activities", () => {
    let db = createSeedDb();
    db = claimActivity(db, U, "portfolio_piece", { now: NOW }).db;
    const second = claimActivity(db, U, "portfolio_piece", { now: NOW });
    expect(second.result.ok).toBe(false);
    expect(second.result.code).toBe("daily_limit");
    expect(second.db.auditLog[0].action).toBe("claim_denied");
  });

  it("enforces the daily XP cap (anti-farming)", () => {
    let db = createSeedDb();
    db = claimActivity(db, U, "portfolio_piece", { now: NOW }).db; // 150
    db = claimActivity(db, U, "upload_certificate", { now: NOW }).db; // 225
    db = claimActivity(db, U, "upload_certificate", { now: NOW }).db; // 300
    db = claimActivity(db, U, "learn_module", { now: NOW }).db; // 350
    db = claimActivity(db, U, "learn_module", { now: NOW }).db; // 400
    db = claimActivity(db, U, "learn_module", { now: NOW }).db; // 450
    const over = claimActivity(db, U, "refer_friend", { now: NOW }); // +120 > 500
    expect(over.result.code).toBe("xp_cap");
  });

  it("assignments add bonus XP and close the assignment", () => {
    const { db, result } = claimActivity(createSeedDb(), U, "portfolio_piece", { assignmentId: "as1", now: NOW });
    expect(result.points).toBe(175);
    expect(db.assignments.find((a) => a.id === "as1").status).toBe("completed");
  });
});

describe("levels & unlocks", () => {
  it("locks activities until the required level", () => {
    const check = checkClaim(createSeedDb(), U, "employer_challenge", { now: NOW });
    expect(check.code).toBe("locked");
    expect(check.minLevel).toBe(5);
  });

  it("levels up and unlocks capabilities when crossing a threshold", () => {
    const db = createSeedDb();
    db.xpTransactions.push({ id: "tx99", userId: U, activityId: null, assignmentId: null, points: 700, reason: "test", type: "award", createdAt: "2026-09-20T00:00:00.000Z", balanceAfter: 1950 });
    const { result, db: after } = claimActivity(db, U, "portfolio_piece", { now: NOW });
    expect(result.leveledUp).toBe(true);
    expect(result.newLevelTitle).toBe("Pro");
    expect(result.unlocked).toContain("Employer-sponsored challenges");
    expect(getCapabilities(after, getBalance(after, U)).every((c) => c.unlocked)).toBe(true);
  });
});

describe("point-value changes", () => {
  it("only affects future awards, never past ledger rows", () => {
    const db = createSeedDb();
    const before = getBalance(db, U);
    const { db: changed, result } = updateActivityPoints(db, "portfolio_piece", 200, "test", NOW);
    expect(result.ok).toBe(true);
    expect(getBalance(changed, U)).toBe(before);
    expect(claimActivity(changed, U, "portfolio_piece", { now: NOW }).result.points).toBe(200);
  });
  it("rejects negative, fractional and oversized values", () => {
    const db = createSeedDb();
    for (const bad of [-5, 12.5, 5000]) expect(updateActivityPoints(db, "portfolio_piece", bad).result.ok).toBe(false);
  });
});

describe("learn courses", () => {
  it("finishing the last module issues a certificate", () => {
    let db = createSeedDb();
    db = advanceCourse(db, U, "co1", { now: NOW }).db;
    const { db: done, result } = advanceCourse(db, U, "co1", { now: NOW });
    expect(result.courseComplete).toBe("Professional Communication");
    expect(done.certificates[0].title).toBe("Professional Communication");
  });
});
