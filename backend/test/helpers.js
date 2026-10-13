const { openDb } = require("../src/db");
const { seed } = require("../src/seed");
const { createApp } = require("../src/app");

// Each test file gets a fresh in-memory database and a real HTTP server.
// The clock is fixed so daily limits and streaks can be tested: call
// setNow(new Date("...")) to move to another day. Default is Mon 12 Oct 2026,
// 12:00 in Melbourne.
async function startApp({ rateLimiting = false } = {}) {
  const db = openDb(":memory:");
  seed(db);
  let now = new Date("2026-10-12T01:00:00Z");
  const app = createApp(db, { rateLimiting, clock: () => now });
  const server = await new Promise((resolve) => { const s = app.listen(0, () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  async function call(method, path, { token, body } = {}) {
    const res = await fetch(base + path, {
      method,
      headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    let json = null;
    try { json = await res.json(); } catch { /* empty body */ }
    return { status: res.status, body: json };
  }
  async function login(email, password) {
    const r = await call("POST", "/api/auth/login", { body: { email, password } });
    return r.body.token;
  }
  return { db, base, call, login, setNow: (d) => { now = d; }, close: () => new Promise((r) => server.close(r)) };
}

module.exports = { startApp };
