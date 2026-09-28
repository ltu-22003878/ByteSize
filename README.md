# Alumable — Student Website Prototype

React + Vite website (student perspective only) with a mock database and a working XP engine.

## Run
```bash
npm install
npm run dev     
npm test        
```

## Structure
- `src/db.js` — mock database (users, levels, capabilities, activities, assignments, XP ledger, audit log, courses, gigs, messages)
- `src/xpEngine.js` — XP calculation, claim rules, level progression, unlocks, anti-farming guardrails
- `src/xpEngine.test.js` — unit tests
- `src/StudentContext.jsx` — DB in state, saved to localStorage
- `src/` page files: Home, Learn, Earn, Messages, Profile, About

Use "Reset demo data" on the Profile page to restore the seed data.
