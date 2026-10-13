# Alumable gamification engine: backend API

Activity -> XP -> level -> unlock. An Express API with a SQLite database, built to sit behind Aashmi's React site (the ByteSize repo). The levels, unlocks, activities and anti-abuse numbers are the ones in that site's `src/db.js`.

## Run it

You need Node 22.13 or newer (check with `node -v`). There is nothing to compile.

```
npm install
cp .env.example .env      # Windows: copy .env.example .env
npm start
```

The API listens on http://localhost:4000. The first start creates `data/alumable.db` and fills it with the same demo student, activities, gigs and assignments as the site. Check it with http://localhost:4000/api/health.

Run the tests (they use a throwaway in-memory database, so your data is safe):

```
npm test
```

## Demo accounts

| Role | Email | Password |
|---|---|---|
| Student (1,250 XP, level 4) | priya@example.com | student-demo-1 |
| Educator (Dr. Helen Lee) | educator@example.com | educator-demo-1 |
| Employer (Greenleaf Café) | employer@example.com | employer-demo-1 |

These are for local demos only. Change `JWT_SECRET` in `.env` before deploying anywhere.

## Endpoints

Send the token from login as `Authorization: Bearer <token>`.

**Public**

| Method | Path | What it does |
|---|---|---|
| GET | /api/health | Health check |
| POST | /api/auth/register | `{email, name, password}`: creates a student, returns a token |
| POST | /api/auth/login | `{email, password}`: returns a token and role |

**Student**

| Method | Path | What it does |
|---|---|---|
| GET | /api/me | Profile, XP total, level and progress, capabilities (each with `unlocked`), streak, XP earned today and the daily cap, avatar |
| GET | /api/activities | Active activities. Each has a `check`: `{ok: true, points}` if it can be claimed now, or `{ok: false, code, message}` if not (the site uses this to grey out buttons) |
| GET | /api/assignments | Work set for this student by an educator or employer, with the bonus XP |
| POST | /api/activities/:id/claim | Claim an activity. Optional `{assignmentId, evidence}`. Returns the XP awarded, the new total and level, whether they levelled up and what unlocked. If the activity needs marking it returns `pending` and no XP yet. |
| GET | /api/gigs | Gigs with the level they need and the student's application status |
| POST | /api/gigs/:id/apply | Apply. 403 if the level is too low, 409 if the student already holds a gig. |
| POST | /api/gigs/:id/withdraw | Give up the current gig |
| GET / PUT | /api/me/avatar | Read or save the avatar (same options as the site) |
| GET / POST | /api/diary | List own entries, or add `{body, shared}` (private by default) |
| PUT | /api/diary/:id/share | `{shared: true or false}` |

A refused claim returns `{error, code}`. Codes and statuses: `locked` 403, `already_claimed` 409, `daily_limit` 429, `cooldown` 429, `xp_cap` 429, `bad_assignment` 400, `evidence_required` 400, `not_found` 404.

**Educator and employer**

Educators can use everything below. Employers can only use students, assignments and gig completion.

| Method | Path | What it does |
|---|---|---|
| GET | /api/educator/students | Students with their level, to pick who to assign work to |
| POST | /api/educator/assignments | `{studentId, activityId, note?, dueDate?, bonusXp?}` (bonus 0 to 100). The student gets the bonus when they claim it. |
| GET | /api/educator/assignments | Assignments this person has set |
| GET | /api/educator/rubric | The marking rubric: five weighted criteria with a written description for each score from 0 to 4 (placeholder until Scott confirms) |
| POST | /api/educator/activities | Create an activity: `{title, baseXp, type?, dailyLimit?, cooldownMinutes?, requiresCapability?, requiresMarking?, description?, category?, duration?}` |
| PUT | /api/educator/activities/:id | Edit an activity. Changing `baseXp` is written to the audit log and never changes past awards. |
| GET | /api/educator/claims?status=pending | Claims waiting to be marked |
| POST | /api/educator/claims/:id/mark | `{decision: "approve" or "reject", marks: [{criterion: <rubric id>, score 0-4, comment?}]}`. Every criterion must be scored once. The response includes the weighted score out of 100. Approving awards the XP. Rejecting lets the student try again. |
| GET | /api/educator/students/:id/diary | Only the entries the student shared |
| GET | /api/educator/audit | The security log: refused claims, point changes, marks (latest 100) |
| POST | /api/educator/gig-applications/:id/complete | Confirm a gig is finished |

Errors are always `{ "error": "message" }`. Status codes: 400 bad input, 401 not signed in, 403 wrong role or item locked, 404 not found, 409 conflict (already claimed, one gig at a time), 429 too many requests.

## Project layout

```
src/xp.js            Levels, capabilities and claim rules (pure functions, no database)
src/db.js            Schema and helpers
src/seed.js          Demo data copied from the site's src/db.js
src/auth.js          Register, login, token and role checks
src/routes/student.js
src/routes/educator.js
src/app.js           Wires it together, rate limits, error handling
test/                Unit and API tests
docs/DECISIONS.md    Decision log (start of the Handover Report's justification)
```

## Connecting the React site

The site keeps its state in `src/StudentContext.jsx` and `src/db.js`, and its rules in `src/xpEngine.js`. To switch it to this API, replace those reads and writes with `fetch("http://localhost:4000/api/...")` calls carrying the token. CORS already allows http://localhost:5173 (change `CORS_ORIGIN` in `.env` if the site runs elsewhere).

## What the site has that the API does not (yet)

The API covers levels, capabilities, activities and claims, assignments, gigs, the avatar and the diary. These parts of the site still run on its own mock data:

- Learn courses, module progress and certificates (the API has the `learn_module` activity, but not the course list).
- Profile details such as university, skills and interests, and the referral code.
- Messages. They stay mock and must be listed under limitations.

## Differences from the site's own rules

These are deliberate. They are written up in `docs/DECISIONS.md` (decisions 10 to 12).

- **Streak:** the site only ever adds one, so it never resets. The API counts consecutive days and resets to zero after a missed day.
- **One gig at a time:** the site lets a student apply to several. The API refuses the second (team decision, Sat 10 Oct).
- **Avatar:** the site's avatar has no level locks, so the API has none either.
- **Educator marking and the audit log** are additions. The site has no educator side.

## Not done yet

- Educator criteria are placeholders until Scott answers.
- Not deployed. Hosting is still to be decided (see `docs/DECISIONS.md`).
- The React site is not wired to the API yet.
- The demo streak shows 0 even though the site's seed says 7, because the last seeded check-in was on 27 Sep and a streak resets after a missed day.
