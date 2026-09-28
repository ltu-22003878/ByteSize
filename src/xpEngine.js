export const dayKey = (d) => new Date(d).toLocaleDateString("en-CA");


export function getBalance(db, userId) {
  return db.xpTransactions
    .filter((t) => t.userId === userId)
    .reduce((sum, t) => sum + t.points, 0);
}

export function getLevelInfo(db, xp) {
  let current = db.levels[0];
  for (const l of db.levels) if (xp >= l.minXp) current = l;
  const next = db.levels.find((l) => l.level === current.level + 1) || null;
  return {
    level: current.level,
    title: current.title,
    from: current.minXp,
    to: next ? next.minXp : null,
    toNext: next ? next.minXp - xp : 0,
    pct: next ? Math.round(((xp - current.minXp) / (next.minXp - current.minXp)) * 100) : 100,
    nextTitle: next ? next.title : null,
  };
}

export function getCapabilities(db, xp) {
  const { level } = getLevelInfo(db, xp);
  return db.capabilities.map((c) => ({ ...c, unlocked: level >= c.minLevel }));
}

export function getDailyXp(db, userId, now = new Date()) {
  const key = dayKey(now);
  return db.xpTransactions
    .filter((t) => t.userId === userId && t.type === "award" && dayKey(t.createdAt) === key)
    .reduce((sum, t) => sum + t.points, 0);
}



export function calcPoints(db, activity, { streak = 0, assignment = null } = {}) {
  const { streakBonusPerDay, streakBonusMaxDays } = db.xpRules;
  let pts = activity.baseXp;
  if (activity.type === "daily") pts += Math.min(streak, streakBonusMaxDays) * streakBonusPerDay;
  if (assignment) pts += assignment.bonusXp || 0;
  return Math.max(0, Math.round(pts));
}



export function checkClaim(db, userId, activityId, { assignmentId = null, now = new Date() } = {}) {
  const activity = db.activities.find((a) => a.id === activityId && a.active !== false);
  const user = db.users.find((u) => u.id === userId);
  if (!activity || !user) return { ok: false, code: "not_found", message: "That activity isn't available." };

  const xp = getBalance(db, userId);
  const { level } = getLevelInfo(db, xp);

 
  if (activity.requiresCapability) {
    const cap = db.capabilities.find((c) => c.id === activity.requiresCapability);
    if (cap && level < cap.minLevel) {
      const lvl = db.levels.find((l) => l.level === cap.minLevel);
      return { ok: false, code: "locked", message: `Unlocks at Level ${cap.minLevel} (${lvl.title}).`, minLevel: cap.minLevel };
    }
  }

  const mine = db.xpTransactions.filter((t) => t.userId === userId && t.activityId === activityId);
  const today = mine.filter((t) => dayKey(t.createdAt) === dayKey(now));

  if (activity.type === "one_time" && mine.length > 0)
    return { ok: false, code: "already_claimed", message: "You've already claimed this one." };

  if (activity.type === "daily" && today.length >= 1)
    return { ok: false, code: "daily_limit", message: "Already done today — come back tomorrow." };

  if (activity.type === "repeatable") {
    if (today.length >= activity.dailyLimit)
      return { ok: false, code: "daily_limit", message: `Daily limit reached (${activity.dailyLimit} per day).` };
    const last = mine.map((t) => new Date(t.createdAt).getTime()).sort((a, b) => b - a)[0];
    if (activity.cooldownMinutes && last && (now.getTime() - last) / 60000 < activity.cooldownMinutes)
      return { ok: false, code: "cooldown", message: `Cooling down — try again in a few minutes.` };
  }

  let assignment = null;
  if (assignmentId) {
    assignment = db.assignments.find((a) => a.id === assignmentId && a.userId === userId);
    if (!assignment || assignment.status !== "open" || assignment.activityId !== activityId)
      return { ok: false, code: "bad_assignment", message: "That assignment isn't open." };
  }

  const points = calcPoints(db, activity, { streak: user.streak, assignment });

  if (getDailyXp(db, userId, now) + points > db.xpRules.dailyXpCap)
    return { ok: false, code: "xp_cap", message: `Daily XP cap of ${db.xpRules.dailyXpCap} reached — resets tomorrow.` };

  return { ok: true, points, activity, assignment };
}

