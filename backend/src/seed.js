// Demo data copied from the prototype's mockData.js so the API and the
// front end show the same activities and gigs. Safe to run repeatedly.
const bcrypt = require("bcryptjs");
const { openDb } = require("./db");

const activities = [
  ["Daily Check-in", "Open the app and check in for the day.", "1 min", 20, 0],
  ["Upload a Certificate", "Add a certificate you've earned elsewhere to your profile.", "5 min", 75, 1],
  ["Finish a Learn Module", "Complete any single module inside the Learn section.", "30 min", 100, 1],
  ["Add a Portfolio Piece", "Upload a piece of work to showcase on your profile.", "1 hr", 150, 1],
  ["Refer a Friend", "Invite a course-mate to join Alumable.", "2 min", 50, 0],
  ["Complete Your Profile", "Fill in your skills, interests and bio.", "5 min", 40, 0],
];

const gigs = [
  ["Logo redesign for a café rebrand", "Jake R.", "Greenleaf Café owner", "Need a fresh logo for our inner-city café.", "Starter", "3–5 days", "$80 fixed", "Design,Branding"],
  ["3 blog posts on sustainable living", "Emma K.", "EcoNest blog editor", "800-word posts targeting Melbourne millennials.", "Starter", "1 week", "$60 fixed", "Writing,Content"],
  ["Instagram content calendar", "Zara T.", "Fold Studio", "Plan four weeks of posts for a small fashion label.", "Starter", "1 month", "$120 fixed", "Marketing,Design"],
  ["Landing page copy for a fintech app", "Marcus D.", "PayNest", "Punchy, clear copy for a 1-page landing site.", "Growth", "4 days", "$140 fixed", "Writing,Marketing"],
  ["Small bug fixes on a React site", "Aisha P.", "Local tutoring startup", "A few layout bugs and a broken contact form.", "Starter", "2–3 days", "$90 fixed", "Dev"],
];

function seed(db) {
  if (db.prepare("SELECT COUNT(*) AS n FROM activities").get().n === 0) {
    const ins = db.prepare("INSERT INTO activities (title, description, duration, xp, requires_marking) VALUES (?,?,?,?,?)");
    for (const a of activities) ins.run(...a);
  }
  if (db.prepare("SELECT COUNT(*) AS n FROM gigs").get().n === 0) {
    const ins = db.prepare("INSERT INTO gigs (title, poster_name, poster_org, description, tier, timeframe, pay, tags) VALUES (?,?,?,?,?,?,?,?)");
    for (const g of gigs) ins.run(...g);
  }
  if (db.prepare("SELECT COUNT(*) AS n FROM users").get().n === 0) {
    const ins = db.prepare("INSERT INTO users (email, name, password_hash, role) VALUES (?,?,?,?)");
    // Demo accounts only. Passwords are for local demos, never real credentials.
    ins.run("priya@example.com", "Priya Sharma", bcrypt.hashSync("student-demo-1", 10), "student");
    ins.run("educator@example.com", "Demo Educator", bcrypt.hashSync("educator-demo-1", 10), "educator");
  }
}

module.exports = { seed };

if (require.main === module) {
  const db = openDb();
  seed(db);
  console.log("Seeded demo data: 6 activities, 5 gigs, 2 demo users.");
}
