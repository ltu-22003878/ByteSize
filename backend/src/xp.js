// Pure XP / level rules. No database, no Express: easy to unit test.
// Thresholds match the prototype's mockData.js so the front end and API agree.

const LEVELS = [
  { level: 1, title: "Newcomer", min: 0 },
  { level: 2, title: "Explorer", min: 300 },
  { level: 3, title: "Builder", min: 700 },
  { level: 4, title: "Rising Star", min: 1000 },
  { level: 5, title: "Pro", min: 2000 },
  { level: 6, title: "Legend", min: 3500 },
];

// What each level unlocks. "employer_challenges" mirrors the prototype's
// "Employer-sponsored challenges" unlock at 2000 XP.
const UNLOCKS = [
  { id: "avatar_basic", label: "Basic avatar items", level: 1 },
  { id: "avatar_cap", label: "Cap accessory", level: 2 },
  { id: "avatar_glasses", label: "Glasses accessory", level: 3 },
  { id: "avatar_mohawk", label: "Mohawk hair style", level: 4 },
  { id: "employer_challenges", label: "Employer-sponsored challenges", level: 5 },
];

function getLevelInfo(xpTotal) {
  const xp = Math.max(0, Math.floor(Number(xpTotal) || 0));
  let current = LEVELS[0];
  for (const l of LEVELS) if (xp >= l.min) current = l;
  const next = LEVELS.find((l) => l.level === current.level + 1) || null;
  const progress = next ? (xp - current.min) / (next.min - current.min) : 1;
  return {
    xpTotal: xp,
    level: current.level,
    title: current.title,
    nextLevel: next ? next.level : null,
    xpToNext: next ? next.min - xp : 0,
    progress: Math.round(progress * 1000) / 1000,
  };
}

function unlocksForLevel(level) {
  return UNLOCKS.filter((u) => u.level <= level).map((u) => u.id);
}

function isUnlocked(unlockId, level) {
  const u = UNLOCKS.find((x) => x.id === unlockId);
  return !!u && u.level <= level;
}

module.exports = { LEVELS, UNLOCKS, getLevelInfo, unlocksForLevel, isUnlocked };