export function claimActivity(db, userId, activityId, { assignmentId = null, now = new Date() } = {}) {
  const check = checkClaim(db, userId, activityId, { assignmentId, now });
  const next = structuredClone(db);

  if (!check.ok) {
    next.auditLog.unshift({
      id: `au${next.auditLog.length + 1}`,
      action: "claim_denied",
      userId,
      activityId,
      code: check.code,
      message: check.message,
      at: now.toISOString(),
    });
    return { db: next, result: { ok: false, code: check.code, message: check.message } };
  }

  const before = getBalance(db, userId);
  const levelBefore = getLevelInfo(db, before);

  next.xpTransactions.push({
    id: `tx${next.xpTransactions.length + 1}`,
    userId,
    activityId,
    assignmentId,
    points: check.points,
    reason: check.activity.title,
    type: "award",
    createdAt: now.toISOString(),
    balanceAfter: before + check.points,
  });

  const after = before + check.points;
  const levelAfter = getLevelInfo(db, after);
  const unlocked = db.capabilities
    .filter((c) => c.minLevel > levelBefore.level && c.minLevel <= levelAfter.level)
    .map((c) => c.label);

  const user = next.users.find((u) => u.id === userId);
  if (check.activity.type === "daily") {
    user.streak += 1;
    user.lastCheckin = dayKey(now);
  }
  if (assignmentId) next.assignments.find((a) => a.id === assignmentId).status = "completed";

  return {
    db: next,
    result: {
      ok: true,
      points: check.points,
      title: check.activity.title,
      balance: after,
      leveledUp: levelAfter.level > levelBefore.level,
      newLevelTitle: levelAfter.title,
      newLevel: levelAfter.level,
      unlocked,
    },
  };
}


export function updateActivityPoints(db, activityId, newXp, actor = "system", now = new Date()) {
  const activity = db.activities.find((a) => a.id === activityId);
  if (!activity) return { db, result: { ok: false, message: "Activity not found." } };
  if (!Number.isInteger(newXp) || newXp < 0 || newXp > db.xpRules.maxActivityPoints)
    return { db, result: { ok: false, message: `Points must be a whole number from 0 to ${db.xpRules.maxActivityPoints}.` } };

  const next = structuredClone(db);
  const target = next.activities.find((a) => a.id === activityId);
  const old = target.baseXp;
  target.baseXp = newXp;
  next.auditLog.unshift({
    id: `au${next.auditLog.length + 1}`,
    action: "points_changed",
    userId: null,
    activityId,
    code: "points_changed",
    message: `${activity.title} value changed ${old} → ${newXp} XP (past awards unchanged). By ${actor}.`,
    at: now.toISOString(),
  });
  return { db: next, result: { ok: true } };
}


export function advanceCourse(db, userId, courseId, { now = new Date() } = {}) {
  const course = db.courses.find((c) => c.id === courseId);
  if (!course || course.modulesDone >= course.modulesTotal)
    return { db, result: { ok: false, message: "Course already complete." } };

  const { db: afterClaim, result } = claimActivity(db, userId, "learn_module", { now });
  if (!result.ok) return { db: afterClaim, result };

  const next = structuredClone(afterClaim);
  const c = next.courses.find((x) => x.id === courseId);
  c.modulesDone += 1;
  if (c.modulesDone === c.modulesTotal) {
    next.certificates.unshift({
      id: `ce${next.certificates.length + 1}`,
      title: c.title,
      issuer: c.provider === "ALUMABLE" ? "Alumable" : c.provider[0] + c.provider.slice(1).toLowerCase(),
      date: now.toLocaleDateString("en-AU", { month: "short", year: "numeric" }),
      status: "verified",
    });
    result.courseComplete = c.title;
  }
  return { db: next, result };
}


export function toggleApplication(db, userId, gigId) {
  const gig = db.gigs.find((g) => g.id === gigId);
  if (!gig) return { db, result: { ok: false, message: "Gig not found." } };
  const cap = db.capabilities.find((c) => c.id === gig.requiresCapability);
  const { level } = getLevelInfo(db, getBalance(db, userId));
  if (cap && level < cap.minLevel)
    return { db, result: { ok: false, message: `Unlocks at Level ${cap.minLevel}.` } };
  const next = structuredClone(db);
  const has = next.applications.includes(gigId);
  next.applications = has ? next.applications.filter((id) => id !== gigId) : [...next.applications, gigId];
  return { db: next, result: { ok: true, applied: !has } };
}
