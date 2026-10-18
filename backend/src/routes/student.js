const express = require("express");
const { audit, totalXp, isConstraintError } = require("../db");
const { getLevelInfo, capabilitiesFor, capability, CAPABILITIES, RULES, dayKey, currentStreak, evaluateClaim } = require("../xp");

// Same options as the site's avatarOptions (ByteSize repo, src/db.js).
const AVATAR_OPTIONS = {
  skin: ["#f5cfa0", "#e0ac69", "#c68642", "#8d5524", "#5a3825"],
  hair: ["#2b2320", "#5a3825", "#8b5e34", "#c9a15a", "#c2410c"],
  hairStyle: ["short", "long", "curly", "bald"],
  outfit: ["#7c3aed", "#10b981", "#3b82f6", "#f59e0b", "#ef4444"],
  accessory: ["none", "glasses", "cap", "rareGlasses", "crown"],
};
const DEFAULT_AVATAR = { skin: "#e0ac69", hair: "#2b2320", hairStyle: "short", outfit: "#7c3aed", outfitId: "tee", accessory: "none" };
const OUTFITS = [
  { id: "tee", xp: 0, color: "#7c3aed" },
  { id: "shirt", xp: 150, color: "#3b82f6" },
  { id: "crop", xp: 350, color: "#f472b6" },
  { id: "hoodie", xp: 650, color: "#10b981" },
  { id: "jacket", xp: 1200, color: "#f59e0b" },
  { id: "cosmic", xp: 2000, color: "#8b5cf6" },
];
const ACCESSORY_XP = { none: 0, glasses: 200, cap: 400, rareGlasses: 900, crown: 1800 };
const COURSES = [
  { id: "co1", provider: "ALUMABLE", title: "Professional Communication", category: "Skills", modulesTotal: 4, initialDone: 2 },
  { id: "co2", provider: "ALUMABLE", title: "Digital Marketing Fundamentals", category: "Industry", modulesTotal: 6, initialDone: 0 },
  { id: "co3", provider: "CANVA", title: "Canva Design Fundamentals", category: "Digital & Tools", modulesTotal: 5, initialDone: 5 },
  { id: "co4", provider: "GOOGLE", title: "Google Analytics Certified", category: "Digital & Tools", modulesTotal: 1, initialDone: 1 },
];

// Which HTTP status each refusal uses. The body always carries the code and message.
const DENIAL_STATUS = { not_found: 404, locked: 403, already_claimed: 409, daily_limit: 429, cooldown: 429, xp_cap: 429, bad_assignment: 400 };

