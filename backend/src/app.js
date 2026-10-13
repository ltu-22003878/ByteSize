const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const { authRoutes, requireAuth, requireRole } = require("./auth");
const { studentRoutes } = require("./routes/student");
const { educatorRoutes } = require("./routes/educator");

function createApp(db, { rateLimiting = true, clock = () => new Date() } = {}) {
  const app = express();
  app.disable("x-powered-by");
  app.use(cors({ origin: process.env.CORS_ORIGIN || "http://localhost:5173" }));
  app.use(express.json({ limit: "10kb" }));

  // Anti-abuse limits (server side, so clients can't skip them).
  const limiter = (windowMs, limit) => rateLimiting
    ? rateLimit({ windowMs, limit, standardHeaders: true, legacyHeaders: false, message: { error: "Too many requests, slow down" } })
    : null;
  const globalLimiter = limiter(15 * 60 * 1000, 300);
  const authLimiter = limiter(15 * 60 * 1000, 20);
  const claimLimiter = limiter(60 * 1000, 20);
  if (globalLimiter) app.use(globalLimiter);

  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  app.use("/api/auth", authRoutes(db, { authLimiter }));
  // Educator routes are mounted first: the student router below is mounted at
  // /api and would otherwise intercept /api/educator/* and return 403.
  app.use("/api/educator", requireAuth(db), requireRole("educator", "employer"), educatorRoutes(db, { clock }));
  app.use("/api", requireAuth(db), requireRole("student"), studentRoutes(db, { claimLimiter, clock }));

  app.use((_req, res) => res.status(404).json({ error: "Not found" }));
  // Never leak stack traces or SQL errors to clients.
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err.type === "entity.parse.failed") return res.status(400).json({ error: "Invalid JSON" });
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
  });
  return app;
}

module.exports = { createApp };
