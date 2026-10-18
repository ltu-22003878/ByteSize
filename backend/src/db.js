// Node's built-in SQLite (node:sqlite, Node 22.13 or newer): nothing to compile,
// so install works on any machine. See docs/DECISIONS.md, decision 2.
const { DatabaseSync } = require("node:sqlite");
const fs = require("fs");
const path = require("path");

// Schema is plain, portable SQL (no SQLite-only tricks beyond AUTOINCREMENT
// spelling) so it can move to MySQL or Postgres for deployment. See
// docs/DECISIONS.md, decision 2.
const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('student','educator','employer')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Ids are short readable text (daily_checkin) because the site already uses them.
CREATE TABLE IF NOT EXISTS activities (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  duration TEXT NOT NULL DEFAULT '',
  base_xp INTEGER NOT NULL CHECK (base_xp >= 0 AND base_xp <= 1000),
  type TEXT NOT NULL CHECK (type IN ('daily','one_time','repeatable')),
  daily_limit INTEGER NOT NULL DEFAULT 1 CHECK (daily_limit >= 1),
  cooldown_minutes INTEGER NOT NULL DEFAULT 0 CHECK (cooldown_minutes >= 0),
  requires_capability TEXT,
  requires_marking INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_by INTEGER REFERENCES users(id)
);

-- Work an educator or employer sets for one student, with bonus XP on top.
CREATE TABLE IF NOT EXISTS assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  activity_id TEXT NOT NULL REFERENCES activities(id),
  assigned_by INTEGER NOT NULL REFERENCES users(id),
  note TEXT NOT NULL DEFAULT '',
  due_date TEXT,
  bonus_xp INTEGER NOT NULL DEFAULT 0 CHECK (bonus_xp >= 0 AND bonus_xp <= 100),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','submitted','completed')),
  created_at TEXT NOT NULL
);

-- Every attempt that passed the rules. once_key and daily_key are what the
-- database itself uses to stop a one-time activity being claimed twice, or a
-- daily one twice in a day, even if two requests arrive together. They stay
-- empty for repeatable activities, so those are not blocked by the keys.
CREATE TABLE IF NOT EXISTS claims (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  activity_id TEXT NOT NULL REFERENCES activities(id),
  assignment_id INTEGER REFERENCES assignments(id),
  status TEXT NOT NULL CHECK (status IN ('pending','approved','rejected')),
  points INTEGER NOT NULL,
  evidence TEXT NOT NULL DEFAULT '',
  day TEXT NOT NULL,
  once_key TEXT,
  daily_key TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (user_id, once_key),
  UNIQUE (user_id, daily_key)
);

-- The XP ledger: every XP change is a row. A student's total is the sum,
-- so history is auditable and nothing can be "set" directly.
CREATE TABLE IF NOT EXISTS xp_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  activity_id TEXT REFERENCES activities(id),
  claim_id INTEGER REFERENCES claims(id),
  points INTEGER NOT NULL,
  reason TEXT NOT NULL,
  day TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS marks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  claim_id INTEGER NOT NULL REFERENCES claims(id),
  marker_id INTEGER NOT NULL REFERENCES users(id),
  criterion TEXT NOT NULL,
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 4),
  comment TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS gigs (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  poster_name TEXT NOT NULL,
  poster_org TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  tier TEXT NOT NULL DEFAULT 'Starter',
  timeframe TEXT NOT NULL DEFAULT '',
  pay TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '',
  requires_capability TEXT
);

-- status 'active' means the student currently holds the gig.
CREATE TABLE IF NOT EXISTS gig_applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  gig_id TEXT NOT NULL REFERENCES gigs(id),
  status TEXT NOT NULL CHECK (status IN ('active','completed','withdrawn')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, gig_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sender_id INTEGER NOT NULL REFERENCES users(id),
  recipient_id INTEGER NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS diary_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  shared INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS course_progress (
  user_id INTEGER NOT NULL REFERENCES users(id),
  course_id TEXT NOT NULL,
  modules_done INTEGER NOT NULL DEFAULT 0 CHECK(modules_done >= 0),
  PRIMARY KEY (user_id, course_id)
);

CREATE TABLE IF NOT EXISTS avatars (
  user_id INTEGER PRIMARY KEY REFERENCES users(id),
  config TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  action TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

function openDb(file) {
  const target = file || process.env.DB_FILE || "./data/alumable.db";
  if (target !== ":memory:") fs.mkdirSync(path.dirname(path.resolve(target)), { recursive: true });
  const db = new DatabaseSync(target);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  db.exec(SCHEMA);
  const gigCols=db.prepare('PRAGMA table_info(gigs)').all().map(c=>c.name);
  if(!gigCols.includes('owner_id'))db.exec('ALTER TABLE gigs ADD COLUMN owner_id INTEGER REFERENCES users(id)');
  if(!gigCols.includes('min_level'))db.exec('ALTER TABLE gigs ADD COLUMN min_level INTEGER NOT NULL DEFAULT 1');
  // node:sqlite has no transaction helper, so add a small one: all-or-nothing.
  db.transaction = (fn) => (...args) => {
    db.exec("BEGIN");
    try {
      const result = fn(...args);
      db.exec("COMMIT");
      return result;
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }
  };
  return db;
}

// True when SQLite rejected a write because of a UNIQUE / CHECK / FOREIGN KEY rule.
function isConstraintError(err) {
  return (typeof err.errcode === "number" && (err.errcode & 0xff) === 19) || /constraint failed/i.test(String(err.message));
}

function audit(db, userId, action, detail = "") {
  db.prepare("INSERT INTO audit_log (user_id, action, detail) VALUES (?, ?, ?)").run(userId ?? null, action, detail);
}

function totalXp(db, userId) {
  const row = db.prepare("SELECT COALESCE(SUM(points),0) AS total FROM xp_ledger WHERE user_id = ?").get(userId);
  return row.total;
}

module.exports = { openDb, audit, totalXp, isConstraintError };
