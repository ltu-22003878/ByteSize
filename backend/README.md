# Alumable gamification engine: backend API

Activity -> XP -> level -> unlock. An Express API with a SQLite database, built to sit behind Aashmi's React site (`alumable-website`).

## Run it

You need Node 22.13 or newer (check with `node -v`). There is nothing to compile.

```
npm install
cp .env.example .env      # Windows: copy .env.example .env
npm start
```

The API listens on http://localhost:4000. The first start creates `data/alumable.db` and fills it with the demo activities and gigs from the prototype. Check it with http://localhost:4000/api/health.

Run the tests (they use a throwaway in-memory database, so your data is safe):

```
npm test
```

## Demo accounts

| Role | Email | Password |
|---|---|---|
| Student | priya@example.com | student-demo-1 |
| Educator | educator@example.com | educator-demo-1 |

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
| GET | /api/me | Profile, XP total, level, progress, unlocks, avatar |
| GET | /api/activities | Active activities with the student's claim status |
| POST | /api/activities/:id/claim | Claim an activity. Instant XP, or `pending` if it needs marking (send `{evidence}`). A second claim returns 409. |
| GET | /api/gigs | Gigs with the student's application status |
| POST | /api/gigs/:id/apply | Apply. Returns 409 if the student already holds a gig. |
| POST | /api/gigs/:id/withdraw | Give up the current gig |
| GET / PUT | /api/me/avatar | Read or save the avatar. Locked items return 403. |
| GET / POST | /api/diary | List own entries, or add `{body, shared}` (private by default) |
| PUT | /api/diary/:id/share | `{shared: true or false}` |

**Educator and employer**

| Method | Path | What it does |
|---|---|---|
| GET | /api/educator/rubric | The marking rubric: five weighted criteria with a written description for each score from 0 to 4 (placeholder until Scott confirms) |
| POST | /api/educator/activities | Create an activity `{title, xp, description?, duration?, requiresMarking?}` |
| PUT | /api/educator/activities/:id | Edit an activity |
| GET | /api/educator/claims?status=pending | Claims waiting to be marked |
| POST | /api/educator/claims/:id/mark | `{decision: "approve" or "reject", marks: [{criterion: <rubric id>, score 0-4, comment?}]}`. Every criterion must be scored once. The response includes the weighted score out of 100. Approving awards the XP. |
| GET | /api/educator/students/:id/diary | Only the entries the student shared |
| POST | /api/educator/gig-applications/:id/complete | Confirm a gig is finished |

Errors are always `{ "error": "message" }`. Status codes: 400 bad input, 401 not signed in, 403 wrong role or item locked, 404 not found, 409 conflict (already claimed, one gig at a time), 429 too many requests.

## Project layout

```
src/xp.js            XP and level rules (pure functions, no database)
src/db.js            Schema and helpers
src/seed.js          Demo data from the prototype
src/auth.js          Register, login, token and role checks
src/routes/student.js
src/routes/educator.js
src/app.js           Wires it together, rate limits, error handling
test/                Unit and API tests
docs/DECISIONS.md    Decision log (start of the Handover Report's justification)
```

## Connecting the React site

The site currently keeps state in `AppStateContext.jsx` and `mockData.js`. To switch it to this API, replace the mock reads with `fetch("http://localhost:4000/api/...")` calls carrying the token. CORS already allows http://localhost:5173 (change `CORS_ORIGIN` in `.env` if the site runs elsewhere).

## Not done yet

- Messages are not saved. They stay mock and must be listed under limitations.
- Educator criteria are placeholders until Scott answers.
- Not deployed. Hosting is still to be decided (see `docs/DECISIONS.md`).
- The React site is not wired to the API yet.
- Demo student starts at 0 XP, whereas the prototype's Priya starts at 1250.
