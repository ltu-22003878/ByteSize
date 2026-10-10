const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const express = require("express");
const { audit } = require("./db");

function secret() {
  const s = process.env.JWT_SECRET;
  if (!s) {
    if (process.env.NODE_ENV === "production") throw new Error("JWT_SECRET must be set in production");
    return "dev-only-secret-do-not-use-in-production";
  }
  return s;
}

function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, secret(), { expiresIn: "2h" });
}

function requireAuth(db) {
  return (req, res, next) => {
    const header = req.get("authorization") || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Sign in required" });
    try {
      const payload = jwt.verify(token, secret());
      const user = db.prepare("SELECT id, email, name, role FROM users WHERE id = ?").get(payload.sub);
      if (!user) return res.status(401).json({ error: "Account no longer exists" });
      req.user = user;
      next();
    } catch {
      res.status(401).json({ error: "Invalid or expired token" });
    }
  };
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ error: "Not allowed for your role" });
    next();
  };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function authRoutes(db, { authLimiter }) {
  const r = express.Router();
  if (authLimiter) r.use(authLimiter);

  // Only students can self-register. Educator and employer accounts are
  // created by an administrator (see seed.js), so nobody can pick their own role.
  r.post("/register", (req, res) => {
    const { email, name, password } = req.body || {};
    if (typeof email !== "string" || !EMAIL_RE.test(email) || email.length > 254) return res.status(400).json({ error: "A valid email is required" });
    if (typeof name !== "string" || name.trim().length < 1 || name.length > 80) return res.status(400).json({ error: "Name is required (max 80 characters)" });
    if (typeof password !== "string" || password.length < 8 || password.length > 72) return res.status(400).json({ error: "Password must be 8 to 72 characters" });
    const exists = db.prepare("SELECT id FROM users WHERE email = ?").get(email.toLowerCase());
    if (exists) return res.status(409).json({ error: "That email is already registered" });
    const info = db.prepare("INSERT INTO users (email, name, password_hash, role) VALUES (?,?,?,'student')")
      .run(email.toLowerCase(), name.trim(), bcrypt.hashSync(password, 10));
    const user = { id: info.lastInsertRowid, role: "student" };
    audit(db, user.id, "register");
    res.status(201).json({ token: signToken(user) });
  });

  r.post("/login", (req, res) => {
    const { email, password } = req.body || {};
    const row = typeof email === "string" ? db.prepare("SELECT * FROM users WHERE email = ?").get(email.toLowerCase()) : null;
    // Same message for unknown email and wrong password, so accounts can't be probed.
    if (!row || typeof password !== "string" || !bcrypt.compareSync(password, row.password_hash)) {
      audit(db, row ? row.id : null, "login_failed");
      return res.status(401).json({ error: "Incorrect email or password" });
    }
    audit(db, row.id, "login");
    res.json({ token: signToken(row), role: row.role });
  });

  return r;
}

module.exports = { signToken, requireAuth, requireRole, authRoutes };
