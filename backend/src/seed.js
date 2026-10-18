// Demo data copied from the shared site (ByteSize repo, src/db.js) so the API
// and the front end start from the same activities, gigs and student.
// Safe to run repeatedly: each block only runs when its table is empty.
const bcrypt = require("bcryptjs");
const { openDb } = require("./db");
const { dayKey } = require("./xp");

// id, title, description, category, duration, base_xp, type, daily_limit, cooldown_minutes, requires_capability
const activities = [
  ["daily_checkin", "Daily check-in", "Check in each day to keep your streak going. Longer streaks earn a bonus.", "Daily", "1 min", 10, "daily", 1, 0, null],
  ["complete_profile", "Complete your profile", "Fill in your bio, skills and interests so companies can find you.", "Profile", "5 min", 50, "one_time", 1, 0, null],
  ["upload_certificate", "Upload a certificate", "Add a certificate from an external provider for verification.", "Certificates", "5 min", 75, "repeatable", 2, 0, null],
  ["learn_module", "Finish a Learn module", "Complete a module in any course on the Learn page.", "Learning", "30 min", 50, "repeatable", 3, 0, null],
  ["portfolio_piece", "Add a portfolio piece", "Showcase a project, essay or design you're proud of.", "Portfolio", "1 hr", 150, "repeatable", 1, 0, null],
  ["refer_friend", "Refer a friend", "Invite a classmate to Alumable with your referral code.", "Community", "2 min", 120, "one_time", 1, 0, null],
  ["mock_interview", "Complete a mock interview", "Practise with an AI-guided mock interview.", "Career", "20 min", 180, "repeatable", 1, 0, "cap_mock_interview"],
  ["employer_challenge", "Employer-sponsored challenge", "A real brief set by a partner company.", "Employer", "2 hr", 300, "repeatable", 1, 0, "cap_employer_challenges"],
];

// id, title, poster, org, description, tier, timeframe, pay, tags, requires_capability
const gigs = [
  ["g1", "Logo redesign for a café rebrand", "Jake R.", "Greenleaf Café owner", "Need a fresh logo for our inner-city café. Brand colours and reference images ready.", "Starter", "3–5 days", "$80 fixed", "Design,Branding", "cap_paid_gigs"],
  ["g2", "3 blog posts on sustainable living", "Emma K.", "EcoNest blog editor", "800-word posts targeting Melbourne millennials. Topic list provided.", "Starter", "1 week", "$60 fixed", "Writing,Content", "cap_paid_gigs"],
  ["g3", "Instagram content calendar", "Zara T.", "Fold Studio", "Plan four weeks of posts for a small fashion label launching in Melbourne.", "Featured", "1 month", "$120 fixed", "Marketing,Design", "cap_featured_gigs"],
  ["g4", "Landing page copy for a SaaS launch", "Dev P.", "Northwind Labs", "Sharp, conversion-focused copy for a B2B product launch page.", "Pro", "2 weeks", "$300 fixed", "Writing,Marketing", "cap_employer_challenges"],
];

// Priya's history from the site's seed: 1,250 XP in total, which is Level 4.
// activity_id is null for items that are not one of the activities above.
const history = [
  [null, 100, "Welcome bonus", "2026-08-12T09:00:00.000Z"],
  ["complete_profile", 50, "Complete your profile", "2026-08-14T09:00:00.000Z"],
  ["upload_certificate", 150, "Certificate: Google Analytics", "2026-08-20T09:00:00.000Z"],
  ["upload_certificate", 100, "Certificate: Canva Design Fundamentals", "2026-09-01T09:00:00.000Z"],
  ["upload_certificate", 75, "Certificate: HubSpot Content Marketing", "2026-09-05T09:00:00.000Z"],
  [null, 250, "Course completed: Canva Design Fundamentals", "2026-09-08T09:00:00.000Z"],
  [null, 200, "Course completed: Google Analytics", "2026-09-10T09:00:00.000Z"],
  [null, 100, "Gig completed: Poster design", "2026-09-12T09:00:00.000Z"],
  [null, 100, "Gig completed: Product photos", "2026-09-16T09:00:00.000Z"],
  [null, 100, "Gig completed: Social captions", "2026-09-20T09:00:00.000Z"],
  ["daily_checkin", 25, "Daily check-in", "2026-09-27T09:00:00.000Z"],
];

