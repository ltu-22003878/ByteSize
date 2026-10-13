const express = require("express");
const { audit, totalXp } = require("../db");
const { RULES, ACTIVITY_TYPES, capability, getLevelInfo, dayKey } = require("../xp");

// PLACEHOLDER rubric until Scott confirms what an assessor needs to mark a gig.
// It is modelled on a normal assessment rubric: weighted criteria, each scored
// 0 to 4 against written level descriptions. The API labels it as a placeholder
// so the interface and the Handover Report can say so honestly.
const LEVELS = ["Not shown", "Emerging", "Competent", "Strong", "Exceptional"];
const PLACEHOLDER_RUBRIC = {
  placeholder: true,
  note: "Placeholder rubric pending confirmation from the coordinator.",
  scale: { min: 0, max: 4, levels: LEVELS },
  criteria: [
    {
      id: "brief", name: "Meets the client's brief", weight: 30,
      descriptors: [
        "No usable response to the brief.",
        "Addresses part of the brief; key requirements missing.",
        "Meets the stated requirements with minor gaps.",
        "Meets all requirements and checks them against the brief.",
        "Meets all requirements and spots an unstated need the client would value.",
      ],
    },
    {
      id: "craft", name: "Quality of the work", weight: 25,
      descriptors: [
        "Work is incomplete or unusable.",
        "Usable but rough; errors a client would notice.",
        "Clean and correct; ready with light edits.",
        "Polished and consistent; ready to hand over.",
        "Polished, and shows judgement in the choices made.",
      ],
    },
    {
      id: "communication", name: "Communication with the client", weight: 20,
      descriptors: [
        "No contact, or unprofessional contact.",
        "Replies, but late or unclear.",
        "Clear and timely updates.",
        "Clear updates, asks useful questions, sets expectations.",
        "Manages the client well, including handling a change or a problem.",
      ],
    },
    {
      id: "scope", name: "Time and scope management", weight: 15,
      descriptors: [
        "Missed the deadline with no notice.",
        "Late, or scope drifted without being raised.",
        "Delivered on time, close to scope.",
        "On time and in scope; flagged risks early.",
        "On time and in scope; adjusted the plan sensibly when something changed.",
      ],
    },
    {
      id: "reflection", name: "Reflection on what was learned", weight: 10,
      descriptors: [
        "No reflection.",
        "Describes what happened but not why.",
        "Identifies one strength and one weakness.",
        "Links lessons to specific moments in the gig.",
        "Links lessons to specific moments and says what will change next time.",
      ],
    },
  ],
};

// Weighted result as a percentage, 0 to 100, rounded to one decimal.
function weightedScore(scoresById) {
  let total = 0;
  for (const c of PLACEHOLDER_RUBRIC.criteria) total += (scoresById[c.id] / 4) * c.weight;
  return Math.round(total * 10) / 10;
}

