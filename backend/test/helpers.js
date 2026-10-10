const { openDb } = require("../src/db");
const { seed } = require("../src/seed");
const { createApp } = require("../src/app");

// Each test file gets a fresh in-memory database and a real HTTP server.
async function startApp({ rateLimiting = false } = {}) {
  const db = openDb(":memory:");
  seed(db);
  const app = createApp(db, { rateLimiting });
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
  return { db, base, call, login, close: () => new Promise((r) => server.close(r)) };
}

module.exports = { startApp };
