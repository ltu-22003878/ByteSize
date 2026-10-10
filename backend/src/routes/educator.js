const express = require("express");
const { audit } = require("../db");

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

function educatorRoutes(db) {
  const r = express.Router();

  r.get("/rubric", (_req, res) => res.json(PLACEHOLDER_RUBRIC));

  function validActivity(b, partial) {
    const out = {};
    if (!partial || b.title !== undefined) {
      if (typeof b.title !== "string" || !b.title.trim() || b.title.length > 120) return { error: "Title is required (max 120 characters)" };
      out.title = b.title.trim();
    }
    if (b.description !== undefined) {
      if (typeof b.description !== "string" || b.description.length > 1000) return { error: "Description must be text up to 1000 characters" };
      out.description = b.description;
    }
    if (b.duration !== undefined) {
      if (typeof b.duration !== "string" || b.duration.length > 40) return { error: "Duration must be short text" };
      out.duration = b.duration;
    }
    if (!partial || b.xp !== undefined) {
      if (!Number.isInteger(b.xp) || b.xp < 0 || b.xp > 500) return { error: "xp must be a whole number from 0 to 500" };
      out.xp = b.xp;
    }
    if (b.requiresMarking !== undefined) {
      if (typeof b.requiresMarking !== "boolean") return { error: "requiresMarking must be true or false" };
      out.requires_marking = b.requiresMarking ? 1 : 0;
    }
    if (b.active !== undefined) {
      if (typeof b.active !== "boolean") return { error: "active must be true or false" };
      out.active = b.active ? 1 : 0;
    }
    return { value: out };
  }

  r.post("/activities", (req, res) => {
    const v = validActivity(req.body || {}, false);
    if (v.error) return res.status(400).json({ error: v.error });
    const a = { description: "", duration: "", requires_marking: 0, ...v.value };
    const info = db.prepare("INSERT INTO activities (title, description, duration, xp, requires_marking, created_by) VALUES (?,?,?,?,?,?)")
      .run(a.title, a.description, a.duration, a.xp, a.requires_marking, req.user.id);
    audit(db, req.user.id, "activity_create", `id=${info.lastInsertRowid}`);
    res.status(201).json({ id: info.lastInsertRowid });
  });

  r.put("/activities/:id", (req, res) => {
    const v = validActivity(req.body || {}, true);
    if (v.error) return res.status(400).json({ error: v.error });
    const keys = Object.keys(v.value);
    if (keys.length === 0) return res.status(400).json({ error: "Nothing to update" });
    // Column names come from the fixed object built above, never from user input.
    const sql = `UPDATE activities SET ${keys.map((k) => `${k} = ?`).join(", ")} WHERE id = ?`;
    const info = db.prepare(sql).run(...keys.map((k) => v.value[k]), req.params.id);
    if (info.changes === 0) return res.status(404).json({ error: "Activity not found" });
    audit(db, req.user.id, "activity_update", `id=${req.params.id}`);
    res.json({ updated: keys });
  });

  r.get("/claims", (req, res) => {
    const status = ["pending", "approved", "rejected"].includes(req.query.status) ? req.query.status : "pending";
    const rows = db.prepare(`
      SELECT c.id, c.status, c.evidence, c.created_at AS createdAt, u.id AS studentId, u.name AS studentName,
             a.id AS activityId, a.title AS activityTitle, a.xp
      FROM claims c JOIN users u ON u.id = c.user_id JOIN activities a ON a.id = c.activity_id
      WHERE c.status = ? ORDER BY c.id`).all(status);
    res.json(rows);
  });

  // Mark a pending claim against the rubric. XP is awarded here, on approval.
  r.post("/claims/:id/mark", (req, res) => {
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
    const run = db.transaction(() => {
      const claim = db.prepare("SELECT c.*, a.xp, a.title FROM claims c JOIN activities a ON a.id = c.activity_id WHERE c.id = ?").get(req.params.id);
      if (!claim) return { code: 404, error: "Claim not found" };
      if (claim.status !== "pending") return { code: 409, error: "This claim has already been marked" };
      const insMark = db.prepare("INSERT INTO marks (claim_id, marker_id, criterion, score, comment) VALUES (?,?,?,?,?)");
      for (const m of marks) insMark.run(claim.id, req.user.id, m.criterion, m.score, m.comment || "");
      const status = decision === "approve" ? "approved" : "rejected";
      db.prepare("UPDATE claims SET status = ? WHERE id = ?").run(status, claim.id);
      if (status === "approved") {
        db.prepare("INSERT INTO xp_ledger (user_id, activity_id, points, reason) VALUES (?,?,?,?)").run(claim.user_id, claim.activity_id, claim.xp, `Approved: ${claim.title}`);
      }
      audit(db, req.user.id, "claim_mark", `claim=${claim.id} decision=${decision}`);
      return { code: 200, status, xpAwarded: status === "approved" ? claim.xp : 0, weightedScore: weightedScore(scores) };
    });
    const out = run();
    if (out.error) return res.status(out.code).json({ error: out.error });
    res.json({ status: out.status, xpAwarded: out.xpAwarded, weightedScore: out.weightedScore });
  });

  // Educators see only the diary entries a student chose to share.
  r.get("/students/:id/diary", (req, res) => {
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