function educatorRoutes(db, { clock = () => new Date() } = {}) {
  const r = express.Router();

  // Employers can set assignments and see students; marking, activities and
  // the security log are for educators only.
  const onlyEducator = (req, res, next) => (req.user.role === "educator" ? next() : res.status(403).json({ error: "Educators only" }));

  r.get("/rubric", onlyEducator, (_req, res) => res.json(PLACEHOLDER_RUBRIC));

  function slugify(title) {
    return title.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40);
  }

  // Checks every field the educator can set on an activity. Returns database
  // column names so the caller never builds SQL from user input.
  function validActivity(b, partial) {
    const out = {};
    const text = (key, col, max, required) => {
      if (b[key] === undefined && !required) return null;
      if (typeof b[key] !== "string" || (required && !b[key].trim()) || b[key].length > max) return `${key} must be text up to ${max} characters`;
      out[col] = b[key].trim();
      return null;
    };
    const int = (key, col, min, max) => {
      if (b[key] === undefined) return null;
      if (!Number.isInteger(b[key]) || b[key] < min || b[key] > max) return `${key} must be a whole number from ${min} to ${max}`;
      out[col] = b[key];
      return null;
    };
    const bool = (key, col) => {
      if (b[key] === undefined) return null;
      if (typeof b[key] !== "boolean") return `${key} must be true or false`;
      out[col] = b[key] ? 1 : 0;
      return null;
    };
    if (!partial && b.baseXp === undefined) return { error: "baseXp is required" };
    const problems = [
      text("title", "title", 120, !partial || b.title !== undefined),
      text("description", "description", 1000, false),
      text("category", "category", 40, false),
      text("duration", "duration", 40, false),
      int("baseXp", "base_xp", 0, RULES.maxActivityPoints),
      int("dailyLimit", "daily_limit", 1, 20),
      int("cooldownMinutes", "cooldown_minutes", 0, 1440),
      bool("requiresMarking", "requires_marking"),
      bool("active", "active"),
    ].filter(Boolean);
    if (problems.length) return { error: problems[0] };
    if (b.type !== undefined) {
      if (!ACTIVITY_TYPES.includes(b.type)) return { error: `type must be one of ${ACTIVITY_TYPES.join(", ")}` };
      out.type = b.type;
    } else if (!partial) out.type = "repeatable";
    if (b.requiresCapability !== undefined) {
      if (b.requiresCapability !== null && !capability(b.requiresCapability)) return { error: "requiresCapability must be null or a known capability id" };
      out.requires_capability = b.requiresCapability;
    }
    return { value: out };
  }

  r.post("/activities", onlyEducator, (req, res) => {
    const v = validActivity(req.body || {}, false);
    if (v.error) return res.status(400).json({ error: v.error });
    const id = slugify(v.value.title);
    if (!id) return res.status(400).json({ error: "Title needs at least one letter or number" });
    if (db.prepare("SELECT id FROM activities WHERE id = ?").get(id)) return res.status(409).json({ error: "An activity with that title already exists" });
    const a = { description: "", category: "", duration: "", daily_limit: 1, cooldown_minutes: 0, requires_capability: null, requires_marking: 0, ...v.value };
    db.prepare(`INSERT INTO activities (id, title, description, category, duration, base_xp, type, daily_limit, cooldown_minutes, requires_capability, requires_marking, created_by)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(id, a.title, a.description, a.category, a.duration, a.base_xp, a.type, a.daily_limit, a.cooldown_minutes, a.requires_capability, a.requires_marking, req.user.id);
    audit(db, req.user.id, "activity_create", `id=${id}`);
    res.status(201).json({ id });
  });

  r.put("/activities/:id", onlyEducator, (req, res) => {
    const v = validActivity(req.body || {}, true);
    if (v.error) return res.status(400).json({ error: v.error });
    const keys = Object.keys(v.value);
    if (keys.length === 0) return res.status(400).json({ error: "Nothing to update" });
    const old = db.prepare("SELECT base_xp FROM activities WHERE id = ?").get(req.params.id);
    if (!old) return res.status(404).json({ error: "Activity not found" });
    // Column names come from the fixed object built above, never from user input.
    const sql = `UPDATE activities SET ${keys.map((k) => `${k} = ?`).join(", ")} WHERE id = ?`;
    db.prepare(sql).run(...keys.map((k) => v.value[k]), req.params.id);
    if (v.value.base_xp !== undefined && v.value.base_xp !== old.base_xp) {
      // Past awards stay as they were: only future claims use the new value.
      audit(db, req.user.id, "points_changed", `activity=${req.params.id} ${old.base_xp} -> ${v.value.base_xp} (past awards unchanged)`);
    }
    audit(db, req.user.id, "activity_update", `id=${req.params.id}`);
    res.json({ updated: keys });
  });

  // Students, so an educator or employer can pick who to assign work to.
  r.get("/students", (_req, res) => {
    const rows = db.prepare("SELECT id, name, email FROM users WHERE role = 'student' ORDER BY id").all();
    res.json(rows.map((u) => ({ ...u, ...getLevelInfo(totalXp(db, u.id)) })));
  });

  r.post("/assignments", (req, res) => {
    const { studentId, activityId, note, dueDate, bonusXp } = req.body || {};
    if (!Number.isInteger(studentId) || !db.prepare("SELECT id FROM users WHERE id = ? AND role = 'student'").get(studentId)) return res.status(400).json({ error: "studentId must be a student's id" });
    if (typeof activityId !== "string" || !db.prepare("SELECT id FROM activities WHERE id = ? AND active = 1").get(activityId)) return res.status(400).json({ error: "activityId must be an active activity" });
    if (note !== undefined && (typeof note !== "string" || note.length > 500)) return res.status(400).json({ error: "note must be text up to 500 characters" });
    if (dueDate !== undefined && (typeof dueDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate))) return res.status(400).json({ error: "dueDate must look like 2026-10-20" });
    const bonus = bonusXp === undefined ? 0 : bonusXp;
    if (!Number.isInteger(bonus) || bonus < 0 || bonus > RULES.maxAssignmentBonus) return res.status(400).json({ error: `bonusXp must be a whole number from 0 to ${RULES.maxAssignmentBonus}` });
    const info = db.prepare("INSERT INTO assignments (user_id, activity_id, assigned_by, note, due_date, bonus_xp, created_at) VALUES (?,?,?,?,?,?,?)")
      .run(studentId, activityId, req.user.id, note || "", dueDate || null, bonus, clock().toISOString());
    audit(db, req.user.id, "assignment_create", `student=${studentId} activity=${activityId} bonus=${bonus}`);
    res.status(201).json({ id: Number(info.lastInsertRowid) });
  });

  r.get("/assignments", (req, res) => {
    const rows = db.prepare(`SELECT s.id, s.user_id AS studentId, u.name AS studentName, s.activity_id AS activityId, s.note, s.due_date AS dueDate, s.bonus_xp AS bonusXp, s.status
                             FROM assignments s JOIN users u ON u.id = s.user_id WHERE s.assigned_by = ? ORDER BY s.id`).all(req.user.id);
    res.json(rows);
  });

  // The security log: refused claims, point changes and other guardrail events.
  r.get("/audit", onlyEducator, (_req, res) => {
    res.json(db.prepare("SELECT id, user_id AS userId, action, detail, created_at AS createdAt FROM audit_log ORDER BY id DESC LIMIT 100").all());
  });

  r.get("/claims", onlyEducator, (req, res) => {
    const status = ["pending", "approved", "rejected"].includes(req.query.status) ? req.query.status : "pending";
    const rows = db.prepare(`
      SELECT c.id, c.status, c.evidence, c.points, c.created_at AS createdAt, u.id AS studentId, u.name AS studentName,
             a.id AS activityId, a.title AS activityTitle
      FROM claims c JOIN users u ON u.id = c.user_id JOIN activities a ON a.id = c.activity_id
      WHERE c.status = ? ORDER BY c.id`).all(status);
    res.json(rows);
  });

  // Mark a pending claim against the rubric. XP is awarded here, on approval,
  // using the amount worked out when the student made the claim.
  r.post("/claims/:id/mark", onlyEducator, (req, res) => {
    const { marks, decision } = req.body || {};
    if (!["approve", "reject"].includes(decision)) return res.status(400).json({ error: "decision must be approve or reject" });
    if (!Array.isArray(marks)) return res.status(400).json({ error: "marks must be a list with one entry per rubric criterion" });
    const scores = {};
    for (const m of marks) {
      if (!PLACEHOLDER_RUBRIC.criteria.some((c) => c.id === m.criterion)) return res.status(400).json({ error: `Unknown criterion "${m.criterion}"` });
      if (m.criterion in scores) return res.status(400).json({ error: `Criterion "${m.criterion}" was scored twice` });
      if (!Number.isInteger(m.score) || m.score < 0 || m.score > 4) return res.status(400).json({ error: "Scores must be whole numbers from 0 to 4" });
      if (m.comment !== undefined && (typeof m.comment !== "string" || m.comment.length > 500)) return res.status(400).json({ error: "Comments are limited to 500 characters" });
      scores[m.criterion] = m.score;
    }
    const missing = PLACEHOLDER_RUBRIC.criteria.filter((c) => !(c.id in scores)).map((c) => c.id);
    if (missing.length) return res.status(400).json({ error: "Every criterion needs a score", missing });
    const now = clock();
    const run = db.transaction(() => {
      const claim = db.prepare("SELECT c.*, a.title FROM claims c JOIN activities a ON a.id = c.activity_id WHERE c.id = ?").get(req.params.id);
      if (!claim) return { code: 404, error: "Claim not found" };
      if (claim.status !== "pending") return { code: 409, error: "This claim has already been marked" };
      const insMark = db.prepare("INSERT INTO marks (claim_id, marker_id, criterion, score, comment) VALUES (?,?,?,?,?)");
      for (const m of marks) insMark.run(claim.id, req.user.id, m.criterion, m.score, m.comment || "");
      const status = decision === "approve" ? "approved" : "rejected";
      if (status === "approved") {
        db.prepare("UPDATE claims SET status = 'approved' WHERE id = ?").run(claim.id);
        db.prepare("INSERT INTO xp_ledger (user_id, activity_id, claim_id, points, reason, day, created_at) VALUES (?,?,?,?,?,?,?)")
          .run(claim.user_id, claim.activity_id, claim.id, claim.points, `Approved: ${claim.title}`, dayKey(now), now.toISOString());
        if (claim.assignment_id) db.prepare("UPDATE assignments SET status = 'completed' WHERE id = ?").run(claim.assignment_id);
      } else {
        // A rejected claim frees the once-only keys so the student can try again,
        // and puts any assignment back to open.
        db.prepare("UPDATE claims SET status = 'rejected', once_key = NULL, daily_key = NULL WHERE id = ?").run(claim.id);
        if (claim.assignment_id) db.prepare("UPDATE assignments SET status = 'open' WHERE id = ?").run(claim.assignment_id);
      }
      audit(db, req.user.id, "claim_mark", `claim=${claim.id} decision=${decision}`);
      return { code: 200, status, xpAwarded: status === "approved" ? claim.points : 0, weightedScore: weightedScore(scores) };
    });
    const out = run();
    if (out.error) return res.status(out.code).json({ error: out.error });
    res.json({ status: out.status, xpAwarded: out.xpAwarded, weightedScore: out.weightedScore });
  });

  // Educators see only the diary entries a student chose to share.
  r.get("/students/:id/diary", onlyEducator, (req, res) => {
    const rows = db.prepare("SELECT id, body, created_at AS createdAt FROM diary_entries WHERE user_id = ? AND shared = 1 ORDER BY id DESC").all(req.params.id);
    res.json(rows);
  });

  // Educator or employer confirms a gig is finished, which frees the student's slot.
  r.post("/gig-applications/:id/complete", (req, res) => {
    const info = db.prepare("UPDATE gig_applications SET status = 'completed' WHERE id = ? AND status = 'active'").run(req.params.id);
    if (info.changes === 0) return res.status(404).json({ error: "No active application with that id" });
    audit(db, req.user.id, "gig_complete", `application=${req.params.id}`);
    res.json({ status: "completed" });
  });

  return r;
}

module.exports = { educatorRoutes, PLACEHOLDER_RUBRIC, weightedScore };
