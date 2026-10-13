# Decision log

One entry per decision, written when it is made. Each entry has the options considered, the reason, and the trade-off. Add to this file as the team decides things; it feeds the Design and Technical Justification section of the Handover Report.

## 1. Stack: Node.js + Express (Sat 10 Oct)
- **Options:** Laravel (PHP) with MySQL as named in the original brief; Node + Express; Python (Flask or FastAPI).
- **Decision:** Node + Express. The front end is already React, so the team uses one language end to end, and the brief allows Node as an option.
- **Trade-off:** Laravel gives more built-in features (auth, migrations) but nobody on the team has confirmed PHP experience, so the learning cost falls in the final week.
- **Status:** Confirm with Scott that a justified stack is acceptable.

## 2. Database: SQLite for development, portable SQL for deployment (Sat 10 Oct)
- **Options:** MySQL (named in the brief), Postgres, SQLite.
- **Decision:** SQLite through Node's built-in `node:sqlite`. It needs no database server and no native add-on, so all three of us can run the API in one command. The schema uses plain SQL so it can move to MySQL or Postgres.
- **What went wrong first:** the first version used the `better-sqlite3` package. It failed to install on Node 26 (macOS, Apple silicon) because it had no prebuilt binary and its C++ code does not compile against Node 26. We switched to the built-in module, which removes the install risk entirely.
- **Trade-off:** SQLite is a single-file database and is not what a production deployment of this size would normally use. `node:sqlite` needs Node 22.13 or newer and is still marked experimental in some Node versions. Moving to MySQL means changing `AUTOINCREMENT`, `datetime('now')` and the connection code in `src/db.js`.
- **Status:** Revisit once hosting is confirmed.

## 3. XP is a ledger, not a number (Sat 10 Oct)
- **Options:** store `xp_total` on the user row; store every change as a row and sum.
- **Decision:** ledger table `xp_ledger`. A student's total is the sum of their rows.
- **Reason:** every change has a reason and a timestamp, so XP can be audited, and nothing can set a total directly.
- **Trade-off:** a sum on every read. Fine at this scale; cache the total if it ever matters.

## 4. Once-only claims are enforced in the database (Sat 10 Oct, revised Sun 11 Oct)
- The first version allowed one claim per student per activity. The site's activities are not all like that: some are one-time, some daily, some repeatable with a daily limit. So `claims` now has two optional keys. A one-time activity stores `once_key`, a daily one stores `daily_key` (activity plus day), and each has a `UNIQUE` constraint with the student. A double claim of a one-time or daily activity therefore fails in the database even if two requests arrive together, and the API turns that into a 409. Repeatable activities leave the keys empty, so their daily limit is checked by the rules in `src/xp.js` instead.
- Rejecting a marked claim clears its keys so the student can resubmit.

## 5. Gig rule: one gig at a time (Sat 10 Oct)
- **Options:** one gig per student; up to three at once.
- **Decision:** one at a time. The check and the insert run in one transaction.
- **Trade-off:** simpler and harder to abuse, but less realistic for a marketplace. Raising the limit later is a one-line change in `src/routes/student.js`.

## 6. Educator marking uses placeholder criteria (Sat 10 Oct)
- David left the educator side open and pointed us to Scott. Until Scott answers, `/api/educator/rubric` returns a placeholder rubric and says so in the response. It has five weighted criteria (brief 30, quality of work 25, client communication 20, time and scope 15, reflection 10), each scored 0 to 4 against a written description of what that level looks like. Marking requires a score for every criterion and returns a weighted result out of 100. The report must label all of this as an assumption.

## 7. Messages stay mock (Sat 10 Oct)
- Messaging is not saved in the database. The manual and the report list it under known limitations.

## 8. Sign-in and roles (Sat 10 Oct)
- JWT bearer tokens that expire after two hours, passwords hashed with bcrypt.
- Only students can register themselves. Educator and employer accounts are created by an administrator (see `src/seed.js`), so nobody can choose their own role.
- Login returns the same error for an unknown email and a wrong password.

## 9. Anti-abuse limits are on the server (Sat 10 Oct)
- Rate limits: 300 requests per 15 minutes per IP overall, 20 login or register attempts per 15 minutes, 20 claims per minute.
- Other limits: XP per activity is capped at 1,000 (the site's rule), a student can earn at most 500 XP a day, request bodies are capped at 10 KB, and diary entries at 5,000 characters.
- Every claim, mark, login and gig action writes to `audit_log`.
- **Limitation:** limits are per IP address. Several students behind one campus network would share a limit.

## 10. The site is the source of truth for the rules (Sun 11 Oct)
- The first backend used thresholds and unlocks from an older copy of the prototype (six levels, avatar items unlocked by level). When the ByteSize repo was checked, its numbers were different, and Aashmi confirmed she had no unpushed changes, so the backend was changed to match the repo: five levels (0, 250, 600, 1,000, 2,000 XP), four capabilities that unlock at levels 2 to 5, eight activities with types and daily limits, a streak bonus of 3 XP per day capped at 5 days, a daily XP cap of 500, and assignments with bonus XP.
- **Trade-off:** the avatar no longer has level locks because the site has none. If the team wants avatar unlocks back, it is a small change, but it is a product decision, not a backend one.

## 11. A day means the Melbourne day (Sun 11 Oct)
- Daily limits and the daily XP cap reset at midnight in `DAY_TZ` (default `Australia/Melbourne`), not at midnight on the server. Without this, a server running in UTC would reset everything at 11am Melbourne time.
- **Limitation:** one time zone for everyone. A student travelling would see the Melbourne day.

## 12. Where the API deliberately differs from the site (Sun 11 Oct)
- **Streak resets.** The site adds one to the streak on every check-in and never resets it, so a student who skips a month keeps their streak. The API counts consecutive days, so a missed day sets it back to zero.
- **One gig at a time** (decision 5), where the site allows several.
- **Educator-approved XP is not held back by the daily cap.** The cap stops farming of instant activities. XP an educator awards after marking is a person's judgement of real work, so it is paid in full.
- **Assignment bonuses are limited to 100 XP.** The site has no limit; an unlimited bonus would let one account hand out any amount of XP.
- **Marking is off by default.** None of the seeded activities need marking, because the site awards XP instantly. An educator can turn marking on for any activity with `requiresMarking: true`. Which activities should need marking depends on Scott's answer.

## Open
- Hosting: which host, whose account, any budget (confirm after the Scrum presentation).
- Whether the 14 Oct session is the marked Assessment 4 presentation, and its time.
- Educator criteria from Scott.
- Whether the team wants avatar unlocks by level (the site has none).
- The site lets a student earn an activity worth up to 1,000 XP but caps a day at 500, so an activity above 500 XP could never be claimed. Dersima to decide whether the limit on a single activity should be lowered.
