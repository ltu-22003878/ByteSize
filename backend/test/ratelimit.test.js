const test = require("node:test");
const assert = require("node:assert/strict");
const { startApp } = require("./helpers");

test("login attempts are rate limited", async () => {
  const ctx = await startApp({ rateLimiting: true });
  let last;
  for (let i = 0; i < 25; i++) {
    last = await ctx.call("POST", "/api/auth/login", { body: { email: "priya@example.com", password: "wrong-password" } });
  }
  assert.equal(last.status, 429);
  await ctx.close();
});
