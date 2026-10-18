# Alumable Gamification Engine

CSE3CAP capstone project for Alumable (client: David Yip), La Trobe University, 2026.
Team: Sharis Mohamed, Dersima Avci, Aashmi Gurung.

Students earn XP for activities and marked work, level up, and unlock paid gigs.
Educators set and mark work in a partner portal; employers post gigs and choose students.
All XP rules are checked on the server and every award is stored in a ledger.

## What's in this repo

| Folder | What it is |
|---|---|
| `src/` | React + Vite website (student site and partner portal) |
| `backend/` | Node.js + Express + SQLite API (the gamification engine) |
| `backend/docs/DECISIONS.md` | Our decision log with options and trade-offs |
| `Handover/` | Handover report, architecture diagram and evidence screenshots |

## Run it locally

Requires Node.js 22.13 or newer.

Terminal 1 (API):

    cd backend
    npm ci
    cp .env.example .env
    npm start

Terminal 2 (website, from the project folder):

    npm install
    npm run dev

Then open http://localhost:5173. On a Mac you can double-click `start-mac.command` instead.

## Demo accounts (local only)

| Role | Email | Password |
|---|---|---|
| Student | priya@example.com | student-demo-1 |
| Educator | educator@example.com | educator-demo-1 |
| Employer | employer@example.com | employer-demo-1 |

## Tests

    cd backend && npm test        # 43 tests
    npx vitest run src            # 13 site tests (from the project folder)

## More detail

- **ARCADE-README.md** – full setup notes, tests and validation
- **System Maintenance Documentation** – architecture, installation, deployment plan, maintenance and open issues
- **User Documentation** – how students, educators and employers use the system

## Status

Working proof of concept on SQLite. Not yet deployed. The suggested AWS and MySQL plan, and the list of known issues, are in the System Maintenance Documentation.