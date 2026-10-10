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

## 4. One claim per student per activity, enforced in the database (Sat 10 Oct)
- A `UNIQUE (user_id, activity_id)` constraint on `claims` means a double claim fails even if two requests arrive at the same moment. The API turns that into a 409 response.

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
- Other limits: XP per activity is capped at 500, request bodies at 10 KB, and diary entries at 5,000 characters.
- Every claim, mark, login and gig action writes to `audit_log`.
- **Limitation:** limits are per IP address. Several students behind one campus network would share a limit.

## Open
- Hosting: which host, whose account, any budget (confirm after the Scrum presentation).
- Whether the 14 Oct session is the marked Assessment 4 presentation, and its time.
- Educator criteria from Scott.
