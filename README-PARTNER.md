# Alumable Partner Portal

Run the backend and frontend in **separate terminals**.

Terminal 1:
```powershell
cd backend
npm install
npm start
```

Terminal 2 (from the project root):
```powershell
npm install
npm run dev
```

Open http://localhost:5173/partner/login. API is http://localhost:4000/api. Set `VITE_API_URL=http://localhost:4000` in a root `.env` file if using a different API host.

Demo educator: educator@example.com / educator-demo-1
Demo employer: employer@example.com / employer-demo-1
Demo student: priya@example.com / student-demo-1 (student API account, not a partner role).

The partner portal authenticates against the real API using bearer tokens. The backend has one additional read-only `GET /api/educator/activities` route to populate the assignment picker; all original routes remain.

**Awaiting Dersima's endpoints:** posting gigs and listing applicants are not available in this backend. The portal offers the existing complete-application endpoint with a manual application ID. The existing student UI is still a separate local demo; it has not been converted to use the API.