function studentRoutes(db, { claimLimiter, clock }) {
  const r = express.Router();

  // Everything the rules need to know about one student and one activity.
  function claimContext(userId, activity, now, assignmentId) {
    const today = dayKey(now);
    const info = getLevelInfo(totalXp(db, userId));
    const live = "status IN ('pending','approved')";
    const ever = db.prepare(`SELECT COUNT(*) AS n, MAX(created_at) AS last FROM claims WHERE user_id = ? AND activity_id = ? AND ${live}`).get(userId, activity.id);
    const todays = db.prepare(`SELECT COUNT(*) AS n FROM claims WHERE user_id = ? AND activity_id = ? AND day = ? AND ${live}`).get(userId, activity.id, today);
    const dailyXp = db.prepare("SELECT COALESCE(SUM(points),0) AS n FROM xp_ledger WHERE user_id = ? AND day = ?").get(userId, today).n;
    let assignment = null;
    if (assignmentId !== null && assignmentId !== undefined) {
      assignment = db.prepare("SELECT * FROM assignments WHERE id = ? AND user_id = ?").get(assignmentId, userId) || null;
    }
    return {
      activity, level: info.level, now, dailyXp,
      everCount: ever.n, todayCount: todays.n, lastClaimAt: ever.last ? Date.parse(ever.last) : null,
      streak: streakFor(userId, today), assignment, assignmentRequested: assignmentId !== null && assignmentId !== undefined,
    };
  }

  function streakFor(userId, today) {
    const rows = db.prepare(`SELECT DISTINCT c.day FROM claims c JOIN activities a ON a.id = c.activity_id
                             WHERE c.user_id = ? AND a.type = 'daily' AND c.status IN ('pending','approved')`).all(userId);
    return currentStreak(new Set(rows.map((x) => x.day)), today);
  }

  r.get("/me", (req, res) => {
    const now = clock();
    const today = dayKey(now);
    const info = getLevelInfo(totalXp(db, req.user.id));
    const av = db.prepare("SELECT config FROM avatars WHERE user_id = ?").get(req.user.id);
    const dailyXp = db.prepare("SELECT COALESCE(SUM(points),0) AS n FROM xp_ledger WHERE user_id = ? AND day = ?").get(req.user.id, today).n;
    res.json({
      user: req.user, ...info,
      capabilities: capabilitiesFor(info.level),
      streak: streakFor(req.user.id, today),
      dailyXp, dailyXpCap: RULES.dailyXpCap,
      completedGigs: db.prepare("SELECT COUNT(*) AS n FROM gig_applications WHERE user_id = ? AND status = 'completed'").get(req.user.id).n,
      avatar: av ? JSON.parse(av.config) : DEFAULT_AVATAR,
    });
  });

  // Each activity comes with a "check": whether the student could claim it right
  // now and, if not, why. The site uses this to grey out its buttons.
  r.get("/activities", (req, res) => {
    const now = clock();
    const rows = db.prepare("SELECT * FROM activities WHERE active = 1 ORDER BY rowid").all();
    res.json(rows.map((a) => {
      const check = evaluateClaim(claimContext(req.user.id, a, now));
      const pending = db.prepare("SELECT COUNT(*) AS n FROM claims WHERE user_id = ? AND activity_id = ? AND status = 'pending'").get(req.user.id, a.id).n > 0;
      return {
        id: a.id, title: a.title, description: a.description, category: a.category, duration: a.duration,
        baseXp: a.base_xp, type: a.type, dailyLimit: a.daily_limit, cooldownMinutes: a.cooldown_minutes,
        requiresCapability: a.requires_capability, requiresMarking: !!a.requires_marking, pending,
        check: check.ok ? { ok: true, points: check.points } : { ok: false, code: check.code, message: check.message, ...(check.minLevel ? { minLevel: check.minLevel } : {}) },
      };
    }));
  });

  // The authoritative history for XP totals; do not read a browser-local ledger.
  r.get("/ledger", (req, res) => {
    const rows = db.prepare("SELECT id, activity_id AS activityId, points, reason, created_at AS createdAt FROM xp_ledger WHERE user_id = ? ORDER BY id ASC").all(req.user.id);
    let balance = 0;
    res.json(rows.map((row) => ({ ...row, userId: String(req.user.id), balanceAfter: (balance += row.points) })).reverse());
  });

  r.get("/audit", (req, res) => {
    const rows = db.prepare("SELECT id, action, detail, created_at AS at FROM audit_log WHERE user_id = ? ORDER BY id DESC LIMIT 30").all(req.user.id);
    res.json(rows.map((row) => ({ ...row, message: `${row.action}: ${row.detail}` })));
  });

  r.get("/courses", (req, res) => {
    const progress = new Map(db.prepare("SELECT course_id, modules_done FROM course_progress WHERE user_id = ?").all(req.user.id).map((r) => [r.course_id, r.modules_done]));
    res.json(COURSES.map(({initialDone, ...course}) => ({ ...course, modulesDone: progress.get(course.id) ?? 0 })));
  });

  r.get("/assignments", (req, res) => {
    const rows = db.prepare(`
      SELECT s.id, s.activity_id AS activityId, s.note, s.due_date AS dueDate, s.bonus_xp AS bonusXp, s.status,
             u.name AS assignedBy, u.role AS assignerRole
      FROM assignments s JOIN users u ON u.id = s.assigned_by
      WHERE s.user_id = ? ORDER BY s.id`).all(req.user.id);
    res.json(rows.map((a) => ({ ...a, assignerRole: a.assignerRole === "employer" ? "Employer" : "Educator" })));
  });

  // Core rule: the server decides if a claim is allowed and how much it is worth.
  // Nothing the client sends can change the amount.
  r.post("/activities/:id/claim", claimLimiter || ((_q, _s, n) => n()), (req, res) => {
    const now = clock();
    const today = dayKey(now);
    const body = req.body || {};
    const evidence = typeof body.evidence === "string" ? body.evidence.slice(0, 1000) : "";
    let course = null;
    if (body.courseId !== undefined) {
      if (req.params.id !== "learn_module" || typeof body.courseId !== "string") {
        return res.status(400).json({ error: "courseId is only valid for Learn modules", code: "bad_course" });
      }
      course = COURSES.find((c) => c.id === body.courseId);
      if (!course) return res.status(400).json({ error: "Course not found", code: "bad_course" });
    }
    let assignmentId = null;
    if (body.assignmentId !== undefined && body.assignmentId !== null) {
      if (!Number.isInteger(body.assignmentId)) return res.status(400).json({ error: "assignmentId must be a whole number", code: "bad_assignment" });
      assignmentId = body.assignmentId;
    }

    const run = db.transaction(() => {
      const activity = db.prepare("SELECT * FROM activities WHERE id = ? AND active = 1").get(req.params.id);
      if (!activity) return { denied: { code: "not_found", message: "That activity isn't available." } };
      if (course) {
        const progress = db.prepare("SELECT modules_done AS done FROM course_progress WHERE user_id = ? AND course_id = ?").get(req.user.id, course.id);
        if ((progress?.done ?? 0) >= course.modulesTotal) return { denied: { code: "course_done", message: "This course is already complete." } };
      }
      const check = evaluateClaim(claimContext(req.user.id, activity, now, assignmentId));
      if (!check.ok) {
        audit(db, req.user.id, "claim_denied", `activity=${activity.id} code=${check.code}`);
        return { denied: check };
      }
      if (activity.requires_marking && evidence.trim().length === 0) return { needsEvidence: true };

      const before = getLevelInfo(totalXp(db, req.user.id));
      const status = activity.requires_marking ? "pending" : "approved";
      const info = db.prepare(`INSERT INTO claims (user_id, activity_id, assignment_id, status, points, evidence, day, once_key, daily_key, created_at)
                               VALUES (?,?,?,?,?,?,?,?,?,?)`).run(
        req.user.id, activity.id, assignmentId, status, check.points, evidence, today,
        activity.type === "one_time" ? activity.id : null,
        activity.type === "daily" ? `${activity.id}:${today}` : null,
        now.toISOString(),
      );
      if (status === "approved") {
        db.prepare("INSERT INTO xp_ledger (user_id, activity_id, claim_id, points, reason, day, created_at) VALUES (?,?,?,?,?,?,?)")
          .run(req.user.id, activity.id, Number(info.lastInsertRowid), check.points, activity.title, today, now.toISOString());
      }
      if (course && status === "approved") {
        db.prepare("INSERT INTO course_progress (user_id, course_id, modules_done) VALUES (?,?,1) ON CONFLICT(user_id, course_id) DO UPDATE SET modules_done = modules_done + 1")
          .run(req.user.id, course.id);
      }
      if (assignmentId !== null) db.prepare("UPDATE assignments SET status = ? WHERE id = ?").run(status === "approved" ? "completed" : "submitted", assignmentId);
      audit(db, req.user.id, "claim", `activity=${activity.id} status=${status} points=${check.points}`);
      return { activity, status, points: check.points, before };
    });

    let out;
    try {
      out = run();
    } catch (e) {
      // The database's own once-only keys caught a duplicate the checks missed.
      if (isConstraintError(e)) return res.status(409).json({ error: "You've already claimed this one.", code: "already_claimed" });
      throw e;
    }
    if (out.needsEvidence) return res.status(400).json({ error: "This activity needs evidence for an educator to mark", code: "evidence_required" });
    if (out.denied) return res.status(DENIAL_STATUS[out.denied.code] || 400).json({ error: out.denied.message, code: out.denied.code, ...(out.denied.minLevel ? { minLevel: out.denied.minLevel } : {}) });

    const after = getLevelInfo(totalXp(db, req.user.id));
    res.status(201).json({
      status: out.status,
      points: out.status === "approved" ? out.points : 0,
      pendingPoints: out.status === "pending" ? out.points : 0,
      activityTitle: out.activity.title,
      ...(course ? { courseId: course.id } : {}),
      ...after,
      leveledUp: after.level > out.before.level,
      unlocked: CAPABILITIES.filter((c) => c.minLevel > out.before.level && c.minLevel <= after.level).map((c) => c.label),
    });
  });

  r.get("/gigs", (req, res) => {
    const rows = db.prepare(`
      SELECT g.*, ga.status AS applicationStatus
      FROM gigs g LEFT JOIN gig_applications ga ON ga.gig_id = g.id AND ga.user_id = ?
      ORDER BY g.rowid`).all(req.user.id);
    res.json(rows.map((g) => ({
      id: g.id, title: g.title, posterName: g.poster_name, posterOrg: g.poster_org, description: g.description,
      tier: g.tier, timeframe: g.timeframe, pay: g.pay, tags: g.tags ? g.tags.split(",") : [],
      requiresCapability: g.requires_capability,
      applied: g.applicationStatus === "active", applicationStatus: g.applicationStatus || null,
    })));
  });

  // Team decision (Sat 10 Oct): one gig at a time per student. The site's gigs
  // are also locked behind a level, so check that first.
  r.post("/gigs/:id/apply", (req, res) => {
    const gig = db.prepare("SELECT id, requires_capability, min_level FROM gigs WHERE id = ?").get(req.params.id);
    if (!gig) return res.status(404).json({ error: "Gig not found" });
    const cap = capability(gig.requires_capability);
    const level = getLevelInfo(totalXp(db, req.user.id)).level;
    if(level < (gig.min_level || 1)) return res.status(403).json({error:`Unlocks at Level ${gig.min_level}.`});
    if (cap && level < cap.minLevel) return res.status(403).json({ error: `Unlocks at Level ${cap.minLevel}.`, code: "locked", minLevel: cap.minLevel });
    const run = db.transaction(() => {
      const active = db.prepare("SELECT gig_id FROM gig_applications WHERE user_id = ? AND status = 'active'").get(req.user.id);
      if (active) return { error: active.gig_id === gig.id ? "You have already applied to this gig" : "You can only hold one gig at a time. Withdraw or finish your current gig first." };
      const prior = db.prepare("SELECT id FROM gig_applications WHERE user_id = ? AND gig_id = ?").get(req.user.id, gig.id);
      if (prior) db.prepare("UPDATE gig_applications SET status = 'active' WHERE id = ?").run(prior.id);
      else db.prepare("INSERT INTO gig_applications (user_id, gig_id, status) VALUES (?,?,'active')").run(req.user.id, gig.id);
      audit(db, req.user.id, "gig_apply", `gig=${gig.id}`);
      return {};
    });
    const out = run();
    if (out.error) return res.status(409).json(out);
    res.status(201).json({ status: "active" });
  });

  r.post("/gigs/:id/withdraw", (req, res) => {
    const info = db.prepare("UPDATE gig_applications SET status = 'withdrawn' WHERE user_id = ? AND gig_id = ? AND status = 'active'").run(req.user.id, req.params.id);
    if (info.changes === 0) return res.status(404).json({ error: "You have no active application for that gig" });
    audit(db, req.user.id, "gig_withdraw", `gig=${req.params.id}`);
    res.json({ status: "withdrawn" });
  });

  r.get("/me/avatar", (req, res) => {
    const av = db.prepare("SELECT config FROM avatars WHERE user_id = ?").get(req.user.id);
    res.json(av ? JSON.parse(av.config) : DEFAULT_AVATAR);
  });

  r.put("/me/avatar", (req, res) => {
    const cfg = req.body || {};
    const clean = {};
    const useWardrobe = cfg.outfitId !== undefined;
    const xp = totalXp(db, req.user.id);
    const outfit = useWardrobe ? OUTFITS.find((i) => i.id === cfg.outfitId) : null;
    if (useWardrobe && (!outfit || xp < outfit.xp)) return res.status(400).json({ error: "Outfit not unlocked" });
    if (useWardrobe && (!Object.prototype.hasOwnProperty.call(ACCESSORY_XP, cfg.accessory) || xp < ACCESSORY_XP[cfg.accessory]))
      return res.status(400).json({ error: "Accessory not unlocked" });
    for (const [key, allowed] of Object.entries(AVATAR_OPTIONS)) {
      if (!allowed.includes(cfg[key])) return res.status(400).json({ error: `Invalid ${key}`, allowed });
      clean[key] = key === "outfit" && useWardrobe ? outfit.color : cfg[key];
    }
    if (useWardrobe) clean.outfitId = outfit.id;
    db.prepare("INSERT INTO avatars (user_id, config) VALUES (?,?) ON CONFLICT(user_id) DO UPDATE SET config = excluded.config").run(req.user.id, JSON.stringify(clean));
    res.json(clean);
  });

  // Learning diary: private by default; the student chooses what to share.
  r.get("/diary", (req, res) => {
    const rows = db.prepare("SELECT id, body, shared, created_at AS createdAt FROM diary_entries WHERE user_id = ? ORDER BY id DESC").all(req.user.id);
    res.json(rows.map((e) => ({ ...e, shared: !!e.shared })));
  });

  r.post("/diary", (req, res) => {
    const { body, shared } = req.body || {};
    if (typeof body !== "string" || body.trim().length === 0 || body.length > 5000) return res.status(400).json({ error: "Entry text is required (max 5000 characters)" });
    const info = db.prepare("INSERT INTO diary_entries (user_id, body, shared) VALUES (?,?,?)").run(req.user.id, body.trim(), shared === true ? 1 : 0);
    res.status(201).json({ id: Number(info.lastInsertRowid), shared: shared === true });
  });

  r.put("/diary/:id/share", (req, res) => {
    if (typeof req.body?.shared !== "boolean") return res.status(400).json({ error: "shared must be true or false" });
    const info = db.prepare("UPDATE diary_entries SET shared = ? WHERE id = ? AND user_id = ?").run(req.body.shared ? 1 : 0, req.params.id, req.user.id);
    if (info.changes === 0) return res.status(404).json({ error: "Entry not found" });
    res.json({ shared: req.body.shared });
  });

  return r;
}

module.exports = { studentRoutes, AVATAR_OPTIONS };
