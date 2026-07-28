# 🐄 Usman Dairy Farm — Management System

A full-stack dairy farm management app for tracking cows, milk production, expenses, health records, and profitability — built for real day-to-day farm operations.

**Live app:** https://dairymanager--usman5911.replit.app

---

## Features

- **Dashboard** — total cows, today's milk, monthly P&L, milk rate, 14-day production trend, health alerts, top producer
- **Cows** — add/edit/track cows (breed, status, lactation, calving, pregnancy, weight)
- **Milk** — log daily morning/evening milk with duplicate-entry protection, filter by cow/date range
- **Expenses** — track feed, medicine, labor, equipment, and misc costs per cow
- **Health** — vaccinations, treatments, checkups, deworming, with upcoming/overdue reminders
- **Buyers** — manage milk buyers and default rates
- **Reports** — revenue vs. expenses, cow productivity ranking, monthly trends, and Cow/Bull/Calf average cost metrics
- **Settings** — animated settings center for profile, admin/worker user management, milk rates, buyers, email, backup & restore
- **Auth** — JWT-based login with admin/worker roles, SMTP email password reset for admins, and account management

---

## Reports: Animal Category Metrics

The Reports tab groups non-sold animals into **Cow 🐄**, **Bull 🐂**, and **Calf 🐮** categories:

- **Calf** — `isCalf === true` or `status === 'calf'`
- **Bull** — `gender === 'male'`, unless already classified as a calf
- **Cow** — all remaining non-sold animals

For each category, the app shows:

- **Avg Cost / Animal** — average direct assigned expenses per animal: feed, medicine, labor, equipment, and misc. One-time purchasing expenses and farm-wide/unassigned expenses are excluded.
- **Avg Feed / Animal** — average assigned feed expense per animal.
- **Avg Milk / Cow** — Cow group only; total milk divided by all cows in the selected period, including cows with zero milk.

---

## Tech Stack

- **Frontend:** React 18, TypeScript, Vite 5, Tailwind CSS v4, Recharts, Lucide Icons
- **Backend:** Express.js, Mongoose (MongoDB), JWT authentication, bcrypt password hashing
- **Deployment:** Replit (Autoscale)

---

## Project Structure

```
dairy_manager/
├── backend/
│   ├── routes/          # auth, cows, milk, expenses, health, buyers, rates, backup
│   ├── middleware/       # JWT auth (protect, adminOnly)
│   ├── db.js              # Mongoose schemas & connection
│   ├── server.js          # Express entry point
│   └── migrate.js         # one-time db.json → MongoDB migration script
├── client/
│   ├── src/
│   │   ├── components/    # Login, Dashboard, CowsTab, MilkTab, ExpensesTab, HealthTab, ReportsTab, SettingsTab
│   │   ├── api.ts          # all API calls + auth token handling
│   │   └── types.ts        # shared TypeScript types
│   └── vite.config.ts
└── replit.md
```

---

## Getting Started Locally

### 1. Clone the repo
```bash
git clone https://github.com/musman5911/dairy_manager.git
cd dairy_manager
```

### 2. Backend setup
```bash
cd backend
npm install
```

Create a `.env` file in `backend/` (never commit this — it's already gitignored):
```
MONGO_URI=your_mongodb_atlas_connection_string
JWT_SECRET=your_random_secret_string
PORT=3000

# Optional: admin password reset by email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_gmail_app_password
APP_URL=http://localhost:5000
```

Start the backend:
```bash
npm run dev
```

### 3. Frontend setup
```bash
cd ../client
npm install
npm run dev
```
The dev server runs on port 5000 and proxies `/api` requests to the backend on port 3000.

### 4. First-time setup
On first load, the app will prompt you to create the initial admin account — no need to seed one manually.

---

## Production Build

```bash
cd client && npm install && npm run build
cd ../backend && npm install && NODE_ENV=production node server.js
```
Express serves the built frontend from `client/dist/` and handles all `/api/*` routes on the same port.

---

## Environment Variables

| Variable      | Description                              |
|---------------|-------------------------------------------|
| `MONGO_URI`   | MongoDB Atlas connection string            |
| `JWT_SECRET`  | Secret used to sign JWT auth tokens        |
| `JWT_EXPIRES_IN` | Optional JWT session lifetime; defaults to `7d` |
| `PORT`        | Port the backend server listens on         |
| `SMTP_HOST`   | SMTP server host for password reset emails |
| `SMTP_PORT`   | SMTP server port, usually `465` or `587`   |
| `SMTP_SECURE` | `true` for port 465, usually `false` for 587 |
| `SMTP_USER`   | SMTP username/email address                |
| `SMTP_PASS`   | SMTP password or Gmail app password        |
| `MAIL_FROM` / `SMTP_FROM` | Optional sender address/name    |
| `APP_URL`     | App URL shown in password reset emails     |
| `EMAIL_TO`    | Optional daily summary recipient(s)        |
| `FRONTEND_URL` | Production frontend URL used to restrict CORS, e.g. `https://dairymanager--usman5911.replit.app` |

---

## Security Notes

- `.env` is gitignored and must never be committed. Rotate credentials immediately if they're ever exposed.
- All write/admin routes are protected via JWT (`protect`) and role checks (`adminOnly`); `protect` also verifies the user still exists and is active on every request.
- Passwords are hashed with bcrypt before storage.
- A broad `/api` rate limiter protects authenticated data routes from leaked-token abuse or accidental script loops.
- In production, set `FRONTEND_URL` to the live app URL so CORS is restricted instead of falling back to `*`.
- The Vite dev server uses `allowedHosts: true` for local/Replit preview compatibility only; production is served by Express from `client/dist`.
- JWTs are stored in `localStorage`; avoid future rich-text/embedded-content features that could introduce XSS without sanitization.

---

## Known Issues

- **Resolved:** Dashboard "Today" widgets and cow table columns now use a separate always-fetched today dataset, so selecting a custom historical range no longer makes today's milk/expense values appear as `-`.

---

## License

Private project — all rights reserved.
