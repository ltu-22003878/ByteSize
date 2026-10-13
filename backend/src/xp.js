// Pure XP, level and claim rules. No database, no Express, so every rule can be
// unit tested on its own. The numbers match the shared site (ByteSize repo,
// src/db.js and src/xpEngine.js) so the front end and the API agree.

const LEVELS = [
  { level: 1, title: "Newcomer", min: 0 },
  { level: 2, title: "Explorer", min: 250 },
  { level: 3, title: "Builder", min: 600 },
  { level: 4, title: "Rising Star", min: 1000 },
  { level: 5, title: "Pro", min: 2000 },
];

// Levels unlock capabilities. Activities and gigs can require one.
const CAPABILITIES = [
  { id: "cap_paid_gigs", label: "Apply for paid gigs", minLevel: 2 },
  { id: "cap_featured_gigs", label: "Featured gigs", minLevel: 3 },
  { id: "cap_mock_interview", label: "AI mock interviews", minLevel: 4 },
  { id: "cap_employer_challenges", label: "Employer-sponsored challenges", minLevel: 5 },
];

// Anti-abuse rules. maxAssignmentBonus is our own limit (the site has none).
const RULES = {
  dailyXpCap: 500,
  streakBonusPerDay: 3,
  streakBonusMaxDays: 5,
  maxActivityPoints: 1000,
  maxAssignmentBonus: 100,
};

const ACTIVITY_TYPES = ["daily", "one_time", "repeatable"];

function levelTitle(level) {
  const l = LEVELS.find((x) => x.level === level);
  return l ? l.title : null;
}

function getLevelInfo(xpTotal) {
  const xp = Math.max(0, Math.floor(Number(xpTotal) || 0));
  let current = LEVELS[0];
  for (const l of LEVELS) if (xp >= l.min) current = l;
  const next = LEVELS.find((l) => l.level === current.level + 1) || null;
  const progress = next ? (xp - current.min) / (next.min - current.min) : 1;
  return {
    xpTotal: xp,
    level: current.level,
    levelTitle: current.title,
    nextLevel: next ? next.level : null,
    nextLevelTitle: next ? next.title : null,
    xpToNext: next ? next.min - xp : 0,
    progress: Math.round(progress * 1000) / 1000,
  };
}

function capability(id) {
  return CAPABILITIES.find((c) => c.id === id) || null;
}

function capabilitiesFor(level) {
  return CAPABILITIES.map((c) => ({ ...c, unlocked: level >= c.minLevel }));
}

// Calendar day in the configured time zone, e.g. "2026-10-12". "Today" has to
// mean the student's day, not the server's, or the daily limits reset at the
// wrong hour. Set DAY_TZ to change it.
function dayKey(date, tz = process.env.DAY_TZ || "Australia/Melbourne") {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function shiftDay(key, n) {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Consecutive days with a daily check-in, counting back from today (if done
// today) or yesterday. A missed day resets it to zero. The prototype only ever
// added one, so its streak never reset.
function currentStreak(days, today) {
  let cursor = days.has(today) ? today : shiftDay(today, -1);
  let n = 0;
  while (days.has(cursor)) {
    n += 1;
    cursor = shiftDay(cursor, -1);
  }
  return n;
}

// Points for one claim. The streak bonus applies to daily activities only.
function calcPoints(activity, { streak = 0, assignment = null } = {}) {
  let pts = activity.base_xp;
  if (activity.type === "daily") pts += Math.min(streak, RULES.streakBonusMaxDays) * RULES.streakBonusPerDay;
  if (assignment) pts += assignment.bonus_xp || 0;
  return Math.max(0, Math.round(pts));
}

// Decide whether a claim is allowed. Order matters and matches the site:
// locked, already claimed, daily limit, cooldown, assignment, daily XP cap.
function evaluateClaim({ activity, level, everCount = 0, todayCount = 0, lastClaimAt = null, dailyXp = 0, streak = 0, assignment = null, assignmentRequested = false, now = new Date() }) {
  if (!activity) return { ok: false, code: "not_found", message: "That activity isn't available." };

  if (activity.requires_capability) {
    const cap = capability(activity.requires_capability);
    if (cap && level < cap.minLevel) {
      return { ok: false, code: "locked", message: `Unlocks at Level ${cap.minLevel} (${levelTitle(cap.minLevel)}).`, minLevel: cap.minLevel };
    }
  }

  if (activity.type === "one_time" && everCount > 0) return { ok: false, code: "already_claimed", message: "You've already claimed this one." };
  if (activity.type === "daily" && todayCount >= 1) return { ok: false, code: "daily_limit", message: "Already done today. Come back tomorrow." };
  if (activity.type === "repeatable") {
    if (todayCount >= activity.daily_limit) return { ok: false, code: "daily_limit", message: `Daily limit reached (${activity.daily_limit} per day).` };
    if (activity.cooldown_minutes && lastClaimAt != null && (now.getTime() - lastClaimAt) / 60000 < activity.cooldown_minutes) {
      return { ok: false, code: "cooldown", message: "Cooling down. Try again in a few minutes." };
    }
  }

  if (assignmentRequested && (!assignment || assignment.status !== "open" || assignment.activity_id !== activity.id)) {
    return { ok: false, code: "bad_assignment", message: "That assignment isn't open." };
  }

  const points = calcPoints(activity, { streak, assignment });
  if (dailyXp + points > RULES.dailyXpCap) {
    return { ok: false, code: "xp_cap", message: `Daily XP cap of ${RULES.dailyXpCap} reached. It resets tomorrow.` };
  }
  return { ok: true, points };
}

module.exports = { LEVELS, CAPABILITIES, RULES, ACTIVITY_TYPES, levelTitle, getLevelInfo, capability, capabilitiesFor, dayKey, shiftDay, currentStreak, calcPoints, evaluateClaim };
