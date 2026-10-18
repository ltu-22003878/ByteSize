# Alumable Arcade — Integrated Capstone Demo (14 October 2026)

This is the final agreed **no-poster, Light/Night retro-arcade interface**, now connected to the Express/SQLite backend for student XP, levels, activities, course progress, applications, diary and avatar settings. The light/dark preference is intentionally browser-local; student XP is not.

## Important data change

The old frontend saved XP to `localStorage` (`alumable-db-v1`). The integrated version **does not read or award XP from that browser cache**. It fetches the authenticated student's total from `GET /api/me` and claims XP via `POST /api/activities/:id/claim`. Never merge browser-local XP into the server ledger automatically, because that would permit students to forge XP.

For Priya, a *fresh* backend database starts with **1,250 XP at Level 4**. The 1,690 XP seen in the previous local-browser demonstration was not recorded in SQLite; it should not be presented as server-backed achievement.

## Requirements

- Node.js 22.13+ (Node.js 24.21.0 has been confirmed on the team's Mac).
- npm and internet access for installing updated frontend dependencies.
- Ports 4000 (API) and 5173 (frontend) available.
- **Development/demo only**. No claim of AWS/MySQL production deployment or real-client acceptance.

## Run on macOS

Close old Vite processes first. Three instances previously occupied ports 5173–5175, which prevented reliable cross-origin login.

```bash
lsof -nP -iTCP:5173 -iTCP:4000 -sTCP:LISTEN
```

Stop only old frontend processes you recognise, with `Control+C` in the matching Terminal. Do not blindly kill unrelated processes. Open **two Terminal windows** in the unzipped `alumable-final-fixed` folder:

**Terminal A (backend)**

```bash
cd backend
npm ci
npm test
npm start
```

Confirm `http://localhost:4000/api/health` returns `{"ok":true}`. Do not start a second backend on port 4000 if one is already running; stop the old one first.

**Terminal B (frontend)**

```bash
npm install
npm run build
npm run dev
```

Open `http://localhost:5173` (Vite is configured with `strictPort` so it will not silently use another port). The root frontend lockfile is intentionally **not included** because router/Vite dependency versions changed: `npm install` downloads them and generates a fresh matching `package-lock.json` on your Mac. After a validated install, retain that generated file for reproducible future builds.

Alternatively, use `start-mac.command` from Finder; it installs packages and starts both processes if those ports are available.

## Demo accounts (local only)

| Role | Email | Password |
|---|---|---|
| Student | `priya@example.com` | `student-demo-1` |
| Educator | `educator@example.com` | `educator-demo-1` |
| Employer | `employer@example.com` | `employer-demo-1` |

Do not use these credentials or the demo JWT configuration in production.

## Security check (required before final sign-off)

In the frontend root, **after `npm install`**:

```bash
npm audit --audit-level=high
npm ls react-router vite vitest
```

The original frontend installation reported **one high-severity npm audit issue**, but the affected package was not shown in the supplied terminal screenshot. This release removes `react-router-dom` in favour of React Router 8 and requests Vite 8.3.3+ / Vitest 5.0.4+, which address known advisories in earlier dependency versions. **A clean audit has not yet been verified in this environment.** If an issue remains, capture `npm audit --json`, resolve based on its *actual package and advisory*, then rerun build and tests. Do not use `npm audit fix --force` blindly.

Frontend browser UI tests and API integration must also be repeated against this updated release.

## Cross-browser integration acceptance test

1. Start backend and frontend, then log in as Priya in normal Chrome and a separate Incognito session.
2. Record the same initial XP in both. A new backend database shows 1,250 XP in both.
3. Choose an available server-enabled activity (e.g. daily check-in), note the quoted XP, and claim **once**.
4. Refresh both sessions: XP and daily limit status must now match, without using browser-local progress.
5. Try claiming again; the server must deny a duplicate.
6. Verify the XP history in Profile, and the Level/Unlock status; optionally restart the backend and repeat the read.
7. Test a Learn module: its module count and XP must update together. Test gig apply/withdraw and avatar save from both sessions.
8. Test Night/Light mode toggle and persistence (that preference is *intentionally* per-browser).
9. Verify educator and employer accounts still have distinct role permissions.

New backend tests verify account-scoped ledger access, course progress, and avatar compatibility. Run `cd backend && npm test` to see their results. The previously supplied screenshot of **39/39 passing tests** applies to the preceding backend revision, not automatically to these new additions.

## Source map

- `src/StudentContext.jsx`: API-backed student state (no local XP storage)
- `src/api.js`: authenticated API requests
- `src/Earn.jsx`: activity list, server claim and gig application UI
- `src/Learn.jsx`: course/module UI, server-awarded XP
- `src/App.jsx`: auth-protected role routing and visual theme switch
- `backend/src/routes/student.js`: XP ledger, courses, activity claim, avatar, gigs, diary
- `backend/src/db.js`: SQL schema and lightweight migration
- `backend/src/seed.js`: local demonstration accounts, initial XP and course examples
- `backend/src/xp.js`: original authoritative XP and anti-farming rules (unchanged)
- `backend/test/api.test.js`: original tests plus integration regression tests

## Unfinished / not production-ready

- SQLite is a sandbox store; the original sponsor brief identifies MySQL and AWS integration for deployment.
- Dashboard skills, sample certificate examples and any demonstration course/catalogue metadata are illustrative; they are not client-verified records.
- Local UX and full end-to-end flows require retesting after the updated package install.
- The educator marking rubric is explicitly a placeholder pending stakeholder confirmation.
- Sponsor sign-off and actual deployment are not evidenced.
- Root npm packages and CVE status require the live npm audit noted above.

See the accompanying final handover report for architecture, testing evidence, known limitations and transition actions.
