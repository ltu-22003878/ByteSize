# Post-upgrade verification checklist — run on the team's Mac

The prior release had 39/39 backend tests passing. This release adds backend endpoints and regression tests; do not copy that result to this release until rerun.

- [ ] `cd backend && npm ci && npm test` — capture count, failures, time.
- [ ] `npm install && npm run build && npm test` — capture output.
- [ ] `npm audit --audit-level=high` — capture actual finding or zero-vulnerability result.
- [ ] `curl http://localhost:4000/api/health` — returns `{"ok":true}`.
- [ ] Student login in normal and Incognito sessions — same backend seed XP.
- [ ] Claim daily check-in in first window; refresh second — same updated XP.
- [ ] Repeated claim is denied; daily progress and ledger match.
- [ ] A Learn module increments course progress and XP atomically.
- [ ] Avatar and gig application changes appear in both sessions.
- [ ] Student diary privacy and educator/ employer permissions pass.
- [ ] Light and Night modes remain usable and selected appearance persists on refresh.
- [ ] Sponsor reviews rubric, hosting target, and signs off on delivery.

**Do not submit as verified** until evidence is attached against the relevant checkbox.