function seed(db) {
  if (db.prepare("SELECT COUNT(*) AS n FROM activities").get().n === 0) {
    const ins = db.prepare("INSERT INTO activities (id, title, description, category, duration, base_xp, type, daily_limit, cooldown_minutes, requires_capability) VALUES (?,?,?,?,?,?,?,?,?,?)");
    for (const a of activities) ins.run(...a);
  }
  if (db.prepare("SELECT COUNT(*) AS n FROM gigs").get().n === 0) {
    const ins = db.prepare("INSERT INTO gigs (id, title, poster_name, poster_org, description, tier, timeframe, pay, tags, requires_capability) VALUES (?,?,?,?,?,?,?,?,?,?)");
    for (const g of gigs) ins.run(...g);
  }
  if (db.prepare("SELECT COUNT(*) AS n FROM users").get().n === 0) {
    const ins = db.prepare("INSERT INTO users (email, name, password_hash, role) VALUES (?,?,?,?)");
    // Demo accounts only. Passwords are for local demos, never real credentials.
    // Priya must be user 1: the history and assignments below belong to her.
    ins.run("priya@example.com", "Priya Sharma", bcrypt.hashSync("student-demo-1", 10), "student");
    ins.run("educator@example.com", "Dr. Helen Lee", bcrypt.hashSync("educator-demo-1", 10), "educator");
    ins.run("employer@example.com", "Greenleaf Café", bcrypt.hashSync("employer-demo-1", 10), "employer");

    const priya = db.prepare("SELECT id FROM users WHERE email = ?").get("priya@example.com").id;
    const educator = db.prepare("SELECT id FROM users WHERE email = ?").get("educator@example.com").id;
    const employer = db.prepare("SELECT id FROM users WHERE email = ?").get("employer@example.com").id;
    const typeOf = new Map(activities.map((a) => [a[0], a[6]]));

    for (const [activityId, points, reason, at] of history) {
      const day = dayKey(new Date(at));
      let claimId = null;
      if (activityId) {
        // A claim row for every activity-linked item, so one-time and daily rules see the history.
        const type = typeOf.get(activityId);
        const info = db.prepare("INSERT INTO claims (user_id, activity_id, status, points, day, once_key, daily_key, created_at) VALUES (?,?, 'approved', ?,?,?,?,?)")
          .run(priya, activityId, points, day, type === "one_time" ? activityId : null, type === "daily" ? `${activityId}:${day}` : null, at);
        claimId = Number(info.lastInsertRowid);
      }
      db.prepare("INSERT INTO xp_ledger (user_id, activity_id, claim_id, points, reason, day, created_at) VALUES (?,?,?,?,?,?,?)")
        .run(priya, activityId, claimId, points, reason, day, at);
    }

    const now = new Date().toISOString();
    const asg = db.prepare("INSERT INTO assignments (user_id, activity_id, assigned_by, note, due_date, bonus_xp, created_at) VALUES (?,?,?,?,?,?,?)");
    asg.run(priya, "portfolio_piece", educator, "Add your best marketing case study to your portfolio.", "2026-10-02", 25, now);
    asg.run(priya, "upload_certificate", employer, "Upload a design-related certificate for our gig shortlist.", "2026-10-05", 15, now);
  }
  // Initialise the new course progress table on both fresh and existing demo databases.
  // ON CONFLICT preserves modules already completed after an upgrade.
  const demoStudent = db.prepare("SELECT id FROM users WHERE email = ?").get("priya@example.com");
  if (demoStudent) {
    const initProgress = db.prepare("INSERT INTO course_progress (user_id, course_id, modules_done) VALUES (?,?,?) ON CONFLICT(user_id, course_id) DO NOTHING");
    for (const [courseId, done] of [["co1", 2], ["co2", 0], ["co3", 5], ["co4", 1]]) initProgress.run(demoStudent.id, courseId, done);
  }
}

module.exports = { seed };

if (require.main === module) {
  const db = openDb();
  seed(db);
  console.log(`Seeded demo data: ${activities.length} activities, ${gigs.length} gigs, 3 demo users, 2 assignments.`);
}
