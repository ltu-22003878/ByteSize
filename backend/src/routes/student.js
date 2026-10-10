const express = require("express");
const { audit, totalXp, isConstraintError } = require("../db");
const { getLevelInfo, unlocksForLevel, isUnlocked } = require("../xp");

const AVATAR_OPTIONS = {
  skin: ["light", "tan", "almond", "brown", "deep"],
  hairColor: ["black", "brown", "blonde", "red", "purple"],
  hairStyle: ["bald", "short", "long", "mohawk"],
  face: ["neutral", "happy", "surprised"],
  outfit: ["purple", "orange", "green", "blue", "slate"],
  accessory: ["none", "glasses", "cap"],
};
// Items that need a level unlock before they can be saved.
const ITEM_UNLOCKS = { cap: "avatar_cap", glasses: "avatar_glasses", mohawk: "avatar_mohawk" };
const DEFAULT_AVATAR = { skin: "tan", hairColor: "purple", hairStyle: "short", face: "happy", outfit: "purple", accessory: "none" };

function studentRoutes(db, { claimLimiter }) {
  const r = express.Router();

  r.get("/me", (req, res) => {
    const info = getLevelInfo(totalXp(db, req.user.id));
    const av = db.prepare("SELECT config FROM avatars WHERE user_id = ?").get(req.user.id);
    res.json({ user: req.user, ...info, unlocks: unlocksForLevel(info.level), avatar: av ? JSON.parse(av.config) : DEFAULT_AVATAR });
  });

  r.get("/activities", (req, res) => {
    const rows = db.prepare(`
      SELECT a.id, a.title, a.description, a.duration, a.xp, a.requires_marking AS requiresMarking,
             c.status AS claimStatus
      FROM activities a
      LEFT JOIN claims c ON c.activity_id = a.id AND c.user_id = ?
      WHERE a.active = 1 ORDER BY a.id`).all(req.user.id);
    res.json(rows.map((a) => ({ ...a, requiresMarking: !!a.requiresMarking, status: a.claimStatus || "open" })));
  });

  // Core rule: one claim per student per activity, XP awarded by the server only.
  r.post("/activities/:id/claim", claimLimiter || ((_q, _s, n) => n()), (req, res) => {
    const activity = db.prepare("SELECT * FROM activities WHERE id = ? AND active = 1").get(req.params.id);
    if (!activity) return res.status(404).json({ error: "Activity not found" });
    const evidence = typeof req.body?.evidence === "string" ? req.body.evidence.slice(0, 1000) : "";
    if (activity.requires_marking && evidence.trim().length === 0) return res.status(400).json({ error: "This activity needs evidence for an educator to mark" });

    const before = getLevelInfo(totalXp(db, req.user.id));
    const run = db.transaction(() => {
      const status = activity.requires_marking ? "pending" : "approved";
      db.prepare("INSERT INTO claims (user_id, activity_id, status, evidence) VALUES (?,?,?,?)").run(req.user.id, activity.id, status, evidence);
      if (status === "approved") {
        db.prepare("INSERT INTO xp_ledger (user_id, activity_id, points, reason) VALUES (?,?,?,?)").run(req.user.id, activity.id, activity.xp, `Claimed: ${activity.title}`);
      }
      audit(db, req.user.id, "claim", `activity=${activity.id} status=${status}`);
      return status;
    });
    let status;
    try {
      status = run();
    } catch (e) {
      if (isConstraintError(e)) return res.status(409).json({ error: "You have already claimed this activity" });
      throw e;
    }
    const after = getLevelInfo(totalXp(db, req.user.id));
    res.status(201).json({
      status,
      xpAwarded: status === "approved" ? activity.xp : 0,
      ...after,
      leveledUp: after.level > before.level,
      newUnlocks: unlocksForLevel(after.level).filter((u) => !unlocksForLevel(before.level).includes(u)),
    });
  });

  r.get("/gigs", (req, res) => {
    const rows = db.prepare(`
      SELECT g.*, ga.status AS applicationStatus
      FROM gigs g LEFT JOIN gig_applications ga ON ga.gig_id = g.id AND ga.user_id = ?
      ORDER BY g.id`).all(req.user.id);
    res.json(rows.map((g) => ({
      id: g.id, title: g.title, posterName: g.poster_name, posterOrg: g.poster_org, description: g.description,
      tier: g.tier, timeframe: g.timeframe, pay: g.pay, tags: g.tags ? g.tags.split(",") : [],
      applied: g.applicationStatus === "active", applicationStatus: g.applicationStatus || null,
    })));
  });

  // Team decision (Sat 10 Oct): one gig at a time per student.
  r.post("/gigs/:id/apply", (req, res) => {
    const gig = db.prepare("SELECT id FROM gigs WHERE id = ?").get(req.params.id);
    if (!gig) return res.status(404).json({ error: "Gig not found" });
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
    const level = getLevelInfo(totalXp(db, req.user.id)).level;
    const clean = {};
    for (const [key, allowed] of Object.entries(AVATAR_OPTIONS)) {
      if (!allowed.includes(cfg[key])) return res.status(400).json({ error: `Invalid ${key}`, allowed });
      const needs = ITEM_UNLOCKS[cfg[key]];
      if (needs && !isUnlocked(needs, level)) return res.status(403).json({ error: `"${cfg[key]}" is not unlocked at level ${level}` });
      clean[key] = cfg[key];
    }
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
    res.status(201).json({ id: info.lastInsertRowid, shared: shared === true });
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
