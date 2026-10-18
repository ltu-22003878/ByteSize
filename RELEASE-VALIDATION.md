# Alumable integrated release — evidence and acceptance

**Release candidate: 14 October 2026.** This is the agreed arcade website (opening poster removed; night/light modes). The new code connects student XP, claim eligibility, course progress, gig applications, avatar settings, diary and XP history to the Express/SQLite backend. The original server XP rules remain unchanged.

## Observed evidence from the previous release

- Team Mac: Node.js v24.21.0, npm 11.19.0.
- Backend automated tests: **39 passed, 0 failed**, as shown in a 14 October screenshot. These tests ran **before** the latest integration changes.
- `GET /api/health` displayed `{"ok":true}` in the browser.
- Arcade website launched, and users confirmed Light/Night mode and theme persistence.
- Browser-local XP changed **1,665 → 1,690** after a daily check-in and survived refresh, but Incognito still displayed **1,250**. That discrepancy led to this integrated release.
- Previous frontend `npm install` output reported **one high-severity vulnerability**, but did not identify the affected dependency. It is not evidence of a clean audit for the updated release.

## Updated release checks performed in preparation

- **10/10** standalone XP rule tests passed using Node.js (no extra dependencies needed).
- All backend JavaScript files passed `node --check` syntax validation.
- All frontend JSX/JavaScript source files passed local TypeScript JSX parsing (syntax-only).
- The original backend `src/xp.js` rules and Light/Night mode CSS match the previous package.
- A full `npm install`, frontend build and npm security audit **could not be verified here** because the npm registry was unreachable; no clean-audit claim is made.

## Required steps for final acceptance on the team Mac

With ports **4000** and **5173** available:

**Terminal A:**

```bash
cd backend
npm ci
npm test
npm start
```

**Terminal B** (from the project root):

```bash
npm install
npm run build
npm test
npm audit --audit-level=high
npm run dev
```

1. Log in as `priya@example.com` in normal Chrome and Incognito. Both must initially display the same server-backed XP (1,250 for a newly seeded database).
2. Claim an available activity once; refresh both sessions. Both should show the same new XP and eligibility.
3. Confirm duplicate claims are denied; check the ledger and daily XP counters.
4. Complete a Learn module and confirm its module count and awarded XP persist together.
5. Test educator and employer role access, diary privacy, gig applications and avatar saving.
6. Confirm Light/Night mode still works and persists locally; obtain client feedback and approval.

Keep screenshots or test logs from this **updated release** alongside the handover report. Do not present the earlier 39/39 screenshot as proof that these new integration checks passed.

## Security warning

The dependency manifest requests React Router 8.4+ and Vite 8.3.4+, but **installed dependency versions and `npm audit` results are pending** until packages can be fetched and tested on your Mac. Do not use `npm audit fix --force` without reading the advisory and retesting. Local/demo accounts and fallback JWT settings must not be used in production.

## Important migration note

The previous frontend-only `localStorage` value `alumable-db-v1` is deliberately ignored by the new frontend. Do not import the browser-local 1,690 XP into the backend, because it is not an authenticated server transaction. The browser's Light/Night preference remains local by design.
